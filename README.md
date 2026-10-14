# 🚀 ApexLead AI — Lead Intelligence Engine & Multi-Source Diaspora Discovery

ApexLead AI is an enterprise-grade, evidence-based lead intelligence and prospecting platform designed to discover, score, enrich, and manage High-Net-Worth (HNW) Overseas Pakistani investors for high-yield real estate acquisitions (such as prime CDA sectors, DHA, Bahria Town, and commercial parcels in Islamabad/Rawalpindi).

The platform pairs an authentic, multi-source diaspora discovery engine with a transparent scoring algorithm, OSINT contact enrichment, a full CRM pipeline, compliance/DNC suppression, an automated Google Maps business scraper, and an OSINT search dorking studio.

---

## 📑 Table of Contents

- [Core Capabilities](#-core-capabilities)
- [System Architecture](#-system-architecture)
- [Project Structure](#-project-structure)
- [Lead Scoring & Evidence Engine](#-lead-scoring--evidence-engine)
- [Data Sources & OSINT Enrichment](#-data-sources--osint-enrichment)
- [CRM Pipeline & Outreach](#-crm-pipeline--outreach)
- [Prerequisites](#-prerequisites)
- [Quick Start Guide](#-quick-start-guide)
  - [Method 1: Local Development (Recommended)](#method-1-local-development-recommended)
  - [Method 2: Docker Containers](#method-2-docker-containers)
- [REST API Reference](#-rest-api-reference)
- [Compliance & Ethical Guidelines](#-compliance--ethical-guidelines)
- [License](#-license)

---

## 🌟 Core Capabilities

### 1. 🌍 Overseas Pakistani Investor Discovery
- **Authentic Registry Discovery**: Discovers verified senior executives, founders, chairmen, and medical specialists across live official databases (UK Companies House, US Federal CMS NPPES Registry, APPNA Leadership Directories, and Gulf executive networks).
- **Zero Hallucination Guarantee**: Strict validation pipeline ensures zero mock data; every lead includes verified source citations and direct register URLs.
- **Geographic Filtering**: Target Tier 1 diaspora hubs (UK, UAE, US, Saudi Arabia) and Tier 2 regions (Canada, Australia, Qatar, Kuwait, Oman, Bahrain).
- **Wealth & Profession Segmentation**: Filter by wealth tier (*Ultra HNW $100M+*, *Very HNW $25M–$100M*, *HNW $5M–$25M*) and high-liquidity professions (Surgeons, Tech Founders, MDs/CEOs, Private Equity, Real Estate Developers).

### 2. 🧠 Transparent Multi-Dimensional Scoring (0–100)
- **Deterministic & Explainable**: Computes scores using verifiable public facts rather than guesswork. Never infers Pakistani heritage from a surname alone.
- **Audit-Ready Evidence Breakdown**: Provides an itemized "Why is this lead scored 87?" breakdown explaining individual point allocations and source evidence.
- **Qualification Buckets**: Categorizes prospects into **HOT (80–100)**, **HIGH POTENTIAL (65–79)**, **POTENTIAL (50–64)**, **LOW CONFIDENCE (30–49)**, and **REJECT (<30)**.

### 3. 🔍 OSINT Contact & People Search Enrichment
- **People Search Directory Signals**: Integrates directory dorking against indexed public records (FastPeopleSearch for US, 192.com for UK) without triggering Cloudflare blocks.
- **Deep Web Contact Crawling**: Asynchronously crawls corporate domains for `/contact`, `/about`, and `/team` pages to extract direct phone numbers and public emails.
- **One-Click Candidate Enrichment**: Discovers mobile numbers, WhatsApp readiness, public corporate emails, and LinkedIn profile URLs.

### 4. 💼 CRM Funnel & Sales Pipeline
- **Stage Progression**: Manage prospects across full sales lifecycle:  
  `New` ➔ `Reviewed` ➔ `Qualified` ➔ `Contacted` ➔ `Replied` ➔ `Interested` ➔ `Meeting` ➔ `Property Viewing` ➔ `Negotiation` ➔ `Converted` (or `Do Not Contact`).
- **Interactive Funnel Dashboard**: Real-time counts and metrics for pipeline health.
- **One-Click WhatsApp Pitching**: Auto-generates personalized, high-converting luxury acquisition pitches formatted for direct WhatsApp outreach.
- **Batch Export**: Export leads with complete scoring breakdowns and evidence trails to formatted **Excel (.xlsx)**, **CSV**, or **JSON**.
- **Prospect CSV Import**: Ingest existing lead spreadsheets with auto-scoring and duplicate deduplication.

### 5. 📍 Google Maps B2B Network Scraper
- Playwright-powered headless browser scraper for local business discovery across worldwide metros.
- Extracts business title, category, star rating, address, phone numbers, and website links with concurrent background email discovery.

### 6. ⚡ Compliant OSINT Dorking Studio
- Visual query builder for Google and Bing search operators.
- Preset templates for executive bios, conference attendee lists, and business associations.

### 7. 🛡️ Compliance, Suppression & Audit Trail
- **DNC List Enforcement**: Automatically blocks suppressed emails, phone numbers, and domains.
- **Deduplication Engine**: Matches candidates against existing records by email, phone, profile URL, and name+company.
- **Audit Trail**: Logs all search, export, enrichment, and pipeline updates.

---

## 🏗 System Architecture

```mermaid
flowchart TD
    subgraph Frontend ["Frontend (React 19 + Vite + CSS)"]
        UI_Home["Landing & Dashboard"]
        UI_Overseas["Overseas Leads Engine"]
        UI_CRM["Lead Database & Funnel"]
        UI_Maps["Google Maps Scraper"]
        UI_Dorking["OSINT Dorking Studio"]
        UI_Compliance["Compliance & DNC Center"]
    end

    subgraph Backend ["Backend (FastAPI + Python 3.12)"]
        API["FastAPI App (main.py)"]
        Scorer["Scoring Engine (scorer.py)"]
        Enricher["OSINT Enrichment (enrichment.py)"]
        Compliance["Compliance & DNC Guard (compliance.py)"]
        DB[(SQLite - leadgen.db)]
        Exporter["Exporter Engine (exporter.py)"]
        ScraperMaps["Playwright Scraper (scraper.py)"]
        ScraperDork["Dork Scraper (dorking.py)"]
    end

    subgraph Sources ["Discovery Sources & Public Registries"]
        UK_CH["UK Companies House (GOV.UK)"]
        US_NPI["US NPPES Physician Registry (CMS)"]
        APPNA["APPNA Leadership Directories"]
        SearchDir["FastPeopleSearch / 192.com (Dorked)"]
        Websites["Corporate Websites / Contact Pages"]
    end

    Frontend -->|HTTP / JSON (Port 5173 / 3005)| API
    API --> Scorer
    API --> Enricher
    API --> Compliance
    API --> DB
    API --> Exporter
    API --> ScraperMaps
    API --> ScraperDork

    Enricher --> SearchDir
    Enricher --> Websites
    API --> UK_CH
    API --> US_NPI
    API --> APPNA
```

---

## 📁 Project Structure

```
sajjad-leadgen/
├── backend/
│   ├── main.py                  # FastAPI REST endpoints & request dispatching
│   ├── models.py                # Pydantic models (Lead, ScoringBreakdown, EvidenceItem, etc.)
│   ├── database.py              # SQLite storage layer, CRM queries, and audit logging
│   ├── scorer.py                # Deterministic scoring algorithm & evidence generator
│   ├── enrichment.py            # Deep OSINT search, phone/email extraction & web crawling
│   ├── compliance.py            # DNC suppression, deduplication checks & domain throttling
│   ├── exporter.py              # Multi-format exports (Excel .xlsx, CSV, JSON)
│   ├── scraper.py               # Playwright headless browser for Google Maps scraping
│   ├── dorking.py               # Playwright headless browser for OSINT search queries
│   ├── seed_crm.py              # Database seeding script for live registry discovery
│   ├── requirements.txt         # Python runtime dependencies
│   ├── Dockerfile               # Backend container configuration with Playwright & Chromium
│   └── sources/
│       ├── base.py              # Abstract BaseLeadSource class
│       ├── search_source.py     # Multi-source concurrent discovery orchestrator
│       ├── uk_companies_source.py  # UK Companies House GOV.UK live registry
│       ├── us_npi_source.py     # US Federal CMS NPPES physician registry
│       ├── appna_source.py      # APPNA leadership directories
│       ├── people_search_source.py # FastPeopleSearch & 192.com directory enricher
│       ├── name_validator.py    # Name cleaning and diaspora surname validation
│       ├── import_source.py     # CSV lead file importer with column normalization
│       └── apollo_adapter.py    # Adapter for external prospect data
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Landing.jsx          # Welcome hub & feature navigation
│   │   │   ├── OverseasLeadsPage.jsx # Core Overseas Pakistani search & qualification
│   │   │   ├── LeadDatabasePage.jsx # Full CRM pipeline, lead drawer & exports
│   │   │   ├── MapsPage.jsx         # Google Maps local business scraper
│   │   │   ├── DorkingPage.jsx      # Google & Bing search operator studio
│   │   │   ├── CompliancePage.jsx   # DNC suppression list & audit trail
│   │   │   └── SettingsPage.jsx     # System configuration & preferences
│   │   ├── components/
│   │   │   ├── Navbar.jsx           # Global navigation header
│   │   │   ├── Icons.jsx            # Modern inline SVG icon library
│   │   │   ├── ExportButtons.jsx    # CSV / Excel / JSON trigger buttons
│   │   │   ├── SearchFilters.jsx    # Country & profession selector pills
│   │   │   ├── ResultsTable.jsx     # Tabular lead presentation component
│   │   │   ├── StatsCards.jsx       # Funnel & conversion metric widgets
│   │   │   └── Toast.jsx            # Notification toast alerts
│   │   ├── App.jsx                  # React Router 7 route definitions
│   │   ├── main.jsx                 # React root renderer
│   │   ├── api.js                   # API URL resolution (/api base path)
│   │   ├── index.css                # Global theme variables & typography
│   │   └── App.css                  # Modern glassmorphism UI styles
│   ├── package.json                 # React 19, Vite & dependencies
│   ├── vite.config.js               # Vite config with backend proxy on port 8005
│   ├── nginx.conf                   # Production Nginx reverse-proxy configuration
│   └── Dockerfile                   # Frontend multi-stage container build
│
├── docker-compose.yml           # Multi-container orchestration (backend + frontend)
├── run-local.bat                # One-click Windows local launcher (LAN / Mobile enabled)
├── start.bat / start.sh         # Docker startup scripts with pre-flight checks
├── stop.bat / stop.sh           # Container teardown scripts
└── README.md                    # Project documentation
```

---

## 🎯 Lead Scoring & Evidence Engine

The scoring engine (`backend/scorer.py`) applies a transparent, multi-dimensional rubric calculating a raw score out of 120, normalized to **0–100**:

$$\text{Normalized Score} = \min\left(100, \text{round}\left(\frac{\text{Raw Total}}{120} \times 100\right)\right)$$

### Point Breakdown

| Category | Max Pts | Verifiable Signals Evaluated |
|---|:---:|---|
| **Pakistan Connection** | **30** | Verified alumni of top Pakistani universities (LUMS, NUST, GIKI, IBA, AKU, FAST, KEMU, etc.) or leadership/membership in recognized diaspora business associations (OPEN, PBPC, APPNA, British Pakistani Foundation). |
| **Overseas Status** | **20** | Verified residency in **Tier 1** markets (UAE, Saudi Arabia, UK, USA) or **Tier 2** markets (Canada, Australia, Qatar, Kuwait, Oman, Bahrain). |
| **Financial Strength** | **20** | Corporate seniority: Founder, CEO, Managing Director, Practice Owner, Consultant Surgeon, Corporate VP/Partner, or large enterprise workforce scale. |
| **Pakistan Capital Deployment** | **15** | Documented participation in Pakistan investments, venture funds, repatriation, or commercial equity. |
| **Islamabad / Real Estate Intent** | **35** | Explicit documented interest, property holdings, or family links to Islamabad/Rawalpindi sectors (CDA Sectors F-6, F-7, E-7, Blue Area, DHA Islamabad, Bahria Town, Gulberg Greens, Eighteen Islamabad). |

### Score Classifications

| Score Range | Classification | Action Strategy |
|:---:|:---:|---|
| **80 – 100** | 🔥 **HOT** | Immediate personalized VIP outreach (WhatsApp acquisition brief). |
| **65 – 79** | 💎 **HIGH POTENTIAL** | High-priority outreach with tailored property brochures. |
| **50 – 64** | ⚡ **POTENTIAL** | Secondary nurture stream; monitor for additional contact signals. |
| **30 – 49** | ⚠️ **LOW CONFIDENCE** | Requires manual verification of Pakistan roots prior to outreach. |
| **0 – 29** | ❌ **REJECT** | Insufficient verifiable signals; automatically withheld from high-priority queues. |

---

## 🛡️ Absolute Free-Only Policy & Central Enforcement

ApexLead AI strictly adheres to an uncompromising **Free-Only Standard**:
1. **Central Enforcement (`FREE_ONLY_MODE=true`)**: The application blocks all billable requests, paid endpoints, trial signups requiring payment cards, and unauthorized providers.
2. **Cardless Free Allowances Only**: Commercial services are permitted **only** when they offer confirmed, cardless free monthly quotas (e.g., Hunter.io: 25 searches/mo; Tomba.io: 25 searches/mo). Once a provider's free monthly quota is exhausted, requests to that provider are automatically paused and flagged.
3. **Disabled By Default**: All commercial integrations (`ENABLE_HUNTER=false`, `ENABLE_TOMBA=false`, `ENABLE_APOLLO=false`, `ENABLE_PROXYCURL=false`, `ENABLE_PDL=false`, `ENABLE_CONTACTOUT=false`, `ENABLE_ROCKETREACH=false`) are disabled by default in `.env`.
4. **Zero Paid Fallback**: If a free endpoint returns no data, the system never falls back silently to a commercial or paid provider.
5. **No Hallucinations**: Missing contacts are honestly represented as `null` / `"Not found"`. The application never invents phone numbers, emails, or LinkedIn URLs.

---

## 📡 Verified Data Sources Matrix

| Source / Tool | Data Returned | Access Method | Pricing Status | Verified Quota | Usage Restrictions & Rules |
|---|---|---|---|---|---|
| **UK Companies House** (`uk_companies_source.py`) | Company officers, appointment counts, official nationality, corporate address | Public REST API (`api.company-information.service.gov.uk`) | **100% Free** | 600 req / 5 min (Official Gov API) | Identity discovery source only. Does NOT return personal mobile phones. Nationality filings provide authentic public proof of Pakistani origin. |
| **US NPPES / CMS Registry** (`us_npi_source.py`) | Licensed medical providers, specialty, practice location address, clinic telephone | Public REST API (`npiregistry.cms.hhs.gov/api`) | **100% Free** | No strict rate cap (Throttled at 0.5s/req) | Practice telephone is classified strictly as `professional_phone` (`phone_type: "clinic"`). Never mislabeled as personal mobile or messaged on WhatsApp. |
| **APPNA Leadership Directory** (`appna_source.py`) | State chapter presidents, executive committee officers, specialty, chapter city/state | Lawful public directory scraping via BeautifulSoup | **100% Free & Open-Source** | Throttled at 1.0s/req | Provides 100% verified Pakistani diaspora connection evidence (`source_type: "medical_association"`). Personal mobile phone set to `None` unless published. |
| **Genuine LinkedIn Finder** (`linkedin_finder.py`) | Genuine discovered profile URL (`linkedin.com/in/{slug}`), match confidence, citation source | Public search results (Bing / DuckDuckGo multi-engine) | **100% Free** | Throttled per domain | Profiles must match `/in/` format and name tokens. URLs are never guessed or constructed from names. Ambiguous matches tagged `needs_review`. |
| **Contact Validator** (`contact_validator.py`) | Email categorization (personal vs corporate role), phone categorization (mobile vs toll-free/landline) | Local regex & deterministic rules engine | **100% Free & Open-Source** | Unlimited | Blocks 50+ corporate role prefixes (`info@`, `sales@`, `contact@`, etc.). Distinguishes personal ESPs (Gmail/Yahoo) from company inboxes. |
| **Hunter.io** (`commercial_enricher.py`) | Professional domain email address | Official Hunter REST API (`api.hunter.io/v2`) | **Confirmed Free Tier** | **25 req / month** (Cardless free tier) | Optional adapter (`ENABLE_HUNTER=false` by default). Discovered emails stored in `professional_email`. Blocked once 25 monthly requests are reached. |
| **Tomba.io** (`commercial_enricher.py`) | Professional business email address | Official Tomba REST API (`api.tomba.io/v1`) | **Confirmed Free Tier** | **25 req / month** (Cardless free tier) | Optional adapter (`ENABLE_TOMBA=false` by default). Discovered emails stored in `professional_email`. Blocked once 25 monthly requests are reached. |
| **Apollo / PDL / Proxycurl** | Commercial databases | Disabled | **Paid / Trial with card** | **0 (Locked)** | Strictly disabled and blocked under `FREE_ONLY_MODE=true`. |

---

## 🚫 Requirements That Cannot Be Legally or Reliably Satisfied With Free Sources

1. **Bulk Personal Mobile Harvesting**:
   - Public statutory registers (UK Companies House, US Federal NPPES) publish corporate registered offices and medical clinic telephones, **not** private residential mobile phone numbers.
   - Bulk scraping residential cell phones from data brokers without subject consent violates GDPR, PECR, and CCPA regulations.
   - ApexLead AI strictly adheres to compliance: when an individual's personal mobile is not publicly published by them or their professional association, it is honestly represented as **"Not found"** rather than falsified.
2. **Guaranteed Private Personal Emails (Gmail/Yahoo) for Every Executive**:
   - Executives routinely publish professional institutional emails (e.g., NHS Trust or corporate corporate domain) rather than private personal Gmail accounts.
   - ApexLead AI places verified institutional emails in `professional_email` and rejects generic role accounts (`info@`, `sales@`, `support@`) from `personal_email`.

---

## 💼 CRM Pipeline & Outreach

The Lead Database (`frontend/src/pages/LeadDatabasePage.jsx`) provides an end-to-end sales workbench:

- **12 Pipeline Stages**: Track progress through qualified steps with full historical status tracking.
- **Detailed Lead Drawer**: View comprehensive profiles including job title, company size, wealth tier estimate, liquid investment capacity, and exact evidence points.
- **Personalized WhatsApp Briefs**: Generate instant acquisition briefs tailored to the lead's profile, e.g.:
  > *"Salam Dr. Tariq, reaching out from Islamabad regarding exclusive off-market luxury real estate and high-yield commercial parcels in CDA Sector F-6 / Blue Area tailored for senior executive leadership. Would you be open to a confidential acquisition brief?"*
- **Audit & History**: Track internal agent notes and compliance history per lead.

---

## 💻 Prerequisites

Ensure you have the following installed on your machine:

- **Python**: `3.10` or higher (Python `3.12` recommended)
- **Node.js**: `v18.0.0` or higher (v20+ recommended) with `npm`
- **Git**
- *(Optional)* **Docker Desktop**: If deploying via containerized environment

---

## 🚀 Quick Start Guide

### Method 1: Local Development (Recommended)

#### 1. Clone the repository
```bash
git clone https://github.com/sajjadalinaqvi/sajjad-leadgen.git
cd sajjad-leadgen
```

#### 2. Windows One-Click Launch
Double-click `run-local.bat` in the project root, or execute:
```cmd
run-local.bat
```
This script will:
- Start the Python FastAPI backend on `http://0.0.0.0:8005` in a dedicated terminal window.
- Install dependencies and start the Vite frontend server on `http://0.0.0.0:5173`.
- Allow access from both your desktop browser and your local network / mobile devices.

#### 3. Manual Launch (Step-by-Step)

**Terminal 1 — Backend:**
```bash
cd backend
python -m venv venv

# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
playwright install chromium

python -m uvicorn main:app --host 0.0.0.0 --port 8005 --reload
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

#### 4. Access the Application
- **Frontend Web UI**: [http://localhost:5173](http://localhost:5173)
- **Backend Swagger API Docs**: [http://localhost:8005/docs](http://localhost:8005/docs)
- **Backend Health Check**: [http://localhost:8005/health](http://localhost:8005/health)

---

### Method 2: Docker Containers

#### 1. Start with Docker Compose
```bash
docker compose up -d --build
```
Or on Windows run `start.bat`, and on Linux/macOS run `./start.sh`.

#### 2. Access Containerized Services
- **Frontend Web UI**: [http://localhost:3005](http://localhost:3005)
- **Backend API**: [http://localhost:8005](http://localhost:8005)

#### 3. Stop Containers
```bash
docker compose down
```
Or run `stop.bat` / `./stop.sh`.

---

## 🔌 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health status. |
| `POST` | `/overseas/search` | Search and score candidates across live registries. |
| `GET` | `/leads` | Query stored leads with filtering, search, and pagination. |
| `GET` | `/leads/{lead_id}` | Retrieve full profile with individual evidence items. |
| `POST` | `/leads` | Save or create a lead with auto-scoring and deduplication. |
| `PATCH` | `/leads/{lead_id}/status` | Update lead CRM pipeline stage and internal notes. |
| `DELETE` | `/leads/{lead_id}` | Permanently delete a lead record. |
| `POST` | `/leads/enrich-candidate` | Run deep OSINT search dorks for phones, emails, and WhatsApp. |
| `POST` | `/leads/{lead_id}/enrich` | Enrich an existing stored lead in the database. |
| `GET` | `/crm/funnel` | Retrieve real-time CRM stage counts and qualification metrics. |
| `GET` | `/compliance/suppression` | List all Do Not Contact (DNC) suppression records. |
| `POST` | `/compliance/suppress` | Add an email, phone, or domain to the DNC registry. |
| `DELETE` | `/compliance/suppression/{id}` | Remove an entry from the suppression registry. |
| `GET` | `/compliance/audit-logs` | Retrieve chronological system audit logs. |
| `POST` | `/export/overseas/{fmt}` | Export scored leads in `csv`, `excel`, or `json` format. |
| `POST` | `/import/leads/csv` | Upload a CSV file for deduplication and auto-scoring. |
| `POST` | `/scrape` | Scrape business contacts from Google Maps via Playwright. |
| `POST` | `/dork` | Execute OSINT search dorks via headless browser. |
| `POST` | `/export-scrape/{fmt}` | Direct export of Google Maps results (`csv`, `excel`, `json`). |
| `POST` | `/export-dork/{fmt}` | Direct export of Google Dorking results (`csv`, `excel`, `json`). |

---

## 🛡️ Compliance & Ethical Guidelines

ApexLead AI is engineered for compliant B2B intelligence gathering:
- **Public & Official Registries**: Gathers publicly accessible data from statutory registers (UK Companies House, US NPPES) and public association listings.
- **Suppression (DNC) List Support**: Contact lists respect user opt-outs and regulatory suppression requests.
- **Anti-Scraping Etiquette**: Requests are throttled with randomized delays to respect origin server limits and rate guidelines.
- **Human-in-the-Loop Qualification**: Outbound contact requires agent review of evidence scores before outreach initiation.

---

## 📄 Manifest of Changed & Added Files
The overseas lead discovery and enrichment pipeline was improved strictly adhering to the Free-Only Policy and Section 9 schema across the following files:

- `backend/config.py`: Central `FREE_ONLY_MODE=true` enforcement, `QuotaManager` for monthly 25-request tracking (Hunter/Tomba), SSRF URL validator, and explicit provider activation flags.
- `backend/models.py`: Section 9 lead schema (`pakistan_connection_evidence`, `PhoneType`, `ReviewStatus`, `personal_phone`, `professional_phone`, `personal_email`, `professional_email`, `linkedin_url`, `linkedin_identity_match`, `linkedin_match_confidence`, `evidence_urls`, `opt_out`, etc.).
- `backend/database.py`: Safe SQLite migrations for Section 9 columns, `insert_lead_dict`, `row_to_lead_dict`, and `set_lead_opt_out` with DNC suppression list registration.
- `backend/contact_validator.py`: Double-check engine blocking 50+ corporate role prefixes (`info@`, `sales@`, `support@`), toll-free/landline phone classification, and genuine LinkedIn `/in/` profile validation.
- `backend/sources/linkedin_finder.py`: Multi-engine public search profile discovery (`GenuineLinkedInFinder`) matching candidate name tokens, employer, and location without guesswork.
- `backend/sources/commercial_enricher.py`: Cardless free-tier adapter for Hunter and Tomba respecting 25 monthly requests, assigning found emails to `professional_email`.
- `backend/sources/appna_source.py`: Section 9 schema sync, providing authentic `medical_association` Pakistan connection evidence and honest null personal contact representations.
- `backend/sources/us_npi_source.py`: Federal CMS provider adapter mapping clinic practice phones strictly to `professional_phone` (`clinic`) and recording healthcare license evidence.
- `backend/sources/uk_companies_source.py`: GOV.UK appointment adapter verifying official nationality (`Pakistani`) and filing citations, flagging ambiguous records as `needs_review`.
- `backend/sources/search_source.py`: Wired with `GenuineLinkedInFinder` and `CommercialEnricher` with full Section 9 schema synchronization.
- `backend/exporter.py`: Export engine updated to serialize Section 9 attributes, Pakistan evidence items, and public citations to CSV, Excel, and JSON.
- `backend/main.py`: New endpoints `GET /system/config`, `POST /leads/{id}/opt-out`, and enhanced `POST /overseas/search` with contact and evidence filtering.
- `backend/test_free_leadgen_pipeline.py`: Comprehensive test suite verifying all 10 Section 12 criteria.
- `frontend/src/pages/OverseasLeadsPage.jsx`: Top Free-Only status banner with live quota tracking, filters for discovered contacts and Pakistan evidence, card rendering showcasing the 3 priority fields with "Not found" badges, separate institutional contact strip, and honest outreach actions.
- `.env.example` & `backend/.env.example`: Central environment configuration with `FREE_ONLY_MODE=true` and explicit commercial provider flags.

---

## 📄 License

This software is licensed under the proprietary development terms of its author. Unauthorized distribution or reverse engineering is prohibited.

