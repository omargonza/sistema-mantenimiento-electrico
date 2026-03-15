// src/Router.jsx
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
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
import { getAccessToken, getCurrentUser } from "./api";

function AppLayout({ children }) {
  const location = useLocation();
  const token = getAccessToken();
  const user = getCurrentUser();

  const isLogged = Boolean(token && user);
  const hideBottomBar = location.pathname === "/login" || !isLogged;

  return (
    <div className="app-wrapper">
      {children}
      {!hideBottomBar ? <BottomBar /> : null}
    </div>
  );
}

function RootRedirect() {
  const token = getAccessToken();
  const user = getCurrentUser();
  const isLogged = Boolean(token && user);

  return <Navigate to={isLogged ? "/dashboard" : "/login"} replace />;
}

function LoginRoute() {
  const token = getAccessToken();
  const user = getCurrentUser();
  const isLogged = Boolean(token && user);

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

        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </AppLayout>
  );
}
