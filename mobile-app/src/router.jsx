import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import NuevaOT from "./pages/NuevaOT";
import DetalleOT from "./pages/DetalleOT";
import BottomBar from "./components/BottomBar";
import Historial from "./pages/Historial";

export default function Router() {
    return (
  
            <div className="app-wrapper">
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/nueva" element={<NuevaOT />} />
                    <Route path="/detalle/:id" element={<DetalleOT />} />
                    <Route path="/historial" element={<Historial />} />
                </Routes>

                <BottomBar />
            </div>
        
    );
}
