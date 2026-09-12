import React from "react";
import { CheckIcon, AlertTriangleIcon, XIcon } from "./Icons";

export default function Toast({ message, type = "success", onClose }) {
  if (!message) return null;

  return (
    <div className={`toast-notification toast-${type} animate-slide-up`}>
      <div className="toast-icon">
        {type === "success" ? (
          <CheckIcon size={16} color="#10b981" />
        ) : (
          <AlertTriangleIcon size={16} color="#f43f5e" />
        )}
      </div>
      <div className="toast-message">{message}</div>
      <button className="toast-close" onClick={onClose}>
        <XIcon size={14} />
      </button>
    </div>
  );
}
