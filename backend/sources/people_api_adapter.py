"""
people_api_adapter.py - External People Extraction API Connectors & Discovery
==============================================================================
ApexLead External People Data Provider Integrations.

Supported APIs for extracting verified personal contact info:
1. Apollo.io API (https://apollo.io):
   - Personal emails, work emails, verified direct dials / cell phones, LinkedIn URLs
   - Endpoint: POST https://api.apollo.io/v1/people/match

2. Proxycurl Person Profile & Contact API (https://nubela.co/proxycurl):
   - Scrapes & extracts live LinkedIn profile, personal emails, phone numbers
   - Endpoint: GET https://nubela.co/proxycurl/api/v2/linkedin/person

3. People Data Labs (PDL) (https://peopledatalabs.com):
   - 3B+ global profiles, personal cell phones, personal emails (Gmail/Yahoo/iCloud)
   - Endpoint: GET https://api.peopledatalabs.com/v1/person/enrich

4. ContactOut API (https://contactout.com):
   - Industry leader for personal emails from LinkedIn profiles (75%+ personal email rate)
   - Endpoint: GET https://api.contactout.com/v1/people

5. RocketReach API (https://rocketreach.co):
   - 700M+ profiles, direct cell phone numbers and verified personal emails
   - Endpoint: GET https://api.rocketreach.com/v2/api/lookupProfile
"""

import os
import logging
from typing import Dict, Any, List
import httpx

import config
from contact_validator import (
    validate_personal_email,
    validate_personal_phone,
    validate_personal_linkedin,
    double_check_lead_contacts
)
from sources.apollo_adapter import ApolloClient

log = logging.getLogger(__name__)


PEOPLE_APIS_DIRECTORY = [
    {
        "id": "apollo",
        "name": "Apollo.io API",
        "website": "https://apollo.io",
        "docs_url": "https://apolloio.github.io/apollo-api-docs/",
        "capabilities": ["Personal Email", "Direct Mobile Phone", "Personal LinkedIn", "Company Insights"],
        "pricing_model": "Freemium / Monthly Credits",
        "best_for": "B2B executives, founders, and managing directors globally",
        "env_key": "APOLLO_API_KEY",
        "status": "Ready (requires API key in environment or settings)"
    },
    {
        "id": "proxycurl",
        "name": "Proxycurl (Nubela)",
        "website": "https://nubela.co/proxycurl",
        "docs_url": "https://nubela.co/proxycurl/docs",
        "capabilities": ["Personal LinkedIn Profile", "Personal Email", "Personal Phone Numbers"],
        "pricing_model": "Pay-as-you-go Credit Packs (~$0.01 - $0.03/lookup)",
        "best_for": "Deep LinkedIn profile extraction and personal phone/email lookup",
        "env_key": "PROXYCURL_API_KEY",
        "status": "Ready (requires API key)"
    },
    {
        "id": "pdl",
        "name": "People Data Labs (PDL)",
        "website": "https://peopledatalabs.com",
        "docs_url": "https://docs.peopledatalabs.com/",
        "capabilities": ["Personal Mobile Numbers", "Personal Gmail/Yahoo Emails", "LinkedIn URL", "Education / Diaspora Graph"],
        "pricing_model": "Free Tier (1,000 matches/mo) then Pay-as-you-go",
        "best_for": "High-net-worth diaspora individuals across UK, US, UAE, and Canada",
        "env_key": "PDL_API_KEY",
        "status": "Ready (requires API key)"
    },
    {
        "id": "contactout",
        "name": "ContactOut API",
        "website": "https://contactout.com",
        "docs_url": "https://api.contactout.com/documentation",
        "capabilities": ["Triple-Verified Personal Email (Gmail/Hotmail)", "Personal Direct Phone", "LinkedIn URL"],
        "pricing_model": "Free Credits + Subscription",
        "best_for": "Direct personal emails from LinkedIn profiles",
        "env_key": "CONTACTOUT_API_KEY",
        "status": "Ready (requires API key)"
    },
    {
        "id": "rocketreach",
        "name": "RocketReach API",
        "website": "https://rocketreach.co",
        "docs_url": "https://rocketreach.co/api",
        "capabilities": ["Personal Emails", "Cell Phone Numbers", "Social Links"],
        "pricing_model": "Monthly Subscription / API Tiers",
        "best_for": "Locating high-accuracy personal cell phone numbers and personal emails",
        "env_key": "ROCKETREACH_API_KEY",
        "status": "Ready (requires API key)"
    }
]


class PeopleAPIOrchestrator:
    """
    Unified manager for third-party people enrichment APIs.
    Dispatches to configured APIs and enforces double-checking of all returned data.
    """

    def __init__(self):
        self.apollo_client = ApolloClient()
        self.proxycurl_key = os.getenv("PROXYCURL_API_KEY", "").strip()
        self.pdl_key = os.getenv("PDL_API_KEY", "").strip()
        self.contactout_key = os.getenv("CONTACTOUT_API_KEY", "").strip()

    def get_api_catalog(self) -> List[Dict[str, Any]]:
        """Returns metadata and status for all candidate extraction APIs."""
        catalog = []
        for api in PEOPLE_APIS_DIRECTORY:
            entry = dict(api)
            if api["id"] == "apollo":
                has_key = bool(config.APOLLO_API_KEY) and config.ENABLE_APOLLO
            else:
                has_key = bool(os.getenv(api["env_key"], "").strip())
            entry["configured"] = has_key
            entry["status"] = "Active & Configured" if has_key else "Ready (Awaiting API Key)"
            catalog.append(entry)
        return catalog

    async def enrich_person(self, person: Dict[str, Any]) -> Dict[str, Any]:
        """
        Enriches a person using available configured APIs in priority sequence.
        Any returned contact info is strictly double-checked.
        """
        # 1. Apollo only when user explicitly opted in for this request
        if self.apollo_client.is_configured and person.get("use_apollo"):
            person = await self._enrich_via_apollo(person)

        # 2. Try PDL if key is present and personal contact missing
        if self.pdl_key and (not person.get("public_email") or not person.get("public_phone")):
            person = await self._enrich_via_pdl(person)

        # 3. Double-check all contacts strictly
        person = double_check_lead_contacts(person)
        return person

    async def _enrich_via_apollo(self, person: Dict[str, Any]) -> Dict[str, Any]:
        """Query Apollo.io people match API via ApolloClient."""
        try:
            res = await self.apollo_client.people_match(
                first_name=person.get("first_name", ""),
                last_name=person.get("last_name", ""),
                full_name=person.get("full_name", ""),
                organization_name=person.get("company", ""),
                linkedin_url=person.get("professional_profile_url") or person.get("linkedin_url", ""),
            )
            if res.get("found"):
                raw_email = res.get("email") or ""
                raw_phone = res.get("phone") or ""
                raw_li = res.get("linkedin_url") or ""

                valid_em, clean_em, _ = validate_personal_email(raw_email, person.get("full_name", ""))
                if valid_em and not person.get("public_email"):
                    person["public_email"] = clean_em
                    person["email_source_url"] = "https://apollo.io"
                elif raw_email and not person.get("professional_email"):
                    person["professional_email"] = raw_email
                    person["email_source_url"] = "https://apollo.io"

                valid_ph, clean_ph, _ = validate_personal_phone(raw_phone, person.get("current_country", ""))
                if valid_ph and not person.get("public_phone"):
                    person["public_phone"] = clean_ph
                    person["phone_source_url"] = "https://apollo.io"

                valid_li, clean_li, _ = validate_personal_linkedin(raw_li, person.get("full_name", ""))
                if valid_li and not person.get("professional_profile_url"):
                    person["professional_profile_url"] = clean_li
                    person["linkedin_url"] = clean_li

                log.info("Apollo enrichment succeeded for %s", person.get("full_name"))
            elif res.get("error"):
                log.debug("Apollo no match for %s: %s", person.get("full_name"), res.get("error"))
        except Exception as e:
            log.warning("Apollo enrichment error for %s: %s", person.get("full_name"), e)
        return person

    async def _enrich_via_pdl(self, person: Dict[str, Any]) -> Dict[str, Any]:
        """Query People Data Labs enrich API."""
        try:
            url = "https://api.peopledatalabs.com/v1/person/enrich"
            params = {
                "api_key": self.pdl_key,
                "name": person.get("full_name", ""),
                "company": person.get("company", ""),
                "country": person.get("current_country", "")
            }
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(url, params=params)
                if resp.status_code == 200:
                    data = resp.json().get("data", {})
                    emails = data.get("emails", [])
                    phones = data.get("phone_numbers", [])
                    linkedin_url = data.get("linkedin_url")

                    # Check personal emails
                    for em_obj in emails:
                        em_val = em_obj.get("address", "") if isinstance(em_obj, dict) else str(em_obj)
                        valid_em, clean_em, _ = validate_personal_email(em_val, person.get("full_name", ""))
                        if valid_em:
                            person["public_email"] = clean_em
                            person["email_source_url"] = "https://peopledatalabs.com"
                            break

                    # Check phones
                    for ph in phones:
                        ph_str = ph if isinstance(ph, str) else ph.get("number", "")
                        valid_ph, clean_ph, _ = validate_personal_phone(ph_str, person.get("current_country", ""))
                        if valid_ph:
                            person["public_phone"] = clean_ph
                            person["phone_source_url"] = "https://peopledatalabs.com"
                            break

                    if linkedin_url:
                        valid_li, clean_li, _ = validate_personal_linkedin(linkedin_url, person.get("full_name", ""))
                        if valid_li:
                            person["professional_profile_url"] = clean_li
        except Exception as e:
            log.warning("PDL enrichment error for %s: %s", person.get("full_name"), e)
        return person
