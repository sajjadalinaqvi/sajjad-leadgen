import io
import json
import logging
import pandas as pd
import re
from typing import List, Dict, Any

log = logging.getLogger(__name__)

FIELDS = ["name", "category", "address", "city", "country", "phone", "website", "email", "rating", "reviews"]
DORK_FIELDS = ["title", "url", "email", "phone", "address", "city", "country", "description"]

OVERSEAS_LEAD_FIELDS = [
    # ── Section 9 Priority & Identity Fields ──
    "full_name",
    "occupation",
    "employer",
    "country",
    "city",
    "personal_phone",
    "phone_type",
    "phone_match_confidence",
    "phone_source_url",
    "professional_phone",
    "personal_email",
    "professional_email",
    "email_verified",
    "email_match_confidence",
    "email_source_url",
    "linkedin_url",
    "linkedin_identity_match",
    "linkedin_match_confidence",
    "linkedin_source_url",
    "review_status",
    "opt_out",
    "last_verified",
    "pakistan_connection_evidence",
    "evidence_urls",
    "source_names",
    # ── Intelligence & CRM Scoring ──
    "total_lead_score",
    "score_category",
    "confidence",
    "pakistan_connection_score",
    "overseas_status_score",
    "financial_strength_score",
    "pakistan_investment_score",
    "islamabad_connection_score",
    "real_estate_intent_score",
    "wealth_tier",
    "estimated_net_worth",
    "evidence_summary",
    "lead_status",
    "notes"
]


def clean_phone(phone: str) -> str:
    """Remove special characters from phone number, keep only digits, spaces, and +"""
    if not phone:
        return ""
    return re.sub(r'[^\d\s+]', '', str(phone)).strip()


def clean_address(address: str) -> str:
    """Remove weird characters from address"""
    if not address:
        return ""
    cleaned = re.sub(r'[^\x00-\x7F]+', '', str(address))
    cleaned = cleaned.replace('"', '').strip()
    return cleaned


def extract_city_country(address: str) -> tuple[str, str]:
    """Extract city and country from address"""
    if not address:
        return "", ""
    address = clean_address(address)
    countries = ['USA', 'United States', 'Canada', 'UK', 'United Kingdom', 'Australia', 
                'Pakistan', 'India', 'Germany', 'France', 'Italy', 'Spain', 'Japan', 'UAE', 'Saudi Arabia']
    parts = [p.strip() for p in address.split(',')]
    country = ""
    city = ""
    for part in reversed(parts):
        for c in countries:
            if c.lower() in part.lower():
                country = c
                break
        if country:
            break
    if len(parts) >= 2:
        for i in range(1, min(3, len(parts))):
            part = parts[i].strip()
            if re.match(r'^[A-Z]{2}$', part) or re.match(r'^[A-Z]{2}\s+\d', part):
                continue
            if re.match(r'^\d{5}(-\d{4})?$', part) or re.match(r'^[A-Z]\d[A-Z]\s?\d[A-Z]\d$', part):
                continue
            if re.search(r'\d', part):
                continue
            city = part.title()
            city = re.sub(r',\s*[A-Z]{2}$', '', city)
            break
    return city, country


def to_dataframe(data: list[dict]) -> pd.DataFrame:
    if not data:
        return pd.DataFrame(columns=FIELDS)
    processed_data = []
    for record in data:
        new_record = record.copy()
        new_record["phone"] = clean_phone(record.get("phone", ""))
        new_record["address"] = clean_address(record.get("address", ""))
        city, country = extract_city_country(record.get("address", ""))
        new_record["city"] = city
        new_record["country"] = country
        processed_data.append(new_record)
    df = pd.DataFrame(processed_data)
    for col in FIELDS:
        if col not in df.columns:
            df[col] = ""
    df = df[FIELDS]
    df["email"] = df.apply(
        lambda r: r["email"] if r["email"] else
        f"https://www.google.com/search?q={str(r['name']).replace(' ', '+')}+official+email+contact",
        axis=1,
    )
    return df


def to_dork_dataframe(data: list[dict]) -> pd.DataFrame:
    if not data:
        return pd.DataFrame(columns=DORK_FIELDS)
    processed_data = []
    for record in data:
        new_record = record.copy()
        new_record["phone"] = clean_phone(record.get("phone", ""))
        new_record["address"] = clean_address(record.get("address", ""))
        city, country = extract_city_country(record.get("address", ""))
        new_record["city"] = city
        new_record["country"] = country
        processed_data.append(new_record)
    df = pd.DataFrame(processed_data)
    for col in DORK_FIELDS:
        if col not in df.columns:
            df[col] = ""
    return df[DORK_FIELDS]


def to_overseas_dataframe(data: list[dict]) -> pd.DataFrame:
    if not data:
        return pd.DataFrame(columns=OVERSEAS_LEAD_FIELDS)
    
    processed = []
    for r in data:
        item = r.copy()
        item["personal_phone"] = clean_phone(r.get("personal_phone", "") or "")
        item["professional_phone"] = clean_phone(r.get("professional_phone", "") or "")
        
        # Format Pakistan connection evidence into readable summary
        ev_items = r.get("pakistan_connection_evidence", [])
        if isinstance(ev_items, list):
            item["pakistan_connection_evidence"] = " | ".join(
                [f"[{e.get('evidence_type', 'evidence')}] {e.get('description', '')} (conf: {e.get('confidence', 0)}%)" for e in ev_items if isinstance(e, dict)]
            )
        
        # Flatten URLs and sources
        ev_urls = r.get("evidence_urls", []) or r.get("source_urls", [])
        if isinstance(ev_urls, list):
            item["evidence_urls"] = ", ".join(ev_urls)
            
        src_names = r.get("source_names", []) or r.get("source_types", [])
        if isinstance(src_names, list):
            item["source_names"] = ", ".join(src_names)

        # Fallbacks for missing Section 9 values
        if not item.get("country") and item.get("current_country"):
            item["country"] = item["current_country"]
        if not item.get("city") and item.get("current_city"):
            item["city"] = item["current_city"]
        if not item.get("employer") and item.get("company"):
            item["employer"] = item["company"]
        if not item.get("occupation") and item.get("job_title"):
            item["occupation"] = item["job_title"]
        if not item.get("linkedin_url") and "linkedin.com/in/" in (item.get("professional_profile_url") or ""):
            item["linkedin_url"] = item["professional_profile_url"]
            
        processed.append(item)
    
    df = pd.DataFrame(processed)
    for col in OVERSEAS_LEAD_FIELDS:
        if col not in df.columns:
            df[col] = ""
    return df[OVERSEAS_LEAD_FIELDS]


# ── Overseas Leads Exporters ──────────────────────────────────────────────────

def export_overseas_csv(data: list[dict]) -> bytes:
    return to_overseas_dataframe(data).to_csv(index=False).encode("utf-8")


def export_overseas_json(data: list[dict]) -> bytes:
    return json.dumps(data, indent=2).encode("utf-8")


def export_overseas_excel(data: list[dict]) -> bytes:
    from openpyxl.styles import Font, Alignment, PatternFill
    from openpyxl.utils.dataframe import dataframe_to_rows
    from openpyxl import Workbook
    
    df = to_overseas_dataframe(data)
    wb = Workbook()
    ws = wb.active
    ws.title = "Overseas Investor Leads"
    
    for r in dataframe_to_rows(df, index=False, header=True):
        ws.append(r)
    
    # Modern Indigo/Navy header styling
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    header_alignment = Alignment(horizontal="left", vertical="center")
    
    for cell in ws[1]:
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_alignment
    
    for column in ws.columns:
        max_length = 0
        column_letter = column[0].column_letter
        for cell in column:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        adjusted_width = min(max(max_length + 3, 12), 45)
        ws.column_dimensions[column_letter].width = adjusted_width
    
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# ── Legacy Exporters (Preserved) ──────────────────────────────────────────────

def export_csv(data: list[dict]) -> bytes:
    return to_dataframe(data).to_csv(index=False).encode()


def export_json(data: list[dict]) -> bytes:
    return json.dumps(data, indent=2).encode()


def export_excel(data: list[dict]) -> bytes:
    from openpyxl.styles import Font, Alignment, PatternFill
    from openpyxl.utils.dataframe import dataframe_to_rows
    from openpyxl import Workbook
    
    df = to_dataframe(data)
    wb = Workbook()
    ws = wb.active
    ws.title = "Business Data"
    
    for r in dataframe_to_rows(df, index=False, header=True):
        ws.append(r)
    
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
    header_alignment = Alignment(horizontal="center", vertical="center")
    
    for cell in ws[1]:
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_alignment
    
    for column in ws.columns:
        max_length = 0
        column_letter = column[0].column_letter
        for cell in column:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        adjusted_width = min(max_length + 2, 50)
        ws.column_dimensions[column_letter].width = adjusted_width
    
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def export_dork_csv(data: list[dict]) -> bytes:
    return to_dork_dataframe(data).to_csv(index=False).encode()


def export_dork_json(data: list[dict]) -> bytes:
    return json.dumps(data, indent=2).encode()


def export_dork_excel(data: list[dict]) -> bytes:
    from openpyxl.styles import Font, Alignment, PatternFill
    from openpyxl.utils.dataframe import dataframe_to_rows
    from openpyxl import Workbook
    
    df = to_dork_dataframe(data)
    wb = Workbook()
    ws = wb.active
    ws.title = "Dork Results"
    
    for r in dataframe_to_rows(df, index=False, header=True):
        ws.append(r)
    
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
    header_alignment = Alignment(horizontal="center", vertical="center")
    
    for cell in ws[1]:
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_alignment
    
    for column in ws.columns:
        max_length = 0
        column_letter = column[0].column_letter
        for cell in column:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        adjusted_width = min(max_length + 2, 50)
        ws.column_dimensions[column_letter].width = adjusted_width
    
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
