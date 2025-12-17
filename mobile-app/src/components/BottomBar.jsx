// src/components/BottomBar.jsx
import { NavLink } from "react-router-dom";
import "../styles/bottombar.css";

export default function BottomBar() {
  return (
    <nav className="bottom-bar" aria-label="Navegación inferior">
      <NavLink className="bottom-btn" to="/">
        <div>🏠</div>
        <span>Inicio</span>
      </NavLink>

      <NavLink className="bottom-btn" to="/nueva">
        <div>➕</div>
        <span>Nueva OT</span>
      </NavLink>
    </nav>
  );
}
