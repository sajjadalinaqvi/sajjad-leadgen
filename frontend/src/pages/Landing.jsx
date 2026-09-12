import React from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import {
  MapPinIcon, SearchIcon, SparklesIcon, ArrowRightIcon, ZapIcon,
  GlobeIcon, MailIcon, PhoneIcon, DownloadIcon, CheckIcon, TerminalIcon,
  DatabaseIcon, ShieldCheckIcon, AwardIcon
} from "../components/Icons";

const TOOLS = [
  {
    path: "/overseas-pakistanis",
    icon: AwardIcon,
    badge: "Core Specialized Engine",
    badgeColor: "#10b981",
    title: "Overseas Pakistani Leads",
    subtitle: "Evidence-Based Real Estate Investor Intelligence",
    desc: "Discover financially successful Pakistanis residing outside Pakistan with documented signals of wealth and potential interest in Islamabad real estate.",
    features: [
      "Transparent Scoring (Pakistan Connection + Financial Signals)",
      "Target Tier 1 (UAE, KSA, UK, USA) & Tier 2 Markets",
      "Explainable Evidence Drawer ('Why is this lead scored 87?')",
      "Human-in-the-Loop Qualification & Outreach Control",
    ],
    accentColor: "#10b981",
    glowColor: "rgba(16, 185, 129, 0.35)",
    actionText: "Launch Investor Discovery",
  },
  {
    path: "/leads",
    icon: DatabaseIcon,
    badge: "CRM & Pipeline",
    badgeColor: "#6366f1",
    title: "Lead Database & CRM",
    subtitle: "Conversion Pipeline & Multi-Format Exports",
    desc: "Manage qualified prospects across sales stages: New → Reviewed → Contacted → Meeting → Property Viewing → Converted.",
    features: [
      "Full CRM Sales Stage Pipeline Tracking",
      "Conversion Funnel & Qualification Analytics",
      "Multi-Format Export (Excel, CSV, JSON with Evidence)",
      "Internal Notes & Agent Engagement History",
    ],
    accentColor: "#6366f1",
    glowColor: "rgba(99, 102, 241, 0.35)",
    actionText: "Open Lead Database",
  },
  {
    path: "/maps",
    icon: MapPinIcon,
    badge: "B2B Business Discovery",
    badgeColor: "#06b6d4",
    title: "Google Maps Network",
    subtitle: "Overseas Pakistani Business Finder",
    desc: "Discover diaspora-owned businesses, commercial offices, and clinics overseas for business network expansion.",
    features: [
      "Real-Time Business Contact Extraction",
      "Phone Numbers, Websites & Star Ratings",
      "Filter by Rating, Category & Hours",
      "Batch Export (CSV, Excel, JSON)",
    ],
    accentColor: "#06b6d4",
    glowColor: "rgba(6, 182, 212, 0.35)",
    actionText: "Open Maps Discovery",
  },
  {
    path: "/dorking",
    icon: TerminalIcon,
    badge: "Compliant OSINT",
    badgeColor: "#8b5cf6",
    title: "Web Research Engine",
    subtitle: "Public Executive & Association Discovery",
    desc: "Use advanced search operators to research diaspora business associations, conference rosters, and public executive bios.",
    features: [
      "Compliant Diaspora Search Presets",
      "Visual Search Operator Builder",
      "Public Record & Conference Discovery",
      "Zero Leak/Credential Scraping Safety",
    ],
    accentColor: "#8b5cf6",
    glowColor: "rgba(139, 92, 246, 0.35)",
    actionText: "Open Web Research",
  },
];

const HIGHLIGHTS = [
  {
    icon: ShieldCheckIcon,
    color: "#10b981",
    title: "Evidence > Assumptions",
    desc: "Never infers Pakistani nationality from names alone. Every score point is tied to verifiable public evidence.",
  },
  {
    icon: AwardIcon,
    color: "#6366f1",
    title: "Quality Over Volume",
    desc: "Optimized to deliver high-converting, qualified prospects for Islamabad property deals rather than thousands of unverified records.",
  },
  {
    icon: DatabaseIcon,
    color: "#06b6d4",
    title: "Full CRM Lifecycle",
    desc: "Track every lead from initial discovery to qualification, property viewings, negotiation, and conversion.",
  },
];

export default function Landing() {
  const nav = useNavigate();

  return (
    <div className="page-wrapper">
      <Navbar />

      <main className="landing-container animate-fade-in">
        {/* Hero Section */}
        <section className="landing-hero">
          <div className="hero-pill-badge animate-slide-up" style={{ borderColor: "rgba(16, 185, 129, 0.3)", color: "#10b981", background: "rgba(16, 185, 129, 0.1)" }}>
            <SparklesIcon size={14} color="#10b981" />
            <span>Specialized Overseas Pakistani Investor Intelligence</span>
          </div>

          <h1 className="hero-main-title animate-slide-up">
            Target Qualified Diaspora Investors for <br />
            <span className="gradient-text-hero">Islamabad Real Estate</span>
          </h1>

          <p className="hero-description animate-slide-up">
            An evidence-based lead intelligence platform that identifies financially strong Overseas Pakistanis with verifiable intent and capability to invest in Islamabad property.
          </p>
        </section>

        {/* Interactive Tool Cards Grid */}
        <section className="tools-showcase-grid">
          {TOOLS.map((tool) => {
            const ToolIcon = tool.icon;
            return (
              <div
                key={tool.path}
                className="tool-card glass-panel"
                onClick={() => nav(tool.path)}
                style={{ "--card-glow": tool.glowColor }}
              >
                <div className="tool-card-glow-overlay" />

                <div className="tool-card-header">
                  <div
                    className="tool-icon-box"
                    style={{ background: `${tool.accentColor}20`, color: tool.accentColor }}
                  >
                    <ToolIcon size={26} color={tool.accentColor} />
                  </div>
                  <span
                    className="tool-badge"
                    style={{
                      background: `${tool.badgeColor}15`,
                      color: tool.badgeColor,
                      borderColor: `${tool.badgeColor}35`,
                    }}
                  >
                    {tool.badge}
                  </span>
                </div>

                <div className="tool-card-content">
                  <h2 className="tool-title">{tool.title}</h2>
                  <span className="tool-subtitle">{tool.subtitle}</span>
                  <p className="tool-desc">{tool.desc}</p>

                  <div className="tool-features-list">
                    {tool.features.map((feat) => (
                      <div key={feat} className="tool-feature-item">
                        <CheckIcon size={14} color={tool.accentColor} />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="tool-card-footer">
                  <button
                    className="btn-tool-launch"
                    style={{ background: tool.accentColor }}
                  >
                    <span>{tool.actionText}</span>
                    <ArrowRightIcon size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </section>

        {/* Feature Highlights Section */}
        <section className="highlights-section">
          <div className="section-header">
            <h3 className="section-title">Engineered for Islamabad Real Estate Success</h3>
            <p className="section-subtitle">Fewer, higher-quality leads with transparent reasoning for maximum conversion.</p>
          </div>

          <div className="highlights-grid">
            {HIGHLIGHTS.map((item) => {
              const ItemIcon = item.icon;
              return (
                <div key={item.title} className="highlight-card glass-panel">
                  <div
                    className="highlight-icon-box"
                    style={{ background: `${item.color}18`, color: item.color }}
                  >
                    <ItemIcon size={22} color={item.color} />
                  </div>
                  <h4 className="highlight-title">{item.title}</h4>
                  <p className="highlight-desc">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Footer */}
        <footer className="landing-footer">
          <div className="footer-content">
            <div className="footer-brand">
              <span className="brand-title">ApexLead <span className="brand-highlight">AI</span></span>
              <span className="footer-copyright">© {new Date().getFullYear()} LeadGen Studio. Specialized Overseas Pakistani Investor Intelligence.</span>
            </div>
            <div className="footer-links">
              <button onClick={() => nav("/overseas-pakistanis")} className="footer-link">Overseas Leads</button>
              <button onClick={() => nav("/leads")} className="footer-link">Lead Database</button>
              <button onClick={() => nav("/compliance")} className="footer-link">Compliance</button>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
