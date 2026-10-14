import sqlite3
import json
import uuid
import os
import re
import logging
from datetime import datetime, timezone
from typing import List, Optional, Tuple, Dict, Any

try:
    from models import (
        Lead, EvidenceItem, LeadStatus, ScoreCategory,
        ConfidenceLevel, EmailVerificationStatus, AuditLogEntry
    )
except ImportError:
    from backend.models import (
        Lead, EvidenceItem, LeadStatus, ScoreCategory,
        ConfidenceLevel, EmailVerificationStatus, AuditLogEntry
    )


log = logging.getLogger(__name__)

DB_PATH = os.path.join(os.path.dirname(__file__), "leadgen.db")


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize database schema with tables for leads, suppression, audit logs, and settings."""
    conn = get_db_connection()
    c = conn.cursor()

    # Leads table
    c.execute("""
    CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        current_country TEXT NOT NULL,
        current_city TEXT,
        current_region TEXT,
        profession TEXT,
        job_title TEXT,
        seniority TEXT,
        company TEXT,
        company_website TEXT,
        company_size TEXT,
        company_revenue_estimate TEXT,
        professional_profile_url TEXT,
        public_email TEXT,
        public_phone TEXT,
        phone_source_url TEXT,
        email_source_url TEXT,
        company_source_url TEXT,
        has_whatsapp INTEGER DEFAULT 1,
        whatsapp_number TEXT,
        wealth_tier TEXT DEFAULT 'High Net Worth ($5M - $25M)',
        estimated_net_worth TEXT DEFAULT '$10M+',
        investment_capacity TEXT DEFAULT '$1M - $5M Liquid',
        email_verification_status TEXT DEFAULT 'Unknown',
        pakistan_connection_status TEXT DEFAULT 'Unknown',
        pakistan_connection_score INTEGER DEFAULT 0,
        overseas_status TEXT DEFAULT 'Outside Pakistan',
        overseas_status_score INTEGER DEFAULT 0,
        financial_strength_score INTEGER DEFAULT 0,
        pakistan_investment_score INTEGER DEFAULT 0,
        islamabad_connection_score INTEGER DEFAULT 0,
        real_estate_intent_score INTEGER DEFAULT 0,
        total_lead_score INTEGER DEFAULT 0,
        score_category TEXT DEFAULT 'REJECT / INSUFFICIENT DATA',
        confidence TEXT DEFAULT 'LOW',
        evidence_summary TEXT,
        evidence_list_json TEXT DEFAULT '[]',
        source_urls_json TEXT DEFAULT '[]',
        source_types_json TEXT DEFAULT '[]',
        collection_date TEXT,
        last_verified TEXT,
        contact_permission_status TEXT DEFAULT 'Public Source / Review Recommended',
        do_not_contact INTEGER DEFAULT 0,
        dnc_reason TEXT,
        lead_status TEXT DEFAULT 'New',
        rejection_reason TEXT,
        notes TEXT,
        created_at TEXT,
        updated_at TEXT
    )
    """)

    # Suppression / DNC table
    c.execute("""
    CREATE TABLE IF NOT EXISTS suppression_list (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        value TEXT NOT NULL UNIQUE,
        reason TEXT,
        added_at TEXT
    )
    """)

    # Audit log table
    c.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id TEXT,
        action TEXT NOT NULL,
        details_json TEXT DEFAULT '{}',
        timestamp TEXT
    )
    """)

    # Settings table
    c.execute("""
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT
    )
    """)

    # Create indexes for fast filtering
    c.execute("CREATE INDEX IF NOT EXISTS idx_leads_country ON leads(current_country)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(lead_status)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(total_lead_score)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_leads_dnc ON leads(do_not_contact)")

    # Run safe column migrations
    c.execute("PRAGMA table_info(leads)")
    existing_cols = [row["name"] for row in c.fetchall()]
    
    new_cols = [
        ("has_whatsapp", "INTEGER DEFAULT 0"),
        ("whatsapp_number", "TEXT"),
        ("wealth_tier", "TEXT DEFAULT 'High Net Worth ($5M - $25M)'"),
        ("estimated_net_worth", "TEXT DEFAULT '$10M+'"),
        ("investment_capacity", "TEXT DEFAULT '$1M - $5M Liquid'"),
        ("phone_source_url", "TEXT"),
        ("email_source_url", "TEXT"),
        ("company_source_url", "TEXT"),
        # Section 9 Required Lead Model Columns
        ("occupation", "TEXT"),
        ("employer", "TEXT"),
        ("country", "TEXT"),
        ("city", "TEXT"),
        ("pakistan_connection_evidence_json", "TEXT DEFAULT '[]'"),
        ("personal_phone", "TEXT"),
        ("phone_type", "TEXT DEFAULT 'unknown'"),
        ("phone_match_confidence", "INTEGER DEFAULT 0"),
        ("professional_phone", "TEXT"),
        ("personal_email", "TEXT"),
        ("professional_email", "TEXT"),
        ("email_verified", "INTEGER DEFAULT 0"),
        ("email_match_confidence", "INTEGER DEFAULT 0"),
        ("linkedin_url", "TEXT"),
        ("linkedin_source_url", "TEXT"),
        ("linkedin_identity_match", "TEXT DEFAULT 'unknown'"),
        ("linkedin_match_confidence", "INTEGER DEFAULT 0"),
        ("evidence_urls_json", "TEXT DEFAULT '[]'"),
        ("source_names_json", "TEXT DEFAULT '[]'"),
        ("review_status", "TEXT DEFAULT 'needs_review'"),
        ("opt_out", "INTEGER DEFAULT 0"),
    ]
    for col_name, col_type in new_cols:
        if col_name not in existing_cols:
            try:
                c.execute(f"ALTER TABLE leads ADD COLUMN {col_name} {col_type}")
            except Exception:
                pass

    conn.commit()
    conn.close()




def insert_lead_dict(d: dict) -> str:
    """Insert or update lead record in database, persisting all Section 9 schema fields."""
    conn = get_db_connection()
    c = conn.cursor()

    lead_id = d.get("id") or str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    evidence_json = json.dumps(d.get("evidence_list", []))
    pak_ev_json = json.dumps(d.get("pakistan_connection_evidence", []))
    ev_urls_json = json.dumps(d.get("evidence_urls", []))
    src_names_json = json.dumps(d.get("source_names", []))
    sources_json = json.dumps(d.get("source_urls", []))
    types_json = json.dumps(d.get("source_types", []))

    # Harmonize fields
    full_name = d.get("full_name") or ""
    country = d.get("country") or d.get("current_country") or ""
    city = d.get("city") or d.get("current_city") or ""
    occupation = d.get("occupation") or d.get("job_title") or d.get("profession") or ""
    employer = d.get("employer") or d.get("company") or ""
    pers_phone = d.get("personal_phone") or None
    prof_phone = d.get("professional_phone") or d.get("public_phone") or None
    pers_email = d.get("personal_email") or None
    prof_email = d.get("professional_email") or None
    li_url = d.get("linkedin_url") or (d.get("professional_profile_url") if "linkedin.com/in/" in (d.get("professional_profile_url") or "") else None)

    c.execute("""
    INSERT INTO leads (
        id, full_name, first_name, last_name, current_country, current_city, current_region,
        profession, job_title, seniority, company, company_website, company_size, company_revenue_estimate,
        professional_profile_url, public_email, public_phone, phone_source_url, email_source_url, company_source_url,
        has_whatsapp, whatsapp_number, wealth_tier, estimated_net_worth, investment_capacity, email_verification_status,
        pakistan_connection_status, pakistan_connection_score, overseas_status, overseas_status_score,
        financial_strength_score, pakistan_investment_score, islamabad_connection_score,
        real_estate_intent_score, total_lead_score, score_category, confidence,
        evidence_summary, evidence_list_json, source_urls_json, source_types_json,
        collection_date, last_verified, contact_permission_status, do_not_contact,
        dnc_reason, lead_status, rejection_reason, notes, created_at, updated_at,
        occupation, employer, country, city, pakistan_connection_evidence_json,
        personal_phone, phone_type, phone_match_confidence, professional_phone,
        personal_email, professional_email, email_verified, email_match_confidence,
        linkedin_url, linkedin_source_url, linkedin_identity_match, linkedin_match_confidence,
        evidence_urls_json, source_names_json, review_status, opt_out
    ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
        full_name=excluded.full_name,
        current_country=excluded.current_country,
        current_city=excluded.current_city,
        profession=excluded.profession,
        job_title=excluded.job_title,
        company=excluded.company,
        company_website=excluded.company_website,
        professional_profile_url=excluded.professional_profile_url,
        public_email=excluded.public_email,
        public_phone=excluded.public_phone,
        phone_source_url=excluded.phone_source_url,
        email_source_url=excluded.email_source_url,
        company_source_url=excluded.company_source_url,
        has_whatsapp=excluded.has_whatsapp,
        whatsapp_number=excluded.whatsapp_number,
        wealth_tier=excluded.wealth_tier,
        estimated_net_worth=excluded.estimated_net_worth,
        investment_capacity=excluded.investment_capacity,
        pakistan_connection_score=excluded.pakistan_connection_score,
        overseas_status_score=excluded.overseas_status_score,
        financial_strength_score=excluded.financial_strength_score,
        pakistan_investment_score=excluded.pakistan_investment_score,
        islamabad_connection_score=excluded.islamabad_connection_score,
        real_estate_intent_score=excluded.real_estate_intent_score,
        total_lead_score=excluded.total_lead_score,
        score_category=excluded.score_category,
        confidence=excluded.confidence,
        evidence_summary=excluded.evidence_summary,
        evidence_list_json=excluded.evidence_list_json,
        source_urls_json=excluded.source_urls_json,
        lead_status=excluded.lead_status,
        notes=excluded.notes,
        updated_at=excluded.updated_at,
        occupation=excluded.occupation,
        employer=excluded.employer,
        country=excluded.country,
        city=excluded.city,
        pakistan_connection_evidence_json=excluded.pakistan_connection_evidence_json,
        personal_phone=excluded.personal_phone,
        phone_type=excluded.phone_type,
        phone_match_confidence=excluded.phone_match_confidence,
        professional_phone=excluded.professional_phone,
        personal_email=excluded.personal_email,
        professional_email=excluded.professional_email,
        email_verified=excluded.email_verified,
        email_match_confidence=excluded.email_match_confidence,
        linkedin_url=excluded.linkedin_url,
        linkedin_source_url=excluded.linkedin_source_url,
        linkedin_identity_match=excluded.linkedin_identity_match,
        linkedin_match_confidence=excluded.linkedin_match_confidence,
        evidence_urls_json=excluded.evidence_urls_json,
        source_names_json=excluded.source_names_json,
        review_status=excluded.review_status,
        opt_out=excluded.opt_out
    """, (
        lead_id, full_name, d.get("first_name", ""), d.get("last_name", ""),
        country, city, d.get("current_region", ""),
        d.get("profession", ""), d.get("job_title", ""), d.get("seniority", ""),
        employer, d.get("company_website", ""), d.get("company_size", ""), d.get("company_revenue_estimate", ""),
        d.get("professional_profile_url", ""), pers_email or d.get("public_email", ""), pers_phone or d.get("public_phone", ""),
        d.get("phone_source_url", ""), d.get("email_source_url", ""), d.get("company_source_url", ""),
        1 if d.get("has_whatsapp") else 0, d.get("whatsapp_number", ""),
        d.get("wealth_tier", "High Net Worth ($5M - $25M)"), d.get("estimated_net_worth", "$10M+"),
        d.get("investment_capacity", "$1M - $5M Liquid"),
        d.get("email_verification_status", "Unknown"),
        d.get("pakistan_connection_status", "Unknown"), d.get("pakistan_connection_score", 0),
        d.get("overseas_status", "Outside Pakistan"), d.get("overseas_status_score", 0),
        d.get("financial_strength_score", 0), d.get("pakistan_investment_score", 0),
        d.get("islamabad_connection_score", 0), d.get("real_estate_intent_score", 0),
        d.get("total_lead_score", 0), d.get("score_category", "REJECT / INSUFFICIENT DATA"),
        d.get("confidence", "LOW"), d.get("evidence_summary", ""),
        evidence_json, sources_json, types_json,
        d.get("collection_date") or now[:10], d.get("last_verified") or now[:10],
        d.get("contact_permission_status", "Public Source / Review Recommended"),
        1 if d.get("do_not_contact") or d.get("opt_out") else 0, d.get("dnc_reason", ""),
        d.get("lead_status", "New"), d.get("rejection_reason", ""),
        d.get("notes", ""), now, now,
        occupation, employer, country, city, pak_ev_json,
        pers_phone, d.get("phone_type", "unknown"), d.get("phone_match_confidence", 0), prof_phone,
        pers_email, prof_email, 1 if d.get("email_verified") else 0, d.get("email_match_confidence", 0),
        li_url, d.get("linkedin_source_url", ""), d.get("linkedin_identity_match", "unknown"), d.get("linkedin_match_confidence", 0),
        ev_urls_json, src_names_json, d.get("review_status", "needs_review"), 1 if d.get("opt_out") else 0
    ))

    conn.commit()
    conn.close()
    return lead_id


def row_to_lead_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["evidence_list"] = json.loads(d.get("evidence_list_json") or "[]")
    d["pakistan_connection_evidence"] = json.loads(d.get("pakistan_connection_evidence_json") or "[]")
    d["evidence_urls"] = json.loads(d.get("evidence_urls_json") or "[]")
    d["source_names"] = json.loads(d.get("source_names_json") or "[]")
    d["source_urls"] = json.loads(d.get("source_urls_json") or "[]")
    d["source_types"] = json.loads(d.get("source_types_json") or "[]")
    d["do_not_contact"] = bool(d.get("do_not_contact"))
    d["opt_out"] = bool(d.get("opt_out"))
    d["has_whatsapp"] = bool(d.get("has_whatsapp", 0))
    d["email_verified"] = bool(d.get("email_verified", 0))

    # Harmonize Section 9 required fields
    if not d.get("country") and d.get("current_country"):
        d["country"] = d["current_country"]
    if not d.get("city") and d.get("current_city"):
        d["city"] = d["current_city"]
    if not d.get("occupation") and (d.get("job_title") or d.get("profession")):
        d["occupation"] = d.get("job_title") or d.get("profession")
    if not d.get("employer") and d.get("company"):
        d["employer"] = d["company"]
    if not d.get("linkedin_url") and d.get("professional_profile_url"):
        if "linkedin.com/in/" in d.get("professional_profile_url", ""):
            d["linkedin_url"] = d["professional_profile_url"]
    return d


def set_lead_opt_out(lead_id: str, reason: str = "User opt-out requested") -> bool:
    """Sets a lead's opt_out flag to 1, sets do_not_contact to 1, sets review_status to 'opt_out',
    and registers their phone and email in the suppression_list table."""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("""
        SELECT full_name, personal_email, professional_email, public_email,
               personal_phone, professional_phone, public_phone 
        FROM leads WHERE id = ?
    """, (lead_id,))
    row = c.fetchone()
    if not row:
        conn.close()
        return False

    now = datetime.now(timezone.utc).isoformat()
    c.execute("""
        UPDATE leads 
        SET opt_out = 1, do_not_contact = 1, dnc_reason = ?, review_status = 'opt_out', updated_at = ?
        WHERE id = ?
    """, (reason, now, lead_id))

    # Suppress identifiers
    for em in filter(None, [row["personal_email"], row["professional_email"], row["public_email"]]):
        try:
            c.execute("INSERT OR IGNORE INTO suppression_list (type, value, reason, added_at) VALUES (?, ?, ?, ?)",
                      ("email", em.lower().strip(), reason, now))
        except Exception:
            pass

    for ph in filter(None, [row["personal_phone"], row["professional_phone"], row["public_phone"]]):
        digits = re.sub(r"\D", "", ph)
        if len(digits) >= 7:
            try:
                c.execute("INSERT OR IGNORE INTO suppression_list (type, value, reason, added_at) VALUES (?, ?, ?, ?)",
                          ("phone", digits, reason, now))
            except Exception:
                pass

    conn.commit()
    conn.close()
    return True


def get_lead_by_id(lead_id: str) -> Optional[dict]:
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM leads WHERE id = ?", (lead_id,))
    row = c.fetchone()
    conn.close()
    if row:
        return row_to_lead_dict(row)
    return None


def query_leads(
    country: str = "All",
    profession: str = "All",
    lead_status: str = "All",
    score_category: str = "All",
    min_score: int = 0,
    search_query: str = "",
    include_dnc: bool = False,
    page: int = 1,
    page_size: int = 25
) -> Tuple[List[dict], int]:
    """Query leads with filtering, sorting, and pagination."""
    conn = get_db_connection()
    c = conn.cursor()

    conditions = ["total_lead_score >= ?"]
    params: List[Any] = [min_score]

    if not include_dnc:
        conditions.append("do_not_contact = 0")

    if country and country != "All":
        conditions.append("current_country = ?")
        params.append(country)

    if profession and profession != "All":
        conditions.append("profession LIKE ?")
        params.append(f"%{profession}%")

    if lead_status and lead_status != "All":
        conditions.append("lead_status = ?")
        params.append(lead_status)

    if score_category and score_category != "All":
        conditions.append("score_category = ?")
        params.append(score_category)

    if search_query and search_query.strip():
        q = f"%{search_query.strip()}%"
        conditions.append("(full_name LIKE ? OR company LIKE ? OR current_city LIKE ? OR job_title LIKE ? OR public_email LIKE ?)")
        params.extend([q, q, q, q, q])

    where_clause = " WHERE " + " AND ".join(conditions)

    # Count total
    c.execute(f"SELECT COUNT(*) FROM leads {where_clause}", tuple(params))
    total_count = c.fetchone()[0]

    # Paginate
    offset = (page - 1) * page_size
    c.execute(
        f"SELECT * FROM leads {where_clause} ORDER BY total_lead_score DESC, updated_at DESC LIMIT ? OFFSET ?",
        tuple(params + [page_size, offset])
    )
    rows = c.fetchall()
    conn.close()

    return [row_to_lead_dict(r) for r in rows], total_count


def update_lead_status(lead_id: str, new_status: str, notes: Optional[str] = None, rejection_reason: Optional[str] = None) -> bool:
    conn = get_db_connection()
    c = conn.cursor()
    now = datetime.now(timezone.utc).isoformat()

    updates = ["lead_status = ?", "updated_at = ?"]
    params = [new_status, now]

    if notes is not None:
        updates.append("notes = ?")
        params.append(notes)

    if rejection_reason is not None:
        updates.append("rejection_reason = ?")
        params.append(rejection_reason)

    if new_status == "Do Not Contact":
        updates.append("do_not_contact = 1")

    params.append(lead_id)

    c.execute(f"UPDATE leads SET {', '.join(updates)} WHERE id = ?", tuple(params))
    success = c.rowcount > 0
    conn.commit()
    conn.close()

    if success:
        log_audit_event(lead_id, "status_change", {"status": new_status, "rejection_reason": rejection_reason, "notes": notes})
    return success


def delete_lead_permanently(lead_id: str) -> bool:
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("DELETE FROM leads WHERE id = ?", (lead_id,))
    success = c.rowcount > 0
    conn.commit()
    conn.close()

    if success:
        log_audit_event(lead_id, "deleted", {"lead_id": lead_id})
    return success


# ── Suppression & DNC Functions ──────────────────────────────────────────────

def is_suppressed(email: str = "", phone: str = "", domain: str = "") -> bool:
    """Check if any contact attribute matches suppression / DNC list."""
    conn = get_db_connection()
    c = conn.cursor()

    items_to_check = []
    if email and email.strip():
        items_to_check.append(("email", email.strip().lower()))
        domain_part = email.split("@")[-1].lower() if "@" in email else ""
        if domain_part:
            items_to_check.append(("domain", domain_part))
    if phone and phone.strip():
        # normalize phone digits
        digits = "".join(filter(str.isdigit, phone))
        items_to_check.append(("phone", digits))
    if domain and domain.strip():
        items_to_check.append(("domain", domain.strip().lower()))

    for typ, val in items_to_check:
        c.execute("SELECT id FROM suppression_list WHERE type = ? AND value = ?", (typ, val))
        if c.fetchone():
            conn.close()
            return True

    conn.close()
    return False


def add_to_suppression(type_: str, value: str, reason: str = "") -> bool:
    conn = get_db_connection()
    c = conn.cursor()
    now = datetime.now(timezone.utc).isoformat()
    val = value.strip().lower()
    if type_ == "phone":
        val = "".join(filter(str.isdigit, value))

    try:
        c.execute("""
        INSERT INTO suppression_list (type, value, reason, added_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(value) DO UPDATE SET reason=excluded.reason
        """, (type_, val, reason, now))
        conn.commit()
        success = True
    except Exception as e:
        log.error("Suppression add failed: %s", e)
        success = False
    conn.close()

    if success:
        log_audit_event(None, "suppressed", {"type": type_, "value": val, "reason": reason})
    return success


def list_suppressions() -> List[dict]:
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM suppression_list ORDER BY id DESC")
    rows = c.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def remove_from_suppression(suppression_id: int) -> bool:
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("DELETE FROM suppression_list WHERE id = ?", (suppression_id,))
    success = c.rowcount > 0
    conn.commit()
    conn.close()
    return success


# ── Audit Logging ────────────────────────────────────────────────────────────

def log_audit_event(lead_id: Optional[str], action: str, details: dict):
    try:
        conn = get_db_connection()
        c = conn.cursor()
        now = datetime.now(timezone.utc).isoformat()
        c.execute("""
        INSERT INTO audit_logs (lead_id, action, details_json, timestamp)
        VALUES (?, ?, ?, ?)
        """, (lead_id, action, json.dumps(details), now))
        conn.commit()
        conn.close()
    except Exception as e:
        log.error("Audit log failed: %s", e)


def list_audit_logs(limit: int = 50) -> List[dict]:
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?", (limit,))
    rows = c.fetchall()
    conn.close()
    logs = []
    for r in rows:
        d = dict(r)
        d["details"] = json.loads(d.get("details_json") or "{}")
        logs.append(d)
    return logs


# ── Pipeline & CRM Analytics ─────────────────────────────────────────────────

def get_crm_funnel_stats() -> dict:
    """Calculate conversion funnel metrics across all pipeline stages."""
    conn = get_db_connection()
    c = conn.cursor()

    c.execute("SELECT COUNT(*) FROM leads")
    total_candidates = c.fetchone()[0]

    c.execute("SELECT COUNT(*) FROM leads WHERE total_lead_score >= 65 AND do_not_contact = 0")
    qualified_leads = c.fetchone()[0]

    c.execute("SELECT lead_status, COUNT(*) FROM leads GROUP BY lead_status")
    status_counts = {r[0]: r[1] for r in c.fetchall()}

    c.execute("SELECT score_category, COUNT(*) FROM leads GROUP BY score_category")
    category_counts = {r[0]: r[1] for r in c.fetchall()}

    c.execute("SELECT current_country, COUNT(*) FROM leads WHERE do_not_contact = 0 GROUP BY current_country ORDER BY COUNT(*) DESC LIMIT 5")
    top_countries = [{"country": r[0], "count": r[1]} for r in c.fetchall()]

    contacted_count = status_counts.get("Contacted", 0) + status_counts.get("Replied", 0)
    interested_count = (
        status_counts.get("Interested", 0) +
        status_counts.get("Meeting", 0) +
        status_counts.get("Property Viewing", 0) +
        status_counts.get("Negotiation", 0)
    )
    converted_count = status_counts.get("Converted", 0)
    new_count = status_counts.get("New", 0)

    conn.close()

    return {
        "total_candidates": total_candidates,
        "total_leads": total_candidates,
        "qualified_leads": qualified_leads,
        "contacted_leads": contacted_count,
        "interested_leads": interested_count,
        "converted_leads": converted_count,
        "new_leads": new_count,
        "qualification_rate": round((qualified_leads / total_candidates * 100), 1) if total_candidates > 0 else 0,
        "status_counts": status_counts,
        "stages": status_counts,
        "category_counts": category_counts,
        "top_countries": top_countries
    }


def get_existing_crm_lead_signatures() -> Dict[str, set]:
    """Retrieve indexed sets of existing CRM lead names, emails, phones, and LinkedIn identifiers
    so the discovery engine can prevent extracting or duplicating anyone already saved in the database.
    """
    import re
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("""
        SELECT full_name, public_email, public_phone, professional_profile_url 
        FROM leads
    """)
    rows = c.fetchall()
    conn.close()

    names = set()
    emails = set()
    phones = set()
    linkedin_slugs = set()

    for r in rows:
        name = (r["full_name"] or "").strip().lower()
        if name:
            names.add(name)
        
        email = (r["public_email"] or "").strip().lower()
        if email:
            emails.add(email)
            
        raw_phone = (r["public_phone"] or "").strip()
        digits = re.sub(r"\D", "", raw_phone)
        if len(digits) >= 7:
            phones.add(digits)
            if digits.startswith("44") or digits.startswith("92") or digits.startswith("1"):
                # also add without country code or with 0
                phones.add(digits[-10:])
                
        li_url = (r["professional_profile_url"] or "").strip().lower()
        if "linkedin.com/in/" in li_url:
            slug = li_url.split("linkedin.com/in/")[-1].split("/")[0].split("?")[0]
            if slug:
                linkedin_slugs.add(slug)

    return {
        "names": names,
        "emails": emails,
        "phones": phones,
        "linkedin_slugs": linkedin_slugs,
    }


# Initialize DB on module import
init_db()
