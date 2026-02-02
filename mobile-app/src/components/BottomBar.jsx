// src/components/BottomBar.jsx
import { NavLink } from "react-router-dom";
import { Home, PlusCircle, FileText, ListChecks } from "lucide-react";
import "../styles/bottombar.css";

export default function BottomBar() {
  const cls = ({ isActive }) => `nav-btn ${isActive ? "nav-btn--active" : ""}`;

  return (
    <nav className="bottom-bar" aria-label="Navegación inferior">
      <NavLink to="/" className={cls}>
        <Home size={20} />
        <span>Inicio</span>
      </NavLink>

      <NavLink to="/nueva" className={cls}>
        <PlusCircle size={20} />
        <span>Nueva OT</span>
      </NavLink>

      <NavLink to="/mis-pdfs" className={cls}>
        <FileText size={20} />
        <span>Mis PDFs</span>
      </NavLink>

      <NavLink to="/historial-luminarias" className={cls}>
        <ListChecks size={20} />
        <span>Luminarias</span>
      </NavLink>
    </nav>
  );
}
