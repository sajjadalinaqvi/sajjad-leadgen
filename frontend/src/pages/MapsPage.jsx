import React, { useState, useRef } from "react";
import Navbar from "../components/Navbar";
import SearchFilters from "../components/SearchFilters";
import ResultsTable from "../components/ResultsTable";
import ExportButtons from "../components/ExportButtons";
import StatsCards from "../components/StatsCards";
import Toast from "../components/Toast";
import { MapPinIcon, SparklesIcon, AlertTriangleIcon, RefreshIcon } from "../components/Icons";
import API from "../api";

const DEFAULT_FILTERS = {
  maps_url: "",
  keyword: "",
  location: "",
  category: "",
  min_rating: 0,
  open_now: false,
};

export default function MapsPage() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const filtersRef = useRef(DEFAULT_FILTERS);
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);

  const showNotification = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
    filtersRef.current = newFilters;
  };

  const fetchPage = async (p) => {
    const f = filtersRef.current;
    if (!f.maps_url.trim() && !f.keyword.trim() && !f.location.trim()) {
      setError("Please specify a search keyword, location, or direct Google Maps URL.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const payload = {
        page: p,
        results_per_page: 25,
        maps_url: f.maps_url.trim(),
        keyword: f.keyword,
        location: f.location,
        category: f.category,
        min_rating: f.min_rating,
        open_now: f.open_now,
      };

      let res;
      try {
        res = await fetch(`${API}/scrape`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch {
        throw new Error("Cannot connect to backend server. Make sure the backend service is running on port 8005.");
      }

      if (res.status === 500) throw new Error("Backend server encountered an error while scraping Google Maps.");
      if (res.status === 422) throw new Error("Invalid request parameters sent to scraper.");
      if (!res.ok) throw new Error(`Scraper returned HTTP status: ${res.status}`);

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!Array.isArray(data.results)) throw new Error("Unexpected response structure from scraper.");

      setResults(data.results);
      setPage(p);
      setHasMore(data.results.length === 25);
      showNotification(`Extracted ${data.results.length} leads for Page ${p}!`, "success");
    } catch (e) {
      setError(e.message);
      showNotification(e.message, "error");
      if (p > 1) setPage(p - 1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-wrapper">
      <Navbar />

      <main className="main-content-container">
        {/* Page Hero Header */}
        <div className="page-header animate-fade-in">
          <div className="page-header-badge">
            <MapPinIcon size={14} color="#6366f1" />
            <span>Google Maps B2B Intelligence</span>
          </div>
          <h1 className="page-title">Google Maps Lead Generator</h1>
          <p className="page-subtitle">
            Extract verified business contacts, email addresses, phone numbers, customer ratings, and websites at scale.
          </p>
        </div>

        {/* Search Panel */}
        <SearchFilters
          filters={filters}
          onChange={handleFiltersChange}
          onSearch={() => fetchPage(1)}
          loading={loading}
        />

        {/* Error Banner */}
        {error && (
          <div className="alert-banner alert-error animate-fade-in">
            <div className="alert-content">
              <AlertTriangleIcon size={20} color="#f43f5e" />
              <span>{error}</span>
            </div>
            <button className="alert-dismiss" onClick={() => setError("")}>
              ✕
            </button>
          </div>
        )}

        {/* Active Scraping Loading Banner */}
        {loading && (
          <div className="scraper-progress-card glass-panel animate-fade-in">
            <div className="progress-spinner-wrap">
              <div className="loader-ring" />
              <MapPinIcon size={24} color="#6366f1" />
            </div>
            <div className="progress-text-wrap">
              <h4>Scraping Google Maps in Real-Time...</h4>
              <p>Extracting business details, websites, ratings, and phone numbers. This typically takes 20–45s.</p>
            </div>
          </div>
        )}

        {/* Live Computed Insights */}
        {results.length > 0 && (
          <StatsCards results={results} type="maps" />
        )}

        {/* Export & Action Center */}
        {results.length > 0 && (
          <ExportButtons
            results={results}
            filters={filters}
            type="maps"
            onNotify={showNotification}
          />
        )}

        {/* Leads Table & Cards View */}
        <ResultsTable
          results={results}
          page={page}
          onPageChange={fetchPage}
          hasMore={hasMore}
          loading={loading}
          onNotify={showNotification}
        />

        {/* Empty state placeholder before any search */}
        {!loading && !error && results.length === 0 && (
          <div className="empty-hero-state glass-panel animate-fade-in">
            <div className="empty-icon-box">
              <SparklesIcon size={32} color="#6366f1" />
            </div>
            <h3>Ready to Extract Qualified Leads</h3>
            <p>
              Select a quick preset above or enter your targeted keyword &amp; city to extract complete business intelligence.
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
