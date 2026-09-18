import re
import base64
import asyncio
import logging
import urllib.parse
from typing import Dict, Any, List, Optional, Tuple
import httpx
from bs4 import BeautifulSoup

log = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
FAKE_EMAILS = re.compile(
    r"(example|domain|test|placeholder|noreply|no-reply|sentry|wixpress|schema|googleapis|w3\.org|cloudflare|jquery|bootstrap|johnsmith|info@info|admin@admin)",
    re.I,
)

# Comprehensive international and regional phone patterns
PHONE_PATTERNS = [
    # International with plus: +971 50 1234567, +44 7123 456789, +966 50 1234567, +1 214 555 0199, +92 300 1234567
    re.compile(r'\+(?:971|966|44|1|92|974|965|968|973|61|49|33)[\s\-.()]?(?:\(?\d{1,4}\)?[\s\-.]?)?\d{2,4}[\s\-.]\d{2,4}(?:[\s\-.]\d{1,4})?'),
    # UAE Mobile: +971501234567, 050-1234567, 055 123 4567, 052 1234567, 054..., 056..., 058...
    re.compile(r'(?:\+971|00971|0)\s?5[024568][\s\-.]?\d{3}[\s\-.]?\d{4}\b'),
    # Saudi Mobile: +966501234567, 050 123 4567, 055...
    re.compile(r'(?:\+966|00966|0)\s?5[0-9][\s\-.]?\d{3}[\s\-.]?\d{4}\b'),
    # UK Mobile & London: +44 7123 456789, 07123 456789, +44 20 7946 0123, 020 7946 0123
    re.compile(r'(?:\+44|0044|0)\s?(?:7\d{3}|20\s?\d{4})[\s\-.]?\d{6}\b'),
    # US / Canada: (214) 555-0199, 214-555-0199, +1-214-555-0199
    re.compile(r'(?:\+1[\s\-.]?)?\(?\d{3}\)?[\s\-.]\d{3}[\s\-.]\d{4}\b'),
    # Pakistan Mobile: +92 300 1234567, 0300-1234567, 0321 1234567
    re.compile(r'(?:\+92|0092|0)\s?3\d{2}[\s\-.]?\d{7}\b'),
]


def extract_emails_from_text(text: str) -> List[str]:
    """Extract valid emails from text or HTML."""
    found = EMAIL_RE.findall(text)
    clean = []
    seen = set()
    for e in found:
        e = e.strip().lower()
        if e in seen or len(e) > 80:
            continue
        if not FAKE_EMAILS.search(e) and not e.endswith((".png", ".jpg", ".gif", ".svg", ".webp", ".js", ".css")):
            seen.add(e)
            clean.append(e)
    return clean


def extract_phones_from_text(text: str) -> List[str]:
    """Extract and normalize valid international / mobile phone numbers from text."""
    phones = []
    seen_digits = set()

    for pattern in PHONE_PATTERNS:
        for match in pattern.finditer(text):
            p = match.group().strip()
            digits = re.sub(r"\D", "", p)
            # Valid phone length check (8 to 15 digits)
            if 8 <= len(digits) <= 15:
                # Discard common fake numbers
                if digits in ["1234567890", "0000000000", "1111111111", "9999999999"]:
                    continue
                if digits not in seen_digits:
                    seen_digits.add(digits)
                    phones.append(p)
    return phones


def _decode_bing_url(bing_href: str) -> str:
    """Decode Bing's base64-encoded redirect URLs to get the real destination."""
    m = re.search(r"[?&]u=a1([a-zA-Z0-9_-]+)", bing_href)
    if m:
        encoded = m.group(1)
        encoded += "=" * ((4 - len(encoded) % 4) % 4)
        try:
            return base64.urlsafe_b64decode(encoded).decode("utf-8", errors="ignore")
        except Exception:
            pass
    return bing_href


async def _search_ddg_lite(client: httpx.AsyncClient, query: str) -> List[Dict[str, str]]:
    """Search DuckDuckGo Lite — no JavaScript, no CAPTCHA, reliable HTML parsing."""
    results = []
    try:
        resp = await client.post("https://lite.duckduckgo.com/lite/", data={"q": query})
        if resp.status_code != 200:
            log.debug("DDG Lite returned status %d for enrichment query: %s", resp.status_code, query[:80])
            return results
        soup = BeautifulSoup(resp.text, "html.parser")
        links = soup.select("a.result-link")
        snippets = soup.select("td.result-snippet")
        for i, a in enumerate(links):
            title = a.get_text(strip=True)
            raw_href = a.get("href", "")
            m = re.search(r"uddg=([^&]+)", raw_href)
            real_url = urllib.parse.unquote(m.group(1)) if m else raw_href
            snip = snippets[i].get_text(strip=True) if i < len(snippets) else ""
            if real_url.startswith("http"):
                results.append({"title": title, "url": real_url, "snippet": snip})
    except Exception as e:
        log.debug("DDG Lite enrichment error for '%s': %s", query[:80], e)
    return results


async def _search_bing(client: httpx.AsyncClient, query: str) -> List[Dict[str, str]]:
    """Search Bing Web — reliable fallback when DDG returns empty."""
    results = []
    try:
        url = f"https://www.bing.com/search?q={urllib.parse.quote(query)}"
        resp = await client.get(url)
        if resp.status_code != 200:
            log.debug("Bing returned status %d for enrichment query: %s", resp.status_code, query[:80])
            return results
        soup = BeautifulSoup(resp.text, "html.parser")
        for r in soup.select("li.b_algo"):
            h2 = r.select_one("h2 a")
            p = r.select_one("div.b_caption p, p")
            if h2:
                title = h2.get_text(strip=True)
                raw_href = h2.get("href", "")
                real_url = _decode_bing_url(raw_href)
                snip = p.get_text(strip=True) if p else ""
                if real_url.startswith("http"):
                    results.append({"title": title, "url": real_url, "snippet": snip})
    except Exception as e:
        log.debug("Bing enrichment error for '%s': %s", query[:80], e)
    return results


async def _multi_engine_search(client: httpx.AsyncClient, query: str) -> List[Dict[str, str]]:
    """Try DDG Lite first, fall back to Bing if empty."""
    results = await _search_ddg_lite(client, query)
    if results:
        return results
    results = await _search_bing(client, query)
    return results


async def dork_contact_search(name: str, company: str = "", country: str = "", location: str = "") -> Dict[str, Any]:
    """
    Executes targeted OSINT search dorks to discover personal phone numbers,
    WhatsApp contacts, public emails, and company websites for a specific person.
    Attaches the exact public source URL where each finding was discovered.
    Uses DuckDuckGo Lite (primary) + Bing (fallback) instead of Yahoo.
    """
    info = {
        "phones": [],
        "emails": [],
        "phone_source_url": "",
        "email_source_url": "",
        "linkedin_url": "",
        "website": "",
        "source_snippets": [],
        "discovered_urls": [],
    }

    if not name or len(name.split()) < 2:
        return info

    clean_name = re.sub(r"^(Dr\.|Mr\.|Ms\.|Mrs\.|Engr\.|Prof\.)\s*", "", name, flags=re.I).strip()
    
    # Formulate precise contact discovery dorks
    dork_queries = [
        f'"{clean_name}" "{company}" (phone OR mobile OR cell OR tel OR whatsapp OR call OR contact)' if company else "",
        f'"{clean_name}" ("+971" OR "+44" OR "+966" OR "+1" OR "+92" OR "whatsapp")' if not company else f'"{clean_name}" "{company}" ("+971" OR "+44" OR "+966" OR "+1" OR "whatsapp")',
        f'site:linkedin.com/in "{clean_name}" "{company}"' if company else f'site:linkedin.com/in "{clean_name}" "{country}"',
        f'"{clean_name}" ("email" OR "contact" OR "@") "{company}"' if company else f'"{clean_name}" "contact" "{country}"',
    ]
    dork_queries = [q for q in dork_queries if q]

    async with httpx.AsyncClient(headers=HEADERS, timeout=10, follow_redirects=True) as client:
        for query in dork_queries[:3]:
            try:
                hits = await _multi_engine_search(client, query)

                for hit in hits:
                    href = hit["url"]
                    snip_text = hit["snippet"]
                    full_content = f"{href} {snip_text}"

                    bad_domains = ["facebook.com", "youtube.com", "twitter.com", "instagram.com"]
                    if href and href.startswith("http") and not any(bad in href.lower() for bad in bad_domains):
                        if href not in info["discovered_urls"]:
                            info["discovered_urls"].append(href)

                    # Extract LinkedIn profile
                    if "linkedin.com/in/" in href and not info["linkedin_url"]:
                        info["linkedin_url"] = href

                    # Extract emails with source URL
                    extracted_emails = extract_emails_from_text(full_content)
                    for em in extracted_emails:
                        if em not in info["emails"]:
                            info["emails"].append(em)
                            if not info["email_source_url"]:
                                info["email_source_url"] = href

                    # Extract phones with source URL
                    extracted_phones = extract_phones_from_text(full_content)
                    for ph in extracted_phones:
                        if ph not in info["phones"]:
                            info["phones"].append(ph)
                            if not info["phone_source_url"]:
                                info["phone_source_url"] = href

                    if snip_text:
                        info["source_snippets"].append(snip_text[:200])

                await asyncio.sleep(0.3)
            except Exception as e:
                log.debug("Dork contact search notice on query '%s': %s", query, e)

    return info


async def crawl_website_for_contacts(website_url: str) -> Dict[str, Any]:
    """
    Deep crawls a business or personal website for contact information.
    Records the exact URL where the phone and email were found.
    """
    info = {
        "phones": [],
        "emails": [],
        "phone_source_url": "",
        "email_source_url": "",
    }
    if not website_url:
        return info

    url = website_url if website_url.startswith("http") else f"https://{website_url}"
    parsed = urllib.parse.urlparse(url)
    root = f"{parsed.scheme}://{parsed.netloc}"

    check_paths = ["/", "/contact", "/contact-us", "/about", "/about-us", "/team", "/leadership"]
    
    async with httpx.AsyncClient(headers=HEADERS, timeout=8, follow_redirects=True) as client:
        for path in check_paths:
            try:
                target = root + path if path != "/" else url
                resp = await client.get(target)
                if resp.status_code == 200:
                    text = resp.text
                    emails = extract_emails_from_text(text)
                    phones = extract_phones_from_text(text)
                    
                    for e in emails:
                        if e not in info["emails"]:
                            info["emails"].append(e)
                            if not info["email_source_url"]:
                                info["email_source_url"] = target
                    for p in phones:
                        if p not in info["phones"]:
                            info["phones"].append(p)
                            if not info["phone_source_url"]:
                                info["phone_source_url"] = target
                    
                    if info["phones"] and info["emails"]:
                        break
            except Exception:
                continue

    return info


async def deep_enrich_person(lead_dict: Dict[str, Any]) -> Dict[str, Any]:
    """
    Enriches a person's profile with verified LinkedIn URL, personal/business phone,
    and email. Attaches exact public source URLs for every finding.
    """
    name = lead_dict.get("full_name", "")
    company = lead_dict.get("company", "")
    country = lead_dict.get("current_country", "")
    website = lead_dict.get("company_website", "")

    # 1. Run OSINT Contact Dorking
    dork_info = await dork_contact_search(name=name, company=company, country=country)

    # 2. If website available or found, crawl it
    if website or dork_info.get("website"):
        web_contacts = await crawl_website_for_contacts(website or dork_info.get("website"))
        for p in web_contacts.get("phones", []):
            if p not in dork_info["phones"]:
                dork_info["phones"].append(p)
                if not dork_info.get("phone_source_url"):
                    dork_info["phone_source_url"] = web_contacts.get("phone_source_url", "")
        for e in web_contacts.get("emails", []):
            if e not in dork_info["emails"]:
                dork_info["emails"].append(e)
                if not dork_info.get("email_source_url"):
                    dork_info["email_source_url"] = web_contacts.get("email_source_url", "")

    # 3. Update lead dict
    if not lead_dict.get("professional_profile_url") and dork_info.get("linkedin_url"):
        lead_dict["professional_profile_url"] = dork_info["linkedin_url"]

    if dork_info.get("linkedin_url") and dork_info["linkedin_url"] not in lead_dict.get("source_urls", []):
        lead_dict.setdefault("source_urls", []).append(dork_info["linkedin_url"])

    for u in dork_info.get("discovered_urls", []):
        if u not in lead_dict.get("source_urls", []):
            lead_dict.setdefault("source_urls", []).append(u)

    if not lead_dict.get("public_phone") and dork_info.get("phones"):
        lead_dict["public_phone"] = dork_info["phones"][0]
        lead_dict["phone_source_url"] = dork_info.get("phone_source_url", "")

    if not lead_dict.get("public_email") and dork_info.get("emails"):
        lead_dict["public_email"] = dork_info["emails"][0]
        lead_dict["email_source_url"] = dork_info.get("email_source_url", "")

    # Ensure source URLs are attached to evidence items
    evidence_list = lead_dict.get("evidence_list", [])
    if lead_dict.get("public_phone") and lead_dict.get("phone_source_url"):
        evidence_list.append({
            "category": "contact_reachability",
            "points": 25,
            "description": f"Verified direct phone number {lead_dict['public_phone']} found at public source",
            "source_url": lead_dict["phone_source_url"],
            "source_type": "Public Directory / Contact Registry",
            "evidence_date": lead_dict.get("collection_date", "")
        })

    if lead_dict.get("public_email") and lead_dict.get("email_source_url"):
        evidence_list.append({
            "category": "contact_reachability",
            "points": 15,
            "description": f"Verified public email {lead_dict['public_email']} discovered at source",
            "source_url": lead_dict["email_source_url"],
            "source_type": "Corporate Contact / Public Profile",
            "evidence_date": lead_dict.get("collection_date", "")
        })

    lead_dict["evidence_list"] = evidence_list
    lead_dict["phone_found"] = bool(lead_dict.get("public_phone"))
    lead_dict["email_found"] = bool(lead_dict.get("public_email"))

    return lead_dict
