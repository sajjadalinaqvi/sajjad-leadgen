import React, { useState } from "react";
import Navbar from "../components/Navbar";
import StatsCards from "../components/StatsCards";
import Toast from "../components/Toast";
import {
  SearchIcon, TerminalIcon, SparklesIcon, CopyIcon, CheckIcon, ExternalLinkIcon,
  GlobeIcon, MailIcon, PhoneIcon, MapPinIcon, DownloadIcon, FileCsvIcon, FileExcelIcon,
  FileJsonIcon, AlertTriangleIcon, GoogleIcon, ArrowLeftIcon, ArrowRightIcon, XIcon, FilterIcon
} from "../components/Icons";
import API from "../api";

const DORK_OPERATORS = [
  { label: "site:", placeholder: "e.g. .gov, linkedin.com, github.com", key: "site", color: "#6366f1" },
  { label: "inurl:", placeholder: "e.g. contact, admin, team, staff", key: "inurl", color: "#06b6d4" },
  { label: "intitle:", placeholder: "e.g. \"executive directory\", \"email list\"", key: "intitle", color: "#8b5cf6" },
  { label: "filetype:", placeholder: "e.g. xlsx, pdf, csv, docx", key: "filetype", color: "#10b981" },
  { label: "intext:", placeholder: "e.g. \"@gmail.com\", confidential", key: "intext", color: "#f59e0b" },
];

const DORK_PRESETS = [
  {
    name: "Pakistani Business Owners",
    keyword: '"Pakistani entrepreneur"',
    dorks: { intext: 'Dubai OR London OR "Saudi Arabia"' },
  },
  {
    name: "Pakistani Executives",
    keyword: '"Pakistani" "CEO" OR "Founder"',
    dorks: { intext: 'UAE OR UK OR USA' },
  },
  {
    name: "Pakistani Investors",
    keyword: '"Pakistani investor"',
    dorks: { intext: '"real estate" OR Islamabad' },
  },
  {
    name: "Islamabad Investment",
    keyword: '"Islamabad" "investment"',
    dorks: { intext: '"Pakistan" OR "property"' },
  },
  {
    name: "Business Associations",
    keyword: '"Pakistan Business Council"',
    dorks: { inurl: "directory OR members" },
  },
  {
    name: "Conference Speakers",
    keyword: '"Pakistani entrepreneur" "speaker"',
    dorks: { intext: "Dubai OR London OR Riyadh" },
  },
];


function buildDorkQuery(keyword, dorks) {
  const parts = [keyword.trim()];
  DORK_OPERATORS.forEach(({ label, key }) => {
    if (dorks[key] && dorks[key].trim()) {
      const val = dorks[key].trim();
      if (val.startsWith('"') || val.includes(" ") || val.includes("OR")) {
        parts.push(`${label}${val}`);
      } else {
        parts.push(`${label}"${val}"`);
      }
    }
  });
  return parts.filter(Boolean).join(" ");
}

export default function DorkingPage() {
  const [activeTab, setActiveTab] = useState("builder"); // 'builder' | 'url'
  const [keyword, setKeyword] = useState("");
  const [dorks, setDorks] = useState({});
  const [dorkUrl, setDorkUrl] = useState("");
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [captchaUrl, setCaptchaUrl] = useState("");
  const [exporting, setExporting] = useState("");
  const [copiedQuery, setCopiedQuery] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);
  const [toast, setToast] = useState(null);

  const isUrlMode = activeTab === "url";
  const currentQuery = isUrlMode ? "" : buildDorkQuery(keyword, dorks);

  const showNotification = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const applyPreset = (preset) => {
    setActiveTab("builder");
    setKeyword(preset.keyword);
    setDorks(preset.dorks || {});
    setDorkUrl("");
    showNotification(`Applied preset: ${preset.name}`, "success");
  };

  const copyToClipboard = (text, key, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showNotification(`Copied ${label} to clipboard!`, "success");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCopyQuery = () => {
    if (!currentQuery) return;
    navigator.clipboard.writeText(currentQuery);
    setCopiedQuery(true);
    showNotification("Copied Dork query to clipboard!", "success");
    setTimeout(() => setCopiedQuery(false), 2000);
  };

  const fetchPage = async (p) => {
    if (isUrlMode && !dorkUrl.trim()) {
      setError("Please paste a valid Google Search URL.");
      return;
    }
    if (!isUrlMode && !keyword.trim() && Object.values(dorks).every((v) => !v?.trim())) {
      setError("Please enter a keyword or at least one dork search operator.");
      return;
    }

    setLoading(true);
    setError("");
    setCaptchaUrl("");
    try {
      const payload = {
        page: p,
        results_per_page: 25,
        search_url: isUrlMode ? dorkUrl.trim() : "",
        query: isUrlMode ? "" : currentQuery,
      };

      let res;
      try {
        res = await fetch(`${API}/dork`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch {
        throw new Error("Cannot connect to backend server. Make sure backend is running on port 8005.");
      }

      if (res.status === 500) throw new Error("Backend server encountered an error while querying Google.");
      if (!res.ok) throw new Error(`Google Dorking error: HTTP ${res.status}`);

      const data = await res.json();
      if (data.captcha) {
        setCaptchaUrl(data.captcha_url || "");
        throw new Error("Google CAPTCHA detected. Click the button below to solve it in your browser.");
      }
      if (data.error) throw new Error(data.error);
      if (!Array.isArray(data.results)) throw new Error("Unexpected response structure from server.");

      setResults(data.results);
      setPage(p);
      setHasMore(data.has_more || false);
      showNotification(`Found ${data.results.length} results for Page ${p}!`, "success");
    } catch (e) {
      setError(e.message);
      showNotification(e.message, "error");
      if (p > 1) setPage(p - 1);
    } finally {
      setLoading(false);
    }
  };

  const exportData = async (fmt) => {
    setExporting(fmt);
    try {
      const payload = {
        results_per_page: 75,
        search_url: isUrlMode ? dorkUrl.trim() : "",
        query: isUrlMode ? "" : currentQuery,
      };

      const res = await fetch(`${API}/export-dork/${fmt}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Export failed: HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `google_dork_results_${new Date().toISOString().slice(0, 10)}.${fmt === "excel" ? "xlsx" : fmt}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showNotification(`Exported ${fmt.toUpperCase()} successfully!`, "success");
    } catch (e) {
      showNotification(`Export error: ${e.message}`, "error");
    } finally {
      setExporting("");
    }
  };

  return (
    <div className="page-wrapper">
      <Navbar />

      <main className="main-content-container">
        {/* Page Hero Header */}
        <div className="page-header animate-fade-in">
          <div className="page-header-badge" style={{ borderColor: "rgba(139, 92, 246, 0.3)", color: "#a855f7" }}>
            <SearchIcon size={14} color="#a855f7" />
            <span>Google Advanced Intelligence &amp; OSINT</span>
          </div>
          <h1 className="page-title">Google Dorking Search Engine</h1>
          <p className="page-subtitle">
            Leverage Google&apos;s advanced index search operators (site:, inurl:, filetype:, intitle:) to discover confidential public documents and B2B contact lists.
          </p>
        </div>

        {/* Search Panel */}
        <div className="search-panel glass-panel animate-slide-up">
          {/* Mode Switcher */}
          <div className="panel-mode-header">
            <div className="mode-tabs">
              <button
                type="button"
                className={`mode-tab ${activeTab === "builder" ? "mode-tab-active" : ""}`}
                onClick={() => setActiveTab("builder")}
              >
                <TerminalIcon size={15} />
                <span>Dork Operator Builder</span>
              </button>
              <button
                type="button"
                className={`mode-tab ${activeTab === "url" ? "mode-tab-active" : ""}`}
                onClick={() => setActiveTab("url")}
              >
                <GlobeIcon size={15} />
                <span>Paste Google Search URL</span>
              </button>
            </div>

            {/* Presets */}
            {!isUrlMode && (
              <div className="preset-chips">
                <span className="preset-label">
                  <SparklesIcon size={13} color="#a855f7" /> Presets:
                </span>
                {DORK_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    className="chip-btn"
                    onClick={() => applyPreset(p)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* URL Mode */}
          {isUrlMode ? (
            <div className="tab-pane animate-fade-in">
              <div className="input-group">
                <div className="input-field-wrapper has-icon">
                  <span className="input-icon">
                    <GlobeIcon size={18} color="#a855f7" />
                  </span>
                  <input
                    className="custom-input"
                    placeholder="Paste full Google search URL (e.g. https://www.google.com/search?q=site:.gov+filetype:pdf...)"
                    value={dorkUrl}
                    onChange={(e) => setDorkUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && fetchPage(1)}
                  />
                  {dorkUrl && (
                    <button
                      type="button"
                      className="input-clear-btn"
                      onClick={() => setDorkUrl("")}
                    >
                      <XIcon size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Builder Mode */
            <div className="tab-pane animate-fade-in">
              {/* Primary Keyword */}
              <div className="input-field-wrapper has-icon mb-4">
                <span className="input-icon">
                  <SearchIcon size={18} color="#94a3b8" />
                </span>
                <input
                  className="custom-input"
                  placeholder='Primary Target Keyword (e.g. "software agency", "construction permits", "hospital directors")'
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchPage(1)}
                />
                {keyword && (
                  <button
                    type="button"
                    className="input-clear-btn"
                    onClick={() => setKeyword("")}
                  >
                    <XIcon size={14} />
                  </button>
                )}
              </div>

              {/* Dork Operators Grid */}
              <div className="dork-operators-grid">
                {DORK_OPERATORS.map(({ label, placeholder, key, color }) => (
                  <div key={key} className="dork-input-card">
                    <span className="dork-label" style={{ color }}>
                      {label}
                    </span>
                    <input
                      className="dork-sub-input"
                      placeholder={placeholder}
                      value={dorks[key] || ""}
                      onChange={(e) => setDorks({ ...dorks, [key]: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && fetchPage(1)}
                    />
                    {dorks[key] && (
                      <button
                        type="button"
                        className="dork-clear-icon"
                        onClick={() => setDorks({ ...dorks, [key]: "" })}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Live Terminal Syntax Preview */}
              {currentQuery && (
                <div className="dork-preview-terminal animate-fade-in">
                  <div className="terminal-top-bar">
                    <div className="terminal-dots">
                      <span className="dot dot-red" />
                      <span className="dot dot-yellow" />
                      <span className="dot dot-green" />
                    </div>
                    <span className="terminal-title">Query Preview</span>
                    <div className="terminal-actions">
                      <button
                        type="button"
                        className="btn-terminal-action"
                        onClick={handleCopyQuery}
                      >
                        {copiedQuery ? <CheckIcon size={13} color="#10b981" /> : <CopyIcon size={13} />}
                        <span>{copiedQuery ? "Copied!" : "Copy"}</span>
                      </button>
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(currentQuery)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-terminal-action"
                      >
                        <ExternalLinkIcon size={13} />
                        <span>Open in Google</span>
                      </a>
                    </div>
                  </div>
                  <div className="terminal-content">
                    <code className="terminal-query">{currentQuery}</code>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Panel Footer */}
          <div className="panel-footer">
            <div className="search-stats-hint">
              {isUrlMode ? (
                <span>Mode: <strong className="highlight-tag">Custom Search URL</strong></span>
              ) : (
                <span>Operators active: <strong className="highlight-tag">{Object.values(dorks).filter(Boolean).length} filters</strong></span>
              )}
            </div>

            <button
              type="button"
              className={`btn-primary-action ${loading ? "btn-loading" : ""}`}
              style={{ background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)" }}
              onClick={() => fetchPage(1)}
              disabled={loading || (isUrlMode ? !dorkUrl.trim() : (!keyword.trim() && Object.values(dorks).every((v) => !v?.trim())))}
            >
              {loading ? (
                <>
                  <span className="spinner-icon" />
                  <span>Executing Dork Search...</span>
                </>
              ) : (
                <>
                  <SearchIcon size={17} />
                  <span>Run Google Dorking Search</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error & CAPTCHA Handler */}
        {error && (
          <div className="alert-banner alert-error animate-fade-in">
            <div className="alert-content">
              <AlertTriangleIcon size={20} color="#f43f5e" />
              <span>{error}</span>
            </div>
            <div className="alert-actions">
              {captchaUrl && (
                <a
                  href={captchaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-solve-captcha"
                >
                  <ExternalLinkIcon size={14} />
                  <span>Solve CAPTCHA in Browser</span>
                </a>
              )}
              <button className="alert-dismiss" onClick={() => { setError(""); setCaptchaUrl(""); }}>
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Loading Progress */}
        {loading && (
          <div className="scraper-progress-card glass-panel animate-fade-in" style={{ borderColor: "rgba(139, 92, 246, 0.3)" }}>
            <div className="progress-spinner-wrap" style={{ background: "rgba(139, 92, 246, 0.15)" }}>
              <div className="loader-ring" style={{ borderTopColor: "#a855f7" }} />
              <SearchIcon size={24} color="#a855f7" />
            </div>
            <div className="progress-text-wrap">
              <h4>Searching &amp; Parsing Google Index...</h4>
              <p>Crawling search results, extracting meta snippets, contact emails, and structured titles.</p>
            </div>
          </div>
        )}

        {/* Stats Insights */}
        {results.length > 0 && (
          <StatsCards results={results} type="dorking" />
        )}

        {/* Export Bar */}
        {results.length > 0 && (
          <div className="export-toolbar glass-panel animate-fade-in">
            <div className="export-info">
              <div className="export-title-row">
                <DownloadIcon size={18} color="#a855f7" />
                <span className="export-heading">Dork Intelligence Export</span>
                <span className="export-badge" style={{ background: "rgba(139, 92, 246, 0.15)", color: "#a855f7", borderColor: "rgba(139, 92, 246, 0.3)" }}>
                  Deep Scrape Batch
                </span>
              </div>
              <span className="export-subtext">Download extracted Google OSINT data in CSV, Excel, or JSON formats</span>
            </div>

            <div className="export-actions-group">
              <button
                className="btn-export-format btn-csv"
                onClick={() => exportData("csv")}
                disabled={!!exporting}
              >
                <FileCsvIcon size={16} />
                <span>{exporting === "csv" ? "Exporting..." : "CSV"}</span>
              </button>

              <button
                className="btn-export-format btn-excel"
                onClick={() => exportData("excel")}
                disabled={!!exporting}
              >
                <FileExcelIcon size={16} />
                <span>{exporting === "excel" ? "Exporting..." : "Excel"}</span>
              </button>

              <button
                className="btn-export-format btn-json"
                onClick={() => exportData("json")}
                disabled={!!exporting}
              >
                <FileJsonIcon size={16} />
                <span>{exporting === "json" ? "Exporting..." : "JSON"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Results View */}
        {results.length > 0 && (
          <div className="results-container glass-panel animate-slide-up">
            <div className="table-controls-bar">
              <div className="table-heading-group">
                <h3 className="table-title">Dork Search Results</h3>
                <span className="results-counter-badge" style={{ background: "rgba(139, 92, 246, 0.15)", color: "#c084fc", borderColor: "rgba(139, 92, 246, 0.3)" }}>
                  {results.length} found • Page {page}
                </span>
              </div>
            </div>

            <div className="table-responsive-wrapper">
              <table className="lead-table">
                <thead>
                  <tr>
                    <th style={{ width: "30%" }}>Page Title &amp; URL</th>
                    <th style={{ width: "22%" }}>Email / Contact</th>
                    <th style={{ width: "18%" }}>Phone / Address</th>
                    <th style={{ width: "30%" }}>Snippet &amp; Content</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, idx) => {
                    const itemKey = `dork-${page}-${idx}`;
                    return (
                      <tr key={itemKey} className="lead-table-row">
                        <td>
                          <div className="lead-name-cell">
                            <a
                              href={r.url}
                              target="_blank"
                              rel="noreferrer"
                              className="lead-name-title font-semibold"
                              style={{ color: "#a855f7" }}
                              title={r.title}
                            >
                              {r.title || "Untitled Page"}
                            </a>
                            <a
                              href={r.url}
                              target="_blank"
                              rel="noreferrer"
                              className="dork-url-sub"
                              title={r.url}
                            >
                              <GlobeIcon size={12} color="#64748b" />
                              <span>{r.url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 38)}...</span>
                            </a>
                          </div>
                        </td>

                        <td>
                          {r.email ? (
                            <div className="email-cell-found">
                              <div className="email-row">
                                <MailIcon size={14} color="#10b981" />
                                <a href={`mailto:${r.email}`} className="email-link">
                                  {r.email}
                                </a>
                                <button
                                  className="btn-copy-mini"
                                  onClick={() => copyToClipboard(r.email, `e-${itemKey}`, "Email")}
                                >
                                  {copiedKey === `e-${itemKey}` ? <CheckIcon size={12} color="#10b981" /> : <CopyIcon size={12} />}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <a
                              href={`https://www.google.com/search?q=${encodeURIComponent((r.title || "") + " official email contact")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-find-google-email"
                            >
                              <GoogleIcon size={13} />
                              <span>Search Email</span>
                            </a>
                          )}
                        </td>

                        <td>
                          <div className="contact-cell">
                            {r.phone ? (
                              <div className="contact-row">
                                <PhoneIcon size={13} color="#06b6d4" />
                                <span>{r.phone}</span>
                              </div>
                            ) : null}
                            {r.address ? (
                              <div className="contact-row">
                                <MapPinIcon size={13} color="#f43f5e" />
                                <span>{r.address}</span>
                              </div>
                            ) : null}
                            {!r.phone && !r.address && (
                              <span className="text-muted-cell">—</span>
                            )}
                          </div>
                        </td>

                        <td>
                          <div className="snippet-desc-box" title={r.description}>
                            {r.description || "No preview snippet available."}
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
              <div className="pagination-info">
                <span>Page <strong>{page}</strong></span>
              </div>
              <div className="pagination-buttons">
                <button
                  className="btn-pagination"
                  onClick={() => fetchPage(page - 1)}
                  disabled={page <= 1 || loading}
                >
                  <ArrowLeftIcon size={15} />
                  <span>Previous</span>
                </button>
                <span className="page-current-indicator">{page}</span>
                <button
                  className="btn-pagination"
                  onClick={() => fetchPage(page + 1)}
                  disabled={!hasMore || loading}
                >
                  <span>Next Page</span>
                  <ArrowRightIcon size={15} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty placeholder */}
        {!loading && !error && results.length === 0 && (
          <div className="empty-hero-state glass-panel animate-fade-in">
            <div className="empty-icon-box" style={{ background: "rgba(139, 92, 246, 0.15)" }}>
              <TerminalIcon size={32} color="#a855f7" />
            </div>
            <h3>Discover Hidden Public Information with Google Dorks</h3>
            <p>
              Click any quick preset or build a custom operator query (e.g. <code>site:.gov filetype:pdf</code>) to harvest unindexed contacts and public records.
            </p>
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
