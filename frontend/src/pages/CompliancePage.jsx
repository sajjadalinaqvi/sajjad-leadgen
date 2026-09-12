import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import Toast from "../components/Toast";
import {
  ShieldCheckIcon, UserXIcon, AlertTriangleIcon, CheckIcon,
  DatabaseIcon, ClockIcon, SlidersIcon
} from "../components/Icons";

import API from "../api";

export default function CompliancePage() {
  const [suppressions, setSuppressions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [newType, setNewType] = useState("email");
  const [newValue, setNewValue] = useState("");
  const [newReason, setNewReason] = useState("User requested Do-Not-Contact");
  const [deleteLeadId, setDeleteLeadId] = useState("");
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchSuppressions();
    fetchAuditLogs();
  }, []);

  const showNotification = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchSuppressions = async () => {
    try {
      const res = await fetch(`${API}/compliance/suppression`);
      if (res.ok) {
        const data = await res.json();
        setSuppressions(data.suppressions || []);
      }
    } catch {
      // Backend may be starting
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch(`${API}/compliance/audit-logs?limit=30`);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
      }
    } catch {
      // Backend may be starting
    }
  };

  const handleAddSuppression = async () => {
    if (!newValue.trim()) {
      showNotification("Please enter an email, phone, or domain to suppress.", "error");
      return;
    }
    try {
      const res = await fetch(`${API}/compliance/suppress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: newType, value: newValue.trim(), reason: newReason }),
      });
      if (res.ok) {
        showNotification(`Added ${newValue} to Do-Not-Contact suppression list!`, "success");
        setNewValue("");
        fetchSuppressions();
        fetchAuditLogs();
      }
    } catch (e) {
      showNotification(`Error: ${e.message}`, "error");
    }
  };

  const handleRemoveSuppression = async (id) => {
    try {
      const res = await fetch(`${API}/compliance/suppression/${id}`, { method: "DELETE" });
      if (res.ok) {
        showNotification("Removed from suppression list.", "success");
        setSuppressions(suppressions.filter((s) => s.id !== id));
        fetchAuditLogs();
      }
    } catch (e) {
      showNotification(`Error: ${e.message}`, "error");
    }
  };

  const handlePurgeLead = async () => {
    if (!deleteLeadId.trim()) return;
    if (!window.confirm(`Permanently purge all data associated with Lead ID "${deleteLeadId}"?`)) return;
    try {
      const res = await fetch(`${API}/leads/${deleteLeadId.trim()}`, { method: "DELETE" });
      if (res.ok) {
        showNotification("Lead permanently deleted and purged from all records.", "success");
        setDeleteLeadId("");
        fetchAuditLogs();
      } else {
        showNotification("Lead ID not found or already deleted.", "error");
      }
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
            <ShieldCheckIcon size={14} color="#10b981" />
            <span>Privacy, Safety &amp; Compliance Center</span>
          </div>
          <h1 className="page-title">Compliance, Suppression &amp; Audit Trail</h1>
          <p className="page-subtitle">
            Maintain strict data governance: manage suppression lists (DNC), permanently delete contacts, and inspect tamper-evident audit logs.
          </p>
        </div>

        {/* Compliance Policy Statement Card */}
        <div className="investor-lead-card glass-panel animate-slide-up" style={{ borderColor: "rgba(16, 185, 129, 0.3)" }}>
          <div className="investor-name-row">
            <ShieldCheckIcon size={22} color="#10b981" />
            <h3 className="investor-full-name">ApexLead AI Data Collection Policy</h3>
          </div>
          <p className="tool-desc" style={{ marginTop: 8 }}>
            ApexLead AI operates strictly within ethical and compliant intelligence frameworks. The platform:
          </p>
          <div className="tool-features-list">
            <div className="tool-feature-item">
              <CheckIcon size={14} color="#10b981" />
              <span><strong>Zero Credential/Leak Harvesting:</strong> Never collects private datasets, hacked lists, or password dumps.</span>
            </div>
            <div className="tool-feature-item">
              <CheckIcon size={14} color="#10b981" />
              <span><strong>Evidence-Based Sourcing:</strong> Never infers nationality from names alone; every score factor requires verifiable public evidence.</span>
            </div>
            <div className="tool-feature-item">
              <CheckIcon size={14} color="#10b981" />
              <span><strong>Polite Throttling &amp; Backoff:</strong> Uses rate-limiting and circuit breakers instead of bypassing website security or CAPTCHAs.</span>
            </div>
            <div className="tool-feature-item">
              <CheckIcon size={14} color="#10b981" />
              <span><strong>Human-in-the-Loop:</strong> All leads require agent review before outreach; DNC requests are permanently respected.</span>
            </div>
          </div>
        </div>

        {/* DNC Suppression Manager */}
        <div className="search-panel glass-panel animate-slide-up">
          <div className="panel-mode-header">
            <div className="export-title-row">
              <UserXIcon size={18} color="#f43f5e" />
              <span className="export-heading">Do-Not-Contact (DNC) Suppression Registry</span>
            </div>
            <span className="results-counter-badge" style={{ background: "rgba(244, 63, 94, 0.15)", color: "#f43f5e", borderColor: "rgba(244, 63, 94, 0.3)" }}>
              {suppressions.length} Suppressed Entities
            </span>
          </div>

          <div className="compliance-form-grid">
            <select
              className="custom-select"
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
            >
              <option value="email">Email Address</option>
              <option value="phone">Phone Number</option>
              <option value="domain">Corporate Domain</option>
            </select>

            <input
              className="custom-input"
              placeholder={newType === "email" ? "e.g. prospect@example.com" : newType === "phone" ? "e.g. +971-50-1234567" : "e.g. domain.com"}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddSuppression()}
            />

            <input
              className="custom-input"
              placeholder="Exclusion reason (e.g. Opted out / Requested DNC)"
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddSuppression()}
            />

            <button
              className="btn-primary-action btn-dnc-add"
              style={{ background: "#f43f5e", borderColor: "rgba(244, 63, 94, 0.4)", boxShadow: "0 2px 10px rgba(244, 63, 94, 0.3)" }}
              onClick={handleAddSuppression}
            >
              <UserXIcon size={15} />
              <span>Add to DNC</span>
            </button>
          </div>

          {/* Active Suppressions Table */}
          {suppressions.length > 0 && (
            <div className="table-responsive-wrapper mt-2">
              <table className="lead-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Value / Target</th>
                    <th>Reason</th>
                    <th>Date Added</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {suppressions.map((s) => (
                    <tr key={s.id} className="lead-table-row">
                      <td><span className="lead-category-badge">{s.type.toUpperCase()}</span></td>
                      <td><strong style={{ color: "#ffffff" }}>{s.value}</strong></td>
                      <td><span className="text-muted-cell">{s.reason}</span></td>
                      <td><span className="text-muted-cell">{s.added_at ? s.added_at.slice(0, 10) : "—"}</span></td>
                      <td>
                        <button
                          className="btn-copy-mini"
                          style={{ color: "#f43f5e" }}
                          onClick={() => handleRemoveSuppression(s.id)}
                          title="Remove from DNC"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Permanent Data Deletion Tool */}
        <div className="search-panel glass-panel animate-slide-up">
          <div className="panel-mode-header">
            <div className="export-title-row">
              <UserXIcon size={18} color="#e11d48" />
              <span className="export-heading">Permanent Lead Deletion (GDPR / Data Purge)</span>
            </div>
          </div>

          <div className="compliance-purge-wrap">
            <input
              className="custom-input"
              placeholder="Enter Lead UUID / ID to delete permanently..."
              value={deleteLeadId}
              onChange={(e) => setDeleteLeadId(e.target.value)}
            />
            <button className="btn-secondary btn-purge-action" style={{ color: "#f43f5e", borderColor: "rgba(244, 63, 94, 0.4)" }} onClick={handlePurgeLead}>
              Purge Record
            </button>
          </div>
        </div>

        {/* System Audit Trail */}
        <div className="results-container glass-panel animate-slide-up">
          <div className="table-controls-bar">
            <div className="table-heading-group">
              <ClockIcon size={18} color="#6366f1" />
              <h3 className="table-title">System Activity &amp; Audit Trail</h3>
            </div>
            <button className="btn-secondary" onClick={fetchAuditLogs}>Refresh Logs</button>
          </div>

          <div className="table-responsive-wrapper">
            <table className="lead-table">
              <thead>
                <tr>
                  <th>Timestamp (UTC)</th>
                  <th>Action</th>
                  <th>Lead ID / Target</th>
                  <th>Event Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((logItem) => (
                  <tr key={logItem.id} className="lead-table-row">
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {logItem.timestamp ? logItem.timestamp.replace("T", " ").slice(0, 19) : "—"}
                    </td>
                    <td>
                      <span className="lead-category-badge" style={{ color: "#818cf8", background: "rgba(99, 102, 241, 0.15)" }}>
                        {logItem.action.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className="text-muted-cell" style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
                        {logItem.lead_id ? logItem.lead_id.slice(0, 12) + "..." : "System"}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: "#e2e8f0" }}>
                        {JSON.stringify(logItem.details)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
