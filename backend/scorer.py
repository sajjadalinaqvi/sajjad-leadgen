import re
from typing import Dict, Any, List
from models import EvidenceItem, ScoringBreakdown, ScoreCategory, ConfidenceLevel

# Known Pakistani Universities & Colleges
PAK_UNIVERSITIES = [
    r"\blums\b", r"lahore university of management sciences",
    r"\bnust\b", r"national university of sciences and technology",
    r"\biba\b", r"institute of business administration",
    r"\bgiki\b", r"ghulam ishaq khan",
    r"\baku\b", r"aga khan university",
    r"\bfast\b", r"fast-nuces", r"national university of computer and emerging sciences",
    r"\buet\b", r"university of engineering and technology",
    r"\bned\b", r"ned university",
    r"punjab university", r"university of the punjab",
    r"quaid-e-azam university", r"qau",
    r"king edward", r"kemu",
    r"rawalpindi medical", r"allama iqbal medical",
    r"dow university", r"duhs", r"army medical college"
]

# Known Pakistani Diaspora & Business Organizations
PAK_ORGANIZATIONS = [
    r"\bopen\b(?:\s+silicon|\s+dallas|\s+london|\s+washington|\s+boston|\s+global|\s+chapter)?",
    r"organization of pakistani entrepreneurs",
    r"pakistan-uae business", r"pbpc", r"pakistan business professional council",
    r"pakistan business council", r"appna", r"association of physicians of pakistani-descent",
    r"app-uk", r"association of pakistani physicians",
    r"uk-pakistan chamber", r"canada-pakistan", r"us-pakistan business council",
    r"pakistan association dubai", r"pad", r"british pakistani foundation"
]

# Islamabad Real Estate Sectors & Locations
ISLAMABAD_LOCATIONS = [
    r"islamabad", r"rawalpindi", r"cda", r"blue area",
    r"dha islamabad", r"dha phase", r"bahria town islamabad", r"bahria town rawalpindi",
    r"gulberg greens", r"eighteen islamabad", r"park view city",
    r"chak shahzad", r"f-6", r"f-7", r"f-8", r"f-10", r"f-11",
    r"e-7", r"e-11", r"g-11", r"g-13", r"b-17", r"d-12",
    r"new islamabad", r"mumtaz city", r"top city"
]

# High-Seniority Financial / Professional Roles
FOUNDER_ROLES = [
    r"founder", r"co-founder", r"ceo", r"chief executive", r"managing director",
    r"owner", r"president", r"group chairman", r"equity partner", r"principal"
]
MEDICAL_ROLES = [
    r"doctor", r"consultant surgeon", r"orthopedic surgeon", r"cardiologist",
    r"physician", r"dentist", r"medical director", r"radiologist", r"frcs", r"facp"
]
EXEC_ROLES = [
    r"vice president", r"\bvp\b", r"director", r"head of", r"chief technology",
    r"chief financial", r"general counsel", r"partner", r"corporate lawyer",
    r"portfolio manager", r"managing partner", r"executive director"
]

# Target Countries
TIER_1_COUNTRIES = ["uae", "united arab emirates", "dubai", "abu dhabi", "saudi arabia", "ksa", "riyadh", "jeddah", "united kingdom", "uk", "london", "united states", "usa", "us"]
TIER_2_COUNTRIES = ["canada", "australia", "qatar", "kuwait", "oman", "bahrain"]


def calculate_lead_score(lead_data: Dict[str, Any]) -> ScoringBreakdown:
    """
    Deterministically computes transparent scores based ONLY on verified signals.
    Never infers Pakistani nationality from a name.
    """
    evidence_list: List[EvidenceItem] = []
    
    # 1. Pakistan Connection Score (0 - 30 pts)
    pak_score = 0
    text_corpus = " ".join([
        str(lead_data.get("full_name", "")),
        str(lead_data.get("profession", "")),
        str(lead_data.get("job_title", "")),
        str(lead_data.get("company", "")),
        str(lead_data.get("notes", "")),
        str(lead_data.get("evidence_summary", "")),
    ]).lower()

    # Pass in explicit evidence if provided
    raw_evidence = lead_data.get("evidence_list", [])
    if isinstance(raw_evidence, list):
        for ev in raw_evidence:
            if isinstance(ev, dict):
                text_corpus += " " + ev.get("description", "").lower()

    # Check explicit self-identification / diaspora organization
    found_org = False
    for org_pat in PAK_ORGANIZATIONS:
        if re.search(org_pat, text_corpus, re.I):
            pak_score += 20
            found_org = True
            evidence_list.append(EvidenceItem(
                category="pakistan_connection",
                points=20,
                description="Public membership or leadership in recognized Pakistani business/diaspora organization.",
                source_type="Diaspora Organization Roster"
            ))
            break

    # Check Pakistani universities
    found_uni = False
    for uni_pat in PAK_UNIVERSITIES:
        if re.search(uni_pat, text_corpus, re.I):
            pak_score += 20
            found_uni = True
            evidence_list.append(EvidenceItem(
                category="pakistan_connection",
                points=20,
                description="Documented education / alumni connection from top Pakistani institution.",
                source_type="University Alumni Records"
            ))
            break

    # Check explicit biography mention / past roots (requiring positive keyword context)
    if not found_org and not found_uni:
        if re.search(r"\b(?:pakistani|pakistan\s+(?:origin|roots|heritage|diaspora|community|national|citizen))\b", text_corpus, re.I):
            pak_score += 15
            evidence_list.append(EvidenceItem(
                category="pakistan_connection",
                points=15,
                description="Public professional biography explicitly mentions Pakistani heritage or origin.",
                source_type="Public Professional Biography"
            ))


    # Clamp Pakistan connection score to max 30
    pak_score = min(30, pak_score)

    # 2. Overseas Status Score (0 - 20 pts)
    country = str(lead_data.get("current_country", "")).strip().lower()
    city = str(lead_data.get("current_city", "")).strip().lower()
    location_corpus = f"{country} {city}".lower()
    
    overseas_score = 0
    if any(c in location_corpus for c in TIER_1_COUNTRIES):
        overseas_score = 20
        evidence_list.append(EvidenceItem(
            category="overseas_status",
            points=20,
            description=f"Resident in Tier 1 high-liquidity investor market ({lead_data.get('current_country')}).",
            source_type="Location Verification"
        ))
    elif any(c in location_corpus for c in TIER_2_COUNTRIES):
        overseas_score = 15
        evidence_list.append(EvidenceItem(
            category="overseas_status",
            points=15,
            description=f"Resident in Tier 2 established diaspora market ({lead_data.get('current_country')}).",
            source_type="Location Verification"
        ))
    elif country and country not in ["pakistan", "pk"]:
        overseas_score = 10
        evidence_list.append(EvidenceItem(
            category="overseas_status",
            points=10,
            description="Verified resident outside Pakistan.",
            source_type="Location Verification"
        ))

    # 3. Financial / Professional Strength Signals (0 - 20 pts)
    fin_score = 0
    title_corpus = f"{lead_data.get('job_title', '')} {lead_data.get('profession', '')} {lead_data.get('seniority', '')}".lower()
    
    if any(re.search(r"\b" + r + r"\b", title_corpus, re.I) for r in FOUNDER_ROLES):
        fin_score = 20
        evidence_list.append(EvidenceItem(
            category="financial_strength",
            points=20,
            description=f"Founder / C-Level Executive / Business Owner ({lead_data.get('job_title') or 'Founder'}).",
            source_type="Corporate Registry / Executive Profile"
        ))
    elif any(re.search(r"\b" + r + r"\b", title_corpus, re.I) for r in MEDICAL_ROLES):
        fin_score = 18
        evidence_list.append(EvidenceItem(
            category="financial_strength",
            points=18,
            description=f"Medical Specialist / Consultant Surgeon / Practice Leader ({lead_data.get('job_title') or 'Doctor'}).",
            source_type="Medical Registry / Clinic Website"
        ))
    elif any(re.search(r"\b" + r + r"\b", title_corpus, re.I) for r in EXEC_ROLES):
        fin_score = 16
        evidence_list.append(EvidenceItem(
            category="financial_strength",
            points=16,
            description=f"Senior Corporate Director / Vice President / Partner ({lead_data.get('job_title')}).",
            source_type="Corporate Directory"
        ))
    else:
        fin_score = 10
        evidence_list.append(EvidenceItem(
            category="financial_strength",
            points=10,
            description="Established corporate / professional seniority.",
            source_type="Professional Profile"
        ))

    # Company size booster (if available)
    comp_size = str(lead_data.get("company_size", "")).lower()
    if any(s in comp_size for s in ["100+", "250+", "500+", "1000+", "enterprise", "50-"]):
        fin_score = min(20, fin_score + 2)

    fin_score = min(20, fin_score)

    # 4. Pakistan Investment Connection (0 - 15 pts)
    pak_inv_score = 0
    if any(k in text_corpus for k in ["invest in pakistan", "pakistan investment", "venture fund", "repatriation", "property fund", "startup pakistan"]):
        pak_inv_score = 15
        evidence_list.append(EvidenceItem(
            category="pakistan_investment",
            points=15,
            description="Public participation in Pakistan capital investment, startup equity, or business ventures.",
            source_type="Media / Investment Press"
        ))
    elif "investment" in text_corpus or "portfolio" in text_corpus:
        pak_inv_score = 8

    # 5. Islamabad Connection & Real Estate Intent (0 - 35 pts)
    isb_conn_score = 0
    re_intent_score = 0

    found_isb = False
    for loc in ISLAMABAD_LOCATIONS:
        if re.search(r"\b" + loc + r"\b", text_corpus, re.I):
            isb_conn_score += 15
            found_isb = True
            evidence_list.append(EvidenceItem(
                category="islamabad_connection",
                points=15,
                description=f"Documented property, family, or business interest linked to Islamabad/Rawalpindi ({loc.title()}).",
                source_type="Public Statement / Press / Directory"
            ))
            break

    if any(re_term in text_corpus for re_term in ["real estate", "property", "villa", "plot", "commercial floor", "penthouse", "farmhouse", "dha plot", "cda sector"]):
        re_intent_score = 20
        evidence_list.append(EvidenceItem(
            category="real_estate_intent",
            points=20,
            description="Publicly documented real estate acquisition or development intent in Pakistan.",
            source_type="Real Estate Forum / Public Quote"
        ))
    elif found_isb:
        re_intent_score = 10

    isb_conn_score = min(15, isb_conn_score)
    re_intent_score = min(20, re_intent_score)

    # Total Score Normalization
    raw_total = pak_score + overseas_score + fin_score + pak_inv_score + isb_conn_score + re_intent_score
    normalized = min(100, round((raw_total / 120.0) * 100))

    # Category Assignment
    if normalized >= 80:
        category = ScoreCategory.HOT
    elif normalized >= 65:
        category = ScoreCategory.HIGH_POTENTIAL
    elif normalized >= 50:
        category = ScoreCategory.POTENTIAL
    elif normalized >= 30:
        category = ScoreCategory.LOW_CONFIDENCE
    else:
        category = ScoreCategory.REJECT

    # Confidence calculation
    if pak_score >= 20 and fin_score >= 16 and overseas_score >= 15:
        confidence = ConfidenceLevel.HIGH
    elif pak_score >= 15 or (overseas_score >= 15 and fin_score >= 15):
        confidence = ConfidenceLevel.MEDIUM
    else:
        confidence = ConfidenceLevel.LOW

    # Generate clear human-readable summary
    summary_parts = []
    if pak_score >= 20:
        summary_parts.append("Verified Pakistan roots & diaspora leadership")
    elif pak_score > 0:
        summary_parts.append("Documented Pakistan heritage signals")
    else:
        summary_parts.append("Pakistan connection unverified (Requires Review)")

    if fin_score >= 18:
        summary_parts.append("Senior business founder / healthcare leader")
    elif fin_score >= 14:
        summary_parts.append("High-seniority corporate executive")

    if isb_conn_score > 0 or re_intent_score > 0:
        summary_parts.append("Active Islamabad real estate investment relevance")

    evidence_summary = ". ".join(summary_parts) + "."

    return ScoringBreakdown(
        pakistan_connection_score=pak_score,
        overseas_status_score=overseas_score,
        financial_strength_score=fin_score,
        pakistan_investment_score=pak_inv_score,
        islamabad_connection_score=isb_conn_score,
        real_estate_intent_score=re_intent_score,
        raw_total_score=raw_total,
        normalized_score=normalized,
        score_category=category,
        confidence=confidence,
        evidence_list=evidence_list,
        evidence_summary=evidence_summary
    )
