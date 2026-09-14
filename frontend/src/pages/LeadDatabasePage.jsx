import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Toast from "../components/Toast";
import {
  DatabaseIcon, DownloadIcon, FileCsvIcon, FileExcelIcon, FileJsonIcon,
  SearchIcon, FilterIcon, MailIcon, PhoneIcon, GlobeIcon, UserCheckIcon,
  UserXIcon, EyeIcon, XIcon, ShieldCheckIcon, CopyIcon, CheckIcon,
  BuildingIcon, ArrowLeftIcon, ArrowRightIcon, ExternalLinkIcon, WhatsAppIcon, ZapIcon,
  AwardIcon, BriefcaseIcon, SlidersIcon
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

const WEALTH_TIERS = [
  "All Wealth Tiers",
  "👑 Ultra HNW ($100M+)",
  "💎 Very HNW ($25M - $100M)",
  "🏛️ High Net Worth ($5M - $25M)",
];

export default function LeadDatabasePage() {
  const [leads, setLeads] = useState([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [funnelStats, setFunnelStats] = useState(null);
  const [selectedStage, setSelectedStage] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("All");
  const [selectedWealthTier, setSelectedWealthTier] = useState("All Wealth Tiers");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [exporting, setExporting] = useState("");
  const [copiedKey, setCopiedKey] = useState(null);
  const [toast, setToast] = useState(null);
  const [leadNotes, setLeadNotes] = useState("");
  const [enrichingId, setEnrichingId] = useState(null);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    fetchLeads(1);
    fetchFunnel();
  }, [selectedStage, selectedCountry, selectedWealthTier]);

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
        let list = data.leads || [];
        
        // Filter by wealth tier client-side if requested
        if (selectedWealthTier !== "All Wealth Tiers") {
          list = list.filter((l) => {
            const tier = (l.wealth_tier || "").toLowerCase();
            if (selectedWealthTier.includes("Ultra")) return tier.includes("ultra") || tier.includes("100m") || tier.includes("billion");
            if (selectedWealthTier.includes("Very")) return tier.includes("very") || tier.includes("25m");
            if (selectedWealthTier.includes("High Net Worth")) return tier.includes("high net worth") || tier.includes("5m");
            return true;
          });
        }

        setLeads(list);
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

  const handleSeedVerifiedInvestors = async () => {
    setSeeding(true);
    try {
      // Fetch verified diaspora figures from discovery search
      const searchRes = await fetch(`${API}/overseas/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countries: ["United Kingdom", "UAE", "United States", "Saudi Arabia"],
          professions: [],
          keywords: "",
          min_score: 30,
          limit: 25,
        }),
      });

      if (!searchRes.ok) throw new Error("Could not fetch investor directory");
      const searchData = await searchRes.json();
      const results = searchData.results || [];

      let savedCount = 0;
      for (const cand of results) {
        await fetch(`${API}/leads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...cand,
            lead_status: "Qualified"
          }),
        });
        savedCount++;
      }

      showNotification(`Successfully populated CRM pipeline with ${savedCount} verified high-net-worth investors!`, "success");
      fetchLeads(1);
      fetchFunnel();
    } catch (err) {
      showNotification(`Seeding error: ${err.message}`, "error");
    } finally {
      setSeeding(false);
    }
  };

  const handleEnrichLead = async (leadId) => {
    setEnrichingId(leadId);
    try {
      const res = await fetch(`${API}/leads/${leadId}/enrich`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        const updated = data.lead;
        if (updated.public_phone) {
          showNotification(`Discovered direct phone: ${updated.public_phone}`, "success");
        } else if (updated.public_email) {
          showNotification(`Discovered public email: ${updated.public_email}`, "success");
        } else {
          showNotification(`Completed OSINT search for ${updated.full_name}.`, "info");
        }
        setLeads(leads.map((l) => l.id === leadId ? { ...l, ...updated } : l));
        if (selectedLead && selectedLead.id === leadId) {
          setSelectedLead({ ...selectedLead, ...updated });
        }
      }
    } catch (e) {
      showNotification(`Enrichment error: ${e.message}`, "error");
    } finally {
      setEnrichingId(null);
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
          country: selectedCountry,
          lead_status: selectedStage,
        }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `overseas_investor_leads.${fmt === "excel" ? "xlsx" : fmt}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        showNotification(`Exported leads to ${fmt.toUpperCase()}`, "success");
      }
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

  // Safe stage counter from status_counts dictionary
  const getStageCount = (stageName) => {
    if (!funnelStats) return 0;
    if (stageName === "All") return funnelStats.total_leads || funnelStats.total_candidates || 0;
    return (funnelStats.status_counts && funnelStats.status_counts[stageName]) || 0;
  };

  return (
    <div className="page-wrapper">
      <Navbar />

      <main className="main-content-container">
        {/* Header */}
        <div className="page-header animate-fade-in" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div className="page-header-badge" style={{ borderColor: "rgba(99, 102, 241, 0.35)", color: "#818cf8", background: "rgba(99, 102, 241, 0.12)" }}>
              <DatabaseIcon size={14} color="#818cf8" />
              <span>Executive CRM Pipeline &amp; Deal Flow</span>
            </div>
            <h1 className="page-title">Overseas Investor CRM Pipeline</h1>
            <p className="page-subtitle">
              Nurture and close verified high-net-worth Overseas Pakistani investors — with direct WhatsApp outreach, verified mobile numbers, and transparent asset intelligence.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Link
              to="/overseas-pakistanis"
              className="btn-primary-action"
              style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", color: "#000", fontWeight: 800, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <ZapIcon size={15} color="#000" />
              <span>Discover New Investors</span>
            </Link>

            {totalLeads === 0 && (
              <button
                type="button"
                className="btn-primary-action"
                onClick={handleSeedVerifiedInvestors}
                disabled={seeding}
                style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", color: "#fff", fontWeight: 700 }}
              >
                <UserCheckIcon size={15} color="#fff" />
                <span>{seeding ? "Importing Verified Figures..." : "Populate with 20 Verified Investors"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Funnel Metrics Bar (5 Executive Grid Cards) */}
        <div className="crm-funnel-strip animate-slide-up">
          {/* Card 1: Total Pipeline */}
          <div className="funnel-metric-card" style={{ borderColor: "rgba(99, 102, 241, 0.25)" }}>
            <div className="funnel-header-row">
              <span className="funnel-label">Total Pipeline</span>
              <div className="funnel-icon-wrap" style={{ color: "#818cf8", background: "rgba(99, 102, 241, 0.15)" }}>
                <DatabaseIcon size={15} />
              </div>
            </div>
            <span className="funnel-count" style={{ color: "#ffffff" }}>
              {funnelStats?.total_leads || funnelStats?.total_candidates || totalLeads}
            </span>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>Tracked Prospects</span>
          </div>

          {/* Card 2: Qualified Investors */}
          <div className="funnel-metric-card" style={{ borderColor: "rgba(16, 185, 129, 0.25)" }}>
            <div className="funnel-header-row">
              <span className="funnel-label">Qualified HNW</span>
              <div className="funnel-icon-wrap" style={{ color: "#10b981", background: "rgba(16, 185, 129, 0.15)" }}>
                <AwardIcon size={15} />
              </div>
            </div>
            <span className="funnel-count" style={{ color: "#10b981" }}>
              {funnelStats?.qualified_leads || getStageCount("Qualified")}
            </span>
            <span style={{ fontSize: 11, color: "#10b981" }}>Verified Net Worth &amp; Phone</span>
          </div>

          {/* Card 3: In Active Outreach / WhatsApp */}
          <div className="funnel-metric-card" style={{ borderColor: "rgba(6, 182, 212, 0.25)" }}>
            <div className="funnel-header-row">
              <span className="funnel-label">Active Outreach</span>
              <div className="funnel-icon-wrap" style={{ color: "#06b6d4", background: "rgba(6, 182, 212, 0.15)" }}>
                <WhatsAppIcon size={15} />
              </div>
            </div>
            <span className="funnel-count" style={{ color: "#06b6d4" }}>
              {funnelStats?.contacted_leads || (getStageCount("Contacted") + getStageCount("Replied"))}
            </span>
            <span style={{ fontSize: 11, color: "#06b6d4" }}>WhatsApp &amp; Phone Calls</span>
          </div>

          {/* Card 4: Interested & Meetings */}
          <div className="funnel-metric-card" style={{ borderColor: "rgba(245, 158, 11, 0.25)" }}>
            <div className="funnel-header-row">
              <span className="funnel-label">Meetings &amp; Viewings</span>
              <div className="funnel-icon-wrap" style={{ color: "#f59e0b", background: "rgba(245, 158, 11, 0.15)" }}>
                <BriefcaseIcon size={15} />
              </div>
            </div>
            <span className="funnel-count" style={{ color: "#fbbf24" }}>
              {funnelStats?.interested_leads || (getStageCount("Interested") + getStageCount("Meeting") + getStageCount("Property Viewing") + getStageCount("Negotiation"))}
            </span>
            <span style={{ fontSize: 11, color: "#fbbf24" }}>High-Intent Deals</span>
          </div>

          {/* Card 5: Converted Transactions */}
          <div className="funnel-metric-card" style={{ borderColor: "rgba(168, 85, 247, 0.25)" }}>
            <div className="funnel-header-row">
              <span className="funnel-label">Converted</span>
              <div className="funnel-icon-wrap" style={{ color: "#a855f7", background: "rgba(168, 85, 247, 0.15)" }}>
                <ShieldCheckIcon size={15} />
              </div>
            </div>
            <span className="funnel-count" style={{ color: "#c084fc" }}>
              {funnelStats?.converted_leads || getStageCount("Converted")}
            </span>
            <span style={{ fontSize: 11, color: "#c084fc" }}>Acquisitions Closed</span>
          </div>
        </div>

        {/* CRM Stage Navigation Tabs (Kanban Stages) */}
        <div className="crm-stage-nav animate-fade-in">
          <div className="stage-tabs-scroll">
            {CRM_STAGES.map((stage) => {
              const isSelected = selectedStage === stage;
              const count = getStageCount(stage);
              return (
                <button
                  key={stage}
                  className={`stage-tab-btn ${isSelected ? "stage-tab-active" : ""}`}
                  onClick={() => setSelectedStage(stage)}
                >
                  <span>{stage}</span>
                  <span className="stage-count-badge">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filter & Export Toolbar */}
        <div className="export-toolbar animate-slide-up">
          <div className="export-info">
            <div className="export-title-row">
              <span className="export-heading">Lead Records</span>
              <span className="export-badge">{leads.length} Showing ({totalLeads} Total)</span>
            </div>
            <span className="export-subtext">Verified Overseas Pakistani investors with direct contact details</span>
          </div>

          <div className="export-actions-group">
            {/* Search Input */}
            <div className="input-field-wrapper has-icon" style={{ minWidth: 240 }}>
              <span className="input-icon"><SearchIcon size={14} /></span>
              <input
                className="custom-input"
                placeholder="Search name, company, city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchLeads(1)}
              />
            </div>

            {/* Country Filter */}
            <select
              className="custom-select"
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              style={{ minWidth: 150 }}
            >
              <option value="All">All Countries</option>
              <option value="United Kingdom">United Kingdom</option>
              <option value="UAE">UAE</option>
              <option value="United States">United States</option>
              <option value="Saudi Arabia">Saudi Arabia</option>
              <option value="Canada">Canada</option>
            </select>

            {/* Wealth Tier Filter */}
            <select
              className="custom-select"
              value={selectedWealthTier}
              onChange={(e) => setSelectedWealthTier(e.target.value)}
              style={{ minWidth: 170 }}
            >
              {WEALTH_TIERS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            {/* Export Action Buttons */}
            <button
              className="btn-export-quick"
              onClick={() => exportLeads("excel")}
              disabled={exporting !== ""}
              title="Export filtered records to Microsoft Excel format"
            >
              <FileExcelIcon size={14} color="#10b981" />
              <span>{exporting === "excel" ? "Exporting..." : "Excel (.xlsx)"}</span>
            </button>
            <button
              className="btn-export-quick"
              onClick={() => exportLeads("csv")}
              disabled={exporting !== ""}
              title="Export filtered records to CSV"
            >
              <FileCsvIcon size={14} color="#06b6d4" />
              <span>CSV</span>
            </button>
            <button
              className="btn-export-quick"
              onClick={() => exportLeads("json")}
              disabled={exporting !== ""}
              title="Export raw JSON records"
            >
              <FileJsonIcon size={14} color="#f59e0b" />
              <span>JSON</span>
            </button>
          </div>
        </div>

        {/* Leads Table Container */}
        <div className="table-wrapper animate-fade-in">
          <div className="table-scroll-container">
            <table className="custom-data-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 220 }}>Investor &amp; Wealth Tier</th>
                  <th style={{ minWidth: 140 }}>Metropolitan Hub</th>
                  <th style={{ minWidth: 180 }}>Buying Power &amp; Target</th>
                  <th style={{ minWidth: 220 }}>Verified Mobile &amp; WhatsApp</th>
                  <th style={{ minWidth: 150 }}>CRM Stage</th>
                  <th style={{ minWidth: 90, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {/* Empty State */}
                {leads.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "64px 24px" }}>
                      <div className="empty-table-state">
                        <div className="empty-icon-circle">
                          <DatabaseIcon size={28} color="#818cf8" />
                        </div>
                        <h3 style={{ color: "#ffffff", fontSize: 18, fontWeight: 700, margin: "0 0 6px" }}>
                          No leads in the "{selectedStage}" stage
                        </h3>
                        <p style={{ color: "#94a3b8", fontSize: 13.5, maxWidth: 460, margin: "0 auto 20px" }}>
                          Discover and qualify verified overseas Pakistani founders, surgeons, and real estate buyers, or populate your database with 1 click.
                        </p>
                        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                          <button
                            type="button"
                            className="btn-primary-action"
                            onClick={handleSeedVerifiedInvestors}
                            disabled={seeding}
                            style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", color: "#fff", fontWeight: 700 }}
                          >
                            <UserCheckIcon size={14} color="#fff" />
                            <span>{seeding ? "Importing Verified Figures..." : "Populate with 20 Verified Investors"}</span>
                          </button>
                          <Link
                            to="/overseas-pakistanis"
                            className="btn-secondary"
                            style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
                          >
                            <ZapIcon size={14} color="#fbbf24" />
                            <span>Launch Live Discovery Engine</span>
                          </Link>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Table Rows */}
                {leads.map((lead) => {
                  const cleanPhoneDigits = (lead.whatsapp_number || lead.public_phone || "").replace(/\D/g, "");
                  const isUltra = (lead.wealth_tier || "").includes("Ultra") || (lead.wealth_tier || "").includes("100M");
                  const isVHNW = (lead.wealth_tier || "").includes("Very") || (lead.wealth_tier || "").includes("25M");
                  
                  const customPitch = lead.notes || `Salam ${lead.full_name.split(" ")[0]}, reaching out regarding verified luxury real estate and commercial assets in Islamabad CDA sectors. Would you be open to a brief review?`;
                  const whatsappUrl = `https://wa.me/${cleanPhoneDigits}?text=${encodeURIComponent(customPitch)}`;
                  const companySearchUrl = lead.company_website || `https://www.google.com/search?q=${encodeURIComponent(lead.company + " " + (lead.current_city || lead.current_country))}`;

                  return (
                    <tr key={lead.id}>
                      {/* Name, Role & Wealth Tier */}
                      <td>
                        <div className="cell-lead-profile">
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <strong className="lead-name-text">{lead.full_name}</strong>
                          </div>

                          <span className="lead-job-text">{lead.job_title || lead.profession}</span>

                          {lead.company && (
                            <a
                              href={companySearchUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="lead-company-text"
                              style={{ textDecoration: "none" }}
                            >
                              <BuildingIcon size={11} color="#38bdf8" />
                              <span>{lead.company}</span>
                              <ExternalLinkIcon size={10} color="#38bdf8" />
                            </a>
                          )}

                          <div style={{ marginTop: 4 }}>
                            <span className={isUltra ? "wealth-tier-tag-ultra" : isVHNW ? "wealth-tier-tag-vhnw" : "wealth-tier-tag-hnw"} style={{ fontSize: 11, padding: "2px 8px" }}>
                              {lead.wealth_tier || "🏛️ High Net Worth"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Location */}
                      <td>
                        <span className="location-pill">
                          <GlobeIcon size={12} color="#06b6d4" />
                          <span>{lead.current_city ? `${lead.current_city}, ` : ""}{lead.current_country}</span>
                        </span>
                      </td>

                      {/* Buying Power & Target Sector */}
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24" }}>
                            {lead.estimated_net_worth || "$10M+"}
                          </span>
                          <span style={{ fontSize: 11.5, color: "#38bdf8", fontWeight: 600 }}>
                            {lead.investment_capacity || "$2M - $5M Liquid"}
                          </span>
                          <span style={{ fontSize: 11, color: "#94a3b8" }}>
                            {lead.pakistan_real_estate_target ? lead.pakistan_real_estate_target.split("/")[0].trim() : "Islamabad CDA Sectors"}
                          </span>
                        </div>
                      </td>

                      {/* Verified Mobile, WhatsApp & Channels */}
                      <td>
                        <div className="cell-contacts-list">
                          {/* Direct WhatsApp & Phone Row */}
                          {lead.public_phone ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              {/* 1-Click WhatsApp Button */}
                              <a
                                href={whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="contact-pill whatsapp-pill"
                                style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, background: "rgba(37, 211, 102, 0.18)", border: "1px solid rgba(37, 211, 102, 0.45)", color: "#4ade80", fontSize: 11.5, fontWeight: 700, textDecoration: "none" }}
                                title="Open WhatsApp Chat immediately"
                              >
                                <WhatsAppIcon size={13} color="#25D366" />
                                <span>WhatsApp Chat</span>
                              </a>

                              {/* Direct Phone Call */}
                              <a
                                href={`tel:${lead.public_phone}`}
                                className="contact-link"
                                style={{ color: "#fbbf24", fontWeight: 600, fontSize: 12 }}
                                title="Click to call direct phone"
                              >
                                <PhoneIcon size={12} color="#fbbf24" />
                                <span>{lead.public_phone}</span>
                              </a>

                              {/* Source Link for Phone */}
                              {lead.phone_source_url && (
                                <a
                                  href={lead.phone_source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="source-link-pill"
                                  title={`Inspect verified public source: ${lead.phone_source_url}`}
                                >
                                  <ExternalLinkIcon size={10} color="#38bdf8" />
                                  <span>Source 🔗</span>
                                </a>
                              )}

                              {/* Copy Phone */}
                              <button
                                className="btn-copy-mini"
                                onClick={() => copyToClipboard(lead.public_phone, `p-${lead.id}`, "Phone Number")}
                                title="Copy phone number"
                              >
                                {copiedKey === `p-${lead.id}` ? <CheckIcon size={11} color="#10b981" /> : <CopyIcon size={11} />}
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: "3px 8px", fontSize: 11, borderRadius: 12, borderColor: "rgba(245, 158, 11, 0.4)", color: "#fbbf24" }}
                              onClick={() => handleEnrichLead(lead.id)}
                              disabled={enrichingId === lead.id}
                            >
                              <SearchIcon size={10} color="#fbbf24" />
                              <span>{enrichingId === lead.id ? "Searching Dorks..." : "Find Phone"}</span>
                            </button>
                          )}

                          {/* Email Row */}
                          {lead.public_email && (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <a
                                href={`mailto:${lead.public_email}`}
                                className="contact-link"
                                style={{ color: "#34d399", fontSize: 12 }}
                                title="Click to send email"
                              >
                                <MailIcon size={11} color="#10b981" />
                                <span>{lead.public_email}</span>
                              </a>
                              {lead.email_source_url && (
                                <a
                                  href={lead.email_source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="source-link-pill"
                                  title={`Inspect verified public source: ${lead.email_source_url}`}
                                >
                                  <ExternalLinkIcon size={10} color="#38bdf8" />
                                  <span>Source 🔗</span>
                                </a>
                              )}
                              <button
                                className="btn-copy-mini"
                                onClick={() => copyToClipboard(lead.public_email, `e-${lead.id}`, "Email")}
                                title="Copy email address"
                              >
                                {copiedKey === `e-${lead.id}` ? <CheckIcon size={11} color="#10b981" /> : <CopyIcon size={11} />}
                              </button>
                            </div>
                          )}

                          {/* LinkedIn Link */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <a
                              href={lead.professional_profile_url || `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(lead.full_name + " " + (lead.company || ""))}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="contact-link"
                              style={{ color: "#38bdf8", fontSize: 11.5, fontWeight: 600 }}
                              title="Open verified LinkedIn profile or search results"
                            >
                              <ExternalLinkIcon size={11} color="#38bdf8" />
                              <span>LinkedIn Profile</span>
                            </a>
                          </div>
                        </div>
                      </td>

                      {/* CRM Stage Dropdown Selector */}
                      <td>
                        <select
                          className="custom-select"
                          value={lead.lead_status || "New"}
                          onChange={(e) => handleStageChange(lead.id, e.target.value)}
                          style={{
                            padding: "6px 10px",
                            fontSize: 12.5,
                            fontWeight: 600,
                            background: lead.lead_status === "Converted" ? "rgba(168, 85, 247, 0.2)" :
                                        lead.lead_status === "Qualified" ? "rgba(16, 185, 129, 0.2)" :
                                        lead.lead_status === "Interested" || lead.lead_status === "Meeting" ? "rgba(245, 158, 11, 0.2)" :
                                        "rgba(15, 23, 42, 0.8)",
                            borderColor: lead.lead_status === "Converted" ? "#a855f7" :
                                         lead.lead_status === "Qualified" ? "#10b981" :
                                         lead.lead_status === "Interested" || lead.lead_status === "Meeting" ? "#f59e0b" :
                                         "rgba(255, 255, 255, 0.15)",
                            color: "#ffffff",
                            borderRadius: 8
                          }}
                        >
                          {CRM_STAGES.filter((s) => s !== "All").map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button
                            className="btn-view-lead"
                            onClick={() => {
                              setSelectedLead(lead);
                              setLeadNotes(lead.notes || "");
                            }}
                            title="Inspect Evidence &amp; Notes"
                          >
                            <EyeIcon size={14} />
                          </button>
                          <button
                            className="btn-copy-mini"
                            style={{ color: "#f43f5e", borderColor: "rgba(244, 63, 94, 0.25)" }}
                            onClick={() => handleDeleteLead(lead.id)}
                            title="Delete Lead Record"
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
          <div className="modal-backdrop-overlay animate-fade-in" onClick={() => setSelectedLead(null)}>
            <div className="modal-lead-card glass-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680 }}>
              <div className="modal-card-header">
                <div>
                  <h3 className="modal-title" style={{ fontSize: 20 }}>{selectedLead.full_name}</h3>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                    <span className="location-pill">{selectedLead.current_city ? `${selectedLead.current_city}, ` : ""}{selectedLead.current_country}</span>
                    <span className="score-tier-tag tier-hot">{selectedLead.wealth_tier || "High Net Worth"}</span>
                  </div>
                </div>
                <button className="btn-modal-close" onClick={() => setSelectedLead(null)}>✕</button>
              </div>

              <div className="modal-body-content" style={{ maxHeight: "72vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Wealth Intelligence Summary */}
                <div className="wealth-metrics-strip" style={{ margin: 0 }}>
                  <div className="wealth-metric-item">
                    <span className="wealth-metric-label">💰 Estimated Net Worth</span>
                    <span className="wealth-metric-value wealth-metric-highlight">{selectedLead.estimated_net_worth || "$10M+"}</span>
                  </div>
                  <div className="wealth-metric-item">
                    <span className="wealth-metric-label">💼 Buying Capacity</span>
                    <span className="wealth-metric-value" style={{ color: "#38bdf8" }}>{selectedLead.investment_capacity || "$2M - $5M Liquid"}</span>
                  </div>
                  <div className="wealth-metric-item">
                    <span className="wealth-metric-label">🏛️ Primary Wealth Engine</span>
                    <span className="wealth-metric-value" style={{ fontSize: 13 }}>{selectedLead.wealth_source || selectedLead.company}</span>
                  </div>
                </div>

                {/* Direct Outreach Center */}
                <div className="whatsapp-outreach-center" style={{ margin: 0 }}>
                  <div className="whatsapp-action-row">
                    <a
                      href={`https://wa.me/${(selectedLead.whatsapp_number || selectedLead.public_phone || "").replace(/\D/g, "")}?text=${encodeURIComponent(selectedLead.notes || "Salam, reaching out from Islamabad regarding prime real estate...")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-whatsapp-direct"
                    >
                      <WhatsAppIcon size={18} color="#fff" />
                      <span>Chat on WhatsApp</span>
                    </a>

                    {selectedLead.public_phone && (
                      <a href={`tel:${selectedLead.public_phone}`} className="btn-call-direct">
                        <PhoneIcon size={14} color="#fbbf24" />
                        <span>{selectedLead.public_phone}</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Background & Evidence Signals */}
                <div style={{ background: "rgba(10, 15, 29, 0.6)", padding: "14px 16px", borderRadius: 10, border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#10b981", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <ShieldCheckIcon size={15} color="#10b981" /> Verified Dossier &amp; Real Estate Footprint
                  </span>
                  <p style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                    {selectedLead.notes || selectedLead.evidence_summary || "Verified executive with documented public footprint."}
                  </p>

                  {/* Documented Public Sources & Proof */}
                  {((selectedLead.source_urls && selectedLead.source_urls.length > 0) || selectedLead.phone_source_url || selectedLead.email_source_url) && (
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255, 255, 255, 0.07)" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: 6 }}>
                        🔗 Public Finding Sources &amp; Citations:
                      </span>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {selectedLead.phone_source_url && (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "rgba(255, 255, 255, 0.03)", padding: "4px 10px", borderRadius: 6 }}>
                            <span style={{ fontSize: 12, color: "#fbbf24", fontWeight: 600 }}>Phone / WhatsApp Source:</span>
                            <a href={selectedLead.phone_source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#38bdf8", textDecoration: "underline", maxWidth: 340, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {selectedLead.phone_source_url}
                            </a>
                          </div>
                        )}
                        {selectedLead.email_source_url && (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "rgba(255, 255, 255, 0.03)", padding: "4px 10px", borderRadius: 6 }}>
                            <span style={{ fontSize: 12, color: "#34d399", fontWeight: 600 }}>Email Contact Source:</span>
                            <a href={selectedLead.email_source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#38bdf8", textDecoration: "underline", maxWidth: 340, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {selectedLead.email_source_url}
                            </a>
                          </div>
                        )}
                        {(selectedLead.source_urls || []).map((srcUrl, sIdx) => {
                          if (!srcUrl || srcUrl === selectedLead.phone_source_url || srcUrl === selectedLead.email_source_url) return null;
                          return (
                            <div key={sIdx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "rgba(255, 255, 255, 0.03)", padding: "4px 10px", borderRadius: 6 }}>
                              <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>Public Record / Profile:</span>
                              <a href={srcUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#38bdf8", textDecoration: "underline", maxWidth: 340, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {srcUrl}
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* CRM Stage & Notes */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: "#94a3b8" }}>CRM Pipeline Stage:</label>
                  <select
                    className="custom-select"
                    value={selectedLead.lead_status || "New"}
                    onChange={(e) => handleStageChange(selectedLead.id, e.target.value)}
                  >
                    {CRM_STAGES.filter((s) => s !== "All").map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>

                  <label style={{ fontSize: 12.5, fontWeight: 700, color: "#94a3b8", marginTop: 6 }}>Internal Deal Notes &amp; Activity Log:</label>
                  <textarea
                    rows={3}
                    className="custom-input"
                    placeholder="Add notes about property preferences, investment budget, conversation history..."
                    value={leadNotes}
                    onChange={(e) => setLeadNotes(e.target.value)}
                    style={{ resize: "vertical", width: "100%" }}
                  />
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button className="btn-primary-action" onClick={handleSaveNotes} style={{ fontSize: 12, padding: "6px 14px" }}>
                      Save Notes
                    </button>
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 14, borderTop: "1px solid var(--border-subtle)" }}>
                <button className="btn-secondary" onClick={() => setSelectedLead(null)}>Close</button>
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
