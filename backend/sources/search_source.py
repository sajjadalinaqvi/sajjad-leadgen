import re
import asyncio
import logging
from typing import List, Dict, Any, Optional
from urllib.parse import urlparse
import httpx
from bs4 import BeautifulSoup

from .base import BaseLeadSource
from compliance import should_throttle_domain, record_domain_request, is_contact_suppressed
from scorer import calculate_lead_score

log = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


class SearchEngineLeadSource(BaseLeadSource):
    """
    Discovers candidate leads from legitimate public executive pages,
    diaspora associations, and speaker rosters using search discovery.
    """

    def __init__(self):
        super().__init__(name="Public Search & Diaspora Discovery", source_type="Public Web Discovery")

    async def discover_candidates(self, criteria: Dict[str, Any]) -> List[Dict[str, Any]]:
        countries = criteria.get("countries", ["UAE", "Saudi Arabia", "United Kingdom", "United States"])
        professions = criteria.get("professions", ["Founder", "CEO", "Doctor", "Investor", "Executive"])
        custom_kw = criteria.get("keywords", "").strip()

        candidates = []

        # Target query templates designed specifically for legitimate diaspora research
        query_templates = [
            '"{country}" "{profession}" "Pakistani" "investor" OR "founder"',
            '"{country}" "Pakistani" "{profession}" "Islamabad" OR "Pakistan"',
            'site:linkedin.com/in "Pakistani" "{profession}" "{country}"',
            '"{profession}" "Pakistan Business Council" "{country}"',
        ]

        target_countries = countries if countries else ["UAE", "UK", "USA"]
        target_professions = professions if professions else ["Founder", "CEO", "Doctor", "Executive"]

        # Build focused queries
        for country in target_countries[:2]:  # Conservative discovery batch
            for prof in target_professions[:2]:
                q = f'"{prof}" "Pakistani" "{country}"'
                if custom_kw:
                    q += f' "{custom_kw}"'

                try:
                    results = await self._search_duckduckgo(q)
                    for res in results:
                        parsed = self.normalize_candidate({
                            "title": res.get("title", ""),
                            "url": res.get("url", ""),
                            "snippet": res.get("snippet", ""),
                            "country": country,
                            "profession": prof
                        })
                        if parsed and parsed.get("full_name"):
                            candidates.append(parsed)
                except Exception as e:
                    log.error("Search candidate error for query '%s': %s", q, e)

                await asyncio.sleep(1.0) # Polite delay between queries

        return candidates

    async def _search_duckduckgo(self, query: str) -> List[Dict[str, str]]:
        """Conservative search discovery via DuckDuckGo HTML endpoint without JavaScript execution."""
        url = "https://html.duckduckgo.com/html/"
        data = {"q": query}
        results = []

        try:
            async with httpx.AsyncClient(headers=HEADERS, timeout=12, follow_redirects=True) as client:
                resp = await client.post(url, data=data)
                if resp.status_code == 200:
                    soup = BeautifulSoup(resp.text, "html.parser")
                    for result in soup.select("div.result__body")[:10]:
                        title_el = result.select_one("a.result__a")
                        snippet_el = result.select_one("a.result__snippet")
                        if title_el:
                            title = title_el.get_text(strip=True)
                            href = title_el.get("href", "")
                            snippet = snippet_el.get_text(strip=True) if snippet_el else ""
                            if href and not href.startswith("/"):
                                results.append({"title": title, "url": href, "snippet": snippet})
        except Exception as e:
            log.warning("DuckDuckGo discovery notice: %s", e)

        return results

    def normalize_candidate(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        title = raw_data.get("title", "")
        snippet = raw_data.get("snippet", "")
        url = raw_data.get("url", "")
        country = raw_data.get("country", "UAE")
        default_prof = raw_data.get("profession", "Executive")

        # Parse name from title (e.g. "Ahmed Khan - Founder & CEO at XYZ | LinkedIn")
        name = ""
        company = ""
        job_title = default_prof

        clean_title = re.sub(r"\s*\|\s*LinkedIn\s*", "", title, flags=re.I)
        parts = re.split(r"[-–—:]", clean_title)
        if len(parts) >= 1:
            name = parts[0].strip()
        if len(parts) >= 2:
            sub_part = parts[1].strip()
            if " at " in sub_part:
                job_title, company = sub_part.split(" at ", 1)
            else:
                job_title = sub_part

        # Clean name from honorifics if needed
        if not name or len(name.split()) < 2 or len(name) > 50:
            return {}

        candidate = {
            "full_name": name,
            "current_country": country,
            "current_city": "",
            "profession": default_prof,
            "job_title": job_title.strip() if job_title else default_prof,
            "company": company.strip() if company else "",
            "professional_profile_url": url,
            "source_urls": [url] if url else [],
            "source_types": [self.source_type],
            "evidence_summary": f"Discovered via public diaspora search: '{snippet[:200]}'",
            "evidence_list": [
                {
                    "category": "pakistan_connection",
                    "points": 15,
                    "description": f"Public profile indexed with Pakistani heritage context: '{snippet[:160]}...'",
                    "source_url": url,
                    "source_type": self.source_type
                }
            ],
            "notes": f"Snippet: {snippet[:300]}"
        }

        # Calculate intelligence score
        scoring = calculate_lead_score(candidate)
        candidate["pakistan_connection_score"] = scoring.pakistan_connection_score
        candidate["overseas_status_score"] = scoring.overseas_status_score
        candidate["financial_strength_score"] = scoring.financial_strength_score
        candidate["pakistan_investment_score"] = scoring.pakistan_investment_score
        candidate["islamabad_connection_score"] = scoring.islamabad_connection_score
        candidate["real_estate_intent_score"] = scoring.real_estate_intent_score
        candidate["total_lead_score"] = scoring.normalized_score
        candidate["score_category"] = scoring.score_category.value
        candidate["confidence"] = scoring.confidence.value
        candidate["evidence_summary"] = scoring.evidence_summary

        return candidate
