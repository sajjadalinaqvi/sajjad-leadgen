"""
People Search Directory Enrichment Module.

Uses search engine dorking to find people-search results indexed by Bing/DDG.
Sites like FastPeopleSearch and 192.com are Cloudflare-protected but their pages
are indexed by search engines, with phone numbers and emails visible in titles
and snippets.

Key insight: FastPeopleSearch page titles contain phone numbers in the format:
"Name(age) City, ST (xxx)xxx-xxxx | Public Records Profile"
"""

import re
import base64
import asyncio
import logging
import urllib.parse
from typing import Dict, Any, List, Optional
import httpx
from bs4 import BeautifulSoup

log = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# US state name -> two-letter abbreviation
US_STATE_ABBR = {
    "alabama": "al", "alaska": "ak", "arizona": "az", "arkansas": "ar",
    "california": "ca", "colorado": "co", "connecticut": "ct", "delaware": "de",
    "florida": "fl", "georgia": "ga", "hawaii": "hi", "idaho": "id",
    "illinois": "il", "indiana": "in", "iowa": "ia", "kansas": "ks",
    "kentucky": "ky", "louisiana": "la", "maine": "me", "maryland": "md",
    "massachusetts": "ma", "michigan": "mi", "minnesota": "mn", "mississippi": "ms",
    "missouri": "mo", "montana": "mt", "nebraska": "ne", "nevada": "nv",
    "new hampshire": "nh", "new jersey": "nj", "new mexico": "nm", "new york": "ny",
    "north carolina": "nc", "north dakota": "nd", "ohio": "oh", "oklahoma": "ok",
    "oregon": "or", "pennsylvania": "pa", "rhode island": "ri", "south carolina": "sc",
    "south dakota": "sd", "tennessee": "tn", "texas": "tx", "utah": "ut",
    "vermont": "vt", "virginia": "va", "washington": "wa", "west virginia": "wv",
    "wisconsin": "wi", "wyoming": "wy", "district of columbia": "dc",
}

# City -> state abbreviation for common diaspora cities
US_CITY_STATE = {
    "dallas": "tx", "houston": "tx", "new york": "ny", "san francisco": "ca",
    "chicago": "il", "los angeles": "ca", "miami": "fl", "boston": "ma",
    "seattle": "wa", "atlanta": "ga", "philadelphia": "pa", "detroit": "mi",
    "phoenix": "az", "san diego": "ca", "san jose": "ca", "austin": "tx",
    "plano": "tx", "irving": "tx", "sugar land": "tx", "missouri city": "tx",
    "jersey city": "nj", "edison": "nj", "iselin": "nj", "parsippany": "nj",
    "fremont": "ca", "sunnyvale": "ca", "cupertino": "ca", "irvine": "ca",
    "herndon": "va", "mclean": "va", "reston": "va", "great falls": "va",
    "rockville": "md", "bethesda": "md", "silver spring": "md",
}

# Phone patterns for extraction from search engine titles and snippets
TITLE_PHONE_RE = re.compile(r'\((\d{3})\)\s*(\d{3})[- ](\d{4})')
US_PHONE_RE = re.compile(r'(?:\+1[\s.-]?)?\(?(\d{3})\)?[\s.-](\d{3})[\s.-](\d{4})')
UK_PHONE_RE = re.compile(r'(?:\+44|0)[\s]?(?:7\d{3}|20[\s]?\d{4})[\s.-]?\d{4,6}')
EMAIL_RE = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
FAKE_EMAILS = re.compile(
    r'(example|domain|test|placeholder|noreply|sentry|wixpress|schema|googleapis|'
    r'w3\.org|cloudflare|jquery|bootstrap|fastpeoplesearch|192\.com|truepeoplesearch)',
    re.I,
)


def _clean_name(name: str) -> str:
    """Remove honorifics and credentials from a name."""
    clean = re.sub(r'^(Dr|Mr|Mrs|Ms|Prof|Engr|Sir)\.\s*', '', name, flags=re.I).strip()
    clean = re.sub(r',?\s*(MD|MBBS|FRCS|PhD|DO|DDS|MBA|CPA|FCA|JD|ESQ)\.?\s*$', '', clean, flags=re.I).strip()
    return clean


def _get_state_abbr(city: str = "") -> str:
    """Try to determine US state abbreviation from city."""
    city_lower = city.lower().strip()
    if city_lower in US_CITY_STATE:
        return US_CITY_STATE[city_lower]
    if "," in city:
        parts = city.split(",")
        state_part = parts[-1].strip().lower()
        if len(state_part) == 2:
            return state_part
        if state_part in US_STATE_ABBR:
            return US_STATE_ABBR[state_part]
    return ""


def _extract_emails(text: str) -> List[str]:
    """Extract valid emails from text, filtering out junk/site-internal emails."""
    found = EMAIL_RE.findall(text)
    clean = []
    seen = set()
    for e in found:
        e = e.strip().lower()
        if e in seen or len(e) > 80:
            continue
        if FAKE_EMAILS.search(e):
            continue
        if e.endswith(('.png', '.jpg', '.gif', '.svg', '.webp', '.js', '.css')):
            continue
        seen.add(e)
        clean.append(e)
    return clean


def _decode_bing_url(bing_href: str) -> str:
    """Decode Bing redirect URL to real destination URL."""
    m = re.search(r"[?&]u=a1([a-zA-Z0-9_-]+)", bing_href)
    if m:
        encoded = m.group(1)
        encoded += "=" * ((4 - len(encoded) % 4) % 4)
        try:
            return base64.urlsafe_b64decode(encoded).decode("utf-8", errors="ignore")
        except Exception:
            pass
    return bing_href


async def _search_bing(client: httpx.AsyncClient, query: str) -> List[Dict[str, str]]:
    """Search Bing and return list of {title, url, snippet}."""
    results = []
    try:
        url = f"https://www.bing.com/search?q={urllib.parse.quote(query)}"
        resp = await client.get(url)
        if resp.status_code != 200:
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
        log.debug("Bing search error: %s", e)
    return results


async def _search_ddg_lite(client: httpx.AsyncClient, query: str) -> List[Dict[str, str]]:
    """Search DDG Lite and return list of {title, url, snippet}."""
    results = []
    try:
        resp = await client.post("https://lite.duckduckgo.com/lite/", data={"q": query})
        if resp.status_code != 200:
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
        log.debug("DDG Lite search error: %s", e)
    return results


async def _multi_search(client: httpx.AsyncClient, query: str) -> List[Dict[str, str]]:
    """Try DDG Lite first, fall back to Bing."""
    results = await _search_ddg_lite(client, query)
    if results:
        return results
    return await _search_bing(client, query)


class USPeopleSearchDorker:
    """
    Finds US-based people by dorking search engines for FastPeopleSearch,
    TruePeopleSearch, and similar indexed people-search results.
    
    These sites are Cloudflare-protected but their pages are indexed by
    search engines. FastPeopleSearch titles contain phone numbers in format:
    "Name(age) City, ST (xxx)xxx-xxxx | Public Records Profile"
    """

    # Target domains that search engines index with contact data in titles/snippets
    PEOPLE_SEARCH_DOMAINS = [
        "fastpeoplesearch.com",
        "truepeoplesearch.com",
        "thatsthem.com",
        "whitepages.com",
        "spokeo.com",
    ]

    async def search_person(self, full_name: str, city: str = "", state: str = "") -> Dict[str, Any]:
        """Search for a US person via search engine dorks of people-search sites."""
        result = {
            "phone": "",
            "email": "",
            "address": "",
            "age": "",
            "source_url": "",
            "found": False,
        }

        clean_name = _clean_name(full_name)
        if not clean_name or len(clean_name.split()) < 2:
            return result

        state_abbr = state.lower().strip() if len(state.strip()) == 2 else ""
        if not state_abbr:
            state_abbr = _get_state_abbr(city)

        location = city if city else state_abbr.upper()

        # Build targeted dork queries
        queries = []
        # Primary: FastPeopleSearch indexed titles (contain phone numbers)
        if location:
            queries.append(f'site:fastpeoplesearch.com "{clean_name}" "{location}"')
        queries.append(f'site:fastpeoplesearch.com "{clean_name}"')
        # Fallback: TruePeopleSearch, Spokeo
        if location:
            queries.append(f'(site:truepeoplesearch.com OR site:thatsthem.com OR site:spokeo.com) "{clean_name}" "{location}"')
        # Generic people search with phone keywords
        queries.append(f'"{clean_name}" "{location}" (phone OR mobile OR cell OR tel) site:fastpeoplesearch.com OR site:whitepages.com')

        try:
            async with httpx.AsyncClient(headers=HEADERS, timeout=5, follow_redirects=True) as client:
                for query in queries[:2]:
                    hits = await _multi_search(client, query)
                    for hit in hits:
                        url = hit.get("url", "")
                        title = hit.get("title", "")
                        snippet = hit.get("snippet", "")
                        combined = f"{title} {snippet}"

                        # Only process hits from people-search domains
                        is_people_search = any(d in url.lower() for d in self.PEOPLE_SEARCH_DOMAINS)

                        # Extract phone from title (FPS format: "Name(age) City, ST (xxx)xxx-xxxx")
                        phone_match = TITLE_PHONE_RE.search(title)
                        if phone_match and not result["phone"]:
                            result["phone"] = f"({phone_match.group(1)}){phone_match.group(2)}-{phone_match.group(3)}"
                            if is_people_search:
                                result["source_url"] = url

                        # Also try US phone pattern in snippet
                        if not result["phone"]:
                            us_phones = US_PHONE_RE.findall(combined)
                            if us_phones:
                                p = us_phones[0]
                                result["phone"] = f"({p[0]}){p[1]}-{p[2]}"
                                if is_people_search and not result["source_url"]:
                                    result["source_url"] = url

                        # Extract age from title
                        if not result["age"]:
                            age_match = re.search(r'\((\d{2,3})\)', title)
                            if age_match:
                                result["age"] = age_match.group(1)

                        # Extract email from snippet
                        if not result["email"]:
                            emails = _extract_emails(combined)
                            if emails:
                                result["email"] = emails[0]
                                if not result["source_url"]:
                                    result["source_url"] = url

                        # Extract address from snippet
                        if not result["address"] and snippet:
                            addr_match = re.search(
                                r'(?:lives?\s+(?:on|at|in)\s+(.+?)\s+in\s+(\S+,?\s*\w{2}))',
                                snippet, re.I
                            )
                            if addr_match:
                                result["address"] = f"{addr_match.group(1)}, {addr_match.group(2)}"

                        # Set source URL from people search domain
                        if is_people_search and not result["source_url"]:
                            result["source_url"] = url

                    if result["phone"]:
                        break
                    await asyncio.sleep(0.3)

        except Exception as e:
            log.debug("US people search dork error for '%s': %s", full_name, e)

        result["found"] = bool(result.get("phone") or result.get("email"))
        return result


class UKPeopleSearchDorker:
    """
    Uses search engine dorking to find 192.com and other UK directory
    indexed pages for UK-based leads.
    """

    async def search_person(self, full_name: str, city: str = "") -> Dict[str, Any]:
        """Search for a UK person via 192.com search engine dorks."""
        result = {
            "phone": "",
            "email": "",
            "address": "",
            "source_url": "",
            "found": False,
        }

        clean_name = _clean_name(full_name)
        if not clean_name or len(clean_name.split()) < 2:
            return result

        queries = [
            f'site:192.com "{clean_name}" "{city}"' if city else f'site:192.com "{clean_name}"',
            f'"{clean_name}" "192.com" (phone OR address) "{city}"' if city else f'"{clean_name}" "192.com" phone address UK',
            f'(site:192.com OR site:peopletracer.co.uk OR site:ukphonebook.com) "{clean_name}"',
        ]

        try:
            async with httpx.AsyncClient(headers=HEADERS, timeout=5, follow_redirects=True) as client:
                for query in queries[:2]:
                    hits = await _multi_search(client, query)
                    for hit in hits:
                        url = hit.get("url", "")
                        title = hit.get("title", "")
                        snippet = hit.get("snippet", "")
                        combined = f"{title} {snippet} {url}"

                        # Extract 192.com or directory source URL
                        if ("192.com" in url or "peopletracer" in url or "ukphonebook" in url):
                            if not result["source_url"]:
                                result["source_url"] = url

                        # Extract UK phone numbers
                        uk_phones = UK_PHONE_RE.findall(combined)
                        if uk_phones and not result["phone"]:
                            result["phone"] = uk_phones[0].strip()

                        # Extract address
                        addr_match = re.search(
                            r'(?:living|lives|resident|address|located)\s+(?:at|in|on)\s+([^.]+)',
                            snippet, re.I
                        )
                        if addr_match and not result["address"]:
                            result["address"] = addr_match.group(1).strip()[:100]

                        # Extract email
                        emails = _extract_emails(combined)
                        if emails and not result["email"]:
                            result["email"] = emails[0]

                    if result["phone"]:
                        break
                    await asyncio.sleep(0.3)

        except Exception as e:
            log.debug("UK people search dork error for '%s': %s", full_name, e)

        result["found"] = bool(result.get("phone") or result.get("source_url"))
        return result


class InternationalPeopleSearchDorker:
    """Searches for direct contact phone/mobile numbers and personal emails for Gulf, Canada, and global diaspora leads."""

    async def search_person(self, full_name: str, country: str = "", city: str = "") -> Dict[str, Any]:
        result = {"phone": "", "email": "", "address": "", "source_url": "", "found": False}
        clean_name = _clean_name(full_name)
        if not clean_name or len(clean_name.split()) < 2:
            return result

        prefix = "+971" if country == "UAE" else ("+966" if "saudi" in (country or "").lower() else ("+1" if country in ("Canada", "United States") else "+44"))
        queries = [
            f'"{clean_name}" "{city}" ("{prefix}" OR "whatsapp" OR "mobile" OR "contact")',
            f'"{clean_name}" "{country}" (email OR contact OR gmail OR phone)',
        ]
        try:
            async with httpx.AsyncClient(headers=HEADERS, timeout=6, follow_redirects=True) as client:
                for q in queries[:2]:
                    hits = await _multi_search(client, q)
                    for hit in hits:
                        combined = f"{hit.get('title', '')} {hit.get('snippet', '')}"
                        url = hit.get("url", "")
                        
                        # Match mobile formats
                        uae_m = re.search(r'(?:\+971|0)\s?5[024568][\s\-.]?\d{3}[\s\-.]?\d{4}', combined)
                        ksa_m = re.search(r'(?:\+966|0)\s?5[0-9][\s\-.]?\d{3}[\s\-.]?\d{4}', combined)
                        uk_m = re.search(r'(?:\+44|0)[\s]?(?:7\d{3})[\s.-]?\d{6}', combined)
                        us_m = US_PHONE_RE.findall(combined)

                        found_phone = ""
                        if uae_m:
                            found_phone = uae_m.group(0)
                        elif ksa_m:
                            found_phone = ksa_m.group(0)
                        elif uk_m:
                            found_phone = uk_m.group(0)
                        elif us_m:
                            p = us_m[0]
                            found_phone = f"({p[0]}){p[1]}-{p[2]}"

                        if found_phone and not result["phone"]:
                            result["phone"] = found_phone
                            result["source_url"] = url

                        emails = _extract_emails(combined)
                        if emails and not result["email"]:
                            result["email"] = emails[0]
                            if not result["source_url"]:
                                result["source_url"] = url

                    if result["phone"]:
                        break
        except Exception as e:
            log.debug("Intl people search error for %s: %s", full_name, e)

        result["found"] = bool(result.get("phone") or result.get("email"))
        return result


class PeopleSearchEnricher:
    """
    Orchestrator that routes enrichment to the appropriate people-search
    dorker based on the lead's country.
    """

    def __init__(self):
        self.us_dorker = USPeopleSearchDorker()
        self.uk_dorker = UKPeopleSearchDorker()
        self.intl_dorker = InternationalPeopleSearchDorker()

    async def enrich(self, lead: Dict[str, Any]) -> Dict[str, Any]:
        """
        Enrich a lead dict with phone/email from people-search directories.
        Modifies lead in-place and returns it.
        """
        name = lead.get("full_name", "")
        country = lead.get("current_country", "")
        city = lead.get("current_city", "")

        if not name or len(name.split()) < 2:
            return lead

        # Skip if already has verified phone AND email
        if lead.get("public_phone") and lead.get("public_email"):
            return lead

        result = None

        # Route to appropriate dorker
        if country in ("United States", "USA", "US"):
            result = await self.us_dorker.search_person(name, city=city)
        elif country in ("United Kingdom", "UK"):
            result = await self.uk_dorker.search_person(name, city=city)
        else:
            result = await self.intl_dorker.search_person(name, country=country, city=city)

        if not result or not result.get("found"):
            return lead

        # Apply discovered data
        if result.get("phone") and not lead.get("public_phone"):
            lead["public_phone"] = result["phone"]
            lead["phone_source_url"] = result.get("source_url", "")
            lead["phone_found"] = True
            log.info("PeopleSearch: found phone %s for %s via %s",
                     result["phone"], name, result.get("source_url", "people search"))

        if result.get("email") and not lead.get("public_email"):
            lead["public_email"] = result["email"]
            lead["email_source_url"] = result.get("source_url", "")
            lead["email_found"] = True
            log.info("PeopleSearch: found email %s for %s", result["email"], name)

        # Add source URL to evidence
        if result.get("source_url"):
            source_urls = lead.get("source_urls", [])
            if result["source_url"] not in source_urls:
                source_urls.append(result["source_url"])
                lead["source_urls"] = source_urls

            evidence_list = lead.get("evidence_list", [])
            source_type = "FastPeopleSearch (via Bing)" if country in ("United States", "USA", "US") else "192.com (via Bing)"
            if result.get("phone"):
                evidence_list.append({
                    "category": "contact_reachability",
                    "points": 30,
                    "description": f"Verified phone {result['phone']} from {source_type} public records",
                    "source_url": result["source_url"],
                    "source_type": source_type,
                    "evidence_date": lead.get("collection_date", "")
                })
            if result.get("email"):
                evidence_list.append({
                    "category": "contact_reachability",
                    "points": 20,
                    "description": f"Verified email {result['email']} from {source_type} public records",
                    "source_url": result["source_url"],
                    "source_type": source_type,
                    "evidence_date": lead.get("collection_date", "")
                })
            lead["evidence_list"] = evidence_list

        # Normalize WhatsApp number from found phone
        if lead.get("public_phone") and not lead.get("whatsapp_number"):
            digits = re.sub(r'\D', '', lead["public_phone"])
            if len(digits) == 10:
                digits = "1" + digits  # Prepend US country code
            lead["whatsapp_number"] = digits
            lead["has_whatsapp"] = len(digits) >= 9

        return lead
