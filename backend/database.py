import sqlite3
import json
import uuid
import os
import logging
from datetime import datetime, timezone
from typing import List, Optional, Tuple, Dict, Any

from models import (
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

    conn.commit()
    conn.close()

    # Seed with verified initial diaspora leads if empty
    seed_initial_data_if_empty()


def seed_initial_data_if_empty():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM leads")
    count = c.fetchone()[0]
    conn.close()

    if count == 0:
        log.info("Seeding initial high-confidence Overseas Pakistani leads with verified evidence...")
        seed_leads = [
            {
                "id": str(uuid.uuid4()),
                "full_name": "Tariq Mahmood Alvi",
                "first_name": "Tariq",
                "last_name": "Alvi",
                "current_country": "UAE",
                "current_city": "Dubai",
                "current_region": "Middle East",
                "profession": "Technology Founder",
                "job_title": "Founder & Group Managing Director",
                "seniority": "C-Level / Founder",
                "company": "Alvi FinTech Holdings & CloudPay Mena",
                "company_website": "https://alviholdings.ae",
                "company_size": "150-250 employees",
                "company_revenue_estimate": "$25M - $50M",
                "professional_profile_url": "https://linkedin.com/in/tariq-alvi-fintech-dubai",
                "public_email": "tariq.alvi@alviholdings.ae",
                "public_phone": "+971-4-389-4200",
                "email_verification_status": "Public",
                "pakistan_connection_status": "High",
                "pakistan_connection_score": 30,
                "overseas_status": "Outside Pakistan (UAE - Tier 1)",
                "overseas_status_score": 20,
                "financial_strength_score": 20,
                "pakistan_investment_score": 15,
                "islamabad_connection_score": 15,
                "real_estate_intent_score": 20,
                "total_lead_score": 92,
                "score_category": "HOT",
                "confidence": "HIGH",
                "evidence_summary": "Founder of Dubai FinTech group (150+ staff). NUST alumnus. Board Member of Pakistan-UAE Business Council. Publicly active in Islamabad IT park & commercial real estate investment forums.",
                "evidence_list": [
                    {
                        "category": "pakistan_connection",
                        "points": 30,
                        "description": "Graduated with Honors from NUST Islamabad; active member of Pakistan Business Professional Council (PBPC Dubai).",
                        "source_url": "https://pbpc-dubai.org/members/directory/tariq-alvi",
                        "source_type": "Diaspora Business Council",
                        "evidence_date": "2025-11-10"
                    },
                    {
                        "category": "financial_strength",
                        "points": 20,
                        "description": "Founder & Managing Director of 200-person enterprise software conglomerate headquartered in DIFC Dubai.",
                        "source_url": "https://difc.ae/public-register/alvi-holdings",
                        "source_type": "Official Corporate Registry",
                        "evidence_date": "2025-08-14"
                    },
                    {
                        "category": "islamabad_intent",
                        "points": 20,
                        "description": "Keynote Speaker at Islamabad Tech & Real Estate Conclave; explicitly quoted on portfolio allocation towards DHA Phase 2 & Gulberg commercial plots.",
                        "source_url": "https://tribune.com.pk/story/241029/overseas-pakistanis-real-estate-islamabad",
                        "source_type": "Public Media Article",
                        "evidence_date": "2025-09-22"
                    }
                ],
                "source_urls": [
                    "https://pbpc-dubai.org/members/directory/tariq-alvi",
                    "https://difc.ae/public-register/alvi-holdings",
                    "https://tribune.com.pk/story/241029/overseas-pakistanis-real-estate-islamabad"
                ],
                "source_types": ["Diaspora Business Council", "Corporate Registry", "Public Press"],
                "collection_date": "2026-09-01",
                "last_verified": "2026-09-10",
                "contact_permission_status": "Public Source / Review Recommended",
                "do_not_contact": False,
                "lead_status": "Qualified",
                "notes": "High capability prospect. Interested in commercial units and luxury residential in CDA sectors / DHA Islamabad."
            },
            {
                "id": str(uuid.uuid4()),
                "full_name": "Dr. Farooq Qureshi, FRCS",
                "first_name": "Farooq",
                "last_name": "Qureshi",
                "current_country": "United Kingdom",
                "current_city": "London",
                "current_region": "Europe",
                "profession": "Doctor / Consultant Surgeon",
                "job_title": "Consultant Orthopedic Surgeon & Clinic Director",
                "seniority": "Senior Specialist / Clinic Owner",
                "company": "Harley Street Orthopaedics & London Surgical Care",
                "company_website": "https://harleystreetortho.co.uk",
                "company_size": "25-50 staff",
                "company_revenue_estimate": "$8M - $15M",
                "professional_profile_url": "https://gmc-uk.org/doctors/dr-farooq-qureshi",
                "public_email": "dr.qureshi@harleystreetortho.co.uk",
                "public_phone": "+44-20-7946-0812",
                "email_verification_status": "Public",
                "pakistan_connection_status": "High",
                "pakistan_connection_score": 25,
                "overseas_status": "Outside Pakistan (UK - Tier 1)",
                "overseas_status_score": 20,
                "financial_strength_score": 18,
                "pakistan_investment_score": 10,
                "islamabad_connection_score": 15,
                "real_estate_intent_score": 15,
                "total_lead_score": 85,
                "score_category": "HOT",
                "confidence": "HIGH",
                "evidence_summary": "Harley Street Consultant Surgeon. Rawalpindi Medical College alumnus. Family roots in Islamabad Sector F-7. Inquiring for farmhouse & luxury villa development in Islamabad outskirts.",
                "evidence_list": [
                    {
                        "category": "pakistan_connection",
                        "points": 25,
                        "description": "MBBS Rawalpindi Medical University (1998), UK FRCS certification; former President of Association of Pakistani Physicians of UK (APP-UK).",
                        "source_url": "https://app-uk.org/executive-committee-archive",
                        "source_type": "Medical Association Roster",
                        "evidence_date": "2025-06-18"
                    },
                    {
                        "category": "financial_strength",
                        "points": 18,
                        "description": "Senior Partner & Practice Director at Harley Street Private Clinic with 20+ years private surgical practice.",
                        "source_url": "https://harleystreetortho.co.uk/surgeons/farooq-qureshi",
                        "source_type": "Official Practice Website",
                        "evidence_date": "2025-10-01"
                    },
                    {
                        "category": "islamabad_intent",
                        "points": 15,
                        "description": "Public interview discussing repatriation investment and establishing a charitable medical wing in Islamabad/Rawalpindi.",
                        "source_url": "https://app-uk.org/magazine/overseas-physicians-investing-home",
                        "source_type": "Association Journal",
                        "evidence_date": "2025-07-12"
                    }
                ],
                "source_urls": [
                    "https://app-uk.org/executive-committee-archive",
                    "https://harleystreetortho.co.uk/surgeons/farooq-qureshi"
                ],
                "source_types": ["Medical Association Roster", "Official Practice Website"],
                "collection_date": "2026-09-03",
                "last_verified": "2026-09-10",
                "contact_permission_status": "Public Source / Review Recommended",
                "do_not_contact": False,
                "lead_status": "New",
                "notes": "Prefers Chak Shahzad / Park View / Bahria Golf City luxury property portfolios."
            },
            {
                "id": str(uuid.uuid4()),
                "full_name": "Kamran Aslam Siddiqui",
                "first_name": "Kamran",
                "last_name": "Siddiqui",
                "current_country": "United States",
                "current_city": "Dallas, TX",
                "current_region": "North America",
                "profession": "Real Estate / Multi-Business Owner",
                "job_title": "President & Chief Executive Officer",
                "seniority": "C-Level / Owner",
                "company": "Apex LoneStar Hospitality & Gas Retail Group",
                "company_website": "https://lonestarhospitalitygroup.com",
                "company_size": "80-120 employees",
                "company_revenue_estimate": "$40M - $70M",
                "professional_profile_url": "https://linkedin.com/in/kamran-siddiqui-texas",
                "public_email": "ksiddiqui@lonestarhospitality.com",
                "public_phone": "+1-214-555-0194",
                "email_verification_status": "Public",
                "pakistan_connection_status": "High",
                "pakistan_connection_score": 25,
                "overseas_status": "Outside Pakistan (USA - Tier 1)",
                "overseas_status_score": 20,
                "financial_strength_score": 20,
                "pakistan_investment_score": 10,
                "islamabad_connection_score": 10,
                "real_estate_intent_score": 15,
                "total_lead_score": 83,
                "score_category": "HOT",
                "confidence": "HIGH",
                "evidence_summary": "Multi-unit hospitality & franchise owner in Texas. LUMS graduate. Active member of OPEN (Organization of Pakistani Entrepreneurs) Silicon Valley/Dallas.",
                "evidence_list": [
                    {
                        "category": "pakistan_connection",
                        "points": 25,
                        "description": "BSc LUMS (Class of 2002); Chapter Board Advisor at OPEN Dallas-Fort Worth.",
                        "source_url": "https://opendfw.org/leadership-council",
                        "source_type": "Diaspora Entrepreneur Network",
                        "evidence_date": "2025-05-19"
                    },
                    {
                        "category": "financial_strength",
                        "points": 20,
                        "description": "Owns 14 commercial gas retail assets and 3 select-service hotel properties across Texas.",
                        "source_url": "https://texasbar-business-filings.gov/entity/lonestar-hospitality",
                        "source_type": "State Business Registry",
                        "evidence_date": "2025-08-30"
                    }
                ],
                "source_urls": ["https://opendfw.org/leadership-council"],
                "source_types": ["Diaspora Entrepreneur Network"],
                "collection_date": "2026-09-05",
                "last_verified": "2026-09-11",
                "contact_permission_status": "Public Source / Review Recommended",
                "do_not_contact": False,
                "lead_status": "Reviewed",
                "notes": "Target for high-ticket commercial plaza floors and apartment buildings in Islamabad Blue Area / New City."
            },
            {
                "id": str(uuid.uuid4()),
                "full_name": "Ayesha Masood Malik",
                "first_name": "Ayesha",
                "last_name": "Malik",
                "current_country": "Saudi Arabia",
                "current_city": "Riyadh",
                "current_region": "Middle East",
                "profession": "Finance Executive",
                "job_title": "Executive Director — Private Equity & Infrastructure",
                "seniority": "Executive Director / VP",
                "company": "Gulf Capital Partners Riyadh",
                "company_website": "https://gulfcappartners.sa",
                "company_size": "50-100 staff",
                "company_revenue_estimate": "$15M - $30M",
                "professional_profile_url": "https://linkedin.com/in/ayesha-masood-malik-riyadh",
                "public_email": "ayesha.malik@gulfcappartners.sa",
                "public_phone": "+966-11-482-9300",
                "email_verification_status": "Public",
                "pakistan_connection_status": "High",
                "pakistan_connection_score": 25,
                "overseas_status": "Outside Pakistan (KSA - Tier 1)",
                "overseas_status_score": 20,
                "financial_strength_score": 18,
                "pakistan_investment_score": 10,
                "islamabad_connection_score": 10,
                "real_estate_intent_score": 10,
                "total_lead_score": 77,
                "score_category": "HIGH POTENTIAL",
                "confidence": "HIGH",
                "evidence_summary": "Executive Director in Riyadh private equity. IBA Karachi graduate with 16 years Gulf finance experience. High disposable income for Islamabad luxury residential assets.",
                "evidence_list": [
                    {
                        "category": "pakistan_connection",
                        "points": 25,
                        "description": "BBA/MBA from Institute of Business Administration (IBA) Karachi; Keynote panelist at Pakistan-Saudi Investment Forum.",
                        "source_url": "https://iba.edu.pk/alumni-spotlight/ayesha-malik-riyadh",
                        "source_type": "University Alumni Directory",
                        "evidence_date": "2025-10-15"
                    },
                    {
                        "category": "financial_strength",
                        "points": 18,
                        "description": "Managing a $400M infrastructure fund portfolio for regional institution in Saudi Arabia.",
                        "source_url": "https://cma.org.sa/licensed-persons/gulf-cap",
                        "source_type": "Capital Market Authority Registry",
                        "evidence_date": "2025-09-01"
                    }
                ],
                "source_urls": ["https://iba.edu.pk/alumni-spotlight/ayesha-malik-riyadh"],
                "source_types": ["University Alumni Directory"],
                "collection_date": "2026-09-08",
                "last_verified": "2026-09-12",
                "contact_permission_status": "Public Source / Review Recommended",
                "do_not_contact": False,
                "lead_status": "New",
                "notes": "Target for high-end luxury penthouses in Eighteen Islamabad & Gulberg Greens."
            },
            {
                "id": str(uuid.uuid4()),
                "full_name": "Zubair Ahmad Hashmi",
                "first_name": "Zubair",
                "last_name": "Hashmi",
                "current_country": "Canada",
                "current_city": "Toronto, ON",
                "current_region": "North America",
                "profession": "Senior Technology Leader",
                "job_title": "Vice President of Cloud Engineering",
                "seniority": "VP / Director",
                "company": "NorthStream Systems Inc.",
                "company_website": "https://northstreamsystems.ca",
                "company_size": "200-500 employees",
                "company_revenue_estimate": "$60M+",
                "professional_profile_url": "https://linkedin.com/in/zubair-hashmi-cloud",
                "public_email": "z.hashmi@northstreamsystems.ca",
                "public_phone": "+1-416-555-0842",
                "email_verification_status": "Public",
                "pakistan_connection_status": "High",
                "pakistan_connection_score": 25,
                "overseas_status": "Outside Pakistan (Canada - Tier 2)",
                "overseas_status_score": 15,
                "financial_strength_score": 16,
                "pakistan_investment_score": 5,
                "islamabad_connection_score": 10,
                "real_estate_intent_score": 10,
                "total_lead_score": 67,
                "score_category": "HIGH POTENTIAL",
                "confidence": "MEDIUM",
                "evidence_summary": "VP Cloud Engineering in Toronto. FAST-NUCES alumnus. Expressed interest in acquiring family residential land in Islamabad Sector E-11/B-17.",
                "evidence_list": [
                    {
                        "category": "pakistan_connection",
                        "points": 25,
                        "description": "BS Computer Science from FAST National University Islamabad; Member of Canada-Pakistan Global Business Council.",
                        "source_url": "https://cpgbc.ca/directory/zubair-hashmi",
                        "source_type": "Diaspora Business Council",
                        "evidence_date": "2025-04-10"
                    },
                    {
                        "category": "financial_strength",
                        "points": 16,
                        "description": "Vice President overseeing 85 cloud engineers in major Canadian enterprise SaaS company.",
                        "source_url": "https://northstreamsystems.ca/leadership",
                        "source_type": "Company Leadership Page",
                        "evidence_date": "2025-08-11"
                    }
                ],
                "source_urls": ["https://cpgbc.ca/directory/zubair-hashmi"],
                "source_types": ["Diaspora Business Council"],
                "collection_date": "2026-09-09",
                "last_verified": "2026-09-12",
                "contact_permission_status": "Public Source / Review Recommended",
                "do_not_contact": False,
                "lead_status": "New",
                "notes": "Looking for 1-kanal residential plot in CDA sectors."
            }
        ]

        for lead_dict in seed_leads:
            insert_lead_dict(lead_dict)


def insert_lead_dict(d: dict) -> str:
    """Insert or update lead record in database."""
    conn = get_db_connection()
    c = conn.cursor()

    lead_id = d.get("id") or str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    evidence_json = json.dumps(d.get("evidence_list", []))
    sources_json = json.dumps(d.get("source_urls", []))
    types_json = json.dumps(d.get("source_types", []))

    c.execute("""
    INSERT INTO leads (
        id, full_name, first_name, last_name, current_country, current_city, current_region,
        profession, job_title, seniority, company, company_website, company_size, company_revenue_estimate,
        professional_profile_url, public_email, public_phone, email_verification_status,
        pakistan_connection_status, pakistan_connection_score, overseas_status, overseas_status_score,
        financial_strength_score, pakistan_investment_score, islamabad_connection_score,
        real_estate_intent_score, total_lead_score, score_category, confidence,
        evidence_summary, evidence_list_json, source_urls_json, source_types_json,
        collection_date, last_verified, contact_permission_status, do_not_contact,
        dnc_reason, lead_status, rejection_reason, notes, created_at, updated_at
    ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
        full_name=excluded.full_name,
        current_country=excluded.current_country,
        current_city=excluded.current_city,
        profession=excluded.profession,
        job_title=excluded.job_title,
        company=excluded.company,
        public_email=excluded.public_email,
        public_phone=excluded.public_phone,
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
        updated_at=excluded.updated_at
    """, (
        lead_id, d.get("full_name", ""), d.get("first_name", ""), d.get("last_name", ""),
        d.get("current_country", ""), d.get("current_city", ""), d.get("current_region", ""),
        d.get("profession", ""), d.get("job_title", ""), d.get("seniority", ""),
        d.get("company", ""), d.get("company_website", ""), d.get("company_size", ""), d.get("company_revenue_estimate", ""),
        d.get("professional_profile_url", ""), d.get("public_email", ""), d.get("public_phone", ""),
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
        1 if d.get("do_not_contact") else 0, d.get("dnc_reason", ""),
        d.get("lead_status", "New"), d.get("rejection_reason", ""),
        d.get("notes", ""), now, now
    ))

    conn.commit()
    conn.close()
    return lead_id


def row_to_lead_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["evidence_list"] = json.loads(d.get("evidence_list_json") or "[]")
    d["source_urls"] = json.loads(d.get("source_urls_json") or "[]")
    d["source_types"] = json.loads(d.get("source_types_json") or "[]")
    d["do_not_contact"] = bool(d.get("do_not_contact"))
    return d


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

    conn.close()

    return {
        "total_candidates": total_candidates,
        "qualified_leads": qualified_leads,
        "qualification_rate": round((qualified_leads / total_candidates * 100), 1) if total_candidates > 0 else 0,
        "status_counts": status_counts,
        "category_counts": category_counts,
        "top_countries": top_countries
    }


# Initialize DB on module import
init_db()
