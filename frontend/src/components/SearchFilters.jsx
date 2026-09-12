import React, { useState } from "react";
import { SearchIcon, MapPinIcon, BuildingIcon, StarIcon, ClockIcon, XIcon, SparklesIcon, FilterIcon, GlobeIcon } from "./Icons";

const CATEGORIES = [
  "", "Restaurant", "Hotel", "Hospital", "Gym", "Salon", "Pharmacy",
  "School", "Bank", "Supermarket", "Cafe", "Bar", "Dentist", "Lawyer",
  "Real Estate Agency", "Software Company", "Marketing Agency", "Auto Repair", "Plumber"
];

const PRESETS = [
  { label: "Dentists in Miami", keyword: "Dentist", location: "Miami, FL", category: "Dentist", min_rating: 4 },
  { label: "Real Estate in Austin", keyword: "Real Estate Agency", location: "Austin, TX", category: "Real Estate Agency", min_rating: 4 },
  { label: "Software in London", keyword: "Software Company", location: "London, UK", category: "Software Company", min_rating: 0 },
  { label: "Fine Dining in NYC", keyword: "Fine Dining", location: "New York, NY", category: "Restaurant", min_rating: 4 },
  { label: "Gyms in Chicago", keyword: "Fitness Center", location: "Chicago, IL", category: "Gym", min_rating: 4 },
];

export default function SearchFilters({ filters, onChange, onSearch, loading }) {
  const [activeTab, setActiveTab] = useState(filters.maps_url.trim() ? "url" : "builder");
  const isUrlMode = activeTab === "url";

  const updateField = (k) => (e) => {
    onChange({ ...filters, [k]: e.target.value });
  };

  const setRating = (star) => {
    onChange({ ...filters, min_rating: filters.min_rating === star ? 0 : star });
  };

  const toggleOpenNow = () => {
    onChange({ ...filters, open_now: !filters.open_now });
  };

  const applyPreset = (p) => {
    setActiveTab("builder");
    onChange({
      ...filters,
      maps_url: "",
      keyword: p.keyword,
      location: p.location,
      category: p.category,
      min_rating: p.min_rating,
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading) {
      if (isUrlMode && filters.maps_url.trim()) {
        onSearch();
      } else if (!isUrlMode && (filters.keyword.trim() || filters.location.trim())) {
        onSearch();
      }
    }
  };

  const isSearchDisabled = isUrlMode
    ? !filters.maps_url.trim()
    : (!filters.keyword.trim() && !filters.location.trim());

  return (
    <div className="search-panel glass-panel animate-slide-up">
      {/* Tab Switcher */}
      <div className="panel-mode-header">
        <div className="mode-tabs">
          <button
            type="button"
            className={`mode-tab ${activeTab === "builder" ? "mode-tab-active" : ""}`}
            onClick={() => {
              setActiveTab("builder");
              if (filters.maps_url) onChange({ ...filters, maps_url: "" });
            }}
          >
            <FilterIcon size={15} />
            <span>Keywords &amp; Filters</span>
          </button>
          <button
            type="button"
            className={`mode-tab ${activeTab === "url" ? "mode-tab-active" : ""}`}
            onClick={() => setActiveTab("url")}
          >
            <GlobeIcon size={15} />
            <span>Direct Google Maps URL</span>
          </button>
        </div>

        {/* Presets dropdown / quick chips */}
        {!isUrlMode && (
          <div className="preset-chips">
            <span className="preset-label">
              <SparklesIcon size={13} color="#6366f1" /> Quick Presets:
            </span>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className="chip-btn"
                onClick={() => applyPreset(p)}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* URL Mode View */}
      {isUrlMode ? (
        <div className="tab-pane animate-fade-in">
          <div className="input-group">
            <div className="input-field-wrapper has-icon">
              <span className="input-icon">
                <GlobeIcon size={18} color="#6366f1" />
              </span>
              <input
                className="custom-input"
                placeholder="Paste full Google Maps URL (e.g. https://www.google.com/maps/search/gyms+in+seattle/...)"
                value={filters.maps_url}
                onChange={updateField("maps_url")}
                onKeyDown={handleKeyDown}
              />
              {filters.maps_url && (
                <button
                  type="button"
                  className="input-clear-btn"
                  onClick={() => onChange({ ...filters, maps_url: "" })}
                >
                  <XIcon size={14} />
                </button>
              )}
            </div>
            <p className="input-helper-text">
              Direct URL mode scrapes the exact search bounding box and query directly from Google Maps.
            </p>
          </div>
        </div>
      ) : (
        /* Builder Mode View */
        <div className="tab-pane animate-fade-in">
          <div className="filter-grid-main">
            {/* Keyword Input */}
            <div className="input-field-wrapper has-icon">
              <span className="input-icon">
                <SearchIcon size={18} color="#94a3b8" />
              </span>
              <input
                className="custom-input"
                placeholder="Keyword or Business Type (e.g. Dental Clinic, Cafe)"
                value={filters.keyword}
                onChange={updateField("keyword")}
                onKeyDown={handleKeyDown}
              />
              {filters.keyword && (
                <button
                  type="button"
                  className="input-clear-btn"
                  onClick={() => onChange({ ...filters, keyword: "" })}
                >
                  <XIcon size={14} />
                </button>
              )}
            </div>

            {/* Location Input */}
            <div className="input-field-wrapper has-icon">
              <span className="input-icon">
                <MapPinIcon size={18} color="#06b6d4" />
              </span>
              <input
                className="custom-input"
                placeholder="Location / City (e.g. Austin, London, Tokyo)"
                value={filters.location}
                onChange={updateField("location")}
                onKeyDown={handleKeyDown}
              />
              {filters.location && (
                <button
                  type="button"
                  className="input-clear-btn"
                  onClick={() => onChange({ ...filters, location: "" })}
                >
                  <XIcon size={14} />
                </button>
              )}
            </div>

            {/* Category Select */}
            <div className="input-field-wrapper has-icon">
              <span className="input-icon">
                <BuildingIcon size={18} color="#a855f7" />
              </span>
              <select
                className="custom-select"
                value={filters.category}
                onChange={updateField("category")}
              >
                <option value="">All Categories</option>
                {CATEGORIES.filter(Boolean).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Secondary Filters Bar */}
          <div className="filter-secondary-bar">
            {/* Min Rating Stars */}
            <div className="rating-filter-group">
              <span className="filter-label">
                <StarIcon size={15} color="#f59e0b" /> Minimum Rating:
              </span>
              <div className="stars-selector">
                {[1, 2, 3, 4, 5].map((s) => {
                  const isActive = s <= filters.min_rating;
                  return (
                    <button
                      key={s}
                      type="button"
                      className={`star-pill-btn ${isActive ? "star-active" : ""}`}
                      onClick={() => setRating(s)}
                      title={`Filter ${s}+ Stars`}
                    >
                      ★ {s}+
                    </button>
                  );
                })}
                {filters.min_rating > 0 && (
                  <button
                    type="button"
                    className="clear-stars-btn"
                    onClick={() => onChange({ ...filters, min_rating: 0 })}
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Open Now Toggle */}
            <div className="toggle-filter-group">
              <label className="switch-label">
                <input
                  type="checkbox"
                  checked={filters.open_now}
                  onChange={toggleOpenNow}
                  className="toggle-checkbox"
                />
                <span className="toggle-slider" />
                <span className="toggle-text">
                  <ClockIcon size={15} color="#10b981" /> Open Now Only
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Footer / Trigger Search */}
      <div className="panel-footer">
        <div className="search-stats-hint">
          {filters.keyword && filters.location ? (
            <span>Targeting: <strong className="highlight-tag">{filters.keyword}</strong> in <strong className="highlight-tag">{filters.location}</strong></span>
          ) : isUrlMode && filters.maps_url ? (
            <span>Targeting: <strong className="highlight-tag">Direct Google Maps Coordinates</strong></span>
          ) : (
            <span className="hint-muted">Enter a search keyword &amp; location or switch to direct URL mode</span>
          )}
        </div>

        <button
          type="button"
          className={`btn-primary-action ${loading ? "btn-loading" : ""}`}
          onClick={onSearch}
          disabled={loading || isSearchDisabled}
        >
          {loading ? (
            <>
              <span className="spinner-icon" />
              <span>Scraping Intelligence...</span>
            </>
          ) : (
            <>
              <SearchIcon size={17} />
              <span>Launch Lead Scraper</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
