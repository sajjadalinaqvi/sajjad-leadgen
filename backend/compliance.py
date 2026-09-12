import re
import time
import logging
from typing import Optional, Dict, Any, Tuple
from database import get_db_connection, is_suppressed, log_audit_event

log = logging.getLogger(__name__)

# In-memory domain request tracker for polite throttling
DOMAIN_LAST_REQUEST: Dict[str, float] = {}
CIRCUIT_BREAKER_DOMAINS: Dict[str, float] = {} # domain -> cooldown timestamp
MIN_DOMAIN_DELAY_SECONDS = 1.5
CIRCUIT_BREAKER_COOLDOWN = 300.0 # 5 minutes cooldown if 429 / 403 detected


def check_duplicate_lead(
    email: Optional[str] = None,
    phone: Optional[str] = None,
    profile_url: Optional[str] = None,
    full_name: Optional[str] = None,
    company: Optional[str] = None
) -> Tuple[bool, Optional[str]]:
    """
    Check if a candidate already exists in the database.
    Returns (is_duplicate: bool, existing_lead_id: Optional[str]).
    """
    conn = get_db_connection()
    c = conn.cursor()

    # 1. Match by Email
    if email and email.strip():
        norm_email = email.strip().lower()
        c.execute("SELECT id FROM leads WHERE LOWER(public_email) = ?", (norm_email,))
        row = c.fetchone()
        if row:
            conn.close()
            return True, row[0]

    # 2. Match by Phone
    if phone and phone.strip():
        digits = "".join(filter(str.isdigit, phone))
        if len(digits) >= 8:
            c.execute("SELECT id, public_phone FROM leads WHERE public_phone IS NOT NULL AND public_phone != ''")
            for r in c.fetchall():
                r_digits = "".join(filter(str.isdigit, r[1] or ""))
                if r_digits and (r_digits == digits or r_digits.endswith(digits) or digits.endswith(r_digits)):
                    conn.close()
                    return True, r[0]

    # 3. Match by Profile URL
    if profile_url and profile_url.strip():
        norm_url = profile_url.strip().lower().rstrip("/")
        c.execute("SELECT id FROM leads WHERE LOWER(professional_profile_url) LIKE ?", (f"%{norm_url}%",))
        row = c.fetchone()
        if row:
            conn.close()
            return True, row[0]

    # 4. Match by Name + Company
    if full_name and company and full_name.strip() and company.strip():
        norm_name = re.sub(r"[^\w\s]", "", full_name.strip().lower())
        norm_comp = re.sub(r"[^\w\s]", "", company.strip().lower())
        c.execute("SELECT id, full_name, company FROM leads WHERE full_name IS NOT NULL AND company IS NOT NULL")
        for r in c.fetchall():
            rn = re.sub(r"[^\w\s]", "", (r[1] or "").lower())
            rc = re.sub(r"[^\w\s]", "", (r[2] or "").lower())
            if rn == norm_name and (rc in norm_comp or norm_comp in rc):
                conn.close()
                return True, r[0]

    conn.close()
    return False, None


def is_contact_suppressed(email: str = "", phone: str = "", domain: str = "") -> bool:
    """Helper wrapper to check suppression list."""
    return is_suppressed(email=email, phone=phone, domain=domain)


def should_throttle_domain(domain: str) -> float:
    """Returns seconds to wait before requesting domain to prevent aggressive scraping."""
    now = time.time()
    
    # Check circuit breaker
    if domain in CIRCUIT_BREAKER_DOMAINS:
        cooldown_until = CIRCUIT_BREAKER_DOMAINS[domain]
        if now < cooldown_until:
            return cooldown_until - now
        else:
            del CIRCUIT_BREAKER_DOMAINS[domain]

    last_time = DOMAIN_LAST_REQUEST.get(domain, 0)
    elapsed = now - last_time
    if elapsed < MIN_DOMAIN_DELAY_SECONDS:
        return MIN_DOMAIN_DELAY_SECONDS - elapsed
    return 0.0


def record_domain_request(domain: str):
    DOMAIN_LAST_REQUEST[domain] = time.time()


def trigger_circuit_breaker(domain: str, reason: str = "HTTP 429 Rate Limit / CAPTCHA"):
    """Trip circuit breaker for a domain to immediately stop automated requests without evasion."""
    log.warning("Circuit breaker tripped for domain %s: %s", domain, reason)
    CIRCUIT_BREAKER_DOMAINS[domain] = time.time() + CIRCUIT_BREAKER_COOLDOWN
    log_audit_event(None, "circuit_breaker", {"domain": domain, "reason": reason, "cooldown_sec": CIRCUIT_BREAKER_COOLDOWN})
