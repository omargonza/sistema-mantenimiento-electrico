// src/Router.jsx
import { useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { LogOut } from "lucide-react";

import Dashboard from "./pages/Dashboard";
import NuevaOT from "./pages/NuevaOT";
import DetalleOT from "./pages/DetalleOT";
import BottomBar from "./components/BottomBar";
import Historial from "./pages/Historial";
import HistorialLuminarias from "./pages/HistorialLuminarias";
import DashboardLuminarias from "./pages/DashboardLuminarias";
import MisPdfs from "./pages/MisPdfs";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import AuditoriaOT from "./pages/AuditoriaOT";
import { getAccessToken, getCurrentUser, logout } from "./api";
import UsuariosTecnicos from "./pages/UsuariosTecnicos";

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

function isAuthenticated() {
  const token = getAccessToken();
  const user = getCurrentUser();
  return isValidToken(token) && isValidUser(user);
}

function getDisplayName(user) {
  if (!user) return "Operador";
  return (
    user.nombre || user.legajo || user.email || user.username || "Operador"
  );
}

function AppLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [closingSession, setClosingSession] = useState(false);

  const isLogged = isAuthenticated();
  const user = getCurrentUser();

  const hideBottomBar = location.pathname === "/login" || !isLogged;
  const showSessionBar = location.pathname !== "/login" && isLogged;

  const handleLogout = async () => {
    if (closingSession) return;

    setClosingSession(true);
    try {
      await logout();
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
    } finally {
      setClosingSession(false);
      navigate("/login", { replace: true });
    }
  };

  return (
    <div className="app-wrapper">
      {showSessionBar ? (
        <div className="app-session-strip">
          <div className="app-session-strip__user">
            <span className="app-session-strip__label">Sesión activa</span>
            <strong className="app-session-strip__name">
              {getDisplayName(user)}
            </strong>
          </div>

          <button
            type="button"
            className="btn-outline app-session-strip__logout"
            onClick={handleLogout}
            disabled={closingSession}
            title="Cerrar sesión"
          >
            <LogOut size={16} strokeWidth={2.2} />
            <span>{closingSession ? "Saliendo..." : "Cerrar sesión"}</span>
          </button>
        </div>
      ) : null}

      {children}

      {!hideBottomBar ? <BottomBar /> : null}
    </div>
  );
}

function RootRedirect() {
  const isLogged = isAuthenticated();
  return <Navigate to={isLogged ? "/dashboard" : "/login"} replace />;
}

function LoginRoute() {
  const isLogged = isAuthenticated();
  return isLogged ? <Navigate to="/dashboard" replace /> : <Login />;
}

export default function Router() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginRoute />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute roles={["admin", "technician"]}>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/nueva"
          element={
            <ProtectedRoute roles={["admin", "technician"]}>
              <NuevaOT />
            </ProtectedRoute>
          }
        />

        <Route
          path="/historial"
          element={
            <ProtectedRoute roles={["admin", "technician"]}>
              <Historial />
            </ProtectedRoute>
          }
        />

        <Route
          path="/historial-luminarias"
          element={
            <ProtectedRoute roles={["admin", "technician"]}>
              <HistorialLuminarias />
            </ProtectedRoute>
          }
        />

        <Route
          path="/mis-pdfs"
          element={
            <ProtectedRoute roles={["admin", "technician"]}>
              <MisPdfs />
            </ProtectedRoute>
          }
        />

        <Route
          path="/detalle/:id"
          element={
            <ProtectedRoute roles={["admin"]}>
              <DetalleOT />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard-luminarias"
          element={
            <ProtectedRoute roles={["admin"]}>
              <DashboardLuminarias />
            </ProtectedRoute>
          }
        />

        <Route
          path="/auditoria-ot"
          element={
            <ProtectedRoute roles={["admin"]}>
              <AuditoriaOT />
            </ProtectedRoute>
          }
        />
        <Route
          path="/usuarios-tecnicos"
          element={
            <ProtectedRoute roles={["admin"]}>
              <UsuariosTecnicos />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </AppLayout>
  );
}
