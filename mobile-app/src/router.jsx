// src/Router.jsx
import { Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import NuevaOT from "./pages/NuevaOT";
import DetalleOT from "./pages/DetalleOT";
import BottomBar from "./components/BottomBar";
import Historial from "./pages/Historial";
import HistorialLuminarias from "./pages/HistorialLuminarias";
import DashboardLuminarias from "./pages/DashboardLuminarias";

import MisPdfs from "./pages/MisPdfs";

export default function Router() {
  return (
    <div className="app-wrapper">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/nueva" element={<NuevaOT />} />
        <Route path="/detalle/:id" element={<DetalleOT />} />

        {/* Historial tareas (backend) */}
        <Route path="/historial" element={<Historial />} />

        {/* Historial luminarias (backend) */}
        <Route path="/historial-luminarias" element={<HistorialLuminarias />} />
        <Route path="/dashboard-luminarias" element={<DashboardLuminarias />} />

        {/* PDFs locales (IndexedDB) */}
        <Route path="/mis-pdfs" element={<MisPdfs />} />
      </Routes>

      <BottomBar />
    </div>
  );
}
