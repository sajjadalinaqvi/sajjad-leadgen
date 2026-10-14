"""
apollo_adapter.py - Apollo.io API Client + CSV Import Adapter
=============================================================
API Documentation:
- Base URL: https://api.apollo.io/api/v1
- Auth: x-api-key header
- Profile: GET /users/api_profile
- People Match: POST /people/match
"""

import logging
from typing import List, Dict, Any, Optional

import httpx

import config
from .base import BaseLeadSource
from scorer import calculate_lead_score

log = logging.getLogger(__name__)


class ApolloClient:
    """Official asynchronous client for Apollo.io REST API."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
    ):
        self.api_key = (api_key or getattr(config, "APOLLO_API_KEY", "")).strip()
        self.base_url = (
            base_url or getattr(config, "APOLLO_API_BASE", "https://api.apollo.io/api/v1")
        ).rstrip("/")

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key) and bool(getattr(config, "ENABLE_APOLLO", False))

    def _headers(self) -> Dict[str, str]:
        return {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "x-api-key": self.api_key,
        }

    async def get_api_profile(self) -> Dict[str, Any]:
        """
        GET /users/api_profile
        Validates the API key and returns the authenticated user profile.
        """
        if not self.api_key:
            return {"status": "error", "message": "APOLLO_API_KEY is not configured"}
        if not getattr(config, "ENABLE_APOLLO", False):
            return {"status": "error", "message": "ENABLE_APOLLO is false"}

        url = f"{self.base_url}/users/api_profile"
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(url, headers=self._headers())
                if resp.status_code == 200:
                    data = resp.json()
                    user = data.get("user") or data
                    return {
                        "status": "ok",
                        "id": user.get("id"),
                        "email": user.get("email"),
                        "first_name": user.get("first_name"),
                        "last_name": user.get("last_name"),
                        "name": user.get("name") or f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
                        "team_id": user.get("team_id"),
                        "raw": data,
                    }
                elif resp.status_code in (401, 403):
                    return {
                        "status": "error",
                        "message": f"Invalid Apollo API key ({resp.status_code})",
                        "detail": resp.text[:500],
                    }
                else:
                    return {
                        "status": "error",
                        "message": f"Apollo API returned {resp.status_code}",
                        "detail": resp.text[:500],
                    }
        except Exception as e:
            log.error("Apollo get_api_profile failed: %s", e)
            return {"status": "error", "message": str(e)}

    async def people_match(
        self,
        first_name: str = "",
        last_name: str = "",
        full_name: str = "",
        organization_name: str = "",
        domain: str = "",
        email: str = "",
        linkedin_url: str = "",
        reveal_personal_emails: bool = True,
    ) -> Dict[str, Any]:
        """
        POST /people/match
        Enrich a person and return email / phone / LinkedIn when available.
        """
        if not self.is_configured:
            return {"found": False, "error": "Apollo not enabled or APOLLO_API_KEY missing"}

        if not first_name and not last_name and full_name.strip():
            parts = full_name.strip().split()
            first_name = parts[0]
            last_name = parts[-1] if len(parts) > 1 else ""

        payload: Dict[str, Any] = {
            "reveal_personal_emails": reveal_personal_emails,
        }
        if first_name:
            payload["first_name"] = first_name.strip()
        if last_name:
            payload["last_name"] = last_name.strip()
        if organization_name:
            payload["organization_name"] = organization_name.strip()
        if domain:
            payload["domain"] = domain.strip().lower().replace("https://", "").replace("http://", "").split("/")[0]
        if email:
            payload["email"] = email.strip()
        if linkedin_url:
            payload["linkedin_url"] = linkedin_url.strip()

        if not any(payload.get(k) for k in ("email", "linkedin_url", "first_name", "last_name")):
            return {"found": False, "error": "Need name, email, or LinkedIn URL for Apollo people/match"}

        url = f"{self.base_url}/people/match"
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.post(url, json=payload, headers=self._headers())
                if resp.status_code == 200:
                    person = resp.json().get("person") or {}
                    if not person:
                        return {"found": False, "error": "No person matched in Apollo"}

                    email_val = person.get("email") or ""
                    phone_val = (
                        person.get("sanitized_phone")
                        or (person.get("phone_numbers") or [{}])[0].get("sanitized_number")
                        or person.get("phone")
                        or ""
                    )
                    return {
                        "found": True,
                        "email": email_val or None,
                        "phone": phone_val or None,
                        "linkedin_url": person.get("linkedin_url"),
                        "title": person.get("title"),
                        "first_name": person.get("first_name"),
                        "last_name": person.get("last_name"),
                        "organization": (person.get("organization") or {}).get("name"),
                        "city": person.get("city"),
                        "state": person.get("state"),
                        "country": person.get("country"),
                        "raw": person,
                    }
                elif resp.status_code == 404:
                    return {"found": False, "error": "Person not found in Apollo"}
                elif resp.status_code in (401, 403):
                    return {"found": False, "error": f"Apollo auth failed ({resp.status_code}): {resp.text[:300]}"}
                elif resp.status_code == 422:
                    return {"found": False, "error": f"Apollo validation error: {resp.text[:300]}"}
                elif resp.status_code == 429:
                    return {"found": False, "error": "Apollo rate limit exceeded (429)"}
                else:
                    return {
                        "found": False,
                        "error": f"Apollo API status {resp.status_code}: {resp.text[:300]}",
                    }
        except Exception as e:
            log.error("Apollo people_match failed: %s", e)
            return {"found": False, "error": str(e)}


class ApolloStructuredAdapter(BaseLeadSource):
    """
    Adapter for official Apollo CSV exports or authorized API data.
    Enriches professional corporate attributes (seniority, company size, title)
    and combines them with our evidence-based diaspora scoring.
    """

    def __init__(self):
        super().__init__(name="Apollo Professional Data Adapter", source_type="Apollo Data Provider")
        self.client = ApolloClient()

    async def discover_candidates(self, criteria: Dict[str, Any]) -> List[Dict[str, Any]]:
        if not self.client.is_configured:
            return []
        # Live discovery via search is plan-dependent; enrichment uses people_match.
        return []

    def normalize_candidate(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Maps standard Apollo CSV columns into our Lead model.
        Apollo fields: 'First Name', 'Last Name', 'Title', 'Company', 'Company Name for Emails',
        'Email', 'Email Status', 'Seniority', 'Departments', '# Employees', 'Industry',
        'Person Linkedin Url', 'City', 'State', 'Country'.
        """
        first = raw_data.get("First Name") or raw_data.get("first_name", "")
        last = raw_data.get("Last Name") or raw_data.get("last_name", "")
        full = raw_data.get("Full Name") or f"{first} {last}".strip()

        country = raw_data.get("Country") or raw_data.get("country", "")
        city = raw_data.get("City") or raw_data.get("city", "")
        title = raw_data.get("Title") or raw_data.get("job_title", "")
        company = raw_data.get("Company") or raw_data.get("company", "")
        email = raw_data.get("Email") or raw_data.get("email", "")
        phone = raw_data.get("Corporate Phone") or raw_data.get("phone", "")
        employees = raw_data.get("# Employees") or raw_data.get("company_size", "")
        linkedin = raw_data.get("Person Linkedin Url") or raw_data.get("linkedin_url", "")
        email_status = raw_data.get("Email Status") or "Unverified"

        candidate = {
            "full_name": full,
            "first_name": first,
            "last_name": last,
            "current_country": country,
            "current_city": city,
            "profession": raw_data.get("Industry") or title,
            "job_title": title,
            "seniority": raw_data.get("Seniority", "Executive"),
            "company": company,
            "company_size": f"{employees} employees" if employees else "",
            "professional_profile_url": linkedin,
            "public_email": email,
            "public_phone": phone,
            "email_verification_status": "Verified" if email_status.lower() == "verified" else "Public",
            "source_urls": [linkedin] if linkedin else [],
            "source_types": [self.source_type],
            "notes": f"Imported via Apollo. Seniority: {raw_data.get('Seniority', 'N/A')}. Industry: {raw_data.get('Industry', 'N/A')}."
        }

        # Run auto-scoring
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
        candidate["evidence_list"] = [e.dict() for e in scoring.evidence_list]
        candidate["lead_status"] = "New"

        return candidate
