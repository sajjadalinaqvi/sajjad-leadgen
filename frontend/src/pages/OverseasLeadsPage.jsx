import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import Toast from "../components/Toast";
import {
  GlobeIcon, SearchIcon, SparklesIcon, BuildingIcon, MailIcon, PhoneIcon,
  ExternalLinkIcon, CheckIcon, UserCheckIcon, UserXIcon, ChevronDownIcon,
  ChevronUpIcon, ShieldCheckIcon, CopyIcon, AwardIcon, BriefcaseIcon, SlidersIcon, AlertTriangleIcon
} from "../components/Icons";
import API from "../api";

const COUNTRIES = [
  { name: "UAE", tier: "Tier 1" },
  { name: "Saudi Arabia", tier: "Tier 1" },
  { name: "United Kingdom", tier: "Tier 1" },
  { name: "United States", tier: "Tier 1" },
  { name: "Canada", tier: "Tier 2" },
  { name: "Australia", tier: "Tier 2" },
  { name: "Qatar", tier: "Tier 2" },
  { name: "Kuwait", tier: "Tier 2" },
  { name: "Oman", tier: "Tier 2" },
  { name: "Bahrain", tier: "Tier 2" },
];

const PROFESSIONS = [
  "Founder / Business Owner",
  "CEO / Managing Director",
  "Doctor / Consultant Surgeon",
  "Senior Tech Executive",
  "Finance & Investment Leader",
  "Corporate Lawyer / Partner",
];

export default function OverseasLeadsPage() {
  const [selectedCountries, setSelectedCountries] = useState(["UAE", "United Kingdom", "Saudi Arabia", "United States"]);
  const [selectedProfessions, setSelectedProfessions] = useState(["Founder / Business Owner", "Doctor / Consultant Surgeon", "CEO / Managing Director"]);
  const [keyword, setKeyword] = useState("");
  const [minScore, setMinScore] = useState(65);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedLeadId, setExpandedLeadId] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const [toast, setToast] = useState(null);
  const [rejectModalLead, setRejectModalLead] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("No verified Pakistan connection");

  // Load initial candidate database
  useEffect(() => {
    fetchExistingQualifiedLeads();
  }, []);

  const showNotification = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchExistingQualifiedLeads = async () => {
    try {
      const res = await fetch(`${API}/leads?score_category=All&min_score=50&page_size=20`);
      if (res.ok) {
        const data = await res.json();
        setCandidates(data.leads || []);
      }
    } catch {
      // Backend may be starting up
    }
  };

  const toggleCountry = (c) => {
    if (selectedCountries.includes(c)) {
      setSelectedCountries(selectedCountries.filter((item) => item !== c));
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

  const handleDiscoverySearch = async () => {
    if (selectedCountries.length === 0) {
      setError("Please select at least one target country.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const payload = {
        countries: selectedCountries,
        professions: selectedProfessions,
        keywords: keyword,
        min_score: minScore,
        limit: 25,
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
        showNotification(`Found ${data.results.length} qualified diaspora candidates!`, "success");
      } else {
        showNotification("No new diaspora candidates found with current filters. Showing existing database.", "error");
        fetchExistingQualifiedLeads();
      }
    } catch (e) {
      setError(e.message);
      showNotification(e.message, "error");
    } finally {
      setLoading(false);
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
        showNotification(`Approved & Saved ${lead.full_name} to CRM Pipeline!`, "success");
        // Update local state
        setCandidates(candidates.map((c) => c.full_name === lead.full_name ? { ...c, lead_status: "Qualified" } : c));
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
      showNotification(`Marked ${rejectModalLead.full_name} as Rejected (${rejectionReason}).`, "success");
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
      showNotification(`Added ${lead.full_name} to Do-Not-Contact (DNC) list.`, "success");
      setCandidates(candidates.filter((c) => c.full_name !== lead.full_name));
    } catch (e) {
      showNotification(`Error: ${e.message}`, "error");
    }
  };

  return (
    <div className="page-wrapper">
      <Navbar />

      <main className="main-content-container">
        {/* Header */}
        <div className="page-header animate-fade-in">
          <div className="page-header-badge" style={{ borderColor: "rgba(16, 185, 129, 0.3)", color: "#10b981", background: "rgba(16, 185, 129, 0.1)" }}>
            <AwardIcon size={14} color="#10b981" />
            <span>Evidence-Based Investor Intelligence</span>
          </div>
          <h1 className="page-title">Overseas Pakistani Investor Leads</h1>
          <p className="page-subtitle">
            Target financially successful Pakistani diaspora outside Pakistan with documented signals of capability and potential interest in Islamabad real estate.
          </p>
        </div>

        {/* Discovery & Search Controls Panel */}
        <div className="search-panel glass-panel animate-slide-up">
          <div className="panel-mode-header">
            <span className="export-heading">Target Criteria &amp; Diaspora Filters</span>
            <span className="results-counter-badge">Prioritizes Quality Over Volume</span>
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
              <BriefcaseIcon size={15} color="#8b5cf6" /> Professional Strength Profiles:
            </span>
            <div className="chip-selection-row">
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

          {/* Secondary Controls Bar */}
          <div className="filter-secondary-bar">
            {/* Custom Keyword */}
            <div className="input-field-wrapper has-icon" style={{ maxWidth: 360 }}>
              <span className="input-icon">
                <SearchIcon size={16} color="#94a3b8" />
              </span>
              <input
                className="custom-input"
                placeholder="Optional keyword (e.g. Fintech, DHA, NUST, Harley St)"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleDiscoverySearch()}
              />
            </div>

            {/* Min Score Slider */}
            <div className="score-slider-group">
              <span className="filter-label">
                <SlidersIcon size={14} color="#f59e0b" /> Min Lead Score:
                <strong className="score-slider-val">{minScore}/100</strong>
              </span>
              <input
                type="range"
                min="30"
                max="90"
                step="5"
                value={minScore}
                onChange={(e) => setMinScore(parseInt(e.target.value, 10))}
                className="custom-range-slider"
              />
            </div>

            {/* Launch Search Button */}
            <button
              className={`btn-primary-action ${loading ? "btn-loading" : ""}`}
              onClick={handleDiscoverySearch}
              disabled={loading}
              style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", boxShadow: "0 4px 18px rgba(16, 185, 129, 0.35)" }}
            >
              {loading ? (
                <>
                  <span className="spinner-icon" />
                  <span>Scanning Public Sources...</span>
                </>
              ) : (
                <>
                  <SearchIcon size={16} />
                  <span>Discover Investor Leads</span>
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

        {/* Candidate Leads List */}
        <div className="leads-list-container">
          <div className="list-heading-bar">
            <div className="table-heading-group">
              <h3 className="table-title">Prospect Candidates ({candidates.length})</h3>
              <span className="results-counter-badge">
                Evidence-First Scoring (0–100)
              </span>
            </div>
          </div>

          <div className="leads-cards-stack">
            {candidates.map((lead, idx) => {
              const leadKey = lead.id || `lead-${idx}`;
              const isExpanded = expandedLeadId === leadKey;
              const isHot = lead.total_lead_score >= 80;
              const isHigh = lead.total_lead_score >= 65 && lead.total_lead_score < 80;

              return (
                <div key={leadKey} className="investor-lead-card glass-panel animate-slide-up">
                  <div className="investor-card-top">
                    {/* Left: Identity & Position */}
                    <div className="investor-identity-group">
                      <div className="investor-name-row">
                        <h3 className="investor-full-name">{lead.full_name}</h3>
                        <span className="investor-location-badge">
                          <GlobeIcon size={13} color="#06b6d4" />
                          {lead.current_city ? `${lead.current_city}, ` : ""}{lead.current_country}
                        </span>
                      </div>

                      <div className="investor-role-row">
                        <span className="investor-job-title">{lead.job_title || lead.profession}</span>
                        {lead.company && (
                          <span className="investor-company-name">
                            <BuildingIcon size={13} color="#94a3b8" />
                            {lead.company}
                          </span>
                        )}
                        {lead.company_size && (
                          <span className="company-size-badge">{lead.company_size}</span>
                        )}
                      </div>
                    </div>

                    {/* Right: Overall Score Pill */}
                    <div className="investor-score-badge-wrap">
                      <div className="score-number-box">
                        <span className="score-val">{lead.total_lead_score}</span>
                        <span className="score-max">/100</span>
                      </div>
                      <span className={`score-tier-tag ${isHot ? "tier-hot" : isHigh ? "tier-high" : "tier-potential"}`}>
                        {lead.score_category || (isHot ? "HOT" : "HIGH POTENTIAL")}
                      </span>
                    </div>
                  </div>

                  {/* Sub-Score Bars */}
                  <div className="score-factors-grid">
                    <div className="factor-metric">
                      <div className="factor-label-row">
                        <span>Pakistan Connection</span>
                        <strong>{lead.pakistan_connection_score || 0}/30</strong>
                      </div>
                      <div className="stat-progress-bar">
                        <div
                          className="stat-progress-fill stat-progress-emerald"
                          style={{ width: `${((lead.pakistan_connection_score || 0) / 30) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="factor-metric">
                      <div className="factor-label-row">
                        <span>Financial Strength</span>
                        <strong>{lead.financial_strength_score || 0}/20</strong>
                      </div>
                      <div className="stat-progress-bar">
                        <div
                          className="stat-progress-fill stat-progress-indigo"
                          style={{ width: `${((lead.financial_strength_score || 0) / 20) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="factor-metric">
                      <div className="factor-label-row">
                        <span>Overseas Status</span>
                        <strong>{lead.overseas_status_score || 0}/20</strong>
                      </div>
                      <div className="stat-progress-bar">
                        <div
                          className="stat-progress-fill stat-progress-cyan"
                          style={{ width: `${((lead.overseas_status_score || 0) / 20) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="factor-metric">
                      <div className="factor-label-row">
                        <span>Islamabad Intent</span>
                        <strong>{(lead.islamabad_connection_score || 0) + (lead.real_estate_intent_score || 0)}/35</strong>
                      </div>
                      <div className="stat-progress-bar">
                        <div
                          className="stat-progress-fill stat-progress-amber"
                          style={{ width: `${(((lead.islamabad_connection_score || 0) + (lead.real_estate_intent_score || 0)) / 35) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Evidence Summary Preview */}
                  {lead.evidence_summary && (
                    <div className="evidence-summary-callout">
                      <ShieldCheckIcon size={16} color="#10b981" />
                      <p className="evidence-summary-text">
                        <strong>Evidence Summary:</strong> {lead.evidence_summary}
                      </p>
                    </div>
                  )}

                  {/* Sourced Contact Bar */}
                  <div className="investor-contact-bar">
                    {lead.public_email ? (
                      <div className="contact-pill-item">
                        <MailIcon size={14} color="#10b981" />
                        <span className="contact-pill-text">{lead.public_email}</span>
                        <button
                          className="btn-copy-mini"
                          onClick={() => copyToClipboard(lead.public_email, `em-${leadKey}`, "Email")}
                        >
                          {copiedKey === `em-${leadKey}` ? <CheckIcon size={12} color="#10b981" /> : <CopyIcon size={12} />}
                        </button>
                      </div>
                    ) : (
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(lead.full_name + " " + (lead.company || "") + " official email contact")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-find-google-email"
                      >
                        <SearchIcon size={12} />
                        <span>Find Official Email</span>
                      </a>
                    )}

                    {lead.public_phone && (
                      <div className="contact-pill-item">
                        <PhoneIcon size={14} color="#06b6d4" />
                        <span className="contact-pill-text">{lead.public_phone}</span>
                        <button
                          className="btn-copy-mini"
                          onClick={() => copyToClipboard(lead.public_phone, `ph-${leadKey}`, "Phone")}
                        >
                          {copiedKey === `ph-${leadKey}` ? <CheckIcon size={12} color="#10b981" /> : <CopyIcon size={12} />}
                        </button>
                      </div>
                    )}

                    {lead.professional_profile_url && (
                      <a
                        href={lead.professional_profile_url}
                        target="_blank"
                        rel="noreferrer"
                        className="contact-pill-link"
                      >
                        <span>Verified Profile</span>
                        <ExternalLinkIcon size={12} />
                      </a>
                    )}

                    {lead.lead_status && (
                      <span className={`status-stage-pill stage-${(lead.lead_status || "new").toLowerCase().replace(/\s+/g, "-")}`}>
                        Stage: {lead.lead_status}
                      </span>
                    )}
                  </div>

                  {/* Evidence Accordion Toggle */}
                  <div className="card-accordion-toggle">
                    <button
                      type="button"
                      className="btn-evidence-accordion"
                      onClick={() => setExpandedLeadId(isExpanded ? null : leadKey)}
                    >
                      <span>Why is this lead scored {lead.total_lead_score}? ({lead.evidence_list?.length || 0} Evidence Signals)</span>
                      {isExpanded ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
                    </button>
                  </div>

                  {/* Expanded Evidence Drawer */}
                  {isExpanded && (
                    <div className="evidence-accordion-content animate-fade-in">
                      <div className="evidence-items-list">
                        {(lead.evidence_list || []).map((ev, evIdx) => (
                          <div key={evIdx} className="evidence-item-row">
                            <div className="evidence-points-badge">
                              +{ev.points} pts
                            </div>
                            <div className="evidence-detail-group">
                              <span className="evidence-category-tag">{ev.category.replace(/_/g, " ").toUpperCase()}</span>
                              <p className="evidence-description">{ev.description}</p>
                              {ev.source_url && (
                                <a
                                  href={ev.source_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="evidence-source-link"
                                >
                                  <ExternalLinkIcon size={12} />
                                  <span>Source: {ev.source_url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 45)}...</span>
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Human-in-the-Loop Review Actions */}
                  <div className="card-review-footer">
                    <div className="review-hint">
                      <span>Human Review: Verify factual evidence before outreach</span>
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
                      >
                        <span>Reject</span>
                      </button>

                      <button
                        type="button"
                        className="btn-review-approve"
                        onClick={() => handleApproveLead(lead)}
                      >
                        <UserCheckIcon size={15} color="#10b981" />
                        <span>Approve &amp; Qualify Lead</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rejection Reason Modal */}
        {rejectModalLead && (
          <div className="modal-overlay animate-fade-in" onClick={() => setRejectModalLead(null)}>
            <div className="modal-lead-card glass-panel" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Reject Lead Candidate</h3>
                <button className="modal-close-btn" onClick={() => setRejectModalLead(null)}>✕</button>
              </div>

              <div className="modal-body">
                <p>Provide a feedback reason for rejecting <strong>{rejectModalLead.full_name}</strong> to improve qualification accuracy:</p>
                <select
                  className="custom-select mt-2"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                >
                  <option value="No verified Pakistan connection">No verified Pakistan connection</option>
                  <option value="Not resident overseas">Not resident overseas</option>
                  <option value="Not financially relevant / senior">Not financially relevant / senior</option>
                  <option value="No Islamabad real estate relevance">No Islamabad real estate relevance</option>
                  <option value="Duplicate candidate">Duplicate candidate</option>
                  <option value="Inaccurate public source data">Inaccurate public source data</option>
                </select>
              </div>

              <div className="modal-footer">
                <button className="btn-secondary" onClick={() => setRejectModalLead(null)}>Cancel</button>
                <button className="btn-primary" style={{ background: "#f43f5e" }} onClick={handleRejectLead}>
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
