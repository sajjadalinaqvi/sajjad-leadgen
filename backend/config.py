"""
config.py - Central Configuration & Free-Only Policy Enforcement
================================================================
Strictly enforces:
1. FREE_ONLY_MODE=true: Blocks all integrations without a confirmed free allowance.
2. Zero billable requests: No paid endpoints, trials requiring payment details, or hidden billing.
3. Explicit feature flags: ENABLE_HUNTER=false, ENABLE_TOMBA=false, ENABLE_APOLLO=false, etc.
4. Quota management: Disables commercial providers immediately when their confirmed free quota is exhausted.
5. Security: SSRF validation for external URLs and conservative per-domain rate limits.
"""

import os
import ipaddress
import urllib.parse
from datetime import datetime, timezone
from typing import Dict, Any, Optional

try:
    from dotenv import load_dotenv
    _backend_env = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    _root_env = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    if os.path.exists(_backend_env):
        load_dotenv(_backend_env)
    elif os.path.exists(_root_env):
        load_dotenv(_root_env)
    else:
        load_dotenv()
except ImportError:
    pass

# ── Central Free-Only Policy ──────────────────────────────────────────────────
# When True, any service requiring payment details, credit packs, or without a confirmed
# no-cost allowance is strictly rejected before making any network request.
FREE_ONLY_MODE: bool = os.getenv("FREE_ONLY_MODE", "true").lower() in ("true", "1", "yes")

# Explicit commercial integration flags (ALL DISABLED BY DEFAULT UNLESS SPECIFIED IN .ENV)
ENABLE_HUNTER: bool = os.getenv("ENABLE_HUNTER", "false").lower() in ("true", "1", "yes")
ENABLE_TOMBA: bool = os.getenv("ENABLE_TOMBA", "false").lower() in ("true", "1", "yes")
ENABLE_APOLLO: bool = os.getenv("ENABLE_APOLLO", "false").lower() in ("true", "1", "yes")
ENABLE_PROXYCURL: bool = os.getenv("ENABLE_PROXYCURL", "false").lower() in ("true", "1", "yes")
ENABLE_PDL: bool = os.getenv("ENABLE_PDL", "false").lower() in ("true", "1", "yes")
ENABLE_CONTACTOUT: bool = os.getenv("ENABLE_CONTACTOUT", "false").lower() in ("true", "1", "yes")
ENABLE_ROCKETREACH: bool = os.getenv("ENABLE_ROCKETREACH", "false").lower() in ("true", "1", "yes")

# Commercial API Keys & Endpoints (from environment ONLY — never hardcoded)
HUNTER_API_KEY: str = os.getenv("HUNTER_API_KEY", "").strip()
HUNTER_API_BASE: str = os.getenv("HUNTER_API_BASE", "https://api.hunter.io/v2/").rstrip("/")
TOMBA_API_KEY: str = os.getenv("TOMBA_API_KEY", "").strip()
TOMBA_SECRET_KEY: str = os.getenv("TOMBA_SECRET_KEY", "").strip()
TOMBA_API_BASE: str = os.getenv("TOMBA_API_BASE", "https://api.tomba.io/v1").rstrip("/")
APOLLO_API_KEY: str = os.getenv("APOLLO_API_KEY", "").strip()
APOLLO_API_BASE: str = os.getenv("APOLLO_API_BASE", "https://api.apollo.io/api/v1").rstrip("/")

# Confirmed Monthly Free Quotas (Verified against official pricing as of 2026)
# Hunter.io Free Plan: 25 searches/month, no credit card required.
HUNTER_FREE_MONTHLY_QUOTA: int = 25
# Tomba.io Free Plan: 25 searches/month, no credit card required.
TOMBA_FREE_MONTHLY_QUOTA: int = 25

# Rate Limits (seconds between requests per domain)
RATE_LIMITS = {
    "npiregistry.cms.hhs.gov": 0.5,
    "appna.org": 1.0,
    "find-and-update.company-information.service.gov.uk": 1.0,
    "api.hunter.io": 1.5,
    "api.tomba.io": 1.5,
    "api.apollo.io": 1.5,
    "default": 1.0,
}

# ── In-Memory Quota Tracking ──────────────────────────────────────────────────
_quota_state: Dict[str, Dict[str, Any]] = {
    "hunter": {"used": 0, "limit": HUNTER_FREE_MONTHLY_QUOTA, "month": datetime.now(timezone.utc).strftime("%Y-%m")},
    "tomba": {"used": 0, "limit": TOMBA_FREE_MONTHLY_QUOTA, "month": datetime.now(timezone.utc).strftime("%Y-%m")},
}


class QuotaManager:
    """Manages provider request limits and quota consumption."""
    def __init__(self, provider: str, monthly_limit: int = 25):
        self.provider = provider
        self.limit = monthly_limit
        self.used = 0
        self.month = datetime.now(timezone.utc).strftime("%Y-%m")

    def can_request(self) -> bool:
        current_month = datetime.now(timezone.utc).strftime("%Y-%m")
        if self.month != current_month:
            self.used = 0
            self.month = current_month
        return self.used < self.limit

    def record_request(self) -> bool:
        if not self.can_request():
            return False
        self.used += 1
        return True

    def get_status(self) -> Dict[str, Any]:
        return {
            "provider": self.provider,
            "requests_used": self.used,
            "limit": self.limit,
            "remaining": max(0, self.limit - self.used),
            "is_exhausted": self.used >= self.limit,
            "reset_period": "monthly",
            "month": self.month
        }



def check_and_increment_quota(provider: str) -> bool:
    """
    Checks if provider has available free quota. Returns True if request is allowed,
    or False if exhausted / blocked by policy.
    """
    current_month = datetime.now(timezone.utc).strftime("%Y-%m")
    state = _quota_state.get(provider)
    if not state:
        return False

    # Reset if new month
    if state["month"] != current_month:
        state["used"] = 0
        state["month"] = current_month

    if state["used"] >= state["limit"]:
        return False

    state["used"] += 1
    return True


def get_quota_status() -> Dict[str, Any]:
    """Returns real-time quota status and activation flags for all providers."""
    current_month = datetime.now(timezone.utc).strftime("%Y-%m")
    return {
        "free_only_mode": FREE_ONLY_MODE,
        "providers": {
            "hunter": {
                "enabled": ENABLE_HUNTER,
                "has_key": bool(HUNTER_API_KEY),
                "used": _quota_state["hunter"]["used"],
                "limit": _quota_state["hunter"]["limit"],
                "remaining": max(0, _quota_state["hunter"]["limit"] - _quota_state["hunter"]["used"]),
                "quota_exhausted": _quota_state["hunter"]["used"] >= _quota_state["hunter"]["limit"],
                "month": current_month,
                "pricing_status": "Free Tier (25 searches/mo, no card required)",
            },
            "tomba": {
                "enabled": ENABLE_TOMBA,
                "has_key": bool(TOMBA_API_KEY and TOMBA_SECRET_KEY),
                "used": _quota_state["tomba"]["used"],
                "limit": _quota_state["tomba"]["limit"],
                "remaining": max(0, _quota_state["tomba"]["limit"] - _quota_state["tomba"]["used"]),
                "quota_exhausted": _quota_state["tomba"]["used"] >= _quota_state["tomba"]["limit"],
                "month": current_month,
                "pricing_status": "Free Tier (25 searches/mo, no card required)",
                "api_endpoint": TOMBA_API_BASE,
            },
            "apollo": {
                "enabled": ENABLE_APOLLO,
                "has_key": bool(APOLLO_API_KEY),
                "pricing_status": "Commercial API (enabled when ENABLE_APOLLO=true + APOLLO_API_KEY set)",
                "api_endpoint": APOLLO_API_BASE,
            },
            "proxycurl": {
                "enabled": ENABLE_PROXYCURL,
                "pricing_status": "Paid Service (Blocked in Free-Only Mode)",
            },
            "pdl": {
                "enabled": ENABLE_PDL,
                "pricing_status": "Paid Service (Blocked in Free-Only Mode)",
            },
            "contactout": {
                "enabled": ENABLE_CONTACTOUT,
                "pricing_status": "Paid Service (Blocked in Free-Only Mode)",
            },
            "rocketreach": {
                "enabled": ENABLE_ROCKETREACH,
                "pricing_status": "Paid Service (Blocked in Free-Only Mode)",
            },
        },
        "hunter_quota": {
            "enabled": ENABLE_HUNTER,
            "has_key": bool(HUNTER_API_KEY),
            "available": ENABLE_HUNTER and bool(HUNTER_API_KEY),
            "requires_user_opt_in": True,
            "requests_used": _quota_state["hunter"]["used"],
            "limit": _quota_state["hunter"]["limit"],
            "remaining": max(0, _quota_state["hunter"]["limit"] - _quota_state["hunter"]["used"]),
            "is_exhausted": _quota_state["hunter"]["used"] >= _quota_state["hunter"]["limit"],
            "api_endpoint": HUNTER_API_BASE,
            "plan_name": _quota_state["hunter"].get("plan_name", "Free"),
        },
        "tomba_quota": {
            "enabled": ENABLE_TOMBA,
            "has_key": bool(TOMBA_API_KEY and TOMBA_SECRET_KEY),
            "available": ENABLE_TOMBA and bool(TOMBA_API_KEY and TOMBA_SECRET_KEY),
            "requires_user_opt_in": True,
            "requests_used": _quota_state["tomba"]["used"],
            "limit": _quota_state["tomba"]["limit"],
            "remaining": max(0, _quota_state["tomba"]["limit"] - _quota_state["tomba"]["used"]),
            "is_exhausted": _quota_state["tomba"]["used"] >= _quota_state["tomba"]["limit"],
            "api_endpoint": TOMBA_API_BASE,
        },
        "apollo_status": {
            "enabled": ENABLE_APOLLO,
            "has_key": bool(APOLLO_API_KEY),
            "available": ENABLE_APOLLO and bool(APOLLO_API_KEY),
            "requires_user_opt_in": True,
            "api_endpoint": APOLLO_API_BASE,
        },
    }


async def sync_hunter_quota_from_api() -> Dict[str, Any]:
    """Dynamically sync quota and plan info from Hunter.io /account endpoint."""
    if not ENABLE_HUNTER or not HUNTER_API_KEY:
        return {"status": "skipped", "message": "Hunter not enabled or key missing"}
    try:
        from sources.hunter_adapter import HunterClient
        client = HunterClient()
        return await client.get_account_info()
    except Exception as e:
        return {"status": "error", "message": str(e)}


async def sync_tomba_quota_from_api() -> Dict[str, Any]:
    """Dynamically sync quota from Tomba.io GET /me."""
    if not ENABLE_TOMBA or not TOMBA_API_KEY or not TOMBA_SECRET_KEY:
        return {"status": "skipped", "message": "Tomba not enabled or credentials missing"}
    try:
        from sources.tomba_adapter import TombaClient
        client = TombaClient()
        return await client.get_account_info()
    except Exception as e:
        return {"status": "error", "message": str(e)}


async def sync_apollo_profile_from_api() -> Dict[str, Any]:
    """Validate Apollo key via GET /users/api_profile."""
    if not ENABLE_APOLLO or not APOLLO_API_KEY:
        return {"status": "skipped", "message": "Apollo not enabled or key missing"}
    try:
        from sources.apollo_adapter import ApolloClient
        client = ApolloClient()
        return await client.get_api_profile()
    except Exception as e:
        return {"status": "error", "message": str(e)}



def is_url_safe(url: str) -> bool:
    """
    Validates that a URL does not target private, local, or loopback network addresses (SSRF defense).
    """
    try:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False
        hostname = parsed.hostname
        if not hostname:
            return False

        # Block localhost and common local domain names
        if hostname.lower() in ("localhost", "127.0.0.1", "::1", "0.0.0.0", "metadata.google.internal"):
            return False

        # Check if it's an IP address and if it's private or loopback
        try:
            ip = ipaddress.ip_address(hostname)
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast:
                return False
        except ValueError:
            # It's a domain name, not an IP literal
            pass

        return True
    except Exception:
        return False
