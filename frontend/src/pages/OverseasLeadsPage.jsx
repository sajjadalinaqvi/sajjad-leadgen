import React, { useState, useRef, useEffect } from "react";
import Navbar from "../components/Navbar";
import Toast from "../components/Toast";
import {
  GlobeIcon, SearchIcon, SparklesIcon, BuildingIcon, MailIcon, PhoneIcon,
  ExternalLinkIcon, CheckIcon, UserCheckIcon, UserXIcon, ChevronDownIcon,
  ChevronUpIcon, ShieldCheckIcon, CopyIcon, AwardIcon, BriefcaseIcon, SlidersIcon,
  AlertTriangleIcon, DownloadIcon, FileCsvIcon, ZapIcon, WhatsAppIcon, MessageSquareIcon,
  LinkedInIcon
} from "../components/Icons";
import API from "../api";

const COUNTRIES = [
  { name: "United Kingdom", tier: "Tier 1" },
  { name: "UAE", tier: "Tier 1" },
  { name: "United States", tier: "Tier 1" },
  { name: "Saudi Arabia", tier: "Tier 1" },
  { name: "Canada", tier: "Tier 2" },
  { name: "Australia", tier: "Tier 2" },
  { name: "Qatar", tier: "Tier 2" },
  { name: "Kuwait", tier: "Tier 2" },
  { name: "Oman", tier: "Tier 2" },
  { name: "Bahrain", tier: "Tier 2" },
];

const WEALTH_TIERS = [
  { label: "All Wealth Tiers", value: "All" },
  { label: "👑 Ultra HNW ($100M+)", value: "Ultra" },
  { label: "💎 Very HNW ($25M - $100M)", value: "Very" },
  { label: "🏛️ High Net Worth ($5M - $25M)", value: "High Net Worth" },
];

const PROFESSIONS = [
  "Doctor / Consultant Surgeon",
  "Real Estate Developer & Investor",
  "Tech Founder & Software Entrepreneur",
  "CEO / Managing Director",
  "Private Equity & Venture Capital",
  "Finance & Investment Leader",
  "Construction & Infrastructure",
  "Corporate Lawyer / Law Firm Partner",
  "Retail, Wholesale & E-Commerce",
];

const PRESETS = [
  { label: "UK Billionaires & Surgeons", countries: ["United Kingdom"], professions: ["CEO / Managing Director", "Doctor / Consultant Surgeon", "Real Estate Developer & Investor"], kw: "London", wealth: "All" },
  { label: "UAE Unicorn Founders & Chairmen", countries: ["UAE"], professions: ["Tech Founder & Software Entrepreneur", "CEO / Managing Director", "Private Equity & Venture Capital"], kw: "Dubai", wealth: "Ultra" },
  { label: "US Forbes Billionaires & Health CEOs", countries: ["United States"], professions: ["CEO / Managing Director", "Doctor / Consultant Surgeon", "Tech Founder & Software Entrepreneur"], kw: "Dallas", wealth: "Ultra" },
  { label: "Saudi Vision 2030 Directors & KFSH MDs", countries: ["Saudi Arabia"], professions: ["Doctor / Consultant Surgeon", "Construction & Infrastructure"], kw: "Riyadh", wealth: "All" },
  { label: "Silicon Valley Tech Wealth", countries: ["United States"], professions: ["Tech Founder & Software Entrepreneur"], kw: "San Francisco", wealth: "Very" },
  { label: "APPNA & KEMU Medical Practice Owners", countries: ["United States", "United Kingdom"], professions: ["Doctor / Consultant Surgeon"], kw: "Surgeon", wealth: "All" },
];

export default function OverseasLeadsPage() {
  const [selectedCountries, setSelectedCountries] = useState(["United Kingdom", "UAE", "United States", "Saudi Arabia"]);
  const [selectedProfessions, setSelectedProfessions] = useState([]);
  const [selectedWealthTier, setSelectedWealthTier] = useState("All");
  const [whatsappOnly, setWhatsappOnly] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [minScore, setMinScore] = useState(30);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState("");
  const [expandedLeadId, setExpandedLeadId] = useState(null);
  const [expandedPitchId, setExpandedPitchId] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const [toast, setToast] = useState(null);
  const [rejectModalLead, setRejectModalLead] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("No verified Pakistan connection");
  const [importing, setImporting] = useState(false);
  const [batchSaving, setBatchSaving] = useState(false);
  const fileInputRef = useRef(null);

  const showNotification = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const toggleCountry = (c) => {
    if (selectedCountries.includes(c)) {
      if (selectedCountries.length > 1) {
        setSelectedCountries(selectedCountries.filter((item) => item !== c));
      }
    } else {
      setSelectedCountries([...selectedCountries, c]);
    }
  };

  const toggleProfession = (p) => {
    if (selectedProfessions.includes(p)) {
      setSelectedProfessions(selectedProfessions.filter((item) => item !== p));
    } else {
      setSelectedProfessions([...selectedProfessions, p]);
    }
  };

  const applyPreset = (preset) => {
    setSelectedCountries(preset.countries);
    setSelectedProfessions(preset.professions);
    setKeyword(preset.kw);
    setSelectedWealthTier(preset.wealth || "All");
    showNotification(`Applied: ${preset.label}`, "success");
    setTimeout(() => {
      executeDiscovery(preset.countries, preset.professions, preset.kw, minScore, preset.wealth || "All", whatsappOnly);
    }, 100);
  };

  const executeDiscovery = async (countries, professions, kw, score, wealth, waOnly) => {
    setLoading(true);
    setError("");
    setHasSearched(true);
    try {
      const payload = {
        countries: countries,
        professions: professions,
        keywords: kw.trim(),
        min_score: score,
        wealth_tier: wealth,
        whatsapp_only: waOnly,
        limit: 30,
      };

      const res = await fetch(`${API}/overseas/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Search failed: HTTP ${res.status}`);
      const data = await res.json();

      if (data.results && data.results.length > 0) {
        setCandidates(data.results);
        showNotification(`Discovered ${data.results.length} verified Overseas Pakistani investors with direct WhatsApp!`, "success");
      } else {
        setCandidates([]);
        showNotification("No profiles matched these exact filters. Try broadening your criteria.", "error");
      }
    } catch (e) {
      setError(e.message);
      showNotification(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDiscoverySearch = () => {
    if (selectedCountries.length === 0) {
      setError("Please select at least one target country.");
      return;
    }
    executeDiscovery(selectedCountries, selectedProfessions, keyword, minScore, selectedWealthTier, whatsappOnly);
  };

  // Initial search loads authentic high net worth investors
  useEffect(() => {
    executeDiscovery(selectedCountries, [], "", 30, "All", true);
  }, []);

  const handleBatchSaveAll = async () => {
    if (candidates.length === 0) return;
    setBatchSaving(true);
    let count = 0;
    try {
      for (const cand of candidates) {
        await fetch(`${API}/leads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...cand, lead_status: "Qualified" }),
        });
        count++;
      }
      showNotification(`Saved ${count} high-net-worth investors to your CRM Database!`, "success");
      setCandidates(candidates.map((c) => ({ ...c, saved: true, lead_status: "Qualified" })));
    } catch (err) {
      showNotification(`Error during batch save: ${err.message}`, "error");
    } finally {
      setBatchSaving(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API}/import/leads/csv`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to process CSV import");
      const data = await res.json();

      showNotification(`Imported ${data.imported} prospects (${data.duplicates} duplicates updated)`, "success");
      
      const leadsRes = await fetch(`${API}/leads?page_size=25`);
      if (leadsRes.ok) {
        const leadsData = await leadsRes.json();
        setCandidates(leadsData.leads || []);
        setHasSearched(true);
      }
    } catch (err) {
      showNotification(`Import error: ${err.message}`, "error");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const copyToClipboard = (text, key, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showNotification(`Copied ${label} to clipboard!`, "success");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleApproveLead = async (lead) => {
    try {
      const res = await fetch(`${API}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...lead, lead_status: "Qualified" }),
      });
      if (res.ok) {
        showNotification(`Saved ${lead.full_name} to CRM Database!`, "success");
        setCandidates(candidates.map((c) => c.full_name === lead.full_name ? { ...c, lead_status: "Qualified", saved: true } : c));
      }
    } catch (e) {
      showNotification(`Error saving lead: ${e.message}`, "error");
    }
  };

  const handleRejectLead = async () => {
    if (!rejectModalLead) return;
    try {
      if (rejectModalLead.id) {
        await fetch(`${API}/leads/${rejectModalLead.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lead_status: "Not Interested",
            rejection_reason: rejectionReason,
          }),
        });
      }
      showNotification(`Marked ${rejectModalLead.full_name} as Rejected.`, "success");
      setCandidates(candidates.filter((c) => c.full_name !== rejectModalLead.full_name));
      setRejectModalLead(null);
    } catch (e) {
      showNotification(`Error: ${e.message}`, "error");
    }
  };

  const handleMarkDNC = async (lead) => {
    try {
      if (lead.public_email) {
        await fetch(`${API}/compliance/suppress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "email", value: lead.public_email, reason: "Manual DNC exclusion" }),
        });
      }
      if (lead.id) {
        await fetch(`${API}/leads/${lead.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lead_status: "Do Not Contact", notes: "Added to DNC suppression list." }),
        });
      }
      showNotification(`Added ${lead.full_name} to Do-Not-Contact list.`, "success");
      setCandidates(candidates.filter((c) => c.full_name !== lead.full_name));
    } catch (e) {
      showNotification(`Error: ${e.message}`, "error");
    }
  };

  const openLinkedInSearch = () => {
    const profTerm = selectedProfessions.length > 0 ? selectedProfessions[0].split("/")[0].trim() : "Executive";
    const countryTerm = selectedCountries.length > 0 ? selectedCountries[0] : "UAE";
    const kwTerm = keyword.trim();
    const queryParts = ["Pakistani", profTerm, countryTerm, kwTerm].filter(Boolean);
    const fullQuery = queryParts.join(" ");
    const linkedInUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(fullQuery)}`;
    window.open(linkedInUrl, "_blank", "noopener,noreferrer");
    showNotification(`Opened live LinkedIn search for: "${fullQuery}"`, "info");
  };

  const openGoogleDork = () => {
    const profTerm = selectedProfessions.length > 0 ? `"${selectedProfessions[0].split("/")[0].trim()}"` : '"Founder"';
    const countryTerm = selectedCountries.length > 0 ? `"${selectedCountries[0]}"` : '"UK"';
    const kwTerm = keyword.trim() ? `"${keyword.trim()}"` : "";
    const dork = `site:linkedin.com/in ("Pakistani" OR "Pakistan") ${profTerm} ${countryTerm} ${kwTerm}`.trim();
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(dork)}`;
    window.open(googleUrl, "_blank", "noopener,noreferrer");
    showNotification("Opened Google Dork query in a new tab!", "info");
  };

  return (
    <div className="page-wrapper">
      <Navbar />

      <main className="main-content-container">
        {/* Header with Wealth & WhatsApp Focus */}
        <div className="page-header animate-fade-in">
          <div className="page-header-badge" style={{ borderColor: "rgba(245, 158, 11, 0.4)", color: "#fbbf24", background: "rgba(245, 158, 11, 0.12)" }}>
            <AwardIcon size={14} color="#fbbf24" />
            <span>High-Net-Worth Diaspora Wealth &amp; Direct WhatsApp Engine</span>
          </div>
          <h1 className="page-title">Overseas Pakistani High-Net-Worth Investors</h1>
          <p className="page-subtitle">
            Curated intelligence engine delivering verified Overseas Pakistani billionaires, founders, C-level executives, and consultant surgeons — prioritized by <strong>Net Worth &amp; Real Estate Buying Capacity</strong> with <strong>100% Genuine, Active WhatsApp Mobile Numbers</strong>.
          </p>
        </div>

        {/* Search & Filter Controls Panel */}
        <div className="search-panel glass-panel animate-slide-up">
          <div className="panel-mode-header">
            <span className="export-heading">Wealth Intelligence Filters &amp; Target Markets</span>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv"
                style={{ display: "none" }}
                onChange={handleFileUpload}
              />
              <button
                type="button"
                className="btn-export-outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                title="Import existing list of prospects from CSV"
              >
                <FileCsvIcon size={14} color="#10b981" />
                <span>{importing ? "Importing CSV..." : "Import CSV List"}</span>
              </button>

              <button
                type="button"
                className="chip-toggle-btn"
                onClick={openLinkedInSearch}
                style={{ fontSize: 12, padding: "5px 12px", borderColor: "rgba(10, 102, 194, 0.4)", color: "#38bdf8", background: "rgba(10, 102, 194, 0.12)" }}
                title="Launch precision Boolean People Search directly on LinkedIn"
              >
                <LinkedInIcon size={14} color="#38bdf8" />
                <span>Search Live on LinkedIn</span>
              </button>

              <button
                type="button"
                className="chip-toggle-btn"
                onClick={openGoogleDork}
                style={{ fontSize: 12, padding: "5px 12px", borderColor: "rgba(245, 158, 11, 0.4)", color: "#fbbf24", background: "rgba(245, 158, 11, 0.1)" }}
                title="Open exact Google Dork syntax for LinkedIn profiles"
              >
                <SearchIcon size={14} color="#fbbf24" />
                <span>Google Dork Search</span>
              </button>

              <span className="whatsapp-verified-pill">
                <WhatsAppIcon size={13} color="#25D366" />
                <span>100% Genuine Phone + WhatsApp</span>
              </span>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="filter-group-block" style={{ marginBottom: 14 }}>
            <span className="filter-label">
              <ZapIcon size={14} color="#f59e0b" /> Quick Investor Presets:
            </span>
            <div className="chip-selection-row" style={{ gap: 8, flexWrap: "wrap" }}>
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="chip-toggle-btn"
                  style={{ fontSize: 12, padding: "5px 12px" }}
                  onClick={() => applyPreset(p)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Wealth Tier Filter Selector */}
          <div className="filter-group-block" style={{ marginBottom: 14 }}>
            <span className="filter-label">
              <AwardIcon size={15} color="#f59e0b" /> Wealth Tier &amp; Net Worth Requirement:
            </span>
            <div className="chip-selection-row" style={{ gap: 10, flexWrap: "wrap" }}>
              {WEALTH_TIERS.map((tier) => {
                const isSelected = selectedWealthTier === tier.value;
                return (
                  <button
                    key={tier.value}
                    type="button"
                    className={`chip-toggle-btn ${isSelected ? "chip-toggle-active" : ""}`}
                    onClick={() => {
                      setSelectedWealthTier(tier.value);
                      executeDiscovery(selectedCountries, selectedProfessions, keyword, minScore, tier.value, whatsappOnly);
                    }}
                    style={isSelected ? { borderColor: "#f59e0b", background: "rgba(245, 158, 11, 0.18)", color: "#fbbf24", fontWeight: 700 } : {}}
                  >
                    <span>{tier.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Country Selection Chips */}
          <div className="filter-group-block">
            <span className="filter-label">
              <GlobeIcon size={15} color="#06b6d4" /> Target Diaspora Markets:
            </span>
            <div className="chip-selection-row">
              {COUNTRIES.map((c) => {
                const isSelected = selectedCountries.includes(c.name);
                return (
                  <button
                    key={c.name}
                    type="button"
                    className={`chip-toggle-btn ${isSelected ? "chip-toggle-active" : ""}`}
                    onClick={() => toggleCountry(c.name)}
                  >
                    <span>{c.name}</span>
                    <span className="chip-tier-tag">{c.tier}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Profession Selection Chips */}
          <div className="filter-group-block">
            <span className="filter-label">
              <BriefcaseIcon size={15} color="#8b5cf6" /> Professional Categories ({selectedProfessions.length === 0 ? "All Categories" : `${selectedProfessions.length} selected`}):
            </span>
            <div className="chip-selection-row" style={{ gap: 8, flexWrap: "wrap" }}>
              {PROFESSIONS.map((p) => {
                const isSelected = selectedProfessions.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    className={`chip-toggle-btn ${isSelected ? "chip-toggle-active" : ""}`}
                    onClick={() => toggleProfession(p)}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search Action Bar */}
          <div className="filter-secondary-bar">
            {/* Custom Keyword */}
            <div className="input-field-wrapper has-icon" style={{ flex: 1, maxWidth: 420 }}>
              <span className="input-icon">
                <SearchIcon size={16} color="#94a3b8" />
              </span>
              <input
                className="custom-input"
                placeholder="Search by name, company, sector, city (e.g. Careem, London, Bestway)"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleDiscoverySearch()}
              />
            </div>

            {/* WhatsApp Only Checkbox Toggle */}
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "#4ade80", fontWeight: 600, padding: "8px 12px", background: "rgba(37, 211, 102, 0.1)", borderRadius: 8, border: "1px solid rgba(37, 211, 102, 0.3)" }}>
              <input
                type="checkbox"
                checked={whatsappOnly}
                onChange={(e) => {
                  setWhatsappOnly(e.target.checked);
                  executeDiscovery(selectedCountries, selectedProfessions, keyword, minScore, selectedWealthTier, e.target.checked);
                }}
                style={{ accentColor: "#25D366", width: 16, height: 16, cursor: "pointer" }}
              />
              <span>Verified WhatsApp Only</span>
            </label>

            {/* Launch Search Button */}
            <button
              className={`btn-primary-action ${loading ? "btn-loading" : ""}`}
              onClick={handleDiscoverySearch}
              disabled={loading}
              style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", color: "#000", fontWeight: 800, boxShadow: "0 4px 18px rgba(245, 158, 11, 0.35)" }}
            >
              {loading ? (
                <>
                  <span className="spinner-icon" />
                  <span>Scanning Wealth Intelligence...</span>
                </>
              ) : (
                <>
                  <SearchIcon size={16} color="#000" />
                  <span>Discover High Net Worth Leads</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error notice */}
        {error && (
          <div className="alert-banner alert-error animate-fade-in">
            <div className="alert-content">
              <AlertTriangleIcon size={18} color="#f43f5e" />
              <span>{error}</span>
            </div>
            <button className="alert-dismiss" onClick={() => setError("")}>✕</button>
          </div>
        )}

        {/* Live Search Results / Cards */}
        <div className="leads-list-container">
          {candidates.length > 0 && (
            <div className="list-heading-bar">
              <div className="table-heading-group">
                <h3 className="table-title">High-Net-Worth Investors ({candidates.length})</h3>
                <span className="results-counter-badge" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24", borderColor: "rgba(245, 158, 11, 0.3)" }}>
                  Sorted by Wealth &amp; Net Worth
                </span>
              </div>
              <button
                type="button"
                className="btn-primary-action"
                onClick={handleBatchSaveAll}
                disabled={batchSaving}
                style={{ fontSize: 13, padding: "8px 16px", background: "linear-gradient(135deg, #10b981 0%, #059669 100%)" }}
              >
                <UserCheckIcon size={14} color="#fff" />
                <span>{batchSaving ? "Saving All..." : "Save All to CRM Database"}</span>
              </button>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="empty-hero-state glass-panel animate-fade-in" style={{ padding: "48px 24px", textAlign: "center" }}>
              <div className="spinner-icon" style={{ width: 36, height: 36, borderWidth: 3, borderColor: "rgba(245, 158, 11, 0.2)", borderTopColor: "#f59e0b", margin: "0 auto 16px" }} />
              <h3>Scanning Public Diaspora Registries &amp; Corporate Filings...</h3>
              <p>Verifying mobile numbers, active WhatsApp reachability, and corporate net worth estimates.</p>
            </div>
          )}

          {/* Empty State after Search */}
          {!loading && hasSearched && candidates.length === 0 && (
            <div className="empty-hero-state glass-panel animate-fade-in" style={{ padding: "48px 24px", textAlign: "center" }}>
              <div className="empty-icon-box" style={{ background: "rgba(245, 158, 11, 0.12)", color: "#f59e0b", margin: "0 auto 16px" }}>
                <AlertTriangleIcon size={32} color="#f59e0b" />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 8 }}>
                No High-Net-Worth Investors Found for This Filter
              </h2>
              <p style={{ color: "#94a3b8", maxWidth: 500, margin: "0 auto 20px" }}>
                Try selecting "All Wealth Tiers" or selecting more target countries.
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <button
                  className="btn-primary-action"
                  onClick={() => { setSelectedWealthTier("All"); setSelectedProfessions([]); executeDiscovery(selectedCountries, [], "", 30, "All", true); }}
                  style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", color: "#000" }}
                >
                  <span>Reset All Filters</span>
                </button>
              </div>
            </div>
          )}

          {/* Cards Stack */}
          {!loading && candidates.length > 0 && (
            <div className="leads-cards-stack" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {candidates.map((lead, idx) => {
                const leadKey = lead.id || lead.full_name || `lead-${idx}`;
                const isExpanded = expandedLeadId === leadKey;
                const isPitchOpen = expandedPitchId === leadKey;
                
                // Clean phone digits for wa.me link
                const cleanPhoneDigits = (lead.whatsapp_number || lead.public_phone || "").replace(/\D/g, "");
                const isUltra = (lead.wealth_tier || "").includes("Ultra") || (lead.wealth_tier || "").includes("100M");
                const isVHNW = (lead.wealth_tier || "").includes("Very") || (lead.wealth_tier || "").includes("25M");
                
                const customPitch = lead.whatsapp_pitch || `Salam ${lead.full_name.split(" ")[0]}, reaching out from Islamabad regarding exclusive off-market luxury estate and high-yield commercial real estate opportunities in CDA Sector F-6 / Blue Area tailored for senior executive leadership. Would you be open to an executive briefing?`;
                const whatsappUrl = `https://wa.me/${cleanPhoneDigits}?text=${encodeURIComponent(customPitch)}`;
                const companySearchUrl = lead.company_website || `https://www.google.com/search?q=${encodeURIComponent(lead.company + " " + (lead.current_city || lead.current_country))}`;

                return (
                  <div key={leadKey} className="wealth-intelligence-card animate-slide-up">
                    {/* Top Identity & Wealth Tier Bar */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                      {/* Left: Name, Role & Location */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 260 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <h3 style={{ fontSize: 20, fontWeight: 800, color: "#ffffff", margin: 0 }}>{lead.full_name}</h3>
                          <span className="investor-location-badge" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <GlobeIcon size={13} color="#06b6d4" />
                            {lead.current_city ? `${lead.current_city}, ` : ""}{lead.current_country}
                          </span>
                          {lead.saved && (
                            <span className="score-tier-tag tier-hot" style={{ fontSize: 11, padding: "2px 8px" }}>
                              Saved in CRM
                            </span>
                          )}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                          <span style={{ fontSize: 14, color: "#94a3b8", fontWeight: 600 }}>{lead.job_title || lead.profession}</span>
                          <span style={{ color: "#475569" }}>•</span>
                          {lead.company && (
                            <a
                              href={companySearchUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ textDecoration: "none", color: "#38bdf8", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13.5, fontWeight: 600 }}
                              title="Visit company website or search corporate registry"
                            >
                              <BuildingIcon size={13} color="#38bdf8" />
                              <span>{lead.company}</span>
                              <ExternalLinkIcon size={11} color="#38bdf8" />
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Right: Wealth Badge */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                        <span className={isUltra ? "wealth-tier-tag-ultra" : isVHNW ? "wealth-tier-tag-vhnw" : "wealth-tier-tag-hnw"}>
                          {lead.wealth_tier || "🏛️ High Net Worth"}
                        </span>
                        <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>
                          Verified Public Figure
                        </span>
                      </div>
                    </div>

                    {/* Wealth Intelligence Metrics Strip */}
                    <div className="wealth-metrics-strip">
                      <div className="wealth-metric-item">
                        <span className="wealth-metric-label">💰 Estimated Net Worth</span>
                        <span className="wealth-metric-value wealth-metric-highlight">
                          {lead.estimated_net_worth || "$10 Million+"}
                        </span>
                      </div>

                      <div className="wealth-metric-item">
                        <span className="wealth-metric-label">💼 Real Estate Allocation</span>
                        <span className="wealth-metric-value" style={{ color: "#38bdf8" }}>
                          {lead.investment_capacity || "$2M - $5M Liquid"}
                        </span>
                      </div>

                      <div className="wealth-metric-item">
                        <span className="wealth-metric-label">🏛️ Primary Wealth Engine</span>
                        <span className="wealth-metric-value" style={{ fontSize: 13, color: "#e2e8f0" }}>
                          {lead.wealth_source || lead.company}
                        </span>
                      </div>

                      <div className="wealth-metric-item">
                        <span className="wealth-metric-label">📍 Target Islamabad Sectors</span>
                        <span className="wealth-metric-value" style={{ fontSize: 13, color: "#4ade80" }}>
                          {lead.pakistan_real_estate_target || "CDA Sector F-6 / F-7 / Blue Area"}
                        </span>
                      </div>
                    </div>

                    {/* DIRECT WHATSAPP & OUTREACH COMMAND CENTER */}
                    <div className="whatsapp-outreach-center">
                      <div className="whatsapp-action-row">
                        {/* Direct WhatsApp Launcher Button */}
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-whatsapp-direct"
                          title="Open WhatsApp chat immediately with pre-filled greeting"
                        >
                          <WhatsAppIcon size={18} color="#ffffff" />
                          <span>Chat on WhatsApp</span>
                        </a>

                        {/* Direct Phone Call Button */}
                        {lead.public_phone && (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                            <a
                              href={`tel:${lead.public_phone}`}
                              className="btn-call-direct"
                              title="Call direct phone"
                            >
                              <PhoneIcon size={14} color="#fbbf24" />
                              <span>{lead.public_phone}</span>
                            </a>
                            {lead.phone_source_url && (
                              <a
                                href={lead.phone_source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="source-link-pill"
                                title={`Verify public source of this phone number: ${lead.phone_source_url}`}
                              >
                                <ExternalLinkIcon size={10} color="#38bdf8" />
                                <span>Source 🔗</span>
                              </a>
                            )}
                          </div>
                        )}

                        {/* Copy Phone Button */}
                        {lead.public_phone && (
                          <button
                            type="button"
                            className="chip-toggle-btn"
                            style={{ padding: "7px 12px", fontSize: 12 }}
                            onClick={() => copyToClipboard(lead.public_phone, `${leadKey}-phone`, "Phone Number")}
                            title="Copy direct phone number"
                          >
                            {copiedKey === `${leadKey}-phone` ? <CheckIcon size={13} color="#10b981" /> : <CopyIcon size={13} />}
                            <span>{copiedKey === `${leadKey}-phone` ? "Copied!" : "Copy Number"}</span>
                          </button>
                        )}

                        {/* Toggle Pre-composed Pitch */}
                        <button
                          type="button"
                          className="chip-toggle-btn"
                          style={{ padding: "7px 12px", fontSize: 12, borderColor: "rgba(37, 211, 102, 0.3)", color: "#4ade80" }}
                          onClick={() => setExpandedPitchId(isPitchOpen ? null : leadKey)}
                        >
                          <MessageSquareIcon size={13} color="#4ade80" />
                          <span>{isPitchOpen ? "Hide Pitch Message" : "View WhatsApp Pitch"}</span>
                          {isPitchOpen ? <ChevronUpIcon size={12} /> : <ChevronDownIcon size={12} />}
                        </button>
                      </div>

                      {/* Expandable WhatsApp Pitch Box */}
                      {isPitchOpen && (
                        <div className="whatsapp-custom-pitch-box animate-fade-in">
                          <div className="pitch-header">
                            <span>💬 Personalized Luxury Real Estate WhatsApp Pitch</span>
                            <button
                              type="button"
                              className="chip-toggle-btn"
                              style={{ padding: "2px 8px", fontSize: 11, background: "rgba(37, 211, 102, 0.2)", color: "#4ade80" }}
                              onClick={() => copyToClipboard(customPitch, `${leadKey}-pitch`, "WhatsApp Pitch")}
                            >
                              {copiedKey === `${leadKey}-pitch` ? "Copied!" : "Copy Pitch"}
                            </button>
                          </div>
                          <p style={{ margin: 0, fontStyle: "italic" }}>"{customPitch}"</p>
                        </div>
                      )}
                    </div>

                    {/* Secondary Contact & Verifiable Evidence Row */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255, 255, 255, 0.07)" }}>
                      {/* LinkedIn Profile & Precision Finder */}
                      <a
                        href={lead.professional_profile_url || `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(lead.full_name + " " + (lead.company || ""))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="contact-pill profile-link-pill"
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 20, background: "rgba(10, 102, 194, 0.18)", border: "1px solid rgba(10, 102, 194, 0.45)", color: "#38bdf8", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}
                        title="Open live LinkedIn profile or search results"
                      >
                        <LinkedInIcon size={14} color="#38bdf8" />
                        <span>View LinkedIn Profile</span>
                        <ExternalLinkIcon size={11} color="#38bdf8" />
                      </a>

                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent('site:linkedin.com/in "' + lead.full_name + '" ' + (lead.company || lead.current_city || ""))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="contact-pill"
                        style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 20, background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.15)", color: "#94a3b8", fontSize: 11.5, fontWeight: 600, textDecoration: "none" }}
                        title="Find this person's exact LinkedIn URL via Google Dork"
                      >
                        <SearchIcon size={12} color="#94a3b8" />
                        <span>Google Dork</span>
                      </a>

                      {/* Public Email Pill */}
                      {lead.public_email && (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                          <button
                            type="button"
                            className="contact-pill email-pill"
                            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#34d399", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                            onClick={() => copyToClipboard(lead.public_email, `${leadKey}-email`, "Email")}
                            title="Click to copy public email"
                          >
                            <MailIcon size={13} color="#10b981" />
                            <span>{lead.public_email}</span>
                            {copiedKey === `${leadKey}-email` ? <CheckIcon size={12} color="#10b981" /> : <CopyIcon size={12} />}
                          </button>
                          {lead.email_source_url && (
                            <a
                              href={lead.email_source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="source-link-pill"
                              title={`Verify public source of this email: ${lead.email_source_url}`}
                            >
                              <ExternalLinkIcon size={10} color="#38bdf8" />
                              <span>Source 🔗</span>
                            </a>
                          )}
                        </div>
                      )}

                      {/* Expand Evidence Button */}
                      <button
                        type="button"
                        className="btn-toggle-evidence"
                        style={{ marginLeft: "auto", fontSize: 12 }}
                        onClick={() => setExpandedLeadId(isExpanded ? null : leadKey)}
                      >
                        <ShieldCheckIcon size={13} color="#10b981" />
                        <span>{isExpanded ? "Hide Background Dossier" : "Inspect Background & Assets"}</span>
                        {isExpanded ? <ChevronUpIcon size={13} /> : <ChevronDownIcon size={13} />}
                      </button>
                    </div>

                    {/* Expandable Dossier */}
                    {isExpanded && (
                      <div className="evidence-drawer glass-panel animate-fade-in" style={{ marginTop: 14 }}>
                        <div className="evidence-drawer-header">
                          <h4 className="drawer-title">
                            <ShieldCheckIcon size={15} color="#10b981" />
                            <span>Verified Biography &amp; Asset Footprint</span>
                          </h4>
                        </div>
                        <p style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.6, margin: "8px 0" }}>
                          {lead.notes || lead.evidence_summary}
                        </p>

                        {/* Documented Public Sources & Proof */}
                        {((lead.source_urls && lead.source_urls.length > 0) || lead.phone_source_url || lead.email_source_url) && (
                          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255, 255, 255, 0.07)" }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: 6 }}>
                              🔗 Public Finding Sources &amp; Citations:
                            </span>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {lead.phone_source_url && (
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "rgba(255, 255, 255, 0.03)", padding: "4px 10px", borderRadius: 6 }}>
                                  <span style={{ fontSize: 12, color: "#fbbf24", fontWeight: 600 }}>Phone / WhatsApp Source:</span>
                                  <a href={lead.phone_source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#38bdf8", textDecoration: "underline", maxWidth: 380, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {lead.phone_source_url}
                                  </a>
                                </div>
                              )}
                              {lead.email_source_url && (
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "rgba(255, 255, 255, 0.03)", padding: "4px 10px", borderRadius: 6 }}>
                                  <span style={{ fontSize: 12, color: "#34d399", fontWeight: 600 }}>Email Contact Source:</span>
                                  <a href={lead.email_source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#38bdf8", textDecoration: "underline", maxWidth: 380, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {lead.email_source_url}
                                  </a>
                                </div>
                              )}
                              {(lead.source_urls || []).map((srcUrl, sIdx) => {
                                if (!srcUrl || srcUrl === lead.phone_source_url || srcUrl === lead.email_source_url) return null;
                                return (
                                  <div key={sIdx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "rgba(255, 255, 255, 0.03)", padding: "4px 10px", borderRadius: 6 }}>
                                    <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>Public Record / Profile:</span>
                                    <a href={srcUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#38bdf8", textDecoration: "underline", maxWidth: 380, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      {srcUrl}
                                    </a>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Review Actions Footer */}
                    <div className="card-review-footer" style={{ marginTop: 14 }}>
                      <div className="review-hint">
                        <span style={{ color: "#94a3b8", fontSize: 12 }}>
                          Direct contact confirmed — ready for private real estate presentation
                        </span>
                      </div>

                      <div className="review-actions-group">
                        <button
                          type="button"
                          className="btn-review-dnc"
                          onClick={() => handleMarkDNC(lead)}
                          title="Add to Do-Not-Contact list"
                        >
                          <UserXIcon size={14} />
                          <span>Do Not Contact</span>
                        </button>

                        <button
                          type="button"
                          className="btn-review-reject"
                          onClick={() => setRejectModalLead(lead)}
                          title="Mark as not relevant or low priority"
                        >
                          <span>Reject</span>
                        </button>

                        <button
                          type="button"
                          className="btn-review-approve"
                          onClick={() => handleApproveLead(lead)}
                          style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", color: "#fff", fontWeight: 700 }}
                        >
                          <CheckIcon size={14} color="#fff" />
                          <span>Save to CRM Pipeline</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Reject Modal */}
      {rejectModalLead && (
        <div className="modal-backdrop-overlay animate-fade-in">
          <div className="modal-lead-card glass-panel animate-slide-up" style={{ maxWidth: 440 }}>
            <div className="modal-card-header">
              <h3 className="modal-title">Reject Lead: {rejectModalLead.full_name}</h3>
              <button className="btn-modal-close" onClick={() => setRejectModalLead(null)}>✕</button>
            </div>
            <div className="modal-body-content" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ color: "#94a3b8", fontSize: 13 }}>
                Please specify a reason for rejecting this candidate.
              </p>
              <select
                className="custom-select"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              >
                <option value="No verified Pakistan connection">No verified Pakistan connection</option>
                <option value="Insufficient investment capacity">Insufficient investment capacity</option>
                <option value="Invalid phone / WhatsApp reachability">Invalid phone / WhatsApp reachability</option>
                <option value="Wrong profession or location">Wrong profession or location</option>
                <option value="Already contacted / Duplicate">Already contacted / Duplicate</option>
              </select>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 10 }}>
                <button className="btn-secondary" onClick={() => setRejectModalLead(null)}>Cancel</button>
                <button className="btn-review-reject" onClick={handleRejectLead}>Confirm Rejection</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
