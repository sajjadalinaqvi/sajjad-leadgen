import React from "react";
import { MailIcon, PhoneIcon, StarIcon, GlobeIcon, BuildingIcon, ZapIcon } from "./Icons";

export default function StatsCards({ results = [], type = "maps" }) {
  if (!results || results.length === 0) return null;

  const total = results.length;
  const withEmail = results.filter((r) => r.email && r.email.trim() !== "").length;
  const withPhone = results.filter((r) => r.phone && r.phone.trim() !== "").length;
  const withWebsite = results.filter((r) => r.website || r.url).length;

  let avgRating = 0;
  let ratedCount = 0;
  let topRatedCount = 0;

  if (type === "maps") {
    results.forEach((r) => {
      const rating = parseFloat(r.rating);
      if (!isNaN(rating) && rating > 0) {
        avgRating += rating;
        ratedCount++;
        if (rating >= 4.0) topRatedCount++;
      }
    });
    avgRating = ratedCount > 0 ? (avgRating / ratedCount).toFixed(1) : "—";
  }

  const emailRate = total > 0 ? Math.round((withEmail / total) * 100) : 0;
  const phoneRate = total > 0 ? Math.round((withPhone / total) * 100) : 0;

  return (
    <div className="stats-grid animate-fade-in">
      {/* Total Leads */}
      <div className="stat-card">
        <div className="stat-icon-box stat-primary">
          <BuildingIcon size={20} color="#6366f1" />
        </div>
        <div className="stat-details">
          <span className="stat-label">Total Extracted</span>
          <div className="stat-value-group">
            <span className="stat-value">{total}</span>
            <span className="stat-badge stat-badge-indigo">Leads</span>
          </div>
          <div className="stat-progress-bar">
            <div className="stat-progress-fill stat-progress-indigo" style={{ width: "100%" }} />
          </div>
        </div>
      </div>

      {/* Verified Emails */}
      <div className="stat-card">
        <div className="stat-icon-box stat-emerald">
          <MailIcon size={20} color="#10b981" />
        </div>
        <div className="stat-details">
          <span className="stat-label">Direct Emails</span>
          <div className="stat-value-group">
            <span className="stat-value">{withEmail}</span>
            <span className="stat-badge stat-badge-emerald">{emailRate}% yield</span>
          </div>
          <div className="stat-progress-bar">
            <div className="stat-progress-fill stat-progress-emerald" style={{ width: `${emailRate}%` }} />
          </div>
        </div>
      </div>

      {/* Phone Numbers */}
      <div className="stat-card">
        <div className="stat-icon-box stat-cyan">
          <PhoneIcon size={20} color="#06b6d4" />
        </div>
        <div className="stat-details">
          <span className="stat-label">Phone Numbers</span>
          <div className="stat-value-group">
            <span className="stat-value">{withPhone}</span>
            <span className="stat-badge stat-badge-cyan">{phoneRate}% valid</span>
          </div>
          <div className="stat-progress-bar">
            <div className="stat-progress-fill stat-progress-cyan" style={{ width: `${phoneRate}%` }} />
          </div>
        </div>
      </div>

      {/* Rating / Websites */}
      {type === "maps" ? (
        <div className="stat-card">
          <div className="stat-icon-box stat-amber">
            <StarIcon size={20} color="#f59e0b" />
          </div>
          <div className="stat-details">
            <span className="stat-label">Average Rating</span>
            <div className="stat-value-group">
              <span className="stat-value">{avgRating}</span>
              <span className="stat-badge stat-badge-amber">{topRatedCount} &gt; 4.0★</span>
            </div>
            <div className="stat-progress-bar">
              <div
                className="stat-progress-fill stat-progress-amber"
                style={{ width: `${avgRating !== "—" ? (parseFloat(avgRating) / 5) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="stat-card">
          <div className="stat-icon-box stat-purple">
            <GlobeIcon size={20} color="#a855f7" />
          </div>
          <div className="stat-details">
            <span className="stat-label">Web Links</span>
            <div className="stat-value-group">
              <span className="stat-value">{withWebsite}</span>
              <span className="stat-badge stat-badge-purple">100% Live</span>
            </div>
            <div className="stat-progress-bar">
              <div className="stat-progress-fill stat-progress-purple" style={{ width: "100%" }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
