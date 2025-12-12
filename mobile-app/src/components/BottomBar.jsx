import { NavLink } from "react-router-dom";
import "../styles/bottombar.css";

export default function BottomBar() {
    return (
        <div className="bottom-bar">
            <NavLink className="bottom-btn" to="/">
                <div>🏠</div>
                <span>Inicio</span>
            </NavLink>

            <NavLink className="bottom-btn" to="/nueva">
                <div>➕</div>
                <span>Nueva OT</span>
            </NavLink>
        </div>
    );
}
