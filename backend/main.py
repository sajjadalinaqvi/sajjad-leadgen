import json
import logging
import traceback
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, Query, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel

from models import (
    Lead, CandidateSearchRequest, LeadFilterRequest,
    LeadStatusUpdateRequest, SuppressionCreateRequest
)
from database import (
    get_lead_by_id, query_leads, insert_lead_dict,
    update_lead_status, delete_lead_permanently,
    list_suppressions, add_to_suppression, remove_from_suppression,
    list_audit_logs, get_crm_funnel_stats, log_audit_event
)
from scorer import calculate_lead_score
from compliance import check_duplicate_lead, is_contact_suppressed
from sources.search_source import SearchEngineLeadSource
from sources.import_source import ManualImportLeadSource
from scraper import scrape_google_maps
from dorking import scrape_dork
from exporter import (
    export_csv, export_json, export_excel,
    export_dork_csv, export_dork_json, export_dork_excel,
    export_overseas_csv, export_overseas_excel, export_overseas_json
)
from enrichment import deep_enrich_person, dork_contact_search

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

app = FastAPI(title="ApexLead AI — Lead Intelligence Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

search_source = SearchEngineLeadSource()
import_source = ManualImportLeadSource()


class ScrapeRequest(BaseModel):
    maps_url: str = ""
    keyword: str = ""
    location: str = ""
    category: str = ""
    min_rating: float = 0
    open_now: bool = False
    page: int = 1
    results_per_page: int = 25


class DorkRequest(BaseModel):
    query: str = ""
    search_url: str = ""
    page: int = 1
    results_per_page: int = 25


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request, exc):
    return JSONResponse(status_code=422, content={"error": f"Invalid parameters: {exc}"})


@app.exception_handler(Exception)
async def global_error_handler(request, exc):
    log.error("Unhandled exception: %s\n%s", exc, traceback.format_exc())
    return JSONResponse(status_code=500, content={"error": "Internal server error. Check backend logs."})


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ApexLead AI Intelligence Engine"}


# ── Overseas Pakistani Investor Leads API ─────────────────────────────────────

@app.post("/overseas/search")
async def search_overseas_candidates(req: CandidateSearchRequest):
    """
    Discovers candidate leads from permitted diaspora & executive search discovery,
    scoring each on Pakistan connection, overseas status, and real estate investment intent.
    """
    try:
        log.info("Running diaspora search for countries=%s, professions=%s", req.countries, req.professions)
        candidates = await search_source.discover_candidates(req.dict())
        
        # Filter by min_score if requested
        filtered = [c for c in candidates if c.get("total_lead_score", 0) >= req.min_score]
        log.info("Search finished: %d raw candidates, %d above min_score (%d)", len(candidates), len(filtered), req.min_score)
        
        return {
            "results": filtered,
            "count": len(filtered),
            "raw_count": len(candidates)
        }
    except Exception as e:
        log.error("Overseas search failed: %s", traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Search discovery failed: {str(e)}")


@app.get("/leads")
async def list_leads(
    country: str = "All",
    profession: str = "All",
    lead_status: str = "All",
    score_category: str = "All",
    min_score: int = 0,
    search: str = "",
    include_dnc: bool = False,
    page: int = 1,
    page_size: int = 25
):
    """Fetch stored leads with filtering, CRM stage breakdown, and pagination."""
    try:
        leads, total = query_leads(
            country=country,
            profession=profession,
            lead_status=lead_status,
            score_category=score_category,
            min_score=min_score,
            search_query=search,
            include_dnc=include_dnc,
            page=page,
            page_size=page_size
        )
        return {
            "leads": leads,
            "total": total,
            "page": page,
            "page_size": page_size,
            "has_more": (page * page_size) < total
        }
    except Exception as e:
        log.error("List leads failed: %s", traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")


@app.get("/leads/{lead_id}")
async def get_lead_details(lead_id: str):
    """Retrieve full lead card with individual evidence items and source URLs."""
    lead = get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@app.post("/leads")
async def create_or_save_lead(lead_data: dict):
    """
    Save or manually create a lead record. Auto-computes score,
    checks duplicate status, and verifies suppression.
    """
    email = lead_data.get("public_email", "")
    phone = lead_data.get("public_phone", "")
    
    # 1. Check suppression / DNC
    if is_contact_suppressed(email=email, phone=phone):
        lead_data["do_not_contact"] = True
        lead_data["dnc_reason"] = "Matched Suppression / DNC registry"
        lead_data["lead_status"] = "Do Not Contact"

    # 2. Check duplicate
    is_dup, existing_id = check_duplicate_lead(
        email=email,
        phone=phone,
        profile_url=lead_data.get("professional_profile_url"),
        full_name=lead_data.get("full_name"),
        company=lead_data.get("company")
    )

    if is_dup and existing_id and not lead_data.get("id"):
        lead_data["id"] = existing_id
        lead_data["notes"] = (lead_data.get("notes", "") + " [Updated from duplicate match]").strip()

    # 3. Compute score breakdown
    scoring = calculate_lead_score(lead_data)
    lead_data["pakistan_connection_score"] = scoring.pakistan_connection_score
    lead_data["overseas_status_score"] = scoring.overseas_status_score
    lead_data["financial_strength_score"] = scoring.financial_strength_score
    lead_data["pakistan_investment_score"] = scoring.pakistan_investment_score
    lead_data["islamabad_connection_score"] = scoring.islamabad_connection_score
    lead_data["real_estate_intent_score"] = scoring.real_estate_intent_score
    lead_data["total_lead_score"] = scoring.normalized_score
    lead_data["score_category"] = scoring.score_category.value
    lead_data["confidence"] = scoring.confidence.value
    lead_data["evidence_summary"] = scoring.evidence_summary
    lead_data["evidence_list"] = [e.dict() for e in scoring.evidence_list]

    saved_id = insert_lead_dict(lead_data)
    log_audit_event(saved_id, "saved", {"name": lead_data.get("full_name"), "score": scoring.normalized_score})

    return {"status": "ok", "id": saved_id, "is_duplicate": is_dup}


@app.patch("/leads/{lead_id}/status")
async def update_lead_crm_status(lead_id: str, req: LeadStatusUpdateRequest):
    """Update CRM pipeline stage (e.g. Qualified, Contacted, Meeting, Converted, DNC)."""
    lead = get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    success = update_lead_status(
        lead_id=lead_id,
        new_status=req.lead_status.value,
        notes=req.notes,
        rejection_reason=req.rejection_reason
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update lead status")
    
    return {"status": "ok", "lead_id": lead_id, "new_status": req.lead_status.value}


@app.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str):
    """Permanently delete a lead record."""
    success = delete_lead_permanently(lead_id)
    if not success:
        raise HTTPException(status_code=404, detail="Lead not found or already deleted")
    return {"status": "ok", "deleted_id": lead_id}


@app.post("/leads/enrich-candidate")
async def enrich_candidate_contacts(candidate: dict):
    """
    Executes deep OSINT search dorks to discover personal/direct phone numbers,
    WhatsApp contacts, public emails, and company websites for a candidate.
    """
    try:
        enriched = await deep_enrich_person(candidate)
        return {"status": "ok", "candidate": enriched}
    except Exception as e:
        log.error("Enrich candidate failed: %s", traceback.format_exc())
        return {"status": "error", "error": str(e), "candidate": candidate}


@app.post("/leads/{lead_id}/enrich")
async def enrich_stored_lead(lead_id: str):
    """
    Runs deep OSINT contact dorking for an existing lead in the database,
    updating their phone, email, and social links.
    """
    lead = get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    try:
        enriched = await deep_enrich_person(lead)
        # Update lead in database
        insert_lead_dict(enriched)
        log_audit_event(lead_id, "contact_enriched", {
            "phone": enriched.get("public_phone"),
            "email": enriched.get("public_email")
        })
        return {"status": "ok", "lead": enriched}
    except Exception as e:
        log.error("Enrich stored lead failed: %s", traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Enrichment failed: {str(e)}")


@app.get("/crm/funnel")
async def get_pipeline_funnel():
    """Returns real-time CRM stage counts and qualification metrics."""
    return get_crm_funnel_stats()


# ── Compliance & Suppression API ─────────────────────────────────────────────

@app.get("/compliance/suppression")
async def get_suppression_records():
    """List all suppressed contacts / DNC entries."""
    return {"suppressions": list_suppressions()}


@app.post("/compliance/suppress")
async def create_suppression_record(req: SuppressionCreateRequest):
    """Add an email, phone, domain, or name to the DNC suppression list."""
    success = add_to_suppression(req.type, req.value, req.reason or "DNC")
    if not success:
        raise HTTPException(status_code=400, detail="Could not add to suppression list")
    return {"status": "ok", "type": req.type, "value": req.value}


@app.delete("/compliance/suppression/{suppression_id}")
async def remove_suppression_record(suppression_id: int):
    """Remove an entry from the DNC suppression list."""
    success = remove_from_suppression(suppression_id)
    if not success:
        raise HTTPException(status_code=404, detail="Suppression entry not found")
    return {"status": "ok"}


@app.get("/compliance/audit-logs")
async def get_audit_trail(limit: int = 50):
    """View recent system audit logs."""
    return {"logs": list_audit_logs(limit=limit)}


# ── Export & Import Endpoints ────────────────────────────────────────────────

@app.post("/export/overseas/{fmt}")
async def export_overseas_leads(fmt: str, payload: dict):
    """
    Export overseas leads with complete transparent evidence summaries,
    individual score breakdowns, and source URLs.
    """
    if fmt not in ("csv", "json", "excel"):
        raise HTTPException(status_code=400, detail=f"Invalid format '{fmt}'. Use csv, json, or excel.")
    
    lead_ids = payload.get("lead_ids", [])
    records = []
    
    if lead_ids:
        for lid in lead_ids:
            item = get_lead_by_id(lid)
            if item:
                records.append(item)
    else:
        # Export all active (non-DNC) leads matching criteria
        records, _ = query_leads(
            country=payload.get("country", "All"),
            profession=payload.get("profession", "All"),
            lead_status=payload.get("lead_status", "All"),
            min_score=payload.get("min_score", 0),
            page=1,
            page_size=1000
        )

    log_audit_event(None, "export_overseas", {"format": fmt, "count": len(records)})

    if fmt == "csv":
        return Response(export_overseas_csv(records), media_type="text/csv",
                        headers={"Content-Disposition": "attachment; filename=overseas_investor_leads.csv"})
    elif fmt == "json":
        return Response(export_overseas_json(records), media_type="application/json",
                        headers={"Content-Disposition": "attachment; filename=overseas_investor_leads.json"})
    elif fmt == "excel":
        return Response(export_overseas_excel(records),
                        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        headers={"Content-Disposition": "attachment; filename=overseas_investor_leads.xlsx"})


@app.post("/import/leads/csv")
async def import_leads_csv(file: UploadFile = File(...)):
    """Upload a CSV file of prospects, running auto-scoring and deduplication."""
    content = await file.read()
    text = content.decode("utf-8", errors="ignore")
    candidates, errors = import_source.import_records_from_csv(text)
    
    saved_count = 0
    dup_count = 0
    for cand in candidates:
        is_dup, _ = check_duplicate_lead(
            email=cand.get("public_email"),
            phone=cand.get("public_phone"),
            profile_url=cand.get("professional_profile_url"),
            full_name=cand.get("full_name"),
            company=cand.get("company")
        )
        if is_dup:
            dup_count += 1
        insert_lead_dict(cand)
        saved_count += 1

    log_audit_event(None, "import_csv", {"total_read": len(candidates), "saved": saved_count, "duplicates": dup_count})

    return {
        "status": "ok",
        "imported": saved_count,
        "duplicates": dup_count,
        "errors": errors
    }


# ── Preserved Google Maps & Search Endpoints ─────────────────────────────────

@app.post("/scrape")
async def scrape(req: ScrapeRequest):
    if not req.maps_url.strip() and not req.keyword.strip():
        raise HTTPException(status_code=400, detail="Provide either a Google Maps URL or a keyword.")
    try:
        log.info("Scraping Maps: url=%s keyword=%s page=%d limit=%d",
                 req.maps_url or req.keyword, req.location, req.page, req.results_per_page)
        results = await scrape_google_maps(
            maps_url=req.maps_url, keyword=req.keyword, location=req.location,
            category=req.category, min_rating=req.min_rating, open_now=req.open_now,
            page=req.page, results_per_page=req.results_per_page
        )
        log.info("Maps scrape done: %d results", len(results))
        return {"results": results, "page": req.page, "count": len(results)}
    except Exception as e:
        log.error("Maps scrape failed: %s", traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Scraping failed: {str(e)}")


@app.post("/dork")
async def dork(req: DorkRequest):
    if not req.query.strip() and not req.search_url.strip():
        raise HTTPException(status_code=400, detail="Provide a search query or a Google search URL.")
    try:
        log.info("Dorking: query=%s url=%s page=%d limit=%d",
                 req.query, req.search_url, req.page, req.results_per_page)
        result = await scrape_dork(
            query=req.query, search_url=req.search_url,
            page=req.page, results_per_page=req.results_per_page
        )
        log.info("Dork done: %d results", len(result.get("results", [])))
        return result
    except Exception as e:
        log.error("Dork failed: %s", traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Dorking failed: {str(e)}")


@app.post("/export-scrape/{fmt}")
async def export_scrape_direct(fmt: str, req: ScrapeRequest):
    if fmt not in ("csv", "json", "excel"):
        raise HTTPException(status_code=400, detail=f"Invalid format '{fmt}'. Use csv, json, or excel.")
    try:
        records = await scrape_google_maps(
            maps_url=req.maps_url, keyword=req.keyword, location=req.location,
            category=req.category, min_rating=req.min_rating, open_now=req.open_now,
            page=1, results_per_page=req.results_per_page
        )
        if fmt == "csv":
            return Response(export_csv(records), media_type="text/csv",
                            headers={"Content-Disposition": "attachment; filename=maps_results.csv"})
        elif fmt == "json":
            return Response(export_json(records), media_type="application/json",
                            headers={"Content-Disposition": "attachment; filename=maps_results.json"})
        elif fmt == "excel":
            return Response(export_excel(records),
                            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                            headers={"Content-Disposition": "attachment; filename=maps_results.xlsx"})
    except Exception as e:
        log.error("Direct export scrape failed: %s", traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@app.post("/export-dork/{fmt}")
async def export_dork_direct(fmt: str, req: DorkRequest):
    if fmt not in ("csv", "json", "excel"):
        raise HTTPException(status_code=400, detail=f"Invalid format '{fmt}'. Use csv, json, or excel.")
    try:
        result = await scrape_dork(
            query=req.query, search_url=req.search_url,
            page=1, results_per_page=req.results_per_page
        )
        records = result.get("results", [])
        if fmt == "csv":
            return Response(export_dork_csv(records), media_type="text/csv",
                            headers={"Content-Disposition": "attachment; filename=dork_results.csv"})
        elif fmt == "json":
            return Response(export_dork_json(records), media_type="application/json",
                            headers={"Content-Disposition": "attachment; filename=dork_results.json"})
        elif fmt == "excel":
            return Response(export_dork_excel(records),
                            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                            headers={"Content-Disposition": "attachment; filename=dork_results.xlsx"})
    except Exception as e:
        log.error("Direct export dork failed: %s", traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")
