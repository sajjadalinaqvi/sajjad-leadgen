import React, { useState } from "react";
import { DownloadIcon, FileCsvIcon, FileExcelIcon, FileJsonIcon, CopyIcon, CheckIcon, SparklesIcon } from "./Icons";
import API from "../api";

export default function ExportButtons({ results = [], filters = {}, type = "maps", onNotify }) {
  const [exporting, setExporting] = useState("");
  const [copiedEmails, setCopiedEmails] = useState(false);

  if (!results.length) return null;

  const download = async (fmt) => {
    setExporting(fmt);
    try {
      const endpoint = type === "maps" ? "export-scrape" : "export-dork";
      const payload = {
        ...filters,
        results_per_page: 75,
      };

      const res = await fetch(`${API}/${endpoint}/${fmt}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Export failed: HTTP ${res.status}`);
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}_leads_${new Date().toISOString().slice(0, 10)}.${fmt === "excel" ? "xlsx" : fmt}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      if (onNotify) {
        onNotify(`Exported ${fmt.toUpperCase()} file successfully!`, "success");
      }
    } catch (e) {
      if (onNotify) {
        onNotify(`Export error: ${e.message}`, "error");
      }
    } finally {
      setExporting("");
    }
  };

  const copyAllEmails = () => {
    const emails = results
      .map((r) => r.email)
      .filter((e) => e && e.trim() !== "")
      .join(", ");

    if (!emails) {
      if (onNotify) onNotify("No emails found in this result set.", "error");
      return;
    }

    navigator.clipboard.writeText(emails);
    setCopiedEmails(true);
    if (onNotify) onNotify("Copied all extracted emails to clipboard!", "success");
    setTimeout(() => setCopiedEmails(false), 2500);
  };

  return (
    <div className="export-toolbar glass-panel animate-fade-in">
      <div className="export-info">
        <div className="export-title-row">
          <DownloadIcon size={18} color="#6366f1" />
          <span className="export-heading">Export & Action Center</span>
          <span className="export-badge">Top 75 Deep Batch</span>
        </div>
        <span className="export-subtext">Download structured lead intelligence directly to your preferred format</span>
      </div>

      <div className="export-actions-group">
        <button
          className="btn-export-quick"
          onClick={copyAllEmails}
          title="Copy all available email addresses to clipboard"
        >
          {copiedEmails ? <CheckIcon size={15} color="#10b981" /> : <CopyIcon size={15} />}
          <span>{copiedEmails ? "Emails Copied!" : "Copy All Emails"}</span>
        </button>

        <button
          className="btn-export-format btn-csv"
          onClick={() => download("csv")}
          disabled={!!exporting}
        >
          <FileCsvIcon size={16} />
          <span>{exporting === "csv" ? "Exporting..." : "CSV"}</span>
        </button>

        <button
          className="btn-export-format btn-excel"
          onClick={() => download("excel")}
          disabled={!!exporting}
        >
          <FileExcelIcon size={16} />
          <span>{exporting === "excel" ? "Exporting..." : "Excel"}</span>
        </button>

        <button
          className="btn-export-format btn-json"
          onClick={() => download("json")}
          disabled={!!exporting}
        >
          <FileJsonIcon size={16} />
          <span>{exporting === "json" ? "Exporting..." : "JSON"}</span>
        </button>
      </div>
    </div>
  );
}
