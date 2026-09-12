import React, { useState } from "react";
import {
  BuildingIcon, MapPinIcon, PhoneIcon, MailIcon, GlobeIcon,
  StarIcon, SearchIcon, ExternalLinkIcon, CopyIcon, CheckIcon,
  ArrowLeftIcon, ArrowRightIcon
} from "./Icons";

export default function ResultsTable({ results, page, onPageChange, hasMore, loading, onNotify }) {
  const [copiedKey, setCopiedKey] = useState(null);

  if (!results.length && !loading) return null;

  const copyToClipboard = (text, key, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    if (onNotify) onNotify(`Copied ${label} to clipboard!`, "success");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const shortenUrl = (url) => {
    if (!url) return "";
    return url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 32);
  };

  return (
    <div className="results-container glass-panel animate-slide-up">
      {/* Header Bar */}
      <div className="table-heading-group" style={{ marginBottom: 14 }}>
        <h3 className="table-title">Extracted Business Intelligence</h3>
        <span className="results-counter-badge">
          {results.length} Leads — Page {page}
        </span>
      </div>

      {/* Desktop Data Table */}
      <div className="table-responsive-wrapper desktop-table-view">
        <table className="lead-table">
          <thead>
            <tr>
              <th style={{ width: "24%" }}>Business Name</th>
              <th style={{ width: "16%" }}>Category</th>
              <th style={{ width: "22%" }}>Address &amp; Location</th>
              <th style={{ width: "20%" }}>Contact &amp; Web</th>
              <th style={{ width: "18%" }}>Rating &amp; Reviews</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={i} className="lead-table-row">
                <td>
                  <div className="lead-name-cell">
                    <span className="lead-name-title font-semibold">{r.name}</span>
                    {r.phone && (
                      <span className="contact-text" style={{ fontSize: 12 }}>
                        <PhoneIcon size={12} color="#06b6d4" /> {r.phone}
                      </span>
                    )}
                  </div>
                </td>

                <td>
                  <span className="lead-category-badge">
                    {r.category || "Business"}
                  </span>
                </td>

                <td>
                  <div className="contact-cell">
                    <span className="text-muted-cell" style={{ fontSize: 12 }}>
                      <MapPinIcon size={12} color="#94a3b8" /> {r.address || "—"}
                    </span>
                  </div>
                </td>

                <td>
                  <div className="contact-cell">
                    {r.email ? (
                      <div className="contact-row">
                        <MailIcon size={13} color="#10b981" />
                        <span className="contact-text" style={{ fontSize: 12 }}>{r.email}</span>
                        <button
                          className="btn-copy-mini"
                          onClick={() => copyToClipboard(r.email, `em-${i}`, "Email")}
                          title="Copy Email"
                        >
                          {copiedKey === `em-${i}` ? <CheckIcon size={11} color="#10b981" /> : <CopyIcon size={11} />}
                        </button>
                      </div>
                    ) : (
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(r.name + ' official email contact')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-find-google-email"
                        style={{ padding: "4px 8px", fontSize: 11 }}
                      >
                        <SearchIcon size={11} />
                        <span>Search Email</span>
                      </a>
                    )}

                    {r.website && (
                      <div className="contact-row mt-1">
                        <GlobeIcon size={12} color="#6366f1" />
                        <a
                          href={r.website}
                          target="_blank"
                          rel="noreferrer"
                          className="contact-pill-link"
                          style={{ fontSize: 11.5, padding: "2px 6px" }}
                        >
                          <span>{shortenUrl(r.website)}</span>
                          <ExternalLinkIcon size={10} />
                        </a>
                      </div>
                    )}
                  </div>
                </td>

                <td>
                  <div className="rating-pill-wrapper">
                    {r.rating ? (
                      <span className="rating-badge-pill">
                        <StarIcon size={12} color="#f59e0b" />
                        <span>{r.rating}</span>
                        {r.reviews && <span className="review-count">({r.reviews})</span>}
                      </span>
                    ) : (
                      <span className="text-muted-cell">No ratings</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Stack for Smartphones & Tablets */}
      <div className="mobile-cards-view">
        {results.map((r, i) => (
          <div key={i} className="mobile-result-card glass-panel animate-slide-up">
            <div className="mobile-card-header">
              <div className="mobile-card-title-group">
                <h4 className="mobile-lead-title">{r.name}</h4>
                {r.category && <span className="lead-category-badge">{r.category}</span>}
              </div>

              {r.rating && (
                <div className="rating-badge-pill">
                  <StarIcon size={13} color="#f59e0b" />
                  <span>{r.rating}</span>
                  {r.reviews && <span className="review-count">({r.reviews})</span>}
                </div>
              )}
            </div>

            {r.address && (
              <div className="mobile-card-row">
                <MapPinIcon size={13} color="#94a3b8" />
                <span className="mobile-card-text">{r.address}</span>
              </div>
            )}

            {/* Mobile Touch Action Pills */}
            <div className="mobile-contact-actions">
              {r.phone && (
                <a href={`tel:${r.phone}`} className="mobile-action-pill pill-phone">
                  <PhoneIcon size={13} />
                  <span>Call {r.phone}</span>
                </a>
              )}

              {r.email ? (
                <div className="mobile-action-pill pill-email">
                  <MailIcon size={13} />
                  <a href={`mailto:${r.email}`} className="mobile-email-link">{r.email}</a>
                  <button
                    className="btn-copy-mini"
                    onClick={() => copyToClipboard(r.email, `m-em-${i}`, "Email")}
                  >
                    {copiedKey === `m-em-${i}` ? <CheckIcon size={11} color="#10b981" /> : <CopyIcon size={11} />}
                  </button>
                </div>
              ) : (
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(r.name + ' official email contact')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mobile-action-pill pill-search"
                >
                  <SearchIcon size={12} />
                  <span>Find Email on Google</span>
                </a>
              )}

              {r.website && (
                <a
                  href={r.website}
                  target="_blank"
                  rel="noreferrer"
                  className="mobile-action-pill pill-website"
                >
                  <GlobeIcon size={13} />
                  <span>Visit Website</span>
                  <ExternalLinkIcon size={11} />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Footer */}
      <div className="pagination-bar">
        <span className="pagination-info">Page {page}</span>
        <div className="pagination-buttons">
          <button
            className="btn-pagination"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1 || loading}
          >
            <ArrowLeftIcon size={14} /> Previous
          </button>
          <span className="page-current-indicator">{page}</span>
          <button
            className="btn-pagination"
            onClick={() => onPageChange(page + 1)}
            disabled={!hasMore || loading}
          >
            Next <ArrowRightIcon size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
