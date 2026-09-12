import React from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import Landing from "./pages/Landing";
import OverseasLeadsPage from "./pages/OverseasLeadsPage";
import LeadDatabasePage from "./pages/LeadDatabasePage";
import MapsPage from "./pages/MapsPage";
import DorkingPage from "./pages/DorkingPage";
import CompliancePage from "./pages/CompliancePage";
import SettingsPage from "./pages/SettingsPage";
import Navbar from "./components/Navbar";
import { SparklesIcon, ArrowLeftIcon } from "./components/Icons";
import "./App.css";

function NotFound() {
  const nav = useNavigate();
  return (
    <div className="page-wrapper">
      <Navbar />
      <div className="main-content-container" style={{ alignItems: "center", justifyContent: "center", minHeight: "70vh" }}>
        <div className="empty-hero-state glass-panel animate-slide-up" style={{ maxWidth: 480 }}>
          <div className="empty-icon-box">
            <SparklesIcon size={32} color="#6366f1" />
          </div>
          <h2>404 — Module Not Found</h2>
          <p>The requested intelligence route does not exist. Return to the main lead workspace.</p>
          <button className="btn-primary-action" onClick={() => nav("/")} style={{ marginTop: 12 }}>
            <ArrowLeftIcon size={16} />
            <span>Return to Workspace</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/overseas-pakistanis" element={<OverseasLeadsPage />} />
      <Route path="/leads" element={<LeadDatabasePage />} />
      <Route path="/maps" element={<MapsPage />} />
      <Route path="/dorking" element={<DorkingPage />} />
      <Route path="/compliance" element={<CompliancePage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
