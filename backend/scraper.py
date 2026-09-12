import re
import asyncio
import httpx
import logging
from urllib.parse import urlparse
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright

log = logging.getLogger(__name__)

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
FAKE_EMAILS = re.compile(
    r"(example|domain|test|placeholder|yourname|youremail|noreply|no-reply"
    r"|user@domain|name@|sentry|wixpress|schema|googleapis|w3\.org"
    r"|cloudflare|jquery|bootstrap|wordpress|drupal|@2x|@3x)",
    re.I,
)
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}
CONCURRENCY = 5
EMAIL_CONCURRENCY = 10
CONTACT_PATHS = ["/", "/contact", "/contact-us", "/contacts", "/about", "/about-us", "/reach-us", "/get-in-touch"]


def build_maps_url(keyword: str, location: str, category: str, open_now: bool) -> str:
    query = f"{category} {keyword}".strip() if category else keyword
    if location:
        query = f"{query} in {location}"
    url = f"https://www.google.com/maps/search/{query.replace(' ', '+')}"
    if open_now:
        url += "?tbs=opnow:1"
    return url


def extract_emails_from_html(html: str) -> list[str]:
    mailto = re.findall(r'mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})', html)
    text = EMAIL_RE.findall(html)
    seen = set()
    result = []
    for e in mailto + text:
        if e in seen:
            continue
        seen.add(e)
        if (
            not e.endswith((".png", ".jpg", ".gif", ".svg", ".webp", ".js", ".css"))
            and not FAKE_EMAILS.search(e)
            and "." in e.split("@")[-1]
            and len(e) < 80
        ):
            result.append(e)
    return result


async def fetch_html(client: httpx.AsyncClient, url: str) -> str:
    try:
        r = await client.get(url, timeout=12, follow_redirects=True)
        if r.status_code == 200:
            return r.text
    except Exception:
        pass
    return ""


async def scrape_email_from_website(url: str, client: httpx.AsyncClient) -> str:
    if not url:
        return ""
    parsed = urlparse(url if url.startswith("http") else "https://" + url)
    root = f"{parsed.scheme}://{parsed.netloc}"

    # Build list of pages to check — root + subpage (if different) + contact paths
    pages = []
    if parsed.path in ("", "/"):
        pages.append(root + "/")
    else:
        pages.append(root + "/")       # root first
        pages.append(url)              # then the specific subpage

    for path in CONTACT_PATHS[1:]:    # skip "/" already added
        candidate = root + path
        if candidate not in pages:
            pages.append(candidate)

    # Fetch all pages concurrently
    htmls = await asyncio.gather(*[fetch_html(client, p) for p in pages])

    for html in htmls:
        if html:
            emails = extract_emails_from_html(html)
            if emails:
                return emails[0]
    return ""


async def scrape_emails_parallel(websites: list[str]) -> list[str]:
    sem = asyncio.Semaphore(EMAIL_CONCURRENCY)
    async with httpx.AsyncClient(headers=HEADERS, timeout=15) as client:
        async def fetch(url):
            async with sem:
                return await scrape_email_from_website(url, client)
        return await asyncio.gather(*[fetch(w) for w in websites])


async def extract_text(page, selector: str) -> str:
    try:
        el = await page.query_selector(selector)
        return (await el.inner_text()).strip() if el else ""
    except Exception:
        return ""


async def fetch_place_details(ctx, href: str) -> dict:
    page = await ctx.new_page()
    details = {"phone": "", "address": "", "website": "", "category": "", "rating": "", "reviews": ""}
    try:
        full_url = f"https://www.google.com{href}" if href.startswith("/") else href
        await page.goto(full_url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(2500)

        # Rating
        details["rating"] = await extract_text(page, 'div.F7nice span[aria-hidden="true"]')

        # Reviews — from aria-label on ceNzKf span
        try:
            label = await page.evaluate(
                "() => { const el = document.querySelector('span.ceNzKf'); return el ? el.getAttribute('aria-label') : ''; }"
            )
            if label:
                m = re.search(r"([\d,]+)\s+review", label)
                details["reviews"] = m.group(1).replace(",", "") if m else ""
        except Exception:
            pass

        # Fallback reviews
        if not details["reviews"]:
            raw = await extract_text(page, 'span[aria-label*="review"]')
            if raw:
                m = re.search(r"[\d,]+", raw)
                details["reviews"] = m.group().replace(",", "") if m else ""

        details["category"] = await extract_text(page, 'button[jsaction*="category"]')
        details["address"] = await extract_text(page, 'button[data-item-id="address"]')
        details["phone"] = await extract_text(page, 'button[data-item-id^="phone"]')

        web_el = await page.query_selector('a[data-item-id="authority"]')
        if web_el:
            details["website"] = (await web_el.get_attribute("href") or "").strip()

    except Exception:
        pass
    finally:
        await page.close()
    return details


async def scrape_google_maps(
    keyword: str = "",
    location: str = "",
    category: str = "",
    min_rating: float = 0,
    open_now: bool = False,
    page: int = 1,
    results_per_page: int = 25,
    maps_url: str = "",
) -> list[dict]:
    url = maps_url.strip() if maps_url.strip() else build_maps_url(keyword, location, category, open_now)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
        )
        map_page = await ctx.new_page()
        try:
            await map_page.goto(url, wait_until="domcontentloaded", timeout=60000)
        except Exception as e:
            log.error("Failed to load Maps URL %s: %s", url, e)
            await browser.close()
            raise RuntimeError(f"Could not load Google Maps. Check your URL or internet connection.")

        try:
            await map_page.click('button:has-text("Accept all")', timeout=3000)
        except Exception:
            pass

        try:
            await map_page.wait_for_selector('div[role="feed"]', timeout=30000)
        except Exception:
            log.warning("Feed selector not found — page may not be a Maps search results page")
            await browser.close()
            raise RuntimeError("No results feed found. Make sure the URL is a Google Maps search results page.")

        # Scroll until we have enough results
        target = results_per_page * page
        feed = await map_page.query_selector('div[role="feed"]')
        prev_count = 0
        stall = 0
        while True:
            await feed.evaluate("el => el.scrollBy(0, 1000)")
            await map_page.wait_for_timeout(1200)
            cards = await map_page.query_selector_all('div[role="feed"] > div > div > a')
            count = len(cards)
            if count >= target:
                break
            if await map_page.query_selector('span:has-text("You\'ve reached the end")'):
                break
            stall = stall + 1 if count == prev_count else 0
            if stall >= 4:
                break
            prev_count = count

        html = await map_page.content()

        soup = BeautifulSoup(html, "html.parser")
        feed_div = soup.find("div", {"role": "feed"})
        if not feed_div:
            await browser.close()
            return []

        # Deduplicate cards by href
        seen_hrefs = set()
        unique_cards = []
        for c in feed_div.find_all("a", href=re.compile(r"/maps/place/")):
            href = c.get("href", "")
            if href not in seen_hrefs:
                seen_hrefs.add(href)
                unique_cards.append(c)

        start = (page - 1) * results_per_page
        page_cards = unique_cards[start: start + results_per_page]

        businesses = []
        for card in page_cards:
            text_blocks = [s.get_text(strip=True) for s in card.find_all(["span", "div"]) if s.get_text(strip=True)]
            name = card.get("aria-label", "") or (text_blocks[0] if text_blocks else "")

            rating, reviews = "", ""
            for t in text_blocks:
                if not rating and re.match(r"^\d\.\d$", t):
                    rating = t
                if not reviews and re.match(r"^\(([\d,]+)\)$", t):
                    reviews = re.match(r"^\(([\d,]+)\)$", t).group(1).replace(",", "")

            # Only apply min_rating filter when rating is known AND filter is set
            if min_rating > 0 and rating:
                try:
                    if float(rating) < min_rating:
                        continue
                except ValueError:
                    pass

            businesses.append({
                "name": name,
                "rating": rating,
                "reviews": reviews,
                "href": card.get("href", ""),
                "website": "",
                "phone": "",
                "address": "",
                "category": category,
                "email": "",
            })

        # Fetch all detail pages in parallel
        sem = asyncio.Semaphore(CONCURRENCY)

        async def fetch_with_sem(biz):
            async with sem:
                details = await fetch_place_details(ctx, biz["href"])
            biz.update({
                "phone": details["phone"],
                "address": details["address"],
                "website": details["website"],
                "category": details["category"] or biz["category"],
                "rating": details["rating"] or biz["rating"],
                "reviews": details["reviews"] or biz["reviews"],
            })
            return biz

        businesses = list(await asyncio.gather(*[fetch_with_sem(b) for b in businesses]))
        await browser.close()

    # Scrape emails in parallel
    emails = await scrape_emails_parallel([b.get("website", "") for b in businesses])
    for biz, email in zip(businesses, emails):
        biz["email"] = email
        biz.pop("href", None)

    return businesses
