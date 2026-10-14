"""
hunter_adapter.py - Official Hunter.io API Integration
=====================================================
API Documentation & Specification:
- Base Endpoint: https://api.hunter.io/v2/
- OpenAPI Specification: https://hunter.io/openapi.json
- Free Tier Allowance: 50 searches/month, 100 verifications/month (cardless free tier)

Supported Operations:
1. get_account_info: Query live account, plan, reset date, and credit usage.
2. find_email: Discover professional or personal emails using domain/company + name or LinkedIn handle.
3. verify_email: Check email deliverability, validity, MX, and SMTP deliverability.
4. domain_search: Search verified emails associated with an organization domain.
"""

import logging
import re
import urllib.parse
from typing import Dict, Any, Optional, List

import httpx
import config
from contact_validator import (
    is_personal_email,
    classify_phone_number,
    validate_genuine_linkedin_url
)

log = logging.getLogger(__name__)


# Registry / directory hosts must never be sent to email-finder APIs (wastes credits).
_BLOCKED_EMAIL_FINDER_DOMAINS = (
    "company-information.service.gov.uk",
    "find-and-update.company-information.service.gov.uk",
    "gov.uk",
    "npiregistry.cms.hhs.gov",
    "cms.hhs.gov",
    "appna.org",
    "linkedin.com",
    "facebook.com",
    "twitter.com",
    "x.com",
    "instagram.com",
    "youtube.com",
    "google.com",
    "bing.com",
    "duckduckgo.com",
)


def clean_domain(raw_url_or_domain: str) -> str:
    """Extract clean domain name from URLs, email domains, or raw inputs.
    Returns empty string for registry/directory hosts that are not company domains.
    """
    if not raw_url_or_domain:
        return ""
    text = raw_url_or_domain.strip().lower()
    if "@" in text:
        text = text.split("@")[-1]
    if "://" in text:
        parsed = urllib.parse.urlparse(text)
        text = parsed.netloc or parsed.path
    text = re.sub(r"^www\.", "", text)
    text = text.split("/")[0].split("?")[0].split(":")[0]
    text = text.strip()
    if not text:
        return ""
    for blocked in _BLOCKED_EMAIL_FINDER_DOMAINS:
        if text == blocked or text.endswith("." + blocked):
            return ""
    return text


def extract_linkedin_handle(linkedin_url: str) -> Optional[str]:
    """Extract clean LinkedIn slug/handle from profile URL for Hunter's linkedin_handle parameter."""
    if not linkedin_url or "linkedin.com/in/" not in linkedin_url.lower():
        return None
    try:
        parts = linkedin_url.lower().split("linkedin.com/in/")[-1].split("/")
        slug = parts[0].split("?")[0].strip()
        return slug if slug else None
    except Exception:
        return None


class HunterClient:
    """
    Official asynchronous client for Hunter.io API v2.
    Adheres strictly to cardless free-tier quotas and rates.
    """

    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        self.api_key = (api_key or getattr(config, "HUNTER_API_KEY", "")).strip()
        self.base_url = (base_url or getattr(config, "HUNTER_API_BASE", "https://api.hunter.io/v2")).rstrip("/")

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    async def get_account_info(self) -> Dict[str, Any]:
        """
        Query GET /account
        Inspects account identity, plan level, billing reset date, and available requests.
        """
        if not self.is_configured:
            return {"status": "error", "message": "HUNTER_API_KEY is not configured"}

        url = f"{self.base_url}/account"
        headers = {"X-API-KEY": self.api_key, "Accept": "application/json"}

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    payload = resp.json().get("data", {})
                    reqs = payload.get("requests", {})
                    searches = reqs.get("searches", {})
                    verifs = reqs.get("verifications", {})
                    credits = reqs.get("credits", {})

                    # Synchronize in-memory quota tracking with Hunter server
                    avail_searches = searches.get("available", 25)
                    used_searches = searches.get("used", 0)
                    if "hunter" in config._quota_state:
                        config._quota_state["hunter"]["limit"] = avail_searches
                        config._quota_state["hunter"]["used"] = used_searches
                        config._quota_state["hunter"]["plan_name"] = payload.get("plan_name", "Free")

                    return {
                        "status": "ok",
                        "first_name": payload.get("first_name"),
                        "last_name": payload.get("last_name"),
                        "email": payload.get("email"),
                        "plan_name": payload.get("plan_name"),
                        "plan_level": payload.get("plan_level"),
                        "reset_date": payload.get("reset_date"),
                        "team_id": payload.get("team_id"),
                        "searches": {
                            "used": used_searches,
                            "available": avail_searches,
                            "remaining": searches.get("remaining", max(0, avail_searches - used_searches))
                        },
                        "verifications": {
                            "used": verifs.get("used", 0),
                            "available": verifs.get("available", 100),
                            "remaining": verifs.get("remaining", 100)
                        },
                        "credits": {
                            "used": credits.get("used", 0),
                            "available": credits.get("available", 50),
                            "remaining": credits.get("remaining", 50)
                        }
                    }
                elif resp.status_code == 401:
                    return {"status": "error", "message": "Invalid Hunter API key (401 Unauthorized)"}
                elif resp.status_code == 429:
                    return {"status": "error", "message": "Hunter API rate limit exceeded (429 Too Many Requests)"}
                else:
                    return {"status": "error", "message": f"Hunter API returned status {resp.status_code}: {resp.text}"}
        except Exception as e:
            log.error("Hunter get_account_info failed: %s", e)
            return {"status": "error", "message": str(e)}

    async def find_email(
        self,
        first_name: str = "",
        last_name: str = "",
        full_name: str = "",
        company: str = "",
        domain: str = "",
        linkedin_url: str = ""
    ) -> Dict[str, Any]:
        """
        Query GET /email-finder
        Discovers professional email address, confidence score, source citations,
        and optionally telephone number or LinkedIn profile.
        """
        if not self.is_configured:
            return {"found": False, "error": "Hunter API key not configured"}

        url = f"{self.base_url}/email-finder"
        params: Dict[str, Any] = {}

        # 1. Company or Domain (reject registry hosts — they are not emailable company domains)
        clean_dom = clean_domain(domain)
        if clean_dom:
            params["domain"] = clean_dom
        elif company and company.strip():
            params["company"] = company.strip()

        # 2. Name
        if first_name.strip() and last_name.strip():
            params["first_name"] = first_name.strip()
            params["last_name"] = last_name.strip()
        elif full_name.strip():
            params["full_name"] = full_name.strip()

        # 3. LinkedIn Handle
        handle = extract_linkedin_handle(linkedin_url)
        if handle:
            params["linkedin_handle"] = handle

        # Hunter requires at least (domain/company + name) OR linkedin_handle
        if not handle and not ("domain" in params or "company" in params):
            return {"found": False, "error": "Must provide a real company domain/name or linkedin_url (registry URLs blocked)"}
        if not handle and not ("first_name" in params or "full_name" in params):
            return {"found": False, "error": "Must provide person name"}

        # Free tier policy check — only after we know the request is valid
        if not config.check_and_increment_quota("hunter"):
            return {
                "found": False,
                "error": "Hunter monthly free quota exhausted. Deactivated to prevent charges."
            }

        headers = {"X-API-KEY": self.api_key, "Accept": "application/json"}

        try:
            async with httpx.AsyncClient(timeout=12) as client:
                resp = await client.get(url, params=params, headers=headers)
                if resp.status_code == 200:
                    data = resp.json().get("data", {})
                    email = data.get("email")
                    score = data.get("score") or 0
                    sources = data.get("sources") or []
                    primary_source = sources[0].get("uri") if sources else "https://hunter.io"
                    phone = data.get("phone_number")
                    li_url = data.get("linkedin_url")
                    position = data.get("position")

                    is_pers = is_personal_email(email) if email else False

                    return {
                        "found": bool(email),
                        "email": email,
                        "score": score,
                        "domain": data.get("domain") or clean_dom,
                        "company": data.get("company") or company,
                        "position": position,
                        "phone_number": phone,
                        "linkedin_url": li_url,
                        "sources": sources,
                        "primary_source_url": primary_source,
                        "verification_status": (data.get("verification") or {}).get("status", "unknown"),
                        "is_personal": is_pers,
                        "is_professional": not is_pers if email else False
                    }
                elif resp.status_code == 404:
                    return {"found": False, "error": "No email found in Hunter dataset"}
                elif resp.status_code == 429:
                    log.warning("[Hunter] 429 Rate limit or monthly quota limit reached.")
                    return {"found": False, "error": "Rate limit or monthly quota exhausted (429)"}
                else:
                    return {"found": False, "error": f"Hunter API status {resp.status_code}: {resp.text}"}
        except Exception as e:
            log.error("Hunter find_email request failed: %s", e)
            return {"found": False, "error": str(e)}

    async def verify_email(self, email: str) -> Dict[str, Any]:
        """
        Query GET /email-verifier
        Validates deliverability, syntax, MX records, and SMTP server acceptance.
        """
        if not self.is_configured:
            return {"status": "error", "message": "Hunter API key not configured"}
        if not email or "@" not in email:
            return {"status": "error", "message": "Invalid email format"}

        url = f"{self.base_url}/email-verifier"
        params = {"email": email.strip()}
        headers = {"X-API-KEY": self.api_key, "Accept": "application/json"}

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(url, params=params, headers=headers)
                if resp.status_code == 200:
                    data = resp.json().get("data", {})
                    return {
                        "status": "ok",
                        "email": data.get("email"),
                        "verification_status": data.get("status"),  # valid, invalid, accept_all, webmail, disposable, unknown
                        "result": data.get("result"),              # deliverable, undeliverable, risky
                        "score": data.get("score", 0),
                        "regexp": data.get("regexp", False),
                        "gibberish": data.get("gibberish", False),
                        "disposable": data.get("disposable", False),
                        "webmail": data.get("webmail", False),
                        "mx_records": data.get("mx_records", False),
                        "smtp_server": data.get("smtp_server", False),
                        "smtp_check": data.get("smtp_check", False),
                        "accept_all": data.get("accept_all", False),
                        "block": data.get("block", False),
                        "sources": data.get("sources", [])
                    }
                elif resp.status_code == 202:
                    return {"status": "pending", "message": "Email verification in progress"}
                elif resp.status_code == 429:
                    return {"status": "error", "message": "Hunter verification quota/rate limit exceeded (429)"}
                else:
                    return {"status": "error", "message": f"Hunter API error {resp.status_code}: {resp.text}"}
        except Exception as e:
            log.error("Hunter verify_email request failed: %s", e)
            return {"status": "error", "message": str(e)}

    async def domain_search(
        self,
        domain: str = "",
        company: str = "",
        type_: str = "personal",
        limit: int = 10
    ) -> Dict[str, Any]:
        """
        Query GET /domain-search
        Searches all verified emails indexed on a corporate or organizational domain.
        type_ can be 'personal' (named individuals) or 'generic' (role inboxes).
        """
        if not self.is_configured:
            return {"status": "error", "message": "Hunter API key not configured"}

        # Free tier policy check
        if not config.check_and_increment_quota("hunter"):
            return {
                "status": "error",
                "message": "Hunter monthly free quota exhausted. Deactivated to prevent charges."
            }

        url = f"{self.base_url}/domain-search"
        params: Dict[str, Any] = {"limit": min(limit, 20)}

        clean_dom = clean_domain(domain)
        if clean_dom:
            params["domain"] = clean_dom
        elif company and company.strip():
            params["company"] = company.strip()
        else:
            return {"status": "error", "message": "Must provide domain or company"}

        if type_ in ("personal", "generic"):
            params["type"] = type_

        headers = {"X-API-KEY": self.api_key, "Accept": "application/json"}

        try:
            async with httpx.AsyncClient(timeout=12) as client:
                resp = await client.get(url, params=params, headers=headers)
                if resp.status_code == 200:
                    data = resp.json().get("data", {})
                    emails = data.get("emails", [])
                    results = []
                    for item in emails:
                        results.append({
                            "email": item.get("value"),
                            "type": item.get("type"),
                            "confidence": item.get("confidence"),
                            "first_name": item.get("first_name"),
                            "last_name": item.get("last_name"),
                            "position": item.get("position"),
                            "seniority": item.get("seniority"),
                            "department": item.get("department"),
                            "linkedin": item.get("linkedin"),
                            "phone_number": item.get("phone_number")
                        })
                    return {
                        "status": "ok",
                        "domain": data.get("domain"),
                        "disposable": data.get("disposable"),
                        "webmail": data.get("webmail"),
                        "pattern": data.get("pattern"),
                        "organization": data.get("organization"),
                        "count": len(results),
                        "results": results
                    }
                elif resp.status_code == 429:
                    return {"status": "error", "message": "Hunter quota or rate limit exceeded (429)"}
                else:
                    return {"status": "error", "message": f"Hunter API status {resp.status_code}: {resp.text}"}
        except Exception as e:
            log.error("Hunter domain_search request failed: %s", e)
            return {"status": "error", "message": str(e)}
