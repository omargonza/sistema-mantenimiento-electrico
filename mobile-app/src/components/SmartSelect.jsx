import { useState, useEffect, useRef } from "react";
import "../styles/smartselect.css";
import { vibrar } from "../utils/haptics";

/* =======================================================
   SmartSelect INDUSTRIAL — versión FULL
   - búsqueda instantánea
   - favoritos automáticos
   - scroll rápido
   - agrupación opcional
   - liviano, 0 dependencias
======================================================= */

export default function SmartSelect({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [favoritos, setFavoritos] = useState([]);
  const ref = useRef(null);

  /* ---------------------------------------------------
     Cargar favoritos de localStorage
  --------------------------------------------------- */
  useEffect(() => {
    const fav = JSON.parse(localStorage.getItem("fav_" + label) || "[]");
    setFavoritos(fav);
  }, [label]);

  /* ---------------------------------------------------
     Guardar favorito cuando se selecciona uno
  --------------------------------------------------- */
  function saveFavorito(op) {
    const nuevo = [op, ...favoritos.filter((f) => f !== op)].slice(0, 5);
    setFavoritos(nuevo);
    localStorage.setItem("fav_" + label, JSON.stringify(nuevo));
  }

  /* ---------------------------------------------------
     Cerrar al click afuera
  --------------------------------------------------- */
  useEffect(() => {
    function listener(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, []);

  /* ---------------------------------------------------
     Filtrar opciones por búsqueda
  --------------------------------------------------- */
  const filtered = options.filter((op) =>
    op.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="smartselect" ref={ref}>
      <label>{label}</label>

      {/* Campo visual */}
      <div
        className="smartselect-display"
        onClick={() => {
          vibrar(15);
          setOpen(!open);
        }}
      >
        {value || "Seleccione..."}
      </div>

      {/* Panel */}
      {open && (
        <div className="smartselect-panel">

          {/* Buscador */}
          <input
            className="smartselect-search"
            placeholder="Buscar..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            autoFocus
          />

          {/* Favoritos */}
          {favoritos.length > 0 && (
            <div className="smartselect-group">
              <div className="smartselect-title">Favoritos</div>
              {favoritos.map((op) => (
                <div
                  key={"fav_" + op}
                  className="smartselect-item fav"
                  onClick={() => {
                    vibrar(20);
                    onChange(op);
                    saveFavorito(op);
                    setOpen(false);
                    setBusqueda("");
                  }}
                >
                  ⭐ {op}
                </div>
              ))}
            </div>
          )}

          {/* Opciones filtradas */}
          <div className="smartselect-group">
            {filtered.length === 0 ? (
              <div className="smartselect-empty">Sin resultados</div>
            ) : (
              filtered.map((op) => (
                <div
                  key={op}
                  className="smartselect-item"
                  onClick={() => {
                    vibrar(20);
                    onChange(op);
                    saveFavorito(op);
                    setOpen(false);
                    setBusqueda("");
                  }}
                >
                  {op}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
