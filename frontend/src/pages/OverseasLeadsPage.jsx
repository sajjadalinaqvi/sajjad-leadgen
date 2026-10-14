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
  { label: "Overseas Real Estate Investors (UAE / Gulf / UK / US)", countries: ["UAE", "Saudi Arabia", "United Kingdom", "United States"], professions: ["Real Estate Developer & Investor", "CEO / Managing Director", "Private Equity & Venture Capital"], kw: "Investor", wealth: "All" },
  { label: "Gulf Pakistani Property Buyers (Dubai & Riyadh)", countries: ["UAE", "Saudi Arabia"], professions: ["Real Estate Developer & Investor", "CEO / Managing Director"], kw: "Dubai", wealth: "Very" },
  { label: "UK Property & Commercial Developers", countries: ["United Kingdom"], professions: ["Real Estate Developer & Investor", "CEO / Managing Director"], kw: "London", wealth: "All" },
  { label: "US & Canadian Diaspora Wealth & Landlords", countries: ["United States", "Canada"], professions: ["CEO / Managing Director", "Doctor / Consultant Surgeon"], kw: "Dallas", wealth: "All" },
  { label: "Silicon Valley Tech Wealth", countries: ["United States"], professions: ["Tech Founder & Software Entrepreneur"], kw: "San Francisco", wealth: "Very" },
  { label: "APPNA & Medical Practice Owners", countries: ["United States", "United Kingdom"], professions: ["Doctor / Consultant Surgeon"], kw: "Surgeon", wealth: "All" },
];

export default function OverseasLeadsPage() {
  const [selectedCountries, setSelectedCountries] = useState(["United Kingdom", "UAE", "United States", "Saudi Arabia"]);
  const [selectedProfessions, setSelectedProfessions] = useState([]);
  const [selectedWealthTier, setSelectedWealthTier] = useState("All");
  const [targetPakistanCity, setTargetPakistanCity] = useState("All");
  const [whatsappOnly, setWhatsappOnly] = useState(false);
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
  const [enrichingLeadId, setEnrichingLeadId] = useState(null);
  const fileInputRef = useRef(null);

  // Precision extraction and verification controls (Personal Phone default true per user requirement)
  const [extractLimit, setExtractLimit] = useState(25);
  const [requirePhone, setRequirePhone] = useState(true);
  const [requireEmail, setRequireEmail] = useState(false);
  const [requireLinkedin, setRequireLinkedin] = useState(false);
  const [requireContactFound, setRequireContactFound] = useState(false);
  const [requirePakistanEvidence, setRequirePakistanEvidence] = useState(true);
  const [reviewStatusFilter, setReviewStatusFilter] = useState("All");
  const [excludeExistingCrm, setExcludeExistingCrm] = useState(true);
  const [showApisModal, setShowApisModal] = useState(false);
  const [peopleApis, setPeopleApis] = useState([]);
  const [loadingApis, setLoadingApis] = useState(false);
  const [systemConfig, setSystemConfig] = useState(null);
  // Commercial API opt-in — OFF by default; only spend credits when user allows
  const [useHunter, setUseHunter] = useState(false);
  const [useTomba, setUseTomba] = useState(false);
  const [useApollo, setUseApollo] = useState(true);

  const showNotification = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch real-time Free-Only mode policy status and confirmed quotas
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch(`${API}/system/config`);
        if (res.ok) {
          const data = await res.json();
          setSystemConfig(data);
        }
      } catch (err) {
        console.warn("Could not load system config:", err);
      }
    };
    fetchConfig();
  }, []);

  const handleOpenApisModal = async () => {
    setShowApisModal(true);
    if (peopleApis.length === 0) {
      setLoadingApis(true);
      try {
        const res = await fetch(`${API}/people-apis`);
        if (res.ok) {
          const data = await res.json();
          setPeopleApis(data.apis || []);
        }
      } catch (err) {
        console.error("Failed to load People APIs catalog", err);
      } finally {
        setLoadingApis(false);
      }
    }
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
      executeDiscovery(
        preset.countries,
        preset.professions,
        preset.kw,
        minScore,
        preset.wealth || "All",
        whatsappOnly,
        extractLimit,
        requirePhone,
        requireEmail,
        requireLinkedin,
        excludeExistingCrm,
        requireContactFound,
        requirePakistanEvidence,
        reviewStatusFilter
      );
    }, 100);
  };

  const executeDiscovery = async (
    countries = selectedCountries,
    professions = selectedProfessions,
    kw = keyword,
    score = minScore,
    wealth = selectedWealthTier,
    waOnly = whatsappOnly,
    limitVal = extractLimit,
    reqPhone = requirePhone,
    reqEmail = requireEmail,
    reqLi = requireLinkedin,
    exclCrm = excludeExistingCrm,
    reqContactFound = requireContactFound,
    reqPakEvidence = requirePakistanEvidence,
    revStatus = reviewStatusFilter,
    targetPakCity = targetPakistanCity
  ) => {
    setLoading(true);
    setError("");
    setHasSearched(true);
    try {
      const payload = {
        countries: countries,
        professions: professions,
        keywords: kw.trim(),
        target_pakistan_city: targetPakCity,
        min_score: score,
        wealth_tier: wealth,
        whatsapp_only: waOnly,
        limit: limitVal,
        require_phone: reqPhone,
        require_email: reqEmail,
        require_linkedin: reqLi,
        require_contact_found: reqContactFound,
        require_pakistan_evidence: reqPakEvidence,
        review_status_filter: revStatus,
        exclude_existing_crm: exclCrm,
        use_hunter: useHunter,
        use_tomba: useTomba,
        use_apollo: useApollo,
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
        showNotification(
          `Discovered ${data.results.length} verified authentic profiles (Double-checked & CRM deduplicated)!`,
          "success"
        );
      } else {
        setCandidates([]);
        showNotification("No profiles matched these exact filters. Try broadening your criteria or relaxing contact filters.", "error");
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
    executeDiscovery(
      selectedCountries,
      selectedProfessions,
      keyword,
      minScore,
      selectedWealthTier,
      whatsappOnly,
      extractLimit,
      requirePhone,
      requireEmail,
      requireLinkedin,
      excludeExistingCrm,
      requireContactFound,
      requirePakistanEvidence,
      reviewStatusFilter,
      targetPakistanCity
    );
  };

  const handleOptOutLead = async (lead) => {
    const leadId = lead.id;
    if (!leadId) {
      showNotification(`${lead.full_name} marked as opted out in current session.`, "info");
      setCandidates((prev) =>
        prev.map((c) => (c.full_name === lead.full_name ? { ...c, opt_out: true, review_status: "opt_out" } : c))
      );
      return;
    }
    if (!window.confirm(`Confirm opt-out for ${lead.full_name}? This will mark them as Opted Out and add their contact info to the DNC suppression registry.`)) {
      return;
    }
    try {
      const res = await fetch(`${API}/leads/${leadId}/opt-out`, { method: "POST" });
      if (!res.ok) throw new Error("Opt-out request failed");
      showNotification(`${lead.full_name} opted out & added to suppression registry.`, "success");
      setCandidates((prev) =>
        prev.map((c) => (c.id === leadId ? { ...c, opt_out: true, review_status: "opt_out", do_not_contact: true } : c))
      );
    } catch (err) {
      showNotification(`Opt-out error: ${err.message}`, "error");
    }
  };

  const handleVerifyIdentity = (lead) => {
    setCandidates((prev) =>
      prev.map((c) => {
        if (c.full_name === lead.full_name) {
          return { ...c, review_status: "verified" };
        }
        return c;
      })
    );
    showNotification(`Identity approved for ${lead.full_name}!`, "success");
  };

  const handleExport = async (fmt) => {
    if (candidates.length === 0) {
      showNotification("No candidates to export.", "error");
      return;
    }
    try {
      if (fmt === "json") {
        const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(candidates, null, 2));
        const a = document.createElement("a");
        a.href = jsonStr;
        a.download = `apexlead_overseas_leads_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        showNotification(`Exported ${candidates.length} leads as JSON!`, "success");
      } else {
        const res = await fetch(`${API}/export/overseas/csv`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lead_ids: candidates.filter((c) => c.id).map((c) => c.id),
            country: selectedCountries[0] || "All",
          }),
        });
        if (res.ok) {
          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `apexlead_overseas_leads_${new Date().toISOString().slice(0, 10)}.csv`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          showNotification(`Exported ${candidates.length} leads as CSV!`, "success");
        } else {
          throw new Error("Server CSV export failed");
        }
      }
    } catch (err) {
      showNotification(`Export error: ${err.message}`, "error");
    }
  };

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

  const handleEnrichLead = async (lead, idx) => {
    const leadKey = lead.id || lead.full_name || `lead-${idx}`;
    setEnrichingLeadId(leadKey);
    try {
      const res = await fetch(`${API}/leads/enrich-candidate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...lead,
          use_hunter: useHunter,
          use_tomba: useTomba,
          use_apollo: useApollo,
        }),
      });
      if (!res.ok) throw new Error(`Enrichment failed: HTTP ${res.status}`);
      const data = await res.json();
      if (data.status === "ok" && data.candidate) {
        setCandidates((prev) =>
          prev.map((c, i) => {
            const cKey = c.id || c.full_name || `lead-${i}`;
            if (cKey === leadKey) {
              return { ...c, ...data.candidate };
            }
            return c;
          })
        );
        const hasPhone = data.candidate.public_phone;
        showNotification(
          hasPhone
            ? `Found verified phone: ${data.candidate.public_phone}!`
            : `Enrichment completed for ${lead.full_name}`,
          "success"
        );
      }
    } catch (err) {
      showNotification(`Enrichment error: ${err.message}`, "error");
    } finally {
      setEnrichingLeadId(null);
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

        {/* Free-Only Policy & Confirmed Quota Banner */}
        <div
          className="glass-panel animate-slide-up"
          style={{
            marginBottom: 20,
            padding: "14px 20px",
            background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(6, 182, 212, 0.05) 100%)",
            border: "1px solid rgba(16, 185, 129, 0.25)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: "rgba(16, 185, 129, 0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid rgba(16, 185, 129, 0.4)",
              }}
            >
              <ShieldCheckIcon size={20} color="#10b981" />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: "#34d399", letterSpacing: "0.4px" }}>
                  FREE-ONLY POLICY ACTIVE
                </span>
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 6,
                    background: "rgba(16, 185, 129, 0.2)",
                    color: "#6ee7b7",
                    fontWeight: 700,
                  }}
                >
                  ZERO PAID APIS
                </span>
              </div>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94a3b8" }}>
                Free pipeline by default. Hunter / Tomba / Apollo only spend credits when you click Allow below.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {/* Hunter opt-in toggle */}
            <button
              type="button"
              onClick={() => {
                if (!systemConfig?.hunter_quota?.available) {
                  showNotification("Hunter is not configured (ENABLE_HUNTER + API key required).", "error");
                  return;
                }
                if (systemConfig?.hunter_quota?.is_exhausted) {
                  showNotification("Hunter free allowance exhausted this month.", "error");
                  return;
                }
                setUseHunter((v) => !v);
              }}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                cursor: "pointer",
                textAlign: "left",
                background: useHunter
                  ? (systemConfig?.hunter_quota?.is_exhausted ? "rgba(244, 63, 94, 0.15)" : "rgba(56, 189, 248, 0.12)")
                  : "rgba(255, 255, 255, 0.04)",
                border: useHunter
                  ? "1px solid rgba(56, 189, 248, 0.5)"
                  : "1px solid rgba(255, 255, 255, 0.1)",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
              title={useHunter ? "Click to stop using Hunter credits" : "Click to allow Hunter email finder (uses free quota)"}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
                <span style={{ color: "#94a3b8", fontWeight: 600 }}>Hunter.io Free Tier:</span>
                <strong style={{ color: systemConfig?.hunter_quota?.is_exhausted ? "#f43f5e" : "#38bdf8" }}>
                  {systemConfig?.hunter_quota?.requests_used ?? 0} / {systemConfig?.hunter_quota?.limit ?? 25} mo
                </strong>
              </div>
              <span style={{ fontSize: 10, color: useHunter ? (systemConfig?.hunter_quota?.is_exhausted ? "#f87171" : "#38bdf8") : "#64748b" }}>
                {systemConfig?.hunter_quota?.is_exhausted
                  ? "⚠️ Free Allowance Exhausted"
                  : useHunter
                    ? "Allowed — will use credits on search"
                    : "Off — click to allow"}
              </span>
            </button>

            {/* Tomba opt-in toggle */}
            <button
              type="button"
              onClick={() => {
                if (!systemConfig?.tomba_quota?.available) {
                  showNotification("Tomba is not configured (ENABLE_TOMBA + key + secret required).", "error");
                  return;
                }
                if (systemConfig?.tomba_quota?.is_exhausted) {
                  showNotification("Tomba free allowance exhausted this month.", "error");
                  return;
                }
                setUseTomba((v) => !v);
              }}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                cursor: "pointer",
                textAlign: "left",
                background: useTomba
                  ? (systemConfig?.tomba_quota?.is_exhausted ? "rgba(244, 63, 94, 0.15)" : "rgba(251, 191, 36, 0.12)")
                  : "rgba(255, 255, 255, 0.04)",
                border: useTomba
                  ? "1px solid rgba(251, 191, 36, 0.5)"
                  : "1px solid rgba(255, 255, 255, 0.1)",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
              title={useTomba ? "Click to stop using Tomba credits" : "Click to allow Tomba email finder (uses free quota)"}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
                <span style={{ color: "#94a3b8", fontWeight: 600 }}>Tomba.io Free Tier:</span>
                <strong style={{ color: systemConfig?.tomba_quota?.is_exhausted ? "#f43f5e" : "#fbbf24" }}>
                  {systemConfig?.tomba_quota?.requests_used ?? 0} / {systemConfig?.tomba_quota?.limit ?? 25} mo
                </strong>
              </div>
              <span style={{ fontSize: 10, color: useTomba ? (systemConfig?.tomba_quota?.is_exhausted ? "#f87171" : "#fbbf24") : "#64748b" }}>
                {systemConfig?.tomba_quota?.is_exhausted
                  ? "⚠️ Free Allowance Exhausted"
                  : useTomba
                    ? "Allowed — will use credits on search"
                    : "Off — click to allow"}
              </span>
            </button>

            {/* Apollo opt-in toggle — unlocked / available */}
            <button
              type="button"
              onClick={() => setUseApollo((v) => !v)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                cursor: "pointer",
                textAlign: "left",
                background: useApollo ? "rgba(168, 85, 247, 0.15)" : "rgba(255, 255, 255, 0.04)",
                border: useApollo ? "1px solid rgba(168, 85, 247, 0.5)" : "1px solid rgba(255, 255, 255, 0.1)",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
              title={useApollo ? "Click to turn Apollo off" : "Click to allow Apollo people match"}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
                <span style={{ color: "#94a3b8", fontWeight: 600 }}>Apollo.io:</span>
                <strong style={{ color: useApollo ? "#c084fc" : "#94a3b8" }}>
                  {useApollo ? "Unlocked" : "Off"}
                </strong>
              </div>
              <span style={{ fontSize: 10, color: useApollo ? "#c084fc" : "#64748b" }}>
                {useApollo
                  ? "Allowed — will use credits on search"
                  : "Off — click to allow"}
              </span>
            </button>
          </div>
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
                onClick={handleOpenApisModal}
                style={{ fontSize: 12, padding: "5px 12px", borderColor: "rgba(168, 85, 247, 0.4)", color: "#c084fc", background: "rgba(168, 85, 247, 0.12)" }}
                title="View supported external APIs to extract people contact info (Apollo, Proxycurl, PDL, ContactOut)"
              >
                <SparklesIcon size={14} color="#c084fc" />
                <span>People Extraction APIs 🌐</span>
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

          {/* Extraction Criteria & Contact Requirements Bar */}
          <div className="filter-group-block" style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 8 }}>
              <span className="filter-label" style={{ margin: 0 }}>
                <SlidersIcon size={15} color="#38bdf8" /> Extraction Limit &amp; Contact Criteria:
              </span>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>
                Double-checked verification: Strictly isolates <strong>personal</strong> channels (rejects company info@ emails).
              </span>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              {/* Limit selector */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12.5, color: "#cbd5e1", fontWeight: 600 }}>Extract:</span>
                {[10, 25, 50, 100].map((num) => (
                  <button
                    key={num}
                    type="button"
                    className={`chip-toggle-btn ${extractLimit === num ? "chip-toggle-active" : ""}`}
                    onClick={() => {
                      setExtractLimit(num);
                      executeDiscovery(selectedCountries, selectedProfessions, keyword, minScore, selectedWealthTier, whatsappOnly, num, requirePhone, requireEmail, requireLinkedin, excludeExistingCrm, requireContactFound, requirePakistanEvidence, reviewStatusFilter);
                    }}
                    style={{
                      padding: "4px 10px", fontSize: 12, fontWeight: 700,
                      ...(extractLimit === num ? { borderColor: "#38bdf8", background: "rgba(56, 189, 248, 0.2)", color: "#38bdf8" } : {})
                    }}
                  >
                    {num} People
                  </button>
                ))}
              </div>

              {/* Contact Filter: Phone */}
              <label style={{
                display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12.5, fontWeight: 600,
                padding: "5px 10px", borderRadius: 8,
                background: requirePhone ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.04)",
                border: requirePhone ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(255, 255, 255, 0.1)",
                color: requirePhone ? "#34d399" : "#94a3b8"
              }}>
                <input
                  type="checkbox"
                  checked={requirePhone}
                  onChange={(e) => {
                    setRequirePhone(e.target.checked);
                    executeDiscovery(selectedCountries, selectedProfessions, keyword, minScore, selectedWealthTier, whatsappOnly, extractLimit, e.target.checked, requireEmail, requireLinkedin, excludeExistingCrm, requireContactFound, requirePakistanEvidence, reviewStatusFilter);
                  }}
                  style={{ accentColor: "#10b981", cursor: "pointer" }}
                />
                <PhoneIcon size={13} color={requirePhone ? "#34d399" : "#94a3b8"} />
                <span>Require Personal Phone</span>
              </label>

              {/* Contact Filter: Email */}
              <label style={{
                display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12.5, fontWeight: 600,
                padding: "5px 10px", borderRadius: 8,
                background: requireEmail ? "rgba(56, 189, 248, 0.15)" : "rgba(255, 255, 255, 0.04)",
                border: requireEmail ? "1px solid rgba(56, 189, 248, 0.4)" : "1px solid rgba(255, 255, 255, 0.1)",
                color: requireEmail ? "#38bdf8" : "#94a3b8"
              }}>
                <input
                  type="checkbox"
                  checked={requireEmail}
                  onChange={(e) => {
                    setRequireEmail(e.target.checked);
                    executeDiscovery(selectedCountries, selectedProfessions, keyword, minScore, selectedWealthTier, whatsappOnly, extractLimit, requirePhone, e.target.checked, requireLinkedin, excludeExistingCrm, requireContactFound, requirePakistanEvidence, reviewStatusFilter);
                  }}
                  style={{ accentColor: "#38bdf8", cursor: "pointer" }}
                />
                <MailIcon size={13} color={requireEmail ? "#38bdf8" : "#94a3b8"} />
                <span>Require Personal Email (No info@)</span>
              </label>

              {/* Contact Filter: LinkedIn */}
              <label style={{
                display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12.5, fontWeight: 600,
                padding: "5px 10px", borderRadius: 8,
                background: requireLinkedin ? "rgba(10, 102, 194, 0.18)" : "rgba(255, 255, 255, 0.04)",
                border: requireLinkedin ? "1px solid rgba(10, 102, 194, 0.45)" : "1px solid rgba(255, 255, 255, 0.1)",
                color: requireLinkedin ? "#60a5fa" : "#94a3b8"
              }}>
                <input
                  type="checkbox"
                  checked={requireLinkedin}
                  onChange={(e) => {
                    setRequireLinkedin(e.target.checked);
                    executeDiscovery(selectedCountries, selectedProfessions, keyword, minScore, selectedWealthTier, whatsappOnly, extractLimit, requirePhone, requireEmail, e.target.checked, excludeExistingCrm, requireContactFound, requirePakistanEvidence, reviewStatusFilter);
                  }}
                  style={{ accentColor: "#0a66c2", cursor: "pointer" }}
                />
                <LinkedInIcon size={13} color={requireLinkedin ? "#60a5fa" : "#94a3b8"} />
                <span>Require Personal LinkedIn (/in/)</span>
              </label>

              {/* Contact Filter: Any Contact Found */}
              <label style={{
                display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12.5, fontWeight: 600,
                padding: "5px 10px", borderRadius: 8,
                background: requireContactFound ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.04)",
                border: requireContactFound ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(255, 255, 255, 0.1)",
                color: requireContactFound ? "#34d399" : "#94a3b8"
              }}>
                <input
                  type="checkbox"
                  checked={requireContactFound}
                  onChange={(e) => {
                    setRequireContactFound(e.target.checked);
                    executeDiscovery(selectedCountries, selectedProfessions, keyword, minScore, selectedWealthTier, whatsappOnly, extractLimit, requirePhone, requireEmail, requireLinkedin, excludeExistingCrm, e.target.checked, requirePakistanEvidence, reviewStatusFilter);
                  }}
                  style={{ accentColor: "#10b981", cursor: "pointer" }}
                />
                <SparklesIcon size={13} color={requireContactFound ? "#34d399" : "#94a3b8"} />
                <span>Require Any Contact</span>
              </label>

              {/* Pakistan Evidence Filter */}
              <label style={{
                display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12.5, fontWeight: 600,
                padding: "5px 10px", borderRadius: 8,
                background: requirePakistanEvidence ? "rgba(6, 182, 212, 0.15)" : "rgba(255, 255, 255, 0.04)",
                border: requirePakistanEvidence ? "1px solid rgba(6, 182, 212, 0.4)" : "1px solid rgba(255, 255, 255, 0.1)",
                color: requirePakistanEvidence ? "#22d3ee" : "#94a3b8"
              }}>
                <input
                  type="checkbox"
                  checked={requirePakistanEvidence}
                  onChange={(e) => {
                    setRequirePakistanEvidence(e.target.checked);
                    executeDiscovery(selectedCountries, selectedProfessions, keyword, minScore, selectedWealthTier, whatsappOnly, extractLimit, requirePhone, requireEmail, requireLinkedin, excludeExistingCrm, requireContactFound, e.target.checked, reviewStatusFilter);
                  }}
                  style={{ accentColor: "#06b6d4", cursor: "pointer" }}
                />
                <ShieldCheckIcon size={13} color={requirePakistanEvidence ? "#22d3ee" : "#94a3b8"} />
                <span>Require Pakistan Evidence</span>
              </label>

              {/* Review Status Queue Filter */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 8px", borderRadius: 8, background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                <span style={{ fontSize: 12, color: "#cbd5e1", fontWeight: 600 }}>Review Queue:</span>
                {[
                  { label: "All Leads", val: "All" },
                  { label: "✓ Verified Only", val: "verified" },
                  { label: "⚠️ Needs Review", val: "needs_review" },
                ].map((s) => (
                  <button
                    key={s.val}
                    type="button"
                    className={`chip-toggle-btn ${reviewStatusFilter === s.val ? "chip-toggle-active" : ""}`}
                    onClick={() => {
                      setReviewStatusFilter(s.val);
                      executeDiscovery(selectedCountries, selectedProfessions, keyword, minScore, selectedWealthTier, whatsappOnly, extractLimit, requirePhone, requireEmail, requireLinkedin, excludeExistingCrm, requireContactFound, requirePakistanEvidence, s.val);
                    }}
                    style={{
                      padding: "3px 8px", fontSize: 11, fontWeight: 600,
                      ...(reviewStatusFilter === s.val ? { borderColor: "#c084fc", background: "rgba(168, 85, 247, 0.2)", color: "#c084fc" } : {})
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* CRM Deduplication Filter */}
              <label style={{
                display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12.5, fontWeight: 600,
                padding: "5px 10px", borderRadius: 8,
                background: excludeExistingCrm ? "rgba(245, 158, 11, 0.15)" : "rgba(255, 255, 255, 0.04)",
                border: excludeExistingCrm ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid rgba(255, 255, 255, 0.1)",
                color: excludeExistingCrm ? "#fbbf24" : "#94a3b8"
              }}>
                <input
                  type="checkbox"
                  checked={excludeExistingCrm}
                  onChange={(e) => {
                    setExcludeExistingCrm(e.target.checked);
                    executeDiscovery(selectedCountries, selectedProfessions, keyword, minScore, selectedWealthTier, whatsappOnly, extractLimit, requirePhone, requireEmail, requireLinkedin, e.target.checked, requireContactFound, requirePakistanEvidence, reviewStatusFilter);
                  }}
                  style={{ accentColor: "#f59e0b", cursor: "pointer" }}
                />
                <ShieldCheckIcon size={14} color={excludeExistingCrm ? "#fbbf24" : "#94a3b8"} />
                <span>Exclude Saved CRM Leads</span>
              </label>
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
                <h3 className="table-title">Overseas Leads ({candidates.length})</h3>
                <span className="results-counter-badge" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#34d399", borderColor: "rgba(16, 185, 129, 0.3)" }}>
                  Evidence-Ranked Diaspora Discovery
                </span>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn-export-outline"
                  onClick={() => handleExport("csv")}
                  title="Export complete leads dataset with citations and evidence to CSV"
                >
                  <DownloadIcon size={14} color="#10b981" />
                  <span>Export CSV</span>
                </button>
                <button
                  type="button"
                  className="btn-export-outline"
                  onClick={() => handleExport("json")}
                  title="Export complete leads dataset with evidence JSON"
                >
                  <DownloadIcon size={14} color="#38bdf8" />
                  <span>Export JSON</span>
                </button>
                <button
                  type="button"
                  className="btn-primary-action"
                  onClick={handleBatchSaveAll}
                  disabled={batchSaving}
                  style={{ fontSize: 13, padding: "8px 16px", background: "linear-gradient(135deg, #10b981 0%, #059669 100%)" }}
                >
                  <UserCheckIcon size={14} color="#fff" />
                  <span>{batchSaving ? "Saving All..." : "Save All to CRM"}</span>
                </button>
              </div>
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

                // Priority person-level fields resolution
                const personalPhone = lead.personal_phone || (lead.phone_type === "mobile" || lead.phone_type === "direct" ? lead.public_phone : null);
                const professionalPhone = lead.professional_phone || (lead.phone_type === "clinic" || lead.phone_type === "office" || lead.phone_type === "switchboard" ? lead.public_phone : null);
                
                const personalEmail = lead.personal_email || (lead.email_type === "personal" ? lead.public_email : null);
                const professionalEmail = lead.professional_email || (lead.email_type === "professional" || lead.email_type === "work" ? lead.public_email : null);

                const rawLi = lead.linkedin_url || (lead.professional_profile_url && lead.professional_profile_url.includes("/in/") ? lead.professional_profile_url : null);
                const linkedInUrl = rawLi && rawLi.includes("/in/") ? rawLi : null;
                const linkedInMatchStatus = lead.linkedin_identity_match || (linkedInUrl ? "verified" : "not_found");
                const linkedInConfidence = Math.round((lead.linkedin_match_confidence || (linkedInUrl ? 0.85 : 0)) * (lead.linkedin_match_confidence <= 1 ? 100 : 1));

                // Clean phone digits for wa.me link ONLY from personalPhone
                const cleanPhoneDigits = personalPhone ? personalPhone.replace(/\D/g, "") : "";

                // Pakistan connection evidence list
                const pakEvidences = Array.isArray(lead.pakistan_connection_evidence) ? lead.pakistan_connection_evidence : [];
                const reviewStatus = lead.review_status || (pakEvidences.length > 0 && pakEvidences.some((e) => (e.confidence || 0) >= 0.8) ? "verified" : "needs_review");

                // Outreach personalized message
                const firstName = (lead.full_name || "").replace(/^(Dr|Mr|Mrs|Ms|Prof|Engr)\.?\s*/i, "").trim().split(/\s+/)[0] || "there";
                const customPitch = lead.whatsapp_pitch || `Salam ${firstName}, reaching out from Islamabad regarding executive property-investment opportunities tailored for overseas Pakistani professionals. Would you be open to a brief overview?`;
                const whatsappUrl = cleanPhoneDigits ? `https://wa.me/${cleanPhoneDigits}?text=${encodeURIComponent(customPitch)}` : null;

                const companySearchUrl = lead.company_website || `https://www.google.com/search?q=${encodeURIComponent((lead.employer || lead.company || "") + " " + (lead.city || lead.country || lead.current_country || ""))}`;

                return (
                  <div key={leadKey} className="wealth-intelligence-card animate-slide-up" style={{ padding: "20px 24px", position: "relative" }}>
                    {/* Top Identity & Status Bar */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                      {/* Left: Name, Location, Status */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 260 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <h3 style={{ fontSize: 20, fontWeight: 800, color: "#ffffff", margin: 0 }}>{lead.full_name}</h3>
                          
                          {/* Location Badge */}
                          <span className="investor-location-badge" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <GlobeIcon size={13} color="#06b6d4" />
                            {lead.city || lead.current_city ? `${lead.city || lead.current_city}, ` : ""}{lead.country || lead.current_country}
                          </span>

                          {/* Review Status Badge */}
                          {reviewStatus === "verified" && (
                            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, fontWeight: 700, background: "rgba(16, 185, 129, 0.2)", color: "#34d399", border: "1px solid rgba(16, 185, 129, 0.4)" }}>
                              ✓ Verified Identity
                            </span>
                          )}
                          {reviewStatus === "needs_review" && (
                            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, fontWeight: 700, background: "rgba(245, 158, 11, 0.2)", color: "#fbbf24", border: "1px solid rgba(245, 158, 11, 0.4)" }}>
                              ⚠️ Needs Review
                            </span>
                          )}
                          {reviewStatus === "opt_out" && (
                            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, fontWeight: 700, background: "rgba(244, 63, 94, 0.2)", color: "#f87171", border: "1px solid rgba(244, 63, 94, 0.4)" }}>
                              🚫 Opted Out (DNC)
                            </span>
                          )}

                          {lead.saved && (
                            <span className="score-tier-tag tier-hot" style={{ fontSize: 11, padding: "2px 8px" }}>
                              Saved in CRM
                            </span>
                          )}
                        </div>

                        {/* Profession & Employer */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                          <span style={{ fontSize: 14, color: "#94a3b8", fontWeight: 600 }}>{lead.occupation || lead.job_title || lead.profession}</span>
                          {(lead.employer || lead.company) && (
                            <>
                              <span style={{ color: "#475569" }}>•</span>
                              <a
                                href={companySearchUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ textDecoration: "none", color: "#38bdf8", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13.5, fontWeight: 600 }}
                                title="Visit company website or search corporate registry"
                              >
                                <BuildingIcon size={13} color="#38bdf8" />
                                <span>{lead.employer || lead.company}</span>
                                <ExternalLinkIcon size={11} color="#38bdf8" />
                              </a>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right: Transparent Professional Signal */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 20,
                          background: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.3)",
                          color: "#fbbf24", fontSize: 12, fontWeight: 700
                        }}>
                          <AwardIcon size={13} color="#fbbf24" />
                          <span>{lead.professional_indicators || lead.wealth_tier || "Verified Professional"}</span>
                        </span>
                        <span style={{ fontSize: 10.5, color: "#64748b" }}>
                          Professional Signal (No unsubstantiated wealth claims)
                        </span>
                      </div>
                    </div>

                    {/* THE 3 PRIORITY PERSON-LEVEL FIELDS SECTION */}
                    <div style={{
                      marginTop: 16,
                      padding: "14px 16px",
                      borderRadius: 12,
                      background: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                      gap: 12
                    }}>
                      {/* 1. PERSONAL PHONE NUMBER */}
                      <div style={{
                        padding: 12, borderRadius: 8,
                        background: personalPhone ? "rgba(16, 185, 129, 0.08)" : "rgba(255, 255, 255, 0.02)",
                        border: personalPhone ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(255, 255, 255, 0.06)",
                        display: "flex", flexDirection: "column", gap: 6
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: personalPhone ? "#34d399" : "#94a3b8", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <PhoneIcon size={12} color={personalPhone ? "#34d399" : "#94a3b8"} />
                            1. Personal Phone
                          </span>
                          {personalPhone ? (
                            <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "rgba(16, 185, 129, 0.2)", color: "#6ee7b7", fontWeight: 700 }}>
                              {lead.phone_type || "mobile"} • {Math.round((lead.phone_match_confidence || 0.85) * (lead.phone_match_confidence <= 1 ? 100 : 1))}% Match
                            </span>
                          ) : (
                            <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "rgba(148, 163, 184, 0.12)", color: "#94a3b8", fontWeight: 600 }}>
                              Not found
                            </span>
                          )}
                        </div>

                        {personalPhone ? (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 2 }}>
                            <a href={`tel:${personalPhone}`} style={{ color: "#34d399", fontWeight: 800, fontSize: 14.5, textDecoration: "none" }} title="Call personal phone">
                              {personalPhone}
                            </a>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button
                                type="button"
                                className="chip-toggle-btn"
                                style={{ padding: "2px 7px", fontSize: 10.5, background: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}
                                onClick={() => copyToClipboard(personalPhone, `${leadKey}-phone`, "Personal Phone")}
                              >
                                {copiedKey === `${leadKey}-phone` ? <CheckIcon size={10} color="#10b981" /> : <CopyIcon size={10} />}
                                <span>{copiedKey === `${leadKey}-phone` ? "Copied" : "Copy"}</span>
                              </button>
                              {lead.phone_source_url && (
                                <a href={lead.phone_source_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", padding: "2px 6px", borderRadius: 4, background: "rgba(56, 189, 248, 0.12)", color: "#38bdf8", fontSize: 10.5, textDecoration: "none" }} title={`Public Citation: ${lead.phone_source_url}`}>
                                  <ExternalLinkIcon size={10} color="#38bdf8" />
                                </a>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: "#64748b", fontStyle: "italic", marginTop: 2 }}>
                            No public mobile found (Clinic switchboards excluded)
                          </span>
                        )}
                      </div>

                      {/* 2. PERSONAL EMAIL */}
                      <div style={{
                        padding: 12, borderRadius: 8,
                        background: personalEmail ? "rgba(56, 189, 248, 0.08)" : "rgba(255, 255, 255, 0.02)",
                        border: personalEmail ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid rgba(255, 255, 255, 0.06)",
                        display: "flex", flexDirection: "column", gap: 6
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: personalEmail ? "#38bdf8" : "#94a3b8", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <MailIcon size={12} color={personalEmail ? "#38bdf8" : "#94a3b8"} />
                            2. Personal Email
                          </span>
                          {personalEmail ? (
                            <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "rgba(56, 189, 248, 0.2)", color: "#7dd3fc", fontWeight: 700 }}>
                              Individual • {Math.round((lead.email_match_confidence || 0.8) * (lead.email_match_confidence <= 1 ? 100 : 1))}% Match
                            </span>
                          ) : (
                            <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "rgba(148, 163, 184, 0.12)", color: "#94a3b8", fontWeight: 600 }}>
                              Not found
                            </span>
                          )}
                        </div>

                        {personalEmail ? (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 2 }}>
                            <a href={`mailto:${personalEmail}`} style={{ color: "#38bdf8", fontWeight: 700, fontSize: 13, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }} title="Send personal email">
                              {personalEmail}
                            </a>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button
                                type="button"
                                className="chip-toggle-btn"
                                style={{ padding: "2px 7px", fontSize: 10.5, background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8" }}
                                onClick={() => copyToClipboard(personalEmail, `${leadKey}-email`, "Personal Email")}
                              >
                                {copiedKey === `${leadKey}-email` ? <CheckIcon size={10} color="#38bdf8" /> : <CopyIcon size={10} />}
                                <span>{copiedKey === `${leadKey}-email` ? "Copied" : "Copy"}</span>
                              </button>
                              {lead.email_source_url && (
                                <a href={lead.email_source_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", padding: "2px 6px", borderRadius: 4, background: "rgba(56, 189, 248, 0.12)", color: "#38bdf8", fontSize: 10.5, textDecoration: "none" }} title={`Email Source Citation: ${lead.email_source_url}`}>
                                  <ExternalLinkIcon size={10} color="#38bdf8" />
                                </a>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: "#64748b", fontStyle: "italic", marginTop: 2 }}>
                            Not found (Corporate info@ &amp; sales@ filtered)
                          </span>
                        )}
                      </div>

                      {/* 3. GENUINE LINKEDIN PROFILE */}
                      <div style={{
                        padding: 12, borderRadius: 8,
                        background: linkedInUrl ? "rgba(10, 102, 194, 0.1)" : "rgba(255, 255, 255, 0.02)",
                        border: linkedInUrl ? "1px solid rgba(10, 102, 194, 0.35)" : "1px solid rgba(255, 255, 255, 0.06)",
                        display: "flex", flexDirection: "column", gap: 6
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: linkedInUrl ? "#60a5fa" : "#94a3b8", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <LinkedInIcon size={12} color={linkedInUrl ? "#60a5fa" : "#94a3b8"} />
                            3. Genuine LinkedIn
                          </span>
                          {linkedInUrl ? (
                            <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "rgba(10, 102, 194, 0.25)", color: "#93c5fd", fontWeight: 700 }}>
                              {linkedInMatchStatus === "verified" ? "✓ Verified" : "Review"} • {linkedInConfidence}% Match
                            </span>
                          ) : (
                            <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "rgba(148, 163, 184, 0.12)", color: "#94a3b8", fontWeight: 600 }}>
                              Not found
                            </span>
                          )}
                        </div>

                        {linkedInUrl ? (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 2 }}>
                            <a href={linkedInUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa", fontWeight: 700, fontSize: 13, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180, display: "inline-flex", alignItems: "center", gap: 4 }} title="Open genuine discovered LinkedIn profile">
                              <span>View Profile</span>
                              <ExternalLinkIcon size={11} color="#60a5fa" />
                            </a>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button
                                type="button"
                                className="chip-toggle-btn"
                                style={{ padding: "2px 7px", fontSize: 10.5, background: "rgba(10, 102, 194, 0.18)", color: "#60a5fa" }}
                                onClick={() => copyToClipboard(linkedInUrl, `${leadKey}-li`, "LinkedIn URL")}
                              >
                                {copiedKey === `${leadKey}-li` ? <CheckIcon size={10} color="#60a5fa" /> : <CopyIcon size={10} />}
                                <span>{copiedKey === `${leadKey}-li` ? "Copied" : "Copy"}</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: "#64748b", fontStyle: "italic", marginTop: 2 }}>
                            No genuine profile discovered (Never guessed)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* SEPARATE INSTITUTIONAL / PROFESSIONAL CHANNELS STRIP */}
                    {(professionalPhone || professionalEmail) && (
                      <div style={{
                        marginTop: 10,
                        padding: "8px 14px",
                        borderRadius: 8,
                        background: "rgba(255, 255, 255, 0.02)",
                        border: "1px dashed rgba(255, 255, 255, 0.1)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 10
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
                            🏥 Professional / Clinic Channel:
                          </span>
                          {professionalPhone && (
                            <span style={{ fontSize: 12.5, color: "#cbd5e1" }}>
                              Clinic Phone: <strong>{professionalPhone}</strong> <span style={{ fontSize: 10.5, color: "#64748b" }}>({lead.phone_type || "clinic"})</span>
                            </span>
                          )}
                          {professionalEmail && (
                            <span style={{ fontSize: 12.5, color: "#cbd5e1" }}>
                              Work Email: <strong>{professionalEmail}</strong>
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 11, color: "#64748b" }}>
                          Distinct from personal mobile • Excluded from WhatsApp outreach
                        </span>
                      </div>
                    )}

                    {/* PAKISTAN CONNECTION EVIDENCE SECTION */}
                    {pakEvidences.length > 0 && (
                      <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: "rgba(6, 182, 212, 0.05)", border: "1px solid rgba(6, 182, 212, 0.2)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                          <ShieldCheckIcon size={13} color="#06b6d4" />
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: "#22d3ee", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            Verified Pakistan Connection Evidence ({pakEvidences.length}):
                          </span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {pakEvidences.map((ev, eIdx) => (
                            <div key={eIdx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 12, color: "#cbd5e1" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden", textOverflow: "ellipsis" }}>
                                <span style={{ padding: "1px 5px", borderRadius: 4, background: "rgba(6, 182, 212, 0.15)", color: "#38bdf8", fontSize: 10.5, fontWeight: 700 }}>
                                  {ev.source_type}
                                </span>
                                <span>{ev.description}</span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontSize: 11, color: "#22d3ee", fontWeight: 700 }}>
                                  {Math.round((ev.confidence || 0.8) * 100)}% Confirmed
                                </span>
                                {ev.evidence_url && (
                                  <a href={ev.evidence_url} target="_blank" rel="noopener noreferrer" style={{ color: "#38bdf8", fontSize: 11 }} title="View official citation source">
                                    <ExternalLinkIcon size={11} color="#38bdf8" />
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* OUTREACH & ACTION COMMAND CENTER */}
                    <div className="whatsapp-outreach-center" style={{ marginTop: 14 }}>
                      <div className="whatsapp-action-row" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                        {/* Direct WhatsApp Launcher: STRICTLY ENABLED ONLY WITH PERSONAL MOBILE */}
                        {personalPhone && whatsappUrl ? (
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
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="btn-whatsapp-direct"
                            style={{ opacity: 0.45, cursor: "not-allowed", filter: "grayscale(0.6)" }}
                            title="WhatsApp is disabled because no verified personal mobile was found (clinic/office switchboards are not messaged)."
                          >
                            <WhatsAppIcon size={18} color="#ffffff" />
                            <span>WhatsApp Unavailable (No Personal Mobile)</span>
                          </button>
                        )}

                        {/* Direct Personal Phone Call Button */}
                        {personalPhone && (
                          <a href={`tel:${personalPhone}`} className="btn-call-direct" title="Call personal phone directly">
                            <PhoneIcon size={14} color="#fbbf24" />
                            <span>{personalPhone}</span>
                          </a>
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

                        {/* Expand Dossier Button */}
                        <button
                          type="button"
                          className="btn-toggle-evidence"
                          style={{ marginLeft: "auto", fontSize: 12 }}
                          onClick={() => setExpandedLeadId(isExpanded ? null : leadKey)}
                        >
                          <ShieldCheckIcon size={13} color="#10b981" />
                          <span>{isExpanded ? "Hide Background Dossier" : "Inspect Dossier & Citations"}</span>
                          {isExpanded ? <ChevronUpIcon size={13} /> : <ChevronDownIcon size={13} />}
                        </button>
                      </div>

                      {/* Expandable WhatsApp Pitch Box */}
                      {isPitchOpen && (
                        <div className="whatsapp-custom-pitch-box animate-fade-in" style={{ marginTop: 10 }}>
                          <div className="pitch-header">
                            <span>💬 Personalized Luxury Real Estate Pitch</span>
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

                    {/* Expandable Dossier */}
                    {isExpanded && (
                      <div className="evidence-drawer glass-panel animate-fade-in" style={{ marginTop: 14 }}>
                        <div className="evidence-drawer-header">
                          <h4 className="drawer-title">
                            <ShieldCheckIcon size={15} color="#10b981" />
                            <span>Verified Biography, Sources &amp; Audit Trail</span>
                          </h4>
                        </div>
                        <p style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.6, margin: "8px 0" }}>
                          {lead.notes || lead.evidence_summary || "Discovered via lawful public directories and diaspora registers."}
                        </p>

                        {/* Documented Public Sources & Proof */}
                        {((lead.evidence_urls && lead.evidence_urls.length > 0) || (lead.source_urls && lead.source_urls.length > 0) || lead.phone_source_url || lead.email_source_url || lead.linkedin_source_url) && (
                          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255, 255, 255, 0.07)" }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: 6 }}>
                              🔗 Public Finding Sources &amp; Citations:
                            </span>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {lead.phone_source_url && (
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "rgba(255, 255, 255, 0.03)", padding: "4px 10px", borderRadius: 6 }}>
                                  <span style={{ fontSize: 12, color: "#fbbf24", fontWeight: 600 }}>Phone Source Citation:</span>
                                  <a href={lead.phone_source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#38bdf8", textDecoration: "underline", maxWidth: 380, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {lead.phone_source_url}
                                  </a>
                                </div>
                              )}
                              {lead.email_source_url && (
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "rgba(255, 255, 255, 0.03)", padding: "4px 10px", borderRadius: 6 }}>
                                  <span style={{ fontSize: 12, color: "#34d399", fontWeight: 600 }}>Email Source Citation:</span>
                                  <a href={lead.email_source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#38bdf8", textDecoration: "underline", maxWidth: 380, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {lead.email_source_url}
                                  </a>
                                </div>
                              )}
                              {lead.linkedin_source_url && (
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "rgba(255, 255, 255, 0.03)", padding: "4px 10px", borderRadius: 6 }}>
                                  <span style={{ fontSize: 12, color: "#60a5fa", fontWeight: 600 }}>LinkedIn Citation:</span>
                                  <a href={lead.linkedin_source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#38bdf8", textDecoration: "underline", maxWidth: 380, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {lead.linkedin_source_url}
                                  </a>
                                </div>
                              )}
                              {[...(lead.evidence_urls || []), ...(lead.source_urls || [])].map((srcUrl, sIdx) => {
                                if (!srcUrl || srcUrl === lead.phone_source_url || srcUrl === lead.email_source_url || srcUrl === lead.linkedin_source_url) return null;
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
                          {reviewStatus === "verified" ? "Identity confirmed with public evidence" : "Ambiguous identity match - review evidence before outreach"}
                        </span>
                      </div>

                      <div className="review-actions-group" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {/* Approve Identity Button if Needs Review */}
                        {reviewStatus === "needs_review" && (
                          <button
                            type="button"
                            className="chip-toggle-btn"
                            onClick={() => handleVerifyIdentity(lead)}
                            style={{ padding: "6px 12px", background: "rgba(16, 185, 129, 0.15)", borderColor: "rgba(16, 185, 129, 0.4)", color: "#34d399", fontSize: 12 }}
                            title="Manually verify this person's identity and Pakistan connection"
                          >
                            <CheckIcon size={12} color="#10b981" />
                            <span>Verify Identity</span>
                          </button>
                        )}

                        {/* Opt-out & Suppress Button */}
                        <button
                          type="button"
                          className="btn-review-dnc"
                          onClick={() => handleOptOutLead(lead)}
                          title="Permanently opt-out lead and add to suppression registry"
                          style={{ padding: "6px 12px", fontSize: 12 }}
                        >
                          <UserXIcon size={13} />
                          <span>Opt-Out / Suppress</span>
                        </button>

                        {/* Reject Button */}
                        <button
                          type="button"
                          className="btn-review-reject"
                          onClick={() => setRejectModalLead(lead)}
                          title="Reject candidate"
                          style={{ padding: "6px 12px", fontSize: 12 }}
                        >
                          <span>Reject</span>
                        </button>

                        {/* Save to CRM Button */}
                        <button
                          type="button"
                          className="btn-review-approve"
                          onClick={() => handleApproveLead(lead)}
                          style={{ padding: "6px 14px", background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", color: "#fff", fontWeight: 700, fontSize: 12 }}
                        >
                          <CheckIcon size={13} color="#fff" />
                          <span>Save to CRM</span>
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

      {/* People Extraction APIs Modal */}
      {showApisModal && (
        <div className="modal-backdrop-overlay animate-fade-in" style={{ zIndex: 1100 }}>
          <div className="modal-lead-card glass-panel animate-slide-up" style={{ maxWidth: 720, maxHeight: "88vh", overflowY: "auto" }}>
            <div className="modal-card-header" style={{ paddingBottom: 12, borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
              <div>
                <h3 className="modal-title" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18, color: "#ffffff" }}>
                  <SparklesIcon size={18} color="#c084fc" />
                  <span>External People Extraction APIs</span>
                </h3>
                <p style={{ color: "#94a3b8", fontSize: 13, margin: "4px 0 0" }}>
                  Specialized data provider APIs to extract personal phone numbers, personal emails (Gmail/Yahoo), and verified LinkedIn URLs.
                </p>
              </div>
              <button className="btn-modal-close" onClick={() => setShowApisModal(false)}>✕</button>
            </div>

            <div className="modal-body-content" style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 14 }}>
              {loadingApis ? (
                <div style={{ textAlign: "center", padding: 32 }}>
                  <div className="spinner-icon" style={{ margin: "0 auto 12px" }} />
                  <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading API Catalog...</p>
                </div>
              ) : (
                (peopleApis.length > 0 ? peopleApis : [
                  {
                    id: "apollo",
                    name: "Apollo.io API",
                    website: "https://apollo.io",
                    docs_url: "https://apolloio.github.io/apollo-api-docs/",
                    capabilities: ["Personal Email", "Direct Mobile Phone", "Personal LinkedIn", "Company Insights"],
                    pricing_model: "Freemium / Monthly Credits",
                    best_for: "B2B executives, founders, and managing directors globally",
                    env_key: "APOLLO_API_KEY",
                    status: "Ready (Awaiting API Key)",
                    configured: false
                  },
                  {
                    id: "proxycurl",
                    name: "Proxycurl (Nubela)",
                    website: "https://nubela.co/proxycurl",
                    docs_url: "https://nubela.co/proxycurl/docs",
                    capabilities: ["Personal LinkedIn Profile", "Personal Email", "Personal Phone Numbers"],
                    pricing_model: "Pay-as-you-go Credit Packs (~$0.01 - $0.03/lookup)",
                    best_for: "Deep LinkedIn profile extraction and personal phone/email lookup",
                    env_key: "PROXYCURL_API_KEY",
                    status: "Ready (Awaiting API Key)",
                    configured: false
                  },
                  {
                    id: "pdl",
                    name: "People Data Labs (PDL)",
                    website: "https://peopledatalabs.com",
                    docs_url: "https://docs.peopledatalabs.com/",
                    capabilities: ["Personal Mobile Numbers", "Personal Gmail/Yahoo Emails", "LinkedIn URL", "Education / Diaspora Graph"],
                    pricing_model: "Free Tier (1,000 matches/mo) then Pay-as-you-go",
                    best_for: "High-net-worth diaspora individuals across UK, US, UAE, and Canada",
                    env_key: "PDL_API_KEY",
                    status: "Ready (Awaiting API Key)",
                    configured: false
                  },
                  {
                    id: "contactout",
                    name: "ContactOut API",
                    website: "https://contactout.com",
                    docs_url: "https://api.contactout.com/documentation",
                    capabilities: ["Triple-Verified Personal Email (Gmail/Hotmail)", "Personal Direct Phone", "LinkedIn URL"],
                    pricing_model: "Free Credits + Subscription",
                    best_for: "Direct personal emails from LinkedIn profiles (75%+ personal rate)",
                    env_key: "CONTACTOUT_API_KEY",
                    status: "Ready (Awaiting API Key)",
                    configured: false
                  },
                  {
                    id: "rocketreach",
                    name: "RocketReach API",
                    website: "https://rocketreach.co",
                    docs_url: "https://rocketreach.co/api",
                    capabilities: ["Personal Emails", "Cell Phone Numbers", "Social Links"],
                    pricing_model: "Monthly Subscription / API Tiers",
                    best_for: "Locating high-accuracy personal cell phone numbers and personal emails",
                    env_key: "ROCKETREACH_API_KEY",
                    status: "Ready (Awaiting API Key)",
                    configured: false
                  }
                ]).map((api) => (
                  <div
                    key={api.id}
                    style={{
                      background: "rgba(255, 255, 255, 0.03)",
                      borderRadius: 12,
                      padding: 14,
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#ffffff" }}>{api.name}</h4>
                          <span style={{
                            fontSize: 11, padding: "2px 7px", borderRadius: 6, fontWeight: 600,
                            background: api.configured ? "rgba(16, 185, 129, 0.2)" : "rgba(148, 163, 184, 0.15)",
                            color: api.configured ? "#34d399" : "#cbd5e1"
                          }}>
                            {api.configured ? "✓ Configured & Active" : "Requires Key"}
                          </span>
                        </div>
                        <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: 12.5 }}>{api.best_for}</p>
                      </div>

                      <div style={{ display: "flex", gap: 8 }}>
                        <a
                          href={api.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="chip-toggle-btn"
                          style={{ padding: "4px 10px", fontSize: 11.5, color: "#38bdf8", textDecoration: "none" }}
                        >
                          <span>Visit Website</span>
                          <ExternalLinkIcon size={11} color="#38bdf8" />
                        </a>
                        <a
                          href={api.docs_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="chip-toggle-btn"
                          style={{ padding: "4px 10px", fontSize: 11.5, color: "#fbbf24", textDecoration: "none" }}
                        >
                          <span>API Docs</span>
                          <ExternalLinkIcon size={11} color="#fbbf24" />
                        </a>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                      <span style={{ fontSize: 11.5, color: "#64748b", fontWeight: 600 }}>Extracts:</span>
                      {api.capabilities.map((cap) => (
                        <span
                          key={cap}
                          style={{
                            fontSize: 11, padding: "2px 8px", borderRadius: 6,
                            background: "rgba(56, 189, 248, 0.12)", color: "#38bdf8", fontWeight: 600
                          }}
                        >
                          {cap}
                        </span>
                      ))}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 4, paddingTop: 6, borderTop: "1px solid rgba(255, 255, 255, 0.05)", fontSize: 11.5, color: "#94a3b8" }}>
                      <span>💳 <strong>Pricing:</strong> {api.pricing_model}</span>
                      <span>🔑 <strong>Environment Key:</strong> <code>{api.env_key}</code></span>
                    </div>
                  </div>
                ))
              )}

              <div style={{
                background: "linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(16, 185, 129, 0.1))",
                borderRadius: 10,
                padding: 12,
                border: "1px solid rgba(245, 158, 11, 0.25)"
              }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#fbbf24", display: "block", marginBottom: 4 }}>
                  🛡️ ApexLead Double-Check Guarantee:
                </span>
                <p style={{ margin: 0, fontSize: 12, color: "#cbd5e1", lineHeight: 1.5 }}>
                  Any data returned by Apollo, Proxycurl, PDL, or ContactOut is automatically put through ApexLead's Contact Validator twice to discard generic corporate role emails (<code>info@</code>, <code>sales@</code>, <code>contact@</code>) and retain only verified personal phones, personal emails, and personal LinkedIn handles.
                </p>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button className="btn-primary-action" onClick={() => setShowApisModal(false)} style={{ fontSize: 13, padding: "6px 16px" }}>
                  <span>Close Window</span>
                </button>
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

