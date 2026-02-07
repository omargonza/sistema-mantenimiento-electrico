import { NavLink } from "react-router-dom";
import {
  Home,
  PlusCircle,
  FileText,
  ListChecks,
  LayoutList,
} from "lucide-react";
import "../styles/bottombar.css";

export default function BottomBar() {
  const cls = ({ isActive }) => `nav-btn ${isActive ? "nav-btn--active" : ""}`;

  return (
    <nav className="bottom-bar" aria-label="Navegación inferior">
      <NavLink to="/" className={cls} title="Inicio" aria-label="Inicio">
        <Home size={22} />
      </NavLink>

      <NavLink
        to="/nueva"
        className={cls}
        title="Nueva OT"
        aria-label="Nueva OT"
      >
        <PlusCircle size={22} />
      </NavLink>

      <NavLink
        to="/historial"
        className={cls}
        title="Historial"
        aria-label="Historial"
      >
        <LayoutList size={22} />
      </NavLink>

      <NavLink
        to="/mis-pdfs"
        className={cls}
        title="Mis PDFs"
        aria-label="Mis PDFs"
      >
        <FileText size={22} />
      </NavLink>

      <NavLink
        to="/historial-luminarias"
        className={cls}
        title="Luminarias"
        aria-label="Luminarias"
      >
        <ListChecks size={22} />
      </NavLink>
    </nav>
  );
}
