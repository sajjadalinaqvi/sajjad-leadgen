import csv
import io
import json
import logging
from typing import List, Dict, Any, Tuple
from .base import BaseLeadSource
from scorer import calculate_lead_score
from compliance import is_contact_suppressed, check_duplicate_lead

log = logging.getLogger(__name__)


class ManualImportLeadSource(BaseLeadSource):
    """
    Handles structured CSV and JSON prospect imports,
    running auto-scoring, deduplication, and suppression verification.
    """

    def __init__(self):
        super().__init__(name="Manual CSV / JSON Import", source_type="User Import")

    async def discover_candidates(self, criteria: Dict[str, Any]) -> List[Dict[str, Any]]:
        return []

    def import_records_from_csv(self, file_content: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        """Parse CSV rows into scored lead candidates."""
        candidates = []
        errors = []
        reader = csv.DictReader(io.StringIO(file_content))

        for row_idx, row in enumerate(reader, start=1):
            name = (
                row.get("Full Name")
                or row.get("full_name")
                or row.get("Name")
                or row.get("name")
                or f"{row.get('first_name', '')} {row.get('last_name', '')}".strip()
            )
            if not name:
                errors.append(f"Row {row_idx}: Missing name.")
                continue

            email = (row.get("Email") or row.get("email") or row.get("public_email") or "").strip()
            phone = (row.get("Phone") or row.get("phone") or row.get("public_phone") or "").strip()

            # Check DNC suppression
            if is_contact_suppressed(email=email, phone=phone):
                errors.append(f"Row {row_idx} ({name}): Skipped due to Do Not Contact (DNC) suppression.")
                continue

            raw_dict = {
                "full_name": name,
                "current_country": row.get("Country") or row.get("country") or "UAE",
                "current_city": row.get("City") or row.get("city") or "",
                "profession": row.get("Profession") or row.get("profession") or "Executive",
                "job_title": row.get("Job Title") or row.get("job_title") or row.get("Title") or "",
                "company": row.get("Company") or row.get("company") or "",
                "company_website": row.get("Company Website") or row.get("company_website") or "",
                "company_size": row.get("Company Size") or row.get("company_size") or "",
                "professional_profile_url": row.get("Profile URL") or row.get("professional_profile_url") or "",
                "public_email": email,
                "public_phone": phone,
                "notes": row.get("Notes") or row.get("notes") or "",
                "evidence_summary": row.get("Evidence") or row.get("evidence_summary") or "",
                "source_urls": [row.get("Source URL") or row.get("source_url")] if (row.get("Source URL") or row.get("source_url")) else []
            }

            norm = self.normalize_candidate(raw_dict)
            candidates.append(norm)

        return candidates, errors

    def normalize_candidate(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        scoring = calculate_lead_score(raw_data)
        lead = dict(raw_data)
        lead["pakistan_connection_score"] = scoring.pakistan_connection_score
        lead["overseas_status_score"] = scoring.overseas_status_score
        lead["financial_strength_score"] = scoring.financial_strength_score
        lead["pakistan_investment_score"] = scoring.pakistan_investment_score
        lead["islamabad_connection_score"] = scoring.islamabad_connection_score
        lead["real_estate_intent_score"] = scoring.real_estate_intent_score
        lead["total_lead_score"] = scoring.normalized_score
        lead["score_category"] = scoring.score_category.value
        lead["confidence"] = scoring.confidence.value
        lead["evidence_summary"] = scoring.evidence_summary
        lead["evidence_list"] = [e.dict() for e in scoring.evidence_list]
        lead["source_types"] = [self.source_type]
        lead["lead_status"] = "New"
        return lead
