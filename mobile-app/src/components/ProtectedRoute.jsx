// src/components/ProtectedRoute.jsx
import { Navigate, useLocation } from "react-router-dom";
import { getAccessToken, getCurrentUser } from "../api";

function isValidToken(token) {
  if (!token || typeof token !== "string") return false;

  const clean = token.trim();
  if (!clean || clean === "null" || clean === "undefined") return false;

  return true;
}

function isValidUser(user) {
  if (!user) return false;

  if (typeof user === "string") {
    const clean = user.trim();
    if (!clean || clean === "null" || clean === "undefined") return false;
    return true;
  }

  if (typeof user === "object") {
    return Object.keys(user).length > 0;
  }

  return false;
}

function resolveUserRole(user) {
  if (!user) return "";

  // Compatibilidad con estructuras viejas si existieran
  const legacyRole = String(user?.profile?.role || user?.role || "")
    .trim()
    .toLowerCase();

  if (legacyRole) {
    if (legacyRole === "admin") return "admin";
    if (legacyRole === "technician" || legacyRole === "tecnico")
      return "technician";
  }

  // Estructura real actual
  if (user?.is_staff === true) return "admin";

  // Todo usuario autenticado no-admin entra como técnico
  return "technician";
}

export default function ProtectedRoute({ children, roles = [] }) {
  const location = useLocation();
  const token = getAccessToken();
  const user = getCurrentUser();

  if (!isValidToken(token) || !isValidUser(user)) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const role = resolveUserRole(user);

  if (roles.length > 0 && !roles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
