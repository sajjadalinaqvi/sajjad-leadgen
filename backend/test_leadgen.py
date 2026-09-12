import sys
import os
import unittest
import uuid

sys.path.insert(0, os.path.dirname(__file__))

from scorer import calculate_lead_score
from database import query_leads, get_crm_funnel_stats, is_suppressed, add_to_suppression
from compliance import check_duplicate_lead


class TestLeadGenIntelligence(unittest.TestCase):

    def test_scoring_high_confidence_founder(self):
        lead = {
            "full_name": "Tariq Alvi",
            "current_country": "UAE",
            "job_title": "Founder & CEO",
            "company": "Alvi FinTech",
            "notes": "NUST Alumnus, member of Pakistan Business Council, interested in DHA Islamabad plots"
        }
        res = calculate_lead_score(lead)
        self.assertGreaterEqual(res.normalized_score, 80)
        self.assertEqual(res.score_category.value, "HOT")
        self.assertEqual(res.confidence.value, "HIGH")
        self.assertGreaterEqual(res.pakistan_connection_score, 20)
        self.assertGreaterEqual(res.financial_strength_score, 20)
        self.assertGreaterEqual(res.overseas_status_score, 20)

    def test_scoring_no_pakistan_evidence(self):
        # A name alone must NEVER infer Pakistan connection
        lead = {
            "full_name": "Zaid Malik",
            "current_country": "USA",
            "job_title": "Software Engineer",
            "company": "Tech Corp",
            "notes": "Living in Seattle, working in enterprise cloud"
        }
        res = calculate_lead_score(lead)
        self.assertEqual(res.pakistan_connection_score, 0)
        self.assertIn(res.score_category.value, ["LOW CONFIDENCE", "REJECT / INSUFFICIENT DATA", "POTENTIAL"])

    def test_database_and_funnel(self):
        leads, total = query_leads(page=1, page_size=10)
        self.assertGreater(total, 0)
        funnel = get_crm_funnel_stats()
        self.assertIn("total_candidates", funnel)
        self.assertIn("qualified_leads", funnel)

    def test_suppression_and_dnc(self):
        unique_email = f"dnc_{uuid.uuid4().hex[:8]}@uniquedomain.org"
        self.assertFalse(is_suppressed(email=unique_email))
        add_to_suppression("email", unique_email, "Testing suppression")
        self.assertTrue(is_suppressed(email=unique_email))


if __name__ == "__main__":
    unittest.main()
