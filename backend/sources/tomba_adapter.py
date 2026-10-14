"""
tomba_adapter.py - Official Tomba.io API Integration
===================================================
API Documentation & Specification:
- Base URL: https://api.tomba.io/v1
- Authentication:
    X-Tomba-Key: $TOMBA_API_KEY
    X-Tomba-Secret: $TOMBA_SECRET_KEY
- Cardless Free Tier: 25 searches/month

Supported Operations:
1. get_account_info: Query GET /me for account profile, usage, plan, and active status.
2. find_email: Discover email from name and company/domain via GET /email-finder.
3. find_by_linkedin: Discover email from LinkedIn URL via GET /linkedin.
4. find_phone: Discover phone numbers via GET /phone-finder.
5. verify_email: Verify email deliverability and score via GET /email-verifier/{email}.
6. domain_search: Search emails on an organization domain via GET /domain-search.
"""

import logging
import urllib.parse
from typing import Dict, Any, Optional, List

import httpx
import config
from contact_validator import (
    is_personal_email,
    classify_phone_number,
    validate_genuine_linkedin_url
)
from sources.hunter_adapter import clean_domain

log = logging.getLogger(__name__)

# Standard browser UA to avoid Cloudflare 1010 block
TOMBA_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 ApexLead/1.0"


class TombaClient:
    """
    Official asynchronous client for Tomba.io API v1.
    Adheres strictly to cardless free-tier quotas and rates.
    """

    # Shared across instances — stop hammering once Tomba reports account blocked
    _account_blocked: bool = False
    _blocked_reason: str = ""

    def __init__(
        self,
        api_key: Optional[str] = None,
        secret_key: Optional[str] = None,
        base_url: Optional[str] = None
    ):
        self.api_key = (api_key or getattr(config, "TOMBA_API_KEY", "")).strip()
        self.secret_key = (secret_key or getattr(config, "TOMBA_SECRET_KEY", "")).strip()
        self.base_url = (base_url or getattr(config, "TOMBA_API_BASE", "https://api.tomba.io/v1")).rstrip("/")

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.secret_key) and not TombaClient._account_blocked

    def _mark_blocked(self, reason: str):
        TombaClient._account_blocked = True
        TombaClient._blocked_reason = reason
        if "tomba" in config._quota_state:
            config._quota_state["tomba"]["is_blocked"] = True
            config._quota_state["tomba"]["blocked_reason"] = reason
        log.warning("[Tomba] Account blocked — further requests paused: %s", reason)

    def _headers(self) -> Dict[str, str]:
        return {
            "X-Tomba-Key": self.api_key,
            "X-Tomba-Secret": self.secret_key,
            "Accept": "application/json",
            "User-Agent": TOMBA_USER_AGENT,
        }

    async def get_account_info(self) -> Dict[str, Any]:
        """
        Query GET /me
        Inspects account identity, plan level, credit limits, and checks if account is blocked.
        """
        if not self.is_configured:
            return {"status": "error", "message": "TOMBA_API_KEY or TOMBA_SECRET_KEY is not configured"}

        url = f"{self.base_url}/me"
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(url, headers=self._headers())
                if resp.status_code == 200:
                    data = resp.json().get("data", {})
                    pricing = data.get("pricing", {})
                    requests = pricing.get("requests", {})
                    used = requests.get("used", 0)
                    available = requests.get("available", 25)

                    # Synchronize in-memory quota tracking with Tomba server
                    if "tomba" in config._quota_state:
                        config._quota_state["tomba"]["limit"] = available
                        config._quota_state["tomba"]["used"] = used
                        config._quota_state["tomba"]["is_blocked"] = False

                    return {
                        "status": "ok",
                        "first_name": data.get("first_name"),
                        "last_name": data.get("last_name"),
                        "email": data.get("email"),
                        "plan": pricing.get("name", "Free"),
                        "searches": {
                            "used": used,
                            "available": available,
                            "remaining": max(0, available - used)
                        },
                        "is_blocked": False
                    }
                elif resp.status_code == 403:
                    try:
                        err_payload = resp.json().get("errors", {})
                        msg = err_payload.get("message", "Forbidden")
                        err_type = err_payload.get("type", "authentication_failed")
                    except Exception:
                        msg = resp.text
                        err_type = "forbidden"

                    is_blocked = "blocked" in msg.lower()
                    if is_blocked:
                        self._mark_blocked(msg)

                    log.warning("[Tomba] Account status: %s (is_blocked=%s)", msg, is_blocked)
                    return {
                        "status": "error",
                        "error_type": err_type,
                        "message": msg,
                        "is_blocked": is_blocked
                    }
                elif resp.status_code == 401:
                    return {"status": "error", "message": "Invalid Tomba API Key or Secret", "is_blocked": False}
                else:
                    return {"status": "error", "message": f"Tomba API returned {resp.status_code}: {resp.text}", "is_blocked": False}
        except Exception as e:
            log.error("Tomba get_account_info failed: %s", e)
            return {"status": "error", "message": str(e), "is_blocked": False}

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
        Query GET /email-finder (or fallback to GET /linkedin if only LinkedIn URL is present).
        """
        if TombaClient._account_blocked:
            return {"found": False, "error": TombaClient._blocked_reason or "Tomba account blocked", "is_blocked": True}
        if not self.is_configured:
            return {"found": False, "error": "Tomba API credentials not configured"}

        # If LinkedIn profile provided and no company/domain, use /linkedin endpoint
        if linkedin_url and not (domain or company):
            return await self.find_by_linkedin(linkedin_url)

        url = f"{self.base_url}/email-finder"
        params: Dict[str, Any] = {}

        clean_dom = clean_domain(domain)
        if clean_dom:
            params["domain"] = clean_dom
        elif company and company.strip():
            params["company"] = company.strip()
        else:
            return {"found": False, "error": "Must provide a real company domain/name (registry URLs blocked)"}

        if first_name.strip() and last_name.strip():
            params["first_name"] = first_name.strip()
            params["last_name"] = last_name.strip()
        elif full_name.strip():
            parts = full_name.strip().split()
            params["first_name"] = parts[0]
            params["last_name"] = parts[-1] if len(parts) > 1 else parts[0]
        else:
            return {"found": False, "error": "Must provide person name"}

        # Quota check — only after request is valid
        if not config.check_and_increment_quota("tomba"):
            return {
                "found": False,
                "error": "Tomba monthly free quota exhausted. Deactivated to prevent charges."
            }

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(url, params=params, headers=self._headers())
                if resp.status_code == 200:
                    data = resp.json().get("data", {})
                    email = data.get("email")
                    score = data.get("score") or 0
                    sources = data.get("sources") or []
                    primary_source = sources[0].get("uri") if sources else "https://tomba.io"

                    is_pers = is_personal_email(email) if email else False

                    return {
                        "found": bool(email),
                        "email": email,
                        "score": score,
                        "first_name": data.get("first_name"),
                        "last_name": data.get("last_name"),
                        "domain": data.get("domain") or clean_dom,
                        "company": data.get("company") or company,
                        "position": data.get("position"),
                        "sources": sources,
                        "primary_source_url": primary_source,
                        "is_personal": is_pers,
                        "is_professional": not is_pers if email else False
                    }
                elif resp.status_code == 403:
                    try:
                        msg = resp.json().get("errors", {}).get("message", "Account blocked or forbidden")
                    except Exception:
                        msg = resp.text
                    if "blocked" in msg.lower():
                        self._mark_blocked(msg)
                    log.warning("[Tomba] 403 response: %s", msg)
                    return {"found": False, "error": msg, "is_blocked": "blocked" in msg.lower()}
                elif resp.status_code == 404:
                    return {"found": False, "error": "No email found in Tomba dataset"}
                elif resp.status_code == 429:
                    return {"found": False, "error": "Tomba rate limit or quota exceeded (429)"}
                else:
                    return {"found": False, "error": f"Tomba API status {resp.status_code}: {resp.text}"}
        except Exception as e:
            log.error("Tomba find_email failed: %s", e)
            return {"found": False, "error": str(e)}

    async def find_by_linkedin(self, linkedin_url: str) -> Dict[str, Any]:
        """
        Query GET /linkedin
        Finds email address directly from a LinkedIn profile URL.
        """
        if TombaClient._account_blocked:
            return {"found": False, "error": TombaClient._blocked_reason or "Tomba account blocked", "is_blocked": True}
        if not self.is_configured:
            return {"found": False, "error": "Tomba API credentials not configured"}
        if not linkedin_url:
            return {"found": False, "error": "LinkedIn URL is required"}

        if not config.check_and_increment_quota("tomba"):
            return {
                "found": False,
                "error": "Tomba monthly free quota exhausted. Deactivated to prevent charges."
            }

        url = f"{self.base_url}/linkedin"
        params = {"url": linkedin_url.strip()}

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(url, params=params, headers=self._headers())
                if resp.status_code == 200:
                    data = resp.json().get("data", {})
                    email = data.get("email")
                    score = data.get("score") or 0
                    is_pers = is_personal_email(email) if email else False
                    return {
                        "found": bool(email),
                        "email": email,
                        "score": score,
                        "first_name": data.get("first_name"),
                        "last_name": data.get("last_name"),
                        "company": data.get("company"),
                        "position": data.get("position"),
                        "linkedin_url": linkedin_url,
                        "is_personal": is_pers,
                        "is_professional": not is_pers if email else False
                    }
                elif resp.status_code == 403:
                    try:
                        msg = resp.json().get("errors", {}).get("message", "Forbidden")
                    except Exception:
                        msg = resp.text
                    return {"found": False, "error": msg, "is_blocked": "blocked" in msg.lower()}
                else:
                    return {"found": False, "error": f"Tomba API status {resp.status_code}: {resp.text}"}
        except Exception as e:
            log.error("Tomba find_by_linkedin failed: %s", e)
            return {"found": False, "error": str(e)}

    async def find_phone(
        self,
        email: str = "",
        linkedin_url: str = "",
        domain: str = ""
    ) -> Dict[str, Any]:
        """
        Query GET /phone-finder
        Finds phone numbers from email, LinkedIn profile URL, or company domain.
        """
        if not self.is_configured:
            return {"found": False, "error": "Tomba API credentials not configured"}

        url = f"{self.base_url}/phone-finder"
        params: Dict[str, Any] = {}
        if email:
            params["email"] = email.strip()
        elif linkedin_url:
            params["url"] = linkedin_url.strip()
        elif domain:
            params["domain"] = clean_domain(domain)
        else:
            return {"found": False, "error": "Must provide email, linkedin_url, or domain"}

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(url, params=params, headers=self._headers())
                if resp.status_code == 200:
                    data = resp.json().get("data", {})
                    phone = data.get("phone_number")
                    ph_info = classify_phone_number(phone) if phone else {}
                    return {
                        "found": bool(phone),
                        "phone_number": phone,
                        "phone_type": ph_info.get("phone_type", "unknown"),
                        "is_mobile": ph_info.get("is_mobile", False),
                        "formatted_e164": ph_info.get("formatted_e164") or phone,
                        "country": data.get("country")
                    }
                elif resp.status_code == 403:
                    try:
                        msg = resp.json().get("errors", {}).get("message", "Forbidden")
                    except Exception:
                        msg = resp.text
                    return {"found": False, "error": msg, "is_blocked": "blocked" in msg.lower()}
                else:
                    return {"found": False, "error": f"Tomba API status {resp.status_code}: {resp.text}"}
        except Exception as e:
            log.error("Tomba find_phone failed: %s", e)
            return {"found": False, "error": str(e)}

    async def verify_email(self, email: str) -> Dict[str, Any]:
        """
        Query GET /email-verifier/{email}
        Validates deliverability, catch-all, and verification score.
        """
        if not self.is_configured:
            return {"status": "error", "message": "Tomba API credentials not configured"}
        if not email or "@" not in email:
            return {"status": "error", "message": "Invalid email address format"}

        safe_email = urllib.parse.quote(email.strip())
        url = f"{self.base_url}/email-verifier/{safe_email}"

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(url, headers=self._headers())
                if resp.status_code == 200:
                    data = resp.json().get("data", {})
                    return {
                        "status": "ok",
                        "email": data.get("email"),
                        "result": data.get("result"),  # deliverable, undeliverable, risky
                        "score": data.get("score", 0),
                        "accept_all": data.get("accept_all", False),
                        "disposable": data.get("disposable", False),
                        "webmail": data.get("webmail", False),
                        "mx_records": data.get("mx_records", False),
                        "smtp_check": data.get("smtp_check", False),
                        "sources": data.get("sources", [])
                    }
                elif resp.status_code == 403:
                    try:
                        msg = resp.json().get("errors", {}).get("message", "Forbidden")
                    except Exception:
                        msg = resp.text
                    return {"status": "error", "message": msg, "is_blocked": "blocked" in msg.lower()}
                else:
                    return {"status": "error", "message": f"Tomba API status {resp.status_code}: {resp.text}"}
        except Exception as e:
            log.error("Tomba verify_email failed: %s", e)
            return {"status": "error", "message": str(e)}

    async def domain_search(
        self,
        domain: str = "",
        company: str = "",
        limit: int = 10
    ) -> Dict[str, Any]:
        """
        Query GET /domain-search
        Retrieves published emails for an organization domain.
        """
        if not self.is_configured:
            return {"status": "error", "message": "Tomba API credentials not configured"}

        if not config.check_and_increment_quota("tomba"):
            return {
                "status": "error",
                "message": "Tomba monthly free quota exhausted. Deactivated to prevent charges."
            }

        url = f"{self.base_url}/domain-search"
        clean_dom = clean_domain(domain)
        params: Dict[str, Any] = {"limit": min(limit, 20)}
        if clean_dom:
            params["domain"] = clean_dom
        elif company:
            params["company"] = company.strip()
        else:
            return {"status": "error", "message": "Must provide domain or company"}

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(url, params=params, headers=self._headers())
                if resp.status_code == 200:
                    data = resp.json().get("data", {})
                    emails = data.get("emails", [])
                    return {
                        "status": "ok",
                        "domain": data.get("domain"),
                        "organization": data.get("organization"),
                        "pattern": data.get("pattern"),
                        "total": data.get("total", len(emails)),
                        "results": emails
                    }
                elif resp.status_code == 403:
                    try:
                        msg = resp.json().get("errors", {}).get("message", "Forbidden")
                    except Exception:
                        msg = resp.text
                    return {"status": "error", "message": msg, "is_blocked": "blocked" in msg.lower()}
                else:
                    return {"status": "error", "message": f"Tomba API status {resp.status_code}: {resp.text}"}
        except Exception as e:
            log.error("Tomba domain_search failed: %s", e)
            return {"status": "error", "message": str(e)}
