import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import Toast from "../components/Toast";
import {
  DatabaseIcon, DownloadIcon, FileCsvIcon, FileExcelIcon, FileJsonIcon,
  SearchIcon, FilterIcon, MailIcon, PhoneIcon, GlobeIcon, UserCheckIcon,
  UserXIcon, EyeIcon, XIcon, ShieldCheckIcon, CopyIcon, CheckIcon,
  BuildingIcon, ArrowLeftIcon, ArrowRightIcon, ExternalLinkIcon
} from "../components/Icons";
import API from "../api";

const CRM_STAGES = [
  "All",
  "New",
  "Reviewed",
  "Qualified",
  "Contacted",
  "Replied",
  "Interested",
  "Meeting",
  "Property Viewing",
  "Negotiation",
  "Converted",
  "Not Interested",
  "Do Not Contact",
];

export default function LeadDatabasePage() {
  const [leads, setLeads] = useState([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [funnelStats, setFunnelStats] = useState(null);
  const [selectedStage, setSelectedStage] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("All");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [exporting, setExporting] = useState("");
  const [copiedKey, setCopiedKey] = useState(null);
  const [toast, setToast] = useState(null);
  const [leadNotes, setLeadNotes] = useState("");

  useEffect(() => {
    fetchLeads(1);
    fetchFunnel();
  }, [selectedStage, selectedCountry]);

  const showNotification = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchLeads = async (p = 1) => {
    setLoading(true);
    try {
      const stageParam = selectedStage !== "All" ? `&lead_status=${encodeURIComponent(selectedStage)}` : "";
      const countryParam = selectedCountry !== "All" ? `&country=${encodeURIComponent(selectedCountry)}` : "";
      const searchParam = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : "";
      
      const res = await fetch(`${API}/leads?page=${p}&page_size=25${stageParam}${countryParam}${searchParam}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
        setTotalLeads(data.total || 0);
        setPage(p);
      }
    } catch {
      showNotification("Error loading database leads", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchFunnel = async () => {
    try {
      const res = await fetch(`${API}/crm/funnel`);
      if (res.ok) {
        const data = await res.json();
        setFunnelStats(data);
      }
    } catch {
      // Ignore
    }
  };

  const handleStageChange = async (leadId, newStage) => {
    try {
      const res = await fetch(`${API}/leads/${leadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_status: newStage }),
      });
      if (res.ok) {
        showNotification(`Updated CRM stage to "${newStage}"`, "success");
        setLeads(leads.map((l) => l.id === leadId ? { ...l, lead_status: newStage } : l));
        fetchFunnel();
      }
    } catch (e) {
      showNotification(`Error: ${e.message}`, "error");
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedLead) return;
    try {
      await fetch(`${API}/leads/${selectedLead.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_status: selectedLead.lead_status,
          notes: leadNotes,
        }),
      });
      showNotification("Saved lead notes successfully!", "success");
      setSelectedLead({ ...selectedLead, notes: leadNotes });
      setLeads(leads.map((l) => l.id === selectedLead.id ? { ...l, notes: leadNotes } : l));
    } catch (e) {
      showNotification(`Error: ${e.message}`, "error");
    }
  };

  const handleDeleteLead = async (leadId) => {
    if (!window.confirm("Are you sure you want to permanently delete this lead record?")) return;
    try {
      const res = await fetch(`${API}/leads/${leadId}`, { method: "DELETE" });
      if (res.ok) {
        showNotification("Lead record deleted permanently.", "success");
        setLeads(leads.filter((l) => l.id !== leadId));
        setSelectedLead(null);
        fetchFunnel();
      }
    } catch (e) {
      showNotification(`Error: ${e.message}`, "error");
    }
  };

  const exportLeads = async (fmt) => {
    setExporting(fmt);
    try {
      const res = await fetch(`${API}/export/overseas/${fmt}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_status: selectedStage !== "All" ? selectedStage : "All",
          country: selectedCountry !== "All" ? selectedCountry : "All",
        }),
      });

      if (!res.ok) throw new Error(`Export error: HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `overseas_leads_${new Date().toISOString().slice(0, 10)}.${fmt === "excel" ? "xlsx" : fmt}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showNotification(`Exported ${fmt.toUpperCase()} successfully!`, "success");
    } catch (e) {
      showNotification(`Export failed: ${e.message}`, "error");
    } finally {
      setExporting("");
    }
  };

  const copyToClipboard = (text, key, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showNotification(`Copied ${label} to clipboard!`, "success");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="page-wrapper">
      <Navbar />

      <main className="main-content-container">
        {/* Header */}
        <div className="page-header animate-fade-in">
          <div className="page-header-badge" style={{ borderColor: "rgba(99, 102, 241, 0.3)", color: "#818cf8" }}>
            <DatabaseIcon size={14} color="#818cf8" />
            <span>CRM Pipeline &amp; Lead Management</span>
          </div>
          <h1 className="page-title">Lead Database &amp; Opportunity Pipeline</h1>
          <p className="page-subtitle">
            Manage, review, track, and export qualified Overseas Pakistani real estate investor prospects through each sales stage.
          </p>
        </div>

        {/* Conversion Funnel KPI Bar */}
        {funnelStats && (
          <div className="stats-grid animate-fade-in">
            <div className="stat-card">
              <div className="stat-icon-box stat-primary">
                <DatabaseIcon size={20} color="#6366f1" />
              </div>
              <div className="stat-details">
                <span className="stat-label">Total Prospects</span>
                <span className="stat-value">{funnelStats.total_candidates || 0}</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-box stat-emerald">
                <UserCheckIcon size={20} color="#10b981" />
              </div>
              <div className="stat-details">
                <span className="stat-label">Qualified Leads (65+)</span>
                <span className="stat-value">{funnelStats.qualified_leads || 0}</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-box stat-cyan">
                <ShieldCheckIcon size={20} color="#06b6d4" />
              </div>
              <div className="stat-details">
                <span className="stat-label">Qualification Yield</span>
                <span className="stat-value">{funnelStats.qualification_rate || 0}%</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-box stat-amber">
                <GlobeIcon size={20} color="#f59e0b" />
              </div>
              <div className="stat-details">
                <span className="stat-label">Active Pipeline</span>
                <span className="stat-value">
                  {(funnelStats.status_counts?.Contacted || 0) +
                   (funnelStats.status_counts?.Interested || 0) +
                   (funnelStats.status_counts?.Meeting || 0) +
                   (funnelStats.status_counts?.["Property Viewing"] || 0)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Pipeline Controls & Stage Switcher */}
        <div className="search-panel glass-panel animate-slide-up">
          {/* Stage Tabs */}
          <div className="crm-stage-tabs-scroll">
            {CRM_STAGES.map((stage) => {
              const count = stage === "All" ? totalLeads : funnelStats?.status_counts?.[stage] || 0;
              const isActive = selectedStage === stage;
              return (
                <button
                  key={stage}
                  className={`crm-stage-pill ${isActive ? "crm-stage-active" : ""}`}
                  onClick={() => setSelectedStage(stage)}
                >
                  <span>{stage}</span>
                  <span className="crm-pill-count">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Secondary Filters & Search Bar */}
          <div className="table-controls-bar" style={{ marginTop: 12 }}>
            <div className="table-search-input-wrap">
              <SearchIcon size={15} color="#94a3b8" />
              <input
                type="text"
                placeholder="Search by name, company, city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchLeads(1)}
                className="table-search-input"
                style={{ width: 280 }}
              />
              {searchQuery && (
                <button className="clear-search-btn" onClick={() => { setSearchQuery(""); fetchLeads(1); }}>
                  <XIcon size={13} />
                </button>
              )}
            </div>

            <select
              className="table-sort-select"
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
            >
              <option value="All">All Countries</option>
              <option value="UAE">UAE</option>
              <option value="Saudi Arabia">Saudi Arabia</option>
              <option value="United Kingdom">United Kingdom</option>
              <option value="United States">United States</option>
              <option value="Canada">Canada</option>
              <option value="Australia">Australia</option>
            </select>

            {/* Export Toolbar */}
            <div className="export-actions-group ml-auto">
              <span className="export-label">Export Stage:</span>
              <button
                className="btn-export-format btn-csv"
                onClick={() => exportLeads("csv")}
                disabled={!!exporting}
              >
                <FileCsvIcon size={15} />
                <span>{exporting === "csv" ? "..." : "CSV"}</span>
              </button>
              <button
                className="btn-export-format btn-excel"
                onClick={() => exportLeads("excel")}
                disabled={!!exporting}
              >
                <FileExcelIcon size={15} />
                <span>{exporting === "excel" ? "..." : "Excel"}</span>
              </button>
              <button
                className="btn-export-format btn-json"
                onClick={() => exportLeads("json")}
                disabled={!!exporting}
              >
                <FileJsonIcon size={15} />
                <span>{exporting === "json" ? "..." : "JSON"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Leads Table & Cards Container */}
        <div className="results-container glass-panel animate-slide-up">
          {/* Desktop Table View */}
          <div className="table-responsive-wrapper desktop-table-view">
            <table className="lead-table">
              <thead>
                <tr>
                  <th style={{ width: "24%" }}>Prospect &amp; Seniority</th>
                  <th style={{ width: "16%" }}>Location &amp; Country</th>
                  <th style={{ width: "12%" }}>Lead Score</th>
                  <th style={{ width: "22%" }}>Contact Intelligence</th>
                  <th style={{ width: "16%" }}>CRM Stage</th>
                  <th style={{ width: "10%" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => {
                  const isHot = lead.total_lead_score >= 80;
                  const isHigh = lead.total_lead_score >= 65 && lead.total_lead_score < 80;

                  return (
                    <tr key={lead.id} className="lead-table-row">
                      <td>
                        <div className="lead-name-cell">
                          <span className="lead-name-title font-semibold">{lead.full_name}</span>
                          <span className="lead-category-badge">{lead.job_title || lead.profession}</span>
                          {lead.company && (
                            <span className="text-muted-cell" style={{ fontSize: 11.5 }}>
                              {lead.company}
                            </span>
                          )}
                        </div>
                      </td>

                      <td>
                        <div className="contact-cell">
                          <span style={{ color: "#ffffff", fontWeight: 600 }}>{lead.current_country}</span>
                          <span className="text-muted-cell">{lead.current_city || "Overseas"}</span>
                        </div>
                      </td>

                      <td>
                        <div className="rating-pill-wrapper">
                          <span className={`score-tier-tag ${isHot ? "tier-hot" : isHigh ? "tier-high" : "tier-potential"}`}>
                            {lead.total_lead_score} / 100
                          </span>
                          <span className="text-muted-cell" style={{ fontSize: 11 }}>
                            {lead.confidence} Confidence
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="contact-cell">
                          {lead.public_email ? (
                            <div className="contact-row">
                              <MailIcon size={13} color="#10b981" />
                              <span className="contact-text" style={{ fontSize: 12 }}>{lead.public_email}</span>
                              <button
                                className="btn-copy-mini"
                                onClick={() => copyToClipboard(lead.public_email, `em-${lead.id}`, "Email")}
                              >
                                {copiedKey === `em-${lead.id}` ? <CheckIcon size={11} color="#10b981" /> : <CopyIcon size={11} />}
                              </button>
                            </div>
                          ) : (
                            <span className="text-muted-cell">No email listed</span>
                          )}

                          {lead.public_phone && (
                            <div className="contact-row">
                              <PhoneIcon size={13} color="#06b6d4" />
                              <span className="contact-text" style={{ fontSize: 12 }}>{lead.public_phone}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td>
                        <select
                          className="table-sort-select"
                          value={lead.lead_status || "New"}
                          onChange={(e) => handleStageChange(lead.id, e.target.value)}
                        >
                          {CRM_STAGES.filter((s) => s !== "All").map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            className="btn-view-lead"
                            onClick={() => {
                              setSelectedLead(lead);
                              setLeadNotes(lead.notes || "");
                            }}
                            title="Inspect Evidence & Notes"
                          >
                            <EyeIcon size={14} />
                          </button>
                          <button
                            className="btn-copy-mini"
                            style={{ color: "#f43f5e" }}
                            onClick={() => handleDeleteLead(lead.id)}
                            title="Delete Lead"
                          >
                            <UserXIcon size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View for Small Screens */}
          <div className="mobile-cards-view">
            {leads.map((lead) => {
              const isHot = lead.total_lead_score >= 80;
              const isHigh = lead.total_lead_score >= 65 && lead.total_lead_score < 80;

              return (
                <div key={lead.id} className="mobile-lead-card glass-panel animate-slide-up">
                  <div className="mobile-card-top-row">
                    <div className="mobile-lead-info">
                      <h4 className="mobile-lead-title">{lead.full_name}</h4>
                      <span className="lead-category-badge">{lead.job_title || lead.profession}</span>
                      {lead.company && (
                        <span className="text-muted-cell" style={{ fontSize: 12 }}>
                          {lead.company}
                        </span>
                      )}
                    </div>

                    <div className="mobile-score-box">
                      <span className="mobile-score-val">{lead.total_lead_score}</span>
                      <span className={`score-tier-tag ${isHot ? "tier-hot" : isHigh ? "tier-high" : "tier-potential"}`}>
                        {lead.score_category || (isHot ? "HOT" : "QUALIFIED")}
                      </span>
                    </div>
                  </div>

                  <div className="mobile-location-tag">
                    <GlobeIcon size={13} color="#06b6d4" />
                    <span>{lead.current_city ? `${lead.current_city}, ` : ""}{lead.current_country}</span>
                  </div>

                  {/* Contact Links */}
                  <div className="mobile-contact-actions">
                    {lead.public_phone && (
                      <a href={`tel:${lead.public_phone}`} className="mobile-action-pill pill-phone">
                        <PhoneIcon size={13} />
                        <span>Call {lead.public_phone}</span>
                      </a>
                    )}

                    {lead.public_email && (
                      <div className="mobile-action-pill pill-email">
                        <MailIcon size={13} />
                        <a href={`mailto:${lead.public_email}`} className="mobile-email-link">{lead.public_email}</a>
                        <button
                          className="btn-copy-mini"
                          onClick={() => copyToClipboard(lead.public_email, `m-em-${lead.id}`, "Email")}
                        >
                          {copiedKey === `m-em-${lead.id}` ? <CheckIcon size={11} color="#10b981" /> : <CopyIcon size={11} />}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Stage Switcher and Action Buttons */}
                  <div className="mobile-card-bottom-bar">
                    <div className="mobile-stage-select-wrap">
                      <span className="mobile-stage-label">Stage:</span>
                      <select
                        className="custom-select mobile-select-sm"
                        value={lead.lead_status || "New"}
                        onChange={(e) => handleStageChange(lead.id, e.target.value)}
                      >
                        {CRM_STAGES.filter((s) => s !== "All").map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    <div className="mobile-card-btn-group">
                      <button
                        className="btn-view-lead"
                        onClick={() => {
                          setSelectedLead(lead);
                          setLeadNotes(lead.notes || "");
                        }}
                      >
                        <EyeIcon size={14} />
                        <span>Details</span>
                      </button>
                      <button
                        className="btn-copy-mini"
                        style={{ color: "#f43f5e", padding: "6px 8px" }}
                        onClick={() => handleDeleteLead(lead.id)}
                      >
                        <UserXIcon size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="pagination-bar">
            <span className="pagination-info">Showing {leads.length} of {totalLeads} leads</span>
            <div className="pagination-buttons">
              <button
                className="btn-pagination"
                onClick={() => fetchLeads(page - 1)}
                disabled={page <= 1 || loading}
              >
                <ArrowLeftIcon size={14} /> Previous
              </button>
              <span className="page-current-indicator">{page}</span>
              <button
                className="btn-pagination"
                onClick={() => fetchLeads(page + 1)}
                disabled={page * 25 >= totalLeads || loading}
              >
                Next <ArrowRightIcon size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Lead Inspector Modal */}
        {selectedLead && (
          <div className="modal-overlay animate-fade-in" onClick={() => setSelectedLead(null)}>
            <div className="modal-lead-card glass-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 650 }}>
              <div className="modal-header">
                <div>
                  <h3 className="modal-lead-name">{selectedLead.full_name}</h3>
                  <span className="lead-category-badge">{selectedLead.job_title || selectedLead.profession}</span>
                </div>
                <button className="modal-close-btn" onClick={() => setSelectedLead(null)}>✕</button>
              </div>

              <div className="modal-body" style={{ maxHeight: "70vh", overflowY: "auto" }}>
                {/* Score Breakdown Bar */}
                <div className="modal-rating-card" style={{ background: "rgba(16, 185, 129, 0.08)", borderColor: "rgba(16, 185, 129, 0.3)" }}>
                  <div>
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Total Score:</span>
                    <strong style={{ fontSize: 22, color: "#10b981", marginLeft: 8 }}>{selectedLead.total_lead_score}/100</strong>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)", marginLeft: 6 }}>({selectedLead.confidence} Confidence)</span>
                  </div>
                  <span className="score-tier-tag tier-hot">{selectedLead.score_category}</span>
                </div>

                {/* Evidence List */}
                <div className="modal-field-item mt-2">
                  <span className="modal-field-label">
                    <ShieldCheckIcon size={15} color="#10b981" /> Verified Evidence Signals:
                  </span>
                  <div className="evidence-items-list" style={{ marginTop: 8 }}>
                    {(selectedLead.evidence_list || []).map((ev, i) => (
                      <div key={i} className="evidence-item-row">
                        <div className="evidence-points-badge">+{ev.points} pts</div>
                        <div className="evidence-detail-group">
                          <p className="evidence-description">{ev.description}</p>
                          {ev.source_url && (
                            <a href={ev.source_url} target="_blank" rel="noreferrer" className="evidence-source-link">
                              <ExternalLinkIcon size={12} />
                              <span>{ev.source_url}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes & Engagement History */}
                <div className="modal-field-item mt-2">
                  <span className="modal-field-label">Internal Agent Notes &amp; Outreach Log:</span>
                  <textarea
                    rows={3}
                    className="custom-input w-full"
                    placeholder="Add notes about property preferences, investment budget, conversation history..."
                    value={leadNotes}
                    onChange={(e) => setLeadNotes(e.target.value)}
                    style={{ resize: "vertical" }}
                  />
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                    <button className="btn-secondary" onClick={handleSaveNotes}>Save Notes</button>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn-secondary" onClick={() => setSelectedLead(null)}>Close</button>
                {selectedLead.professional_profile_url && (
                  <a href={selectedLead.professional_profile_url} target="_blank" rel="noreferrer" className="btn-primary">
                    <span>View Public Profile</span>
                    <ExternalLinkIcon size={14} />
                  </a>
                )}
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
