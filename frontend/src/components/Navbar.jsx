import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  MapPinIcon, SearchIcon, SparklesIcon, LayersIcon,
  DatabaseIcon, ShieldCheckIcon, AwardIcon, SlidersIcon,
  MenuIcon, XIcon
} from "./Icons";
import API from "../api";

export default function Navbar() {
  const location = useLocation();
  const [backendOnline, setBackendOnline] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    const checkHealth = async () => {
      try {
        const res = await fetch(`${API}/health`, { signal: AbortSignal.timeout(3000) });
        if (mounted) setBackendOnline(res.ok);
      } catch {
        if (mounted) setBackendOnline(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const navItems = [
    { path: "/", label: "Overview", icon: LayersIcon },
    { path: "/overseas-pakistanis", label: "Overseas Leads", icon: AwardIcon },
    { path: "/leads", label: "Lead CRM", icon: DatabaseIcon },
    { path: "/maps", label: "Maps Leads", icon: MapPinIcon },
    { path: "/dorking", label: "Web Research", icon: SearchIcon },
    { path: "/compliance", label: "Compliance", icon: ShieldCheckIcon },
    { path: "/settings", label: "Settings", icon: SlidersIcon },
  ];

  const bottomNavItems = [
    { path: "/", label: "Home", icon: LayersIcon },
    { path: "/overseas-pakistanis", label: "Overseas", icon: AwardIcon },
    { path: "/leads", label: "CRM", icon: DatabaseIcon },
    { path: "/maps", label: "Maps", icon: MapPinIcon },
    { path: "/compliance", label: "Compliance", icon: ShieldCheckIcon },
  ];

  return (
    <>
      <header className="navbar-container">
        <div className="navbar-content">
          {/* Brand Logo */}
          <Link to="/" className="navbar-brand">
            <div className="brand-icon-wrapper" style={{ background: "linear-gradient(135deg, #10b981 0%, #6366f1 100%)" }}>
              <AwardIcon size={20} color="#ffffff" />
            </div>
            <div className="brand-text">
              <span className="brand-title">ApexLead <span className="brand-highlight" style={{ color: "#10b981" }}>AI</span></span>
              <span className="brand-tagline">Islamabad Real Estate</span>
            </div>
          </Link>

          {/* Desktop Navigation Tabs */}
          <nav className="navbar-nav desktop-only-nav">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`nav-link ${isActive ? "nav-link-active" : ""}`}
                >
                  <Icon size={15} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Status indicator & Mobile Toggle */}
          <div className="navbar-actions">
            <div className="status-badge desktop-only-nav">
              <span className={`status-dot ${backendOnline === true ? "dot-online" : backendOnline === false ? "dot-offline" : "dot-checking"}`} />
              <span className="status-label">
                {backendOnline === true ? "Engine Online" : backendOnline === false ? "Offline" : "Checking..."}
              </span>
            </div>

            {/* Mobile Menu Hamburger Button */}
            <button
              className="mobile-menu-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <XIcon size={22} /> : <MenuIcon size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu Drawer */}
        {mobileMenuOpen && (
          <div className="mobile-menu-drawer glass-panel animate-fade-in">
            <div className="mobile-menu-links">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`mobile-nav-link ${isActive ? "mobile-nav-link-active" : ""}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                    {isActive && <span className="mobile-active-dot" />}
                  </Link>
                );
              })}
            </div>

            <div className="mobile-menu-footer">
              <div className="status-badge" style={{ width: "100%", justifyContent: "center" }}>
                <span className={`status-dot ${backendOnline === true ? "dot-online" : backendOnline === false ? "dot-offline" : "dot-checking"}`} />
                <span className="status-label">
                  API Status: {backendOnline === true ? "Connected & Ready" : backendOnline === false ? "Offline" : "Checking..."}
                </span>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Floating Bottom Navigation Bar for Mobile Phones */}
      <nav className="mobile-bottom-dock">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`bottom-dock-item ${isActive ? "bottom-dock-active" : ""}`}
            >
              <div className="bottom-dock-icon">
                <Icon size={19} />
              </div>
              <span className="bottom-dock-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
