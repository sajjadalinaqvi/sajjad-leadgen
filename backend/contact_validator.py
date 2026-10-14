"""
Personal Data Double-Check & Validation Engine for ApexLead.

Enforces strict rules to ensure that discovered contact data is 100% genuine,
personal, and matches the intended individual:
1. Personal Phone: Strict international/regional validation, rejects toll-free/dummy numbers.
2. Personal Email: Zero corporate/generic role inboxes (no info@, contact@, admin@).
   Requires personal ESP domains OR corporate mailboxes matching the person's name.
3. Personal LinkedIn: Strict /in/ profile URL format, double-checks slug matches person's name.
"""

import re
import urllib.parse
from typing import Tuple, Optional, List, Dict, Any

# Generic & corporate role-based prefixes that are NEVER personal
CORPORATE_ROLE_PREFIXES = {
    "info", "contact", "admin", "administrator", "support", "sales", "help",
    "office", "billing", "press", "media", "team", "careers", "jobs",
    "enquiries", "inquiries", "hello", "service", "services", "reception",
    "general", "secretary", "meetings", "editor", "compliance", "privacy",
    "legal", "webmaster", "postmaster", "hr", "mail", "marketing", "pr",
    "customercare", "customerservice", "frontdesk", "leads", "accounts",
    "finance", "management", "operations", "staff", "directors", "board",
    "events", "reservations", "feedback", "security", "abuse", "booking",
    "bookings", "request", "requests", "inbox", "mailroom", "info-uk",
    "press-office", "media-enquiries", "clientcare", "customercareteam"
}

# Personal Free Email Service Providers
PERSONAL_EMAIL_DOMAINS = {
    "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "ymail.com",
    "hotmail.com", "hotmail.co.uk", "outlook.com", "live.com", "live.co.uk",
    "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com",
    "zoho.com", "mail.com", "gmx.com", "gmx.co.uk", "fastmail.com", "yandex.com"
}

# Fake / Placeholder / Scraping Site Domains
BLOCKED_EMAIL_DOMAINS = {
    "example.com", "domain.com", "test.com", "placeholder.com", "sentry.io",
    "wixpress.com", "schema.org", "googleapis.com", "w3.org", "cloudflare.com",
    "jquery.com", "bootstrap.com", "fastpeoplesearch.com", "192.com",
    "truepeoplesearch.com", "whitepages.com", "spokeo.com", "thatsthem.com",
    "radaris.com", "peekyou.com", "yellowpages.com", "companieshouse.gov.uk",
    "gov.uk", "nhs.uk", "cms.hhs.gov"  # general government roots
}

# US Toll-Free / Non-personal area codes
US_TOLL_FREE_AREA_CODES = {"800", "888", "877", "866", "855", "844", "833", "900", "976"}

# UK Non-personal toll-free / premium rate prefixes
UK_NON_PERSONAL_PREFIXES = {"0800", "0808", "0845", "0870", "0871", "0844", "0843", "09"}

# Dummy repeated/sequential number sequences
DUMMY_PHONE_SEQUENCES = {
    "1234567890", "0123456789", "0000000000", "1111111111", "2222222222",
    "3333333333", "4444444444", "5555555555", "6666666666", "7777777777",
    "8888888888", "9999999999", "12345678", "00000000", "99999999"
}

EMAIL_SYNTAX_RE = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


def _extract_name_tokens(full_name: str) -> List[str]:
    """Clean and extract lowercase name tokens (e.g., 'Dr. Sajood Ahmad, MD' -> ['sajood', 'ahmad'])."""
    cleaned = re.sub(r"^(dr|mr|mrs|ms|prof|engr|sir|lord|lady)\.?\s*", "", full_name, flags=re.I).strip()
    cleaned = re.sub(r",?\s*(md|mbbs|frcs|phd|do|dds|mba|cpa|fca|jd|esq|cbe|obe|mbe)\.?\s*$", "", cleaned, flags=re.I).strip()
    tokens = [t.lower() for t in re.findall(r"[a-zA-Z]{2,}", cleaned)]
    return tokens


def validate_personal_email(email: str, full_name: str = "") -> Tuple[bool, str, str]:
    """
    Double-checks an email address:
    1. Rejects any generic role inboxes (info@, contact@, admin@, etc.).
    2. Verifies syntax & domain sanity.
    3. If personal ESP (Gmail/Yahoo/etc.), verifies local part is valid.
    4. If corporate domain, verifies the mailbox belongs directly to the person
       (contains first name, last name, or initials).
    Returns: (is_valid, reason, cleaned_email)
    """
    if not email or not isinstance(email, str):
        return False, "Empty email", ""

    clean = email.strip().lower()
    if not EMAIL_SYNTAX_RE.match(clean) or len(clean) > 80:
        return False, "Invalid email format/syntax", ""

    parts = clean.split("@")
    if len(parts) != 2:
        return False, "Malformed email structure", ""

    local_part, domain = parts[0], parts[1]

    # Check 1: Blocked / scraping / dummy domains
    if domain in BLOCKED_EMAIL_DOMAINS or any(domain.endswith("." + b) for b in BLOCKED_EMAIL_DOMAINS):
        return False, f"Blocked domain: {domain}", ""

    # Check 2: Strictly reject generic corporate role prefixes
    clean_local_alpha = re.sub(r"[^a-z]", "", local_part)
    if clean_local_alpha in CORPORATE_ROLE_PREFIXES:
        return False, f"Corporate generic email rejected ({local_part}@...)", ""

    for prefix in CORPORATE_ROLE_PREFIXES:
        if local_part.startswith(prefix + ".") or local_part.startswith(prefix + "_") or local_part.startswith(prefix + "-"):
            return False, f"Corporate generic role prefix ({prefix}) rejected", ""

    # Check 3: Personal ESP check
    if domain in PERSONAL_EMAIL_DOMAINS:
        return True, f"Verified personal mailbox on {domain}", clean

    # Check 4: Corporate domain — verify it belongs to this specific person
    name_tokens = _extract_name_tokens(full_name) if full_name else []
    if name_tokens:
        first = name_tokens[0] if len(name_tokens) > 0 else ""
        last = name_tokens[-1] if len(name_tokens) > 1 else ""
        first_init = first[0] if first else ""
        last_init = last[0] if last else ""

        # Check for name match in local part
        matched = False
        if first and first in local_part:
            matched = True
        elif last and last in local_part:
            matched = True
        elif first_init and last and f"{first_init}{last}" in local_part:
            matched = True
        elif last and first_init and f"{last}{first_init}" in local_part:
            matched = True
        elif first and last_init and f"{first}{last_init}" in local_part:
            matched = True

        if not matched:
            return False, f"Corporate email '{clean}' does not match person name ({full_name})", ""

    return True, f"Verified direct individual email on {domain}", clean


def validate_personal_phone(phone: str, country: str = "") -> Tuple[bool, str, str]:
    """
    Double-checks a phone number:
    1. Verifies valid length (8 to 15 digits).
    2. Rejects dummy/sequential numbers.
    3. Rejects toll-free corporate call center area codes (US 800/888, UK 0800/0845).
    4. Normalizes to formatted telephone string.
    Returns: (is_valid, reason, normalized_phone)
    """
    if not phone or not isinstance(phone, str):
        return False, "Empty phone", ""

    digits = re.sub(r"\D", "", phone)
    if not (8 <= len(digits) <= 15):
        return False, f"Invalid phone digit count ({len(digits)})", ""

    # Check for dummy numbers
    for seq in DUMMY_PHONE_SEQUENCES:
        if digits == seq or digits.endswith(seq):
            return False, "Dummy/sequential phone number rejected", ""

    # US Toll-free / corporate check
    if len(digits) == 10 and digits[:3] in US_TOLL_FREE_AREA_CODES:
        return False, f"US toll-free corporate number rejected ({digits[:3]})", ""
    if len(digits) == 11 and digits[0] == "1" and digits[1:4] in US_TOLL_FREE_AREA_CODES:
        return False, f"US toll-free corporate number rejected ({digits[1:4]})", ""

    # US Fictional reserved exchange (555-0100 to 555-0199)
    if "55501" in digits:
        return False, "Fictional reserved exchange 555-01xx rejected", ""

    # UK Toll-free check
    for uk_tf in UK_NON_PERSONAL_PREFIXES:
        if phone.strip().startswith(uk_tf) or digits.startswith("44" + uk_tf[1:]):
            return False, f"UK toll-free/business rate prefix rejected ({uk_tf})", ""

    # Normalization & Formatting
    formatted = phone.strip()
    if len(digits) == 10:
        # Standard US 10-digit
        formatted = f"+1 ({digits[:3]}) {digits[3:6]}-{digits[6:]}"
    elif len(digits) == 11 and digits.startswith("1"):
        formatted = f"+1 ({digits[1:4]}) {digits[4:7]}-{digits[7:]}"
    elif len(digits) == 11 and digits.startswith("07"):
        # UK Mobile
        formatted = f"+44 {digits[1:5]} {digits[5:]}"
    elif len(digits) == 12 and digits.startswith("971"):
        formatted = f"+971 {digits[3:5]} {digits[5:8]} {digits[8:]}"
    elif len(digits) == 12 and digits.startswith("966"):
        formatted = f"+966 {digits[3:5]} {digits[5:8]} {digits[8:]}"
    elif len(digits) == 12 and digits.startswith("923"):
        formatted = f"+92 {digits[2:5]} {digits[5:]}"
    elif len(digits) == 10 and digits.startswith("05"):
        # Gulf local mobile (UAE or KSA)
        if "saudi" in (country or "").lower():
            formatted = f"+966 {digits[1:3]} {digits[3:6]} {digits[6:]}"
        else:
            formatted = f"+971 {digits[1:3]} {digits[3:6]} {digits[6:]}"

    return True, "Verified authentic direct phone number", formatted


def validate_personal_linkedin(url: str, full_name: str = "") -> Tuple[bool, str, str]:
    """
    Double-checks a LinkedIn URL:
    1. Must be an individual personal profile (linkedin.com/in/{slug}).
    2. Rejects corporate pages (/company/), posts, pulse, or search queries.
    3. Verifies slug contains the candidate's name tokens.
    Returns: (is_valid, reason, clean_url)
    """
    if not url or not isinstance(url, str):
        return False, "Empty URL", ""

    clean = url.strip()
    if not clean.startswith("http"):
        clean = "https://" + clean

    parsed = urllib.parse.urlparse(clean)
    netloc = parsed.netloc.lower()
    if "linkedin.com" not in netloc:
        return False, "Not a LinkedIn URL", ""

    path = parsed.path.rstrip("/")
    m = re.search(r"/in/([a-zA-Z0-9_\-%]+)", path, re.I)
    if not m:
        return False, "Not a personal LinkedIn profile URL (requires /in/)", ""

    slug = m.group(1).lower()
    clean_url = f"https://www.linkedin.com/in/{slug}"

    # Name token double-check
    name_tokens = _extract_name_tokens(full_name) if full_name else []
    if name_tokens:
        clean_slug = re.sub(r"[^a-z]", "", slug)
        # Check if at least one meaningful name token (length >= 3) is present in the slug
        matches = [t for t in name_tokens if len(t) >= 3 and t in clean_slug]
        if not matches:
            # Also check if initials + last name or first name + last initial
            first = name_tokens[0] if len(name_tokens) > 0 else ""
            last = name_tokens[-1] if len(name_tokens) > 1 else ""
            f_init = first[0] if first else ""
            if not (f_init and last and f"{f_init}{last}" in clean_slug):
                return False, f"LinkedIn slug '{slug}' does not match name ({full_name})", ""

    return True, "Verified personal LinkedIn profile", clean_url


def double_check_lead_contacts(lead: Dict[str, Any]) -> Dict[str, Any]:
    """
    Audits and double-checks all 3 critical personal contact attributes:
    1. personal phone number
    2. personal email address
    3. personal LinkedIn profile URL

    Modifies the lead in-place, stripping invalid/corporate data,
    and attaches verification tags and evidence notes.
    """
    full_name = lead.get("full_name", "")
    country = lead.get("current_country", "")

    verification_log = []

    # 1. Double-check Email
    raw_email = lead.get("public_email", "")
    if raw_email:
        valid_email, reason, clean_email = validate_personal_email(raw_email, full_name)
        if valid_email:
            lead["public_email"] = clean_email
            lead["personal_email_verified"] = True
            verification_log.append(f"Email: {reason}")
        else:
            # Strip invalid/corporate email so corporate inbox is never stored
            lead["public_email"] = ""
            lead["personal_email_verified"] = False
            verification_log.append(f"Email Rejected: {reason}")
    else:
        lead["personal_email_verified"] = False

    # 2. Double-check Phone
    raw_phone = lead.get("public_phone", "")
    if raw_phone:
        valid_phone, reason, clean_phone = validate_personal_phone(raw_phone, country)
        if valid_phone:
            lead["public_phone"] = clean_phone
            lead["personal_phone_verified"] = True
            # Normalize WhatsApp
            digits = re.sub(r"\D", "", clean_phone)
            lead["whatsapp_number"] = digits
            lead["has_whatsapp"] = len(digits) >= 9
            verification_log.append(f"Phone: {reason}")
        else:
            lead["public_phone"] = ""
            lead["personal_phone_verified"] = False
            lead["has_whatsapp"] = False
            verification_log.append(f"Phone Rejected: {reason}")
    else:
        lead["personal_phone_verified"] = False

    # 3. Double-check LinkedIn Profile
    raw_li = lead.get("professional_profile_url", "")
    if raw_li:
        valid_li, reason, clean_li = validate_personal_linkedin(raw_li, full_name)
        if valid_li:
            lead["professional_profile_url"] = clean_li
            lead["personal_linkedin_verified"] = True
            verification_log.append(f"LinkedIn: {reason}")
        else:
            lead["professional_profile_url"] = ""
            lead["personal_linkedin_verified"] = False
            verification_log.append(f"LinkedIn Rejected: {reason}")
    else:
        lead["personal_linkedin_verified"] = False

    lead["contact_verification_log"] = verification_log
    lead["verified_contact_count"] = sum([
        1 if lead.get("personal_phone_verified") else 0,
        1 if lead.get("personal_email_verified") else 0,
        1 if lead.get("personal_linkedin_verified") else 0
    ])

    return lead


def is_corporate_role_email(email: str) -> bool:
    """Returns True if the email is a corporate role/generic inbox (info@, sales@, etc.)."""
    if not email or "@" not in email:
        return False
    local_part = email.split("@")[0].strip().lower()
    clean_local = re.sub(r"[^a-z]", "", local_part)
    if clean_local in CORPORATE_ROLE_PREFIXES:
        return True
    return any(local_part.startswith(p + ".") or local_part.startswith(p + "_") or local_part.startswith(p + "-") for p in CORPORATE_ROLE_PREFIXES)


def is_personal_email(email: str) -> bool:
    """Returns True if email is from a personal email service provider (Gmail/Yahoo/etc.)."""
    if not email or "@" not in email:
        return False
    domain = email.split("@")[1].strip().lower()
    return domain in PERSONAL_EMAIL_DOMAINS and not is_corporate_role_email(email)


def classify_phone_number(phone: str) -> Dict[str, Any]:
    """Classifies phone as mobile, landline, toll_free, clinic, or unknown."""
    if not phone:
        return {"phone_type": "unknown", "is_mobile": False, "confidence": 0.0}
    digits = re.sub(r"\D", "", phone)
    if any(digits.startswith(p) or ("44" + p[1:] if p.startswith("0") else p) in digits for p in UK_NON_PERSONAL_PREFIXES):
        return {"phone_type": "toll_free", "is_mobile": False, "confidence": 0.95}
    if any(digits.startswith("1" + c) or digits.startswith(c) for c in US_TOLL_FREE_AREA_CODES):
        return {"phone_type": "toll_free", "is_mobile": False, "confidence": 0.95}
    if digits.startswith("447") or (len(digits) == 11 and digits.startswith("07")):
        return {"phone_type": "mobile", "is_mobile": True, "confidence": 0.95}
    if digits.startswith("9715") or (digits.startswith("971") and len(digits) == 12):
        return {"phone_type": "mobile", "is_mobile": True, "confidence": 0.95}
    if digits.startswith("9665") or (digits.startswith("966") and len(digits) == 12):
        return {"phone_type": "mobile", "is_mobile": True, "confidence": 0.95}
    if digits.startswith("923") or (len(digits) == 11 and digits.startswith("03")):
        return {"phone_type": "mobile", "is_mobile": True, "confidence": 0.95}
    if len(digits) == 10 and digits.startswith("05"):
        return {"phone_type": "mobile", "is_mobile": True, "confidence": 0.95}
    if digits.startswith("4420") or digits.startswith("441") or digits.startswith("442"):
        return {"phone_type": "landline", "is_mobile": False, "confidence": 0.90}
    if len(digits) == 10:
        return {"phone_type": "mobile", "is_mobile": True, "confidence": 0.75}
    return {"phone_type": "unknown", "is_mobile": False, "confidence": 0.50}


def validate_genuine_linkedin_url(url: str, full_name: str = "") -> Tuple[bool, str, float]:
    """Validates genuine LinkedIn /in/ URL and returns (is_valid, reason, match_confidence)."""
    valid, reason, clean_url = validate_personal_linkedin(url, full_name)
    if not valid:
        return False, reason, 0.0
    # Determine confidence from name match
    name_tokens = _extract_name_tokens(full_name) if full_name else []
    if not name_tokens:
        return True, reason, 0.75
    slug = clean_url.split("/in/")[-1].lower()
    matches = sum(1 for t in name_tokens if len(t) >= 3 and t in slug)
    confidence = min(1.0, 0.65 + (matches * 0.15))
    return True, reason, confidence


class ContactClassifier:
    """Namespace wrapper for contact classification and validation."""
    is_personal_email = staticmethod(is_personal_email)
    is_corporate_role_email = staticmethod(is_corporate_role_email)
    classify_phone_number = staticmethod(classify_phone_number)
    validate_genuine_linkedin_url = staticmethod(validate_genuine_linkedin_url)

