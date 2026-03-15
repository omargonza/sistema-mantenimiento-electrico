// src/components/AdminAuditButton.jsx
import { useNavigate } from "react-router-dom";
import { getCurrentUser } from "../api";

export default function AdminAuditButton() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const role = user?.profile?.role;

  if (role !== "admin") return null;

  return (
    <button
      type="button"
      onClick={() => navigate("/auditoria-ot")}
      style={{
        position: "fixed",
        right: 14,
        bottom: 84, // deja lugar para el BottomBar
        zIndex: 60,
        border: "none",
        borderRadius: 999,
        padding: "12px 14px",
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
        boxShadow: "0 10px 24px rgba(0,0,0,.28)",
        background: "#f59e0b",
        color: "#111827",
      }}
      aria-label="Ir a auditoría de órdenes"
      title="Auditoría de OTs"
    >
      Auditoría OTs
    </button>
  );
}
