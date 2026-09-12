import logging
from typing import List, Dict, Any
from .base import BaseLeadSource
from scorer import calculate_lead_score
from compliance import is_contact_suppressed

log = logging.getLogger(__name__)


class ApolloStructuredAdapter(BaseLeadSource):
    """
    Adapter for official Apollo CSV exports or authorized API data.
    Enriches professional corporate attributes (seniority, company size, title)
    and combines them with our evidence-based diaspora scoring.
    """

    def __init__(self):
        super().__init__(name="Apollo Professional Data Adapter", source_type="Apollo Data Provider")

    async def discover_candidates(self, criteria: Dict[str, Any]) -> List[Dict[str, Any]]:
        # When an official API key is configured, query the Apollo API here
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
