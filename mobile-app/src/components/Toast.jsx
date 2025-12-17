// src/components/Toast.jsx
import { useEffect } from "react";

export default function Toast({ open, type = "info", message, onClose, ms = 2200 }) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => onClose?.(), ms);
    return () => clearTimeout(t);
  }, [open, ms, onClose]);

  if (!open) return null;

  return (
    <div className={`toast toast-${type}`} role="status" aria-live="polite">
      <div className="toast-inner">
        <b className="toast-title">
          {type === "ok" ? "Listo" : type === "warn" ? "Atención" : "Aviso"}
        </b>
        <div className="toast-msg">{message}</div>
      </div>

      <button className="toast-x" onClick={onClose} aria-label="Cerrar">
        ✕
      </button>
    </div>
  );
}
