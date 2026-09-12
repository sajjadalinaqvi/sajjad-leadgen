import re
import asyncio
import httpx
import os
import warnings
import logging
from urllib.parse import urlencode, urlparse, unquote_plus
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup

warnings.filterwarnings("ignore", message="Unverified HTTPS request")
log = logging.getLogger(__name__)

RESULTS_PER_PAGE = 25
CONCURRENCY = 5
USER_DATA_DIR = os.path.expanduser("~/.scraper_browser_profile")

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
# Universal international phone regex — worldwide coverage
PHONE_RE = re.compile(
    # International with + prefix: +1-206-684-8950, +92-51-922 4101, +49 (30) 285 34-0
    r'\+\d{1,3}[\s\-.()]?(?:\(?\d{1,4}\)?[\s\-.]?)?\d{2,4}[\s\-.]\d{2,4}(?:[\s\-.]\d{1,4})?'
    # US/Canada with parens: (206) 684-8950
    r'|\(\d{3}\)[\s\-.]\d{3}[\s\-.]\d{4}'
    # Local with leading 0 + multiple separators: 042-3798-0052, 0321-948-4072
    r'|\b0\d{2,4}[\s\-.]\d{3,4}[\s\-.]\d{3,4}'
    # Local mobile space-separated: 0321 9484072 (exactly 4+7 digits)
    r'|\b0\d{3} \d{7}\b'
    # Local compact with dash/dot: 042-37980052, 0321-9484072
    r'|\b0\d{2,3}[\-.]\d{7,8}'
    # US local without parens: 206 682-7770, 212-229-6000
    r'|\b\d{3}[\s\-.]\d{3}[\s\-.]\d{4}\b'
)
FAKE_EMAILS = re.compile(
    r"(example|domain|test|placeholder|noreply|no-reply|sentry|wixpress|schema|googleapis|w3\.org|cloudflare|jquery|bootstrap|johnsmith|john\.smith|jane\.doe|janedoe|johndoe|info@info|admin@admin|user@user)",
    re.I,
)
GIT_EMAIL = re.compile(r"^git@|@hf\.co$|@github\.com$|@gitlab\.|@gitee\.|@git\.", re.I)
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}


# ── Helpers ──────────────────────────────────────────────────────────────────

def build_google_url(query: str, page: int, num: int = RESULTS_PER_PAGE) -> str:
    params = {"q": query, "start": (page - 1) * num, "num": num}
    return f"https://www.google.com/search?{urlencode(params)}"


def inject_page_param(url: str, page: int, num: int = RESULTS_PER_PAGE) -> str:
    start = (page - 1) * num
    url = re.sub(r"[&?]start=\d+", "", url)
    sep = "&" if "?" in url else "?"
    return f"{url}{sep}start={start}"



def extract_emails(html: str) -> list[str]:
    mailto = re.findall(r'mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})', html)
    text = EMAIL_RE.findall(html)
    seen, result = set(), []
    for e in mailto + text:
        if e in seen or len(e) > 80:
            continue
        seen.add(e)
        if (
            not e.endswith((".png", ".jpg", ".gif", ".svg", ".webp", ".js", ".css"))
            and not FAKE_EMAILS.search(e)
            and not GIT_EMAIL.search(e)
            and "." in e.split("@")[-1]
        ):
            result.append(e)
    return result


def extract_phones(text: str) -> list[str]:
    phones, seen = [], set()
    for match in PHONE_RE.finditer(text):
        p = match.group().strip()
        digits = re.sub(r"\D", "", p)
        if not (7 <= len(digits) <= 15):
            continue
        if digits not in seen:
            seen.add(digits)
            phones.append(p)
    return phones[:3]


def extract_address(soup: BeautifulSoup) -> str:
    for el in soup.find_all(["span", "div", "p", "address"]):
        text = el.get_text(strip=True)
        if re.search(r"\d{1,5}\s+\w+\s+(St|Ave|Rd|Blvd|Dr|Ln|Way|Pl|Court|Ct|Street|Avenue|Road)\b", text, re.I):
            if len(text) < 200:
                # Strip embedded phone numbers from address
                clean = re.sub(
                    r'(?:\+\d{1,3}[\s\-.()]?)?(?:\(?\d{3}\)[\s\-.])?\d{3}[\s\-.]\d{4}',
                    '', text
                ).strip()
                return clean
    return ""


async def deep_scrape_url(url: str, client: httpx.AsyncClient) -> dict:
    info = {"email": "", "phone": "", "address": "", "description": ""}
    try:
        r = await client.get(url, timeout=12, follow_redirects=True)
        if r.status_code != 200:
            return info
        html = r.text
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()
        plain_text = soup.get_text(" ", strip=True)

        parsed = urlparse(url)
        root = f"{parsed.scheme}://{parsed.netloc}"

        # Emails — try current page first, then contact pages
        emails = extract_emails(html)
        if not emails:
            for path in ["/contact", "/contact-us", "/about"]:
                try:
                    r2 = await client.get(root + path, timeout=8, follow_redirects=True)
                    emails = extract_emails(r2.text)
                    if emails:
                        break
                except Exception:
                    continue
        info["email"] = emails[0] if emails else ""

        # Phone — try current page, then homepage, then contact page
        info["phone"] = (extract_phones(plain_text) or [""])[0]

        # Also check address-like elements for embedded phones (e.g. "227 Westlake Ave Seattle 206 682-7770")
        if not info["phone"]:
            for el in soup.find_all(["address", "div", "p", "span"]):
                t = el.get_text(" ", strip=True)
                if re.search(r"\d{1,5}\s+\w+\s+(St|Ave|Rd|Blvd|Dr|Ln|Way|Street|Avenue|Road)\b", t, re.I):
                    phones = extract_phones(t)
                    if phones:
                        info["phone"] = phones[0]
                        break

        if not info["phone"] and parsed.path not in ("", "/"):
            for fallback in [root + "/", root + "/contact", root + "/contact-us"]:
                try:
                    rf = await client.get(fallback, timeout=8, follow_redirects=True)
                    soup_f = BeautifulSoup(rf.text, "html.parser")
                    for tag in soup_f(["script", "style", "noscript"]):
                        tag.decompose()
                    phones = extract_phones(soup_f.get_text(" ", strip=True))
                    if phones:
                        info["phone"] = phones[0]
                        break
                except Exception:
                    continue

        # Address — try current page, then homepage
        info["address"] = extract_address(soup)
        if not info["address"] and parsed.path not in ("", "/"):
            try:
                rh = await client.get(root + "/", timeout=8, follow_redirects=True)
                soup_h = BeautifulSoup(rh.text, "html.parser")
                info["address"] = extract_address(soup_h)
            except Exception:
                pass

        # Description
        meta = soup.find("meta", {"name": "description"}) or soup.find("meta", {"property": "og:description"})
        if meta and meta.get("content"):
            info["description"] = meta["content"][:300]
        else:
            for p_tag in soup.find_all("p"):
                t = p_tag.get_text(strip=True)
                if len(t) > 80:
                    info["description"] = t[:300]
                    break
    except Exception:
        pass
    return info


# ── Search backends ───────────────────────────────────────────────────────────

async def search_via_google_url(url: str) -> tuple[list[dict], str | None]:
    """Scrape a pasted Google search URL using persistent Playwright context."""
    async with async_playwright() as p:
        ctx = await p.chromium.launch_persistent_context(
            user_data_dir=USER_DATA_DIR,
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--window-size=1366,768",
            ],
            user_agent=HEADERS["User-Agent"],
            viewport={"width": 1366, "height": 768},
            locale="en-US",
            timezone_id="America/New_York",
        )
        await ctx.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = { runtime: {} };
        """)
        pg = await ctx.new_page()
        await pg.route("**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf}", lambda r: r.abort())
        await pg.goto(url, wait_until="domcontentloaded", timeout=30000)

        try:
            await pg.click('button:has-text("Accept all")', timeout=3000)
            await pg.wait_for_timeout(800)
        except Exception:
            pass

        try:
            await pg.wait_for_selector("#search, #rso, #captcha-form", timeout=10000)
        except Exception:
            pass

        await pg.wait_for_timeout(1500)
        html = await pg.content()
        await ctx.close()

    if "captcha" in html.lower() and "rso" not in html.lower():
        log.warning("Google CAPTCHA detected for URL: %s", url)
        return [], "captcha"

    soup = BeautifulSoup(html, "html.parser")
    results = []

    containers = (
        soup.select("div.g:not(.g-blk)")
        or soup.select("div.tF2Cxc")
        or soup.select("div[data-sokoban-container]")
        or soup.select("div.Gx5Zad")
    )

    for div in containers:
        title_el = div.select_one("h3")
        link_el = div.select_one("a[href]")
        desc_el = div.select_one("div.VwiC3b, span.aCOpRe, div.IsZvec")

        title = title_el.get_text(strip=True) if title_el else ""
        href = link_el.get("href", "") if link_el else ""
        snippet = desc_el.get_text(strip=True) if desc_el else ""

        if not href.startswith("http") or "google.com" in href or not title:
            continue
        results.append({"title": title, "url": href, "snippet": snippet})

    seen, unique = set(), []
    for r in results:
        if r["url"] not in seen:
            seen.add(r["url"])
            unique.append(r)
    return unique, None


async def search_via_duckduckgo(query: str, page: int, num: int = RESULTS_PER_PAGE) -> tuple[list[dict], str | None]:
    """Search using persistent Playwright profile — same as URL mode."""
    url = build_google_url(query, page, num)
    return await search_via_google_url(url)


# ── Main entry ────────────────────────────────────────────────────────────────

async def scrape_dork(query: str = "", search_url: str = "", page: int = 1, results_per_page: int = RESULTS_PER_PAGE) -> dict:
    raw_results = []
    error = None

    if search_url.strip():
        # URL mode — use Playwright to scrape the exact Google URL
        paginated_url = inject_page_param(search_url.strip(), page, results_per_page)
        raw_results, error = await search_via_google_url(paginated_url)

        if error == "captcha":
            return {
                "results": [], "page": page, "has_more": False,
                "captcha": True,
                "error": "Google is showing a CAPTCHA. Click 'Open in Browser' to solve it once, then retry.",
                "captcha_url": paginated_url,
            }
    else:
        # Search/builder mode — use DuckDuckGo (no CAPTCHA)
        raw_results, error = await search_via_duckduckgo(query, page, results_per_page)

    if error:
        return {"results": [], "page": page, "has_more": False, "error": error}

    if not raw_results:
        return {"results": [], "page": page, "has_more": False, "error": "No results found. Try a different query."}

    # Deep scrape each result page
    sem = asyncio.Semaphore(CONCURRENCY)
    async with httpx.AsyncClient(headers=HEADERS, timeout=15, verify=False) as client:
        async def enrich(r):
            async with sem:
                info = await deep_scrape_url(r["url"], client)
            return {
                "title": r["title"],
                "url": r["url"],
                "description": info["description"] or r["snippet"],
                "email": info["email"],
                "phone": info["phone"],
                "address": info["address"],
            }
        enriched = list(await asyncio.gather(*[enrich(r) for r in raw_results]))

    return {"results": enriched, "page": page, "has_more": len(raw_results) >= results_per_page}
