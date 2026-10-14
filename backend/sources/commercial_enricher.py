"""
commercial_enricher.py - Commercial Enrichment Integration
==========================================================
Hunter, Tomba, and Apollo are ONLY called when the user explicitly opts in
per request (use_hunter / use_tomba / use_apollo). Env ENABLE_* + API keys
mean the provider is available — not that it may spend credits automatically.
"""

import logging
from typing import Dict, Any, Optional

import config
from contact_validator import (
    is_personal_email,
    classify_phone_number,
    validate_genuine_linkedin_url,
)
from sources.hunter_adapter import HunterClient
from sources.tomba_adapter import TombaClient
from sources.apollo_adapter import ApolloClient

log = logging.getLogger(__name__)


class CommercialEnricher:
    """Adapter for commercial enrichment providers. Credits spent only on user allow."""

    def __init__(self):
        self.hunter_client = HunterClient()
        self.tomba_client = TombaClient()
        self.apollo_client = ApolloClient()

    def get_quota_status(self) -> Dict[str, Any]:
        return config.get_quota_status()

    async def enrich_candidate(
        self,
        candidate: Dict[str, Any],
        allow_hunter: Optional[bool] = None,
        allow_tomba: Optional[bool] = None,
        allow_apollo: Optional[bool] = None,
    ) -> Dict[str, Any]:
        """
        Enrich using only providers the user explicitly allowed for this request.
        Flags may also be embedded on the candidate dict (use_hunter / use_tomba / use_apollo).
        """
        use_hunter = bool(
            allow_hunter if allow_hunter is not None else candidate.get("use_hunter", False)
        )
        use_tomba = bool(
            allow_tomba if allow_tomba is not None else candidate.get("use_tomba", False)
        )
        use_apollo = bool(
            allow_apollo if allow_apollo is not None else candidate.get("use_apollo", False)
        )

        full_name = candidate.get("full_name", "")
        employer = candidate.get("employer") or candidate.get("company", "")
        first_name = candidate.get("first_name", "")
        last_name = candidate.get("last_name", "")

        if not first_name or not last_name:
            parts = full_name.split()
            if len(parts) >= 2:
                first_name = parts[0]
                last_name = parts[-1]

        if not (use_hunter or use_tomba or use_apollo):
            # Expected default path — credits are not spent
            return candidate

        # 1. Hunter — only if user allowed this run
        if (
            use_hunter
            and config.ENABLE_HUNTER
            and config.HUNTER_API_KEY
            and (not candidate.get("professional_email") or not candidate.get("personal_email"))
        ):
            await self._enrich_via_hunter(candidate, first_name, last_name, employer)
        elif use_hunter and not (config.ENABLE_HUNTER and config.HUNTER_API_KEY):
            log.debug("[Hunter] User allowed but provider not configured/enabled")

        # 2. Tomba — only if user allowed this run
        if (
            use_tomba
            and config.ENABLE_TOMBA
            and self.tomba_client.is_configured
            and not candidate.get("professional_email")
        ):
            await self._enrich_via_tomba(candidate, first_name, last_name, employer)
        elif use_tomba and not (config.ENABLE_TOMBA and self.tomba_client.is_configured):
            log.debug("[Tomba] User allowed but provider not configured/enabled")

        # 3. Apollo — only if user allowed this run
        if use_apollo and config.ENABLE_APOLLO and self.apollo_client.is_configured:
            needs_contact = (
                not candidate.get("professional_email")
                or not candidate.get("personal_email")
                or not candidate.get("linkedin_url")
                or not candidate.get("professional_phone")
            )
            if needs_contact:
                await self._enrich_via_apollo(candidate, first_name, last_name, employer)
        elif use_apollo and not (config.ENABLE_APOLLO and self.apollo_client.is_configured):
            log.debug("[Apollo] User allowed but provider not configured/enabled")

        return candidate

    async def _enrich_via_hunter(
        self, candidate: Dict[str, Any], first_name: str, last_name: str, company: str
    ):
        try:
            res = await self.hunter_client.find_email(
                first_name=first_name,
                last_name=last_name,
                full_name=candidate.get("full_name", ""),
                company=company,
                domain=candidate.get("company_website", ""),
                linkedin_url=candidate.get("linkedin_url", ""),
            )
            if res.get("found"):
                email = res.get("email")
                score = res.get("score") or 0
                src_url = res.get("primary_source_url") or "https://hunter.io"

                if res.get("is_personal") and not candidate.get("personal_email"):
                    candidate["personal_email"] = email
                    candidate["email_match_confidence"] = score
                    candidate["email_verified"] = score >= 70
                    candidate["email_source_url"] = src_url
                    candidate.setdefault("source_names", []).append("Hunter.io Free Tier")
                elif not candidate.get("professional_email"):
                    candidate["professional_email"] = email
                    candidate["email_match_confidence"] = score
                    candidate["email_verified"] = score >= 70
                    candidate["email_source_url"] = src_url
                    candidate.setdefault("source_names", []).append("Hunter.io Free Tier")

                if res.get("phone_number"):
                    ph_info = classify_phone_number(res["phone_number"])
                    if ph_info.get("is_mobile") and not candidate.get("personal_phone"):
                        candidate["personal_phone"] = ph_info.get("formatted_e164") or res["phone_number"]
                        candidate["phone_type"] = "mobile"
                        candidate["phone_match_confidence"] = 80
                    elif not candidate.get("professional_phone"):
                        candidate["professional_phone"] = ph_info.get("formatted_e164") or res["phone_number"]

                if res.get("linkedin_url") and not candidate.get("linkedin_url"):
                    li_val = validate_genuine_linkedin_url(
                        res["linkedin_url"], candidate.get("full_name", "")
                    )
                    if li_val.get("is_genuine"):
                        candidate["linkedin_url"] = li_val.get("clean_url")
                        candidate["linkedin_source_url"] = "https://hunter.io"
                        candidate["linkedin_identity_match"] = "verified"
                        candidate["linkedin_match_confidence"] = 85

                log.info(
                    "[Hunter] Enriched contact for %s: %s (score: %d)",
                    candidate.get("full_name"),
                    email,
                    score,
                )
        except Exception as e:
            log.debug("[Hunter] Request error: %s", e)

    async def _enrich_via_tomba(
        self, candidate: Dict[str, Any], first_name: str, last_name: str, company: str
    ):
        try:
            res = await self.tomba_client.find_email(
                first_name=first_name,
                last_name=last_name,
                full_name=candidate.get("full_name", ""),
                company=company,
                domain=candidate.get("company_website", ""),
                linkedin_url=candidate.get("linkedin_url", ""),
            )
            if not res.get("found"):
                if res.get("error"):
                    log.debug("[Tomba] No match for %s: %s", candidate.get("full_name"), res.get("error"))
                return

            email = res.get("email")
            score = res.get("score") or 0
            src_url = res.get("primary_source_url") or "https://tomba.io"

            if res.get("is_personal") and not candidate.get("personal_email"):
                candidate["personal_email"] = email
                candidate["email_match_confidence"] = score
                candidate["email_verified"] = score >= 70
                candidate["email_source_url"] = src_url
            elif not candidate.get("professional_email"):
                candidate["professional_email"] = email
                candidate["email_match_confidence"] = score
                candidate["email_verified"] = score >= 70
                candidate["email_source_url"] = src_url

            if res.get("position") and not candidate.get("job_title"):
                candidate["job_title"] = res["position"]
            if res.get("company") and not candidate.get("company"):
                candidate["company"] = res["company"]

            candidate.setdefault("source_names", []).append("Tomba.io")
            log.info(
                "[Tomba] Found email for %s: %s (score: %d)",
                candidate.get("full_name"),
                email,
                score,
            )
        except Exception as e:
            log.debug("[Tomba] Request error: %s", e)

    async def _enrich_via_apollo(
        self, candidate: Dict[str, Any], first_name: str, last_name: str, company: str
    ):
        try:
            res = await self.apollo_client.people_match(
                first_name=first_name,
                last_name=last_name,
                full_name=candidate.get("full_name", ""),
                organization_name=company,
                domain=candidate.get("company_website", ""),
                email=candidate.get("professional_email") or candidate.get("personal_email") or "",
                linkedin_url=candidate.get("linkedin_url") or candidate.get("professional_profile_url") or "",
            )
            if not res.get("found"):
                if res.get("error"):
                    log.debug("[Apollo] No match for %s: %s", candidate.get("full_name"), res.get("error"))
                return

            email = res.get("email")
            if email:
                if is_personal_email(email) and not candidate.get("personal_email"):
                    candidate["personal_email"] = email
                    candidate["email_source_url"] = "https://apollo.io"
                    candidate["email_verified"] = True
                elif not candidate.get("professional_email"):
                    candidate["professional_email"] = email
                    candidate["email_source_url"] = "https://apollo.io"
                    candidate["email_verified"] = True

            phone = res.get("phone")
            if phone:
                ph_info = classify_phone_number(phone)
                if ph_info.get("is_mobile") and not candidate.get("personal_phone"):
                    candidate["personal_phone"] = ph_info.get("formatted_e164") or phone
                    candidate["phone_type"] = "mobile"
                    candidate["phone_source_url"] = "https://apollo.io"
                elif not candidate.get("professional_phone"):
                    candidate["professional_phone"] = ph_info.get("formatted_e164") or phone
                    candidate["phone_source_url"] = "https://apollo.io"

            linkedin = res.get("linkedin_url")
            if linkedin and not candidate.get("linkedin_url"):
                li_val = validate_genuine_linkedin_url(linkedin, candidate.get("full_name", ""))
                if li_val.get("is_genuine"):
                    candidate["linkedin_url"] = li_val.get("clean_url")
                    candidate["professional_profile_url"] = li_val.get("clean_url")
                    candidate["linkedin_source_url"] = "https://apollo.io"
                    candidate["linkedin_identity_match"] = "verified"
                    candidate["linkedin_match_confidence"] = 85

            if res.get("title") and not candidate.get("job_title"):
                candidate["job_title"] = res["title"]
            if res.get("organization") and not candidate.get("company"):
                candidate["company"] = res["organization"]

            candidate.setdefault("source_names", []).append("Apollo.io")
            log.info("[Apollo] Enriched contact for %s", candidate.get("full_name"))
        except Exception as e:
            log.debug("[Apollo] Request error: %s", e)
