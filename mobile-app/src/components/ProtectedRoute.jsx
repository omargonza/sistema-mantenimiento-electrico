// src/components/ProtectedRoute.jsx
import { Navigate, useLocation } from "react-router-dom";
import { getAccessToken, getCurrentUser } from "../api";

export default function ProtectedRoute({ children, roles = [] }) {
  const location = useLocation();
  const token = getAccessToken();
  const user = getCurrentUser();

  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const role = user?.profile?.role || "";

  if (roles.length > 0 && !roles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
