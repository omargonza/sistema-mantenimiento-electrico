import { useEffect, useMemo, useRef, useState, useDeferredValue, useCallback } from "react";
import "../styles/smartselect.css";
import { vibrar } from "../utils/haptics";

const MAX_RENDER = 200; // subilo/bajalo según tus listas

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

export default function SmartSelect({ label, value, options = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const deferredSearch = useDeferredValue(busqueda); // suaviza tipeo en móviles
  const [favoritos, setFavoritos] = useState([]);

  const sheetRef = useRef(null);
  const inputRef = useRef(null);

  // Favoritos
  useEffect(() => {
    const fav = JSON.parse(localStorage.getItem("fav_" + label) || "[]");
    setFavoritos(Array.isArray(fav) ? fav : []);
  }, [label]);

  const saveFavorito = useCallback(
    (op) => {
      const nuevo = [op, ...favoritos.filter((f) => f !== op)].slice(0, 5);
      setFavoritos(nuevo);
      localStorage.setItem("fav_" + label, JSON.stringify(nuevo));
    },
    [favoritos, label]
  );

  const optionsNorm = useMemo(() => {
    // Pre-normaliza una vez por cambio de options
    return options.map((op) => ({ raw: op, n: norm(op) }));
  }, [options]);

  const filtered = useMemo(() => {
    const q = norm(deferredSearch);
    if (!q) return options;

    const out = [];
    for (let i = 0; i < optionsNorm.length; i++) {
      const item = optionsNorm[i];
      if (item.n.includes(q)) {
        out.push(item.raw);
        if (out.length >= MAX_RENDER) break;
      }
    }
    return out;
  }, [deferredSearch, options, optionsNorm]);

  const openSheet = useCallback(() => {
    vibrar?.(15);
    setOpen(true);
    // foco seguro
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const closeSheet = useCallback(() => {
    setOpen(false);
    setBusqueda("");
  }, []);

  // ESC para cerrar (desktop / teclados móviles)
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeSheet();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeSheet]);

  // Bloquear scroll del body mientras está abierto (a prueba de fallos)
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev || "";
      };
    } else {
      // Fallback duro por si quedó bloqueado por cualquier motivo
      document.body.style.overflow = "";
    }
  }, [open]);


  const pick = useCallback(
    (op) => {
      vibrar?.(20);
      onChange?.(op);
      saveFavorito(op);
      closeSheet();
    },
    [onChange, saveFavorito, closeSheet]
  );

  return (
    <div className="smartselect">
      <label>{label}</label>

      <button
        type="button"
        className="smartselect-display"
        onClick={() => (open ? closeSheet() : openSheet())}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={value ? "ss-value" : "ss-placeholder"}>
          {value || "Seleccione..."}
        </span>
        <span className="ss-chevron" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="ss-overlay" onClick={closeSheet} role="dialog" aria-label={label}>
          <div
            className="ss-sheet"
            ref={sheetRef}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ss-handle" />

            <div className="ss-head">
              <div className="ss-title">{label}</div>
              <button type="button" className="ss-close" onClick={closeSheet}>Cerrar</button>
            </div>

            <input
              ref={inputRef}
              className="ss-search"
              placeholder="Buscar..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              inputMode="search"
            />

            <div className="ss-list">
              {favoritos.length > 0 && (
                <div className="ss-group">
                  <div className="ss-group-title">Favoritos</div>
                  {favoritos.map((op) => (
                    <button
                      key={"fav_" + op}
                      type="button"
                      className="ss-item ss-fav"
                      onClick={() => pick(op)}
                    >
                      ⭐ {op}
                    </button>
                  ))}
                </div>
              )}

              <div className="ss-group">
                {filtered.length === 0 ? (
                  <div className="ss-empty">Sin resultados</div>
                ) : (
                  filtered.map((op) => (
                    <button
                      key={op}
                      type="button"
                      className="ss-item"
                      onClick={() => pick(op)}
                    >
                      {op}
                    </button>
                  ))
                )}
              </div>

              {norm(deferredSearch) && optionsNorm.length > MAX_RENDER && (
                <div className="ss-hint">
                  Mostrando {Math.min(filtered.length, MAX_RENDER)} resultados. Refiná la búsqueda para ver más.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
