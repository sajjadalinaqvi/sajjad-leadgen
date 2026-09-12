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
    "full_name",
    "current_country",
    "current_city",
    "profession",
    "job_title",
    "seniority",
    "company",
    "company_website",
    "company_size",
    "public_email",
    "public_phone",
    "email_verification_status",
    "total_lead_score",
    "score_category",
    "confidence",
    "pakistan_connection_score",
    "overseas_status_score",
    "financial_strength_score",
    "pakistan_investment_score",
    "islamabad_connection_score",
    "real_estate_intent_score",
    "evidence_summary",
    "professional_profile_url",
    "source_urls",
    "lead_status",
    "do_not_contact",
    "collection_date",
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
        item["public_phone"] = clean_phone(r.get("public_phone", ""))
        # Flatten source URLs list if needed
        sources = r.get("source_urls", [])
        if isinstance(sources, list):
            item["source_urls"] = ", ".join(sources)
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
