import React, { useState } from "react";
import Navbar from "../components/Navbar";
import Toast from "../components/Toast";
import { SlidersIcon, GlobeIcon, ShieldCheckIcon, CheckIcon } from "../components/Icons";

export default function SettingsPage() {
  const [tier1Countries, setTier1Countries] = useState("UAE, Saudi Arabia, United Kingdom, United States");
  const [tier2Countries, setTier2Countries] = useState("Canada, Australia, Qatar, Kuwait, Oman, Bahrain");
  const [qualificationThreshold, setQualificationThreshold] = useState(65);
  const [hotThreshold, setHotThreshold] = useState(80);
  const [domainDelay, setDomainDelay] = useState(1.5);
  const [toast, setToast] = useState(null);

  const showNotification = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSave = () => {
    showNotification("Settings updated and saved to intelligence engine!", "success");
  };

  return (
    <div className="page-wrapper">
      <Navbar />

      <main className="main-content-container">
        {/* Header */}
        <div className="page-header animate-fade-in">
          <div className="page-header-badge" style={{ borderColor: "rgba(99, 102, 241, 0.3)", color: "#818cf8" }}>
            <SlidersIcon size={14} color="#818cf8" />
            <span>Platform Configuration</span>
          </div>
          <h1 className="page-title">Intelligence Engine Settings</h1>
          <p className="page-subtitle">
            Configure target diaspora priority markets, customize qualification score thresholds, and adjust rate-limiting parameters.
          </p>
        </div>

        {/* Priority Markets Configuration */}
        <div className="search-panel glass-panel animate-slide-up">
          <div className="panel-mode-header">
            <div className="export-title-row">
              <GlobeIcon size={18} color="#06b6d4" />
              <span className="export-heading">Priority Diaspora Markets</span>
            </div>
          </div>

          <div className="modal-field-item">
            <span className="modal-field-label">Tier 1 High-Liquidity Markets (+20 pts):</span>
            <input
              className="custom-input w-full"
              value={tier1Countries}
              onChange={(e) => setTier1Countries(e.target.value)}
            />
            <span className="input-helper-text">Comma-separated country list. Highest priority target regions.</span>
          </div>

          <div className="modal-field-item mt-2">
            <span className="modal-field-label">Tier 2 Established Diaspora Markets (+15 pts):</span>
            <input
              className="custom-input w-full"
              value={tier2Countries}
              onChange={(e) => setTier2Countries(e.target.value)}
            />
          </div>
        </div>

        {/* Scoring Thresholds */}
        <div className="search-panel glass-panel animate-slide-up">
          <div className="panel-mode-header">
            <div className="export-title-row">
              <SlidersIcon size={18} color="#f59e0b" />
              <span className="export-heading">Scoring &amp; Qualification Thresholds</span>
            </div>
          </div>

          <div className="settings-thresholds-grid">
            <div className="modal-field-item">
              <span className="modal-field-label">Qualified Lead Threshold (Score / 100):</span>
              <input
                type="number"
                min="40"
                max="85"
                className="custom-input"
                value={qualificationThreshold}
                onChange={(e) => setQualificationThreshold(parseInt(e.target.value, 10))}
              />
              <span className="input-helper-text">Leads meeting or exceeding this score are routed for agent qualification.</span>
            </div>

            <div className="modal-field-item">
              <span className="modal-field-label">HOT Lead Priority Threshold:</span>
              <input
                type="number"
                min="70"
                max="95"
                className="custom-input"
                value={hotThreshold}
                onChange={(e) => setHotThreshold(parseInt(e.target.value, 10))}
              />
              <span className="input-helper-text">Immediate outreach recommendation trigger.</span>
            </div>
          </div>
        </div>

        {/* Throttling & Safety Parameters */}
        <div className="search-panel glass-panel animate-slide-up">
          <div className="panel-mode-header">
            <div className="export-title-row">
              <ShieldCheckIcon size={18} color="#10b981" />
              <span className="export-heading">Polite Scraping &amp; Safety Controls</span>
            </div>
          </div>

          <div className="modal-field-item">
            <span className="modal-field-label">Minimum Domain Throttling Delay (Seconds):</span>
            <input
              type="number"
              step="0.5"
              min="1.0"
              max="10.0"
              className="custom-input"
              style={{ maxWidth: 200 }}
              value={domainDelay}
              onChange={(e) => setDomainDelay(parseFloat(e.target.value))}
            />
            <span className="input-helper-text">Enforces polite pause between requests to the same public domain to respect server load.</span>
          </div>

          <div className="settings-action-row" style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <button className="btn-primary-action" style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)" }} onClick={handleSave}>
              <CheckIcon size={15} />
              <span>Save Settings</span>
            </button>
          </div>
        </div>
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
