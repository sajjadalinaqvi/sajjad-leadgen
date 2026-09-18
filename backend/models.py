from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


class LeadStatus(str, Enum):
    NEW = "New"
    REVIEWED = "Reviewed"
    QUALIFIED = "Qualified"
    CONTACTED = "Contacted"
    REPLIED = "Replied"
    INTERESTED = "Interested"
    MEETING = "Meeting"
    PROPERTY_VIEWING = "Property Viewing"
    NEGOTIATION = "Negotiation"
    CONVERTED = "Converted"
    NOT_INTERESTED = "Not Interested"
    DO_NOT_CONTACT = "Do Not Contact"


class ScoreCategory(str, Enum):
    HOT = "HOT"                     # 80-100
    HIGH_POTENTIAL = "HIGH POTENTIAL" # 65-79
    POTENTIAL = "POTENTIAL"         # 50-64
    LOW_CONFIDENCE = "LOW CONFIDENCE" # 30-49
    REJECT = "REJECT / INSUFFICIENT DATA" # 0-29


class ConfidenceLevel(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    UNKNOWN = "UNKNOWN"


class EmailVerificationStatus(str, Enum):
    PUBLIC = "Public"
    UNVERIFIED = "Unverified"
    VERIFIED = "Verified"
    INVALID = "Invalid"
    UNKNOWN = "Unknown"


class EvidenceItem(BaseModel):
    category: str = Field(..., description="Category: pakistan_connection, financial_strength, pakistan_investment, islamabad_intent")
    points: int = Field(default=0, description="Points awarded for this evidence")
    description: str = Field(..., description="Human-readable fact/evidence explanation")
    source_url: Optional[str] = Field(default="", description="Legitimate public source URL")
    source_type: Optional[str] = Field(default="Public Web", description="Type of source: Biography, Education, Organization, Registry, Directory")
    evidence_date: Optional[str] = Field(default="", description="Date of evidence observation")


class ScoringBreakdown(BaseModel):
    pakistan_connection_score: int = 0
    overseas_status_score: int = 0
    financial_strength_score: int = 0
    pakistan_investment_score: int = 0
    islamabad_connection_score: int = 0
    real_estate_intent_score: int = 0
    raw_total_score: int = 0
    normalized_score: int = 0
    score_category: ScoreCategory = ScoreCategory.REJECT
    confidence: ConfidenceLevel = ConfidenceLevel.LOW
    evidence_list: List[EvidenceItem] = []
    evidence_summary: str = ""


class Lead(BaseModel):
    id: Optional[str] = None
    full_name: str
    first_name: Optional[str] = ""
    last_name: Optional[str] = ""
    current_country: str = ""
    current_city: Optional[str] = ""
    current_region: Optional[str] = ""
    profession: Optional[str] = ""
    job_title: Optional[str] = ""
    seniority: Optional[str] = ""
    company: Optional[str] = ""
    company_website: Optional[str] = ""
    company_size: Optional[str] = ""
    company_revenue_estimate: Optional[str] = ""
    professional_profile_url: Optional[str] = ""
    public_email: Optional[str] = ""
    public_phone: Optional[str] = ""
    phone_source_url: Optional[str] = ""
    email_source_url: Optional[str] = ""
    company_source_url: Optional[str] = ""
    has_whatsapp: bool = True
    whatsapp_number: Optional[str] = ""
    wealth_tier: Optional[str] = "High Net Worth ($5M - $25M)"
    estimated_net_worth: Optional[str] = "$10M+"
    investment_capacity: Optional[str] = "$1M - $5M Liquid"
    email_verification_status: EmailVerificationStatus = EmailVerificationStatus.UNKNOWN
    
    # Intelligence & Scoring
    pakistan_connection_status: str = "High" # High, Medium, Low, Unknown
    pakistan_connection_score: int = 0
    overseas_status: str = "Outside Pakistan"
    overseas_status_score: int = 0
    financial_strength_score: int = 0
    pakistan_investment_score: int = 0
    islamabad_connection_score: int = 0
    real_estate_intent_score: int = 0
    total_lead_score: int = 0
    score_category: ScoreCategory = ScoreCategory.REJECT
    confidence: ConfidenceLevel = ConfidenceLevel.LOW
    
    evidence_summary: Optional[str] = ""
    evidence_list: List[EvidenceItem] = []
    source_urls: List[str] = []
    source_types: List[str] = []
    collection_date: Optional[str] = None
    last_verified: Optional[str] = None
    
    # CRM & Compliance
    contact_permission_status: str = "Public Source / Review Recommended"
    do_not_contact: bool = False
    dnc_reason: Optional[str] = ""
    lead_status: LeadStatus = LeadStatus.NEW
    rejection_reason: Optional[str] = ""
    notes: Optional[str] = ""


class CandidateSearchRequest(BaseModel):
    countries: List[str] = ["UAE", "Saudi Arabia", "United Kingdom", "United States"]
    professions: List[str] = []
    keywords: Optional[str] = ""
    min_score: int = 30
    whatsapp_only: bool = False
    wealth_tier: Optional[str] = "All"
    confidence: Optional[str] = "All"
    pakistan_connection_filter: Optional[str] = "All"
    islamabad_intent_filter: Optional[str] = "All"
    limit: int = 25


class LeadFilterRequest(BaseModel):
    country: Optional[str] = "All"
    profession: Optional[str] = "All"
    lead_status: Optional[str] = "All"
    score_category: Optional[str] = "All"
    min_score: int = 0
    search_query: Optional[str] = ""
    include_dnc: bool = False
    page: int = 1
    page_size: int = 25


class LeadStatusUpdateRequest(BaseModel):
    lead_status: LeadStatus
    notes: Optional[str] = None
    rejection_reason: Optional[str] = None


class SuppressionCreateRequest(BaseModel):
    type: str = Field(..., description="email, phone, domain, or name_location")
    value: str
    reason: Optional[str] = "User requested exclusion / DNC"


class AuditLogEntry(BaseModel):
    id: Optional[int] = None
    lead_id: Optional[str] = None
    action: str
    details: Dict[str, Any] = {}
    timestamp: Optional[str] = None
