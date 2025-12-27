// src/components/TableroAutocomplete.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { buscarTableros } from "../services/tablerosAutocompleteApi";

/**
 * TableroAutocomplete (PRO)
 * - Debounce + AbortController
 * - Busca desde 3 caracteres
 * - Evita re-buscar cuando el usuario selecciona un item (reduce requests/logs)
 * - “Sin resultados” consistente
 * - Cierra en blur (con delay) y al seleccionar
 * - Evita flicker de loading con requestId
 */
export default function TableroAutocomplete({
  value = "",
  onSelect,
  placeholder = "Buscar tablero…",
  limit = 20,
  minChars = 3,
  debounceMs = 220,
}) {
  const [q, setQ] = useState(value || "");
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const ctrlRef = useRef(null);
  const tRef = useRef(null);
  const reqIdRef = useRef(0);

  // evita disparar búsqueda cuando el input se llena por selección
  const selectedRef = useRef(false);

  // para mostrar “Sin resultados” solo si ya se intentó buscar
  const searchedOnceRef = useRef(false);

  useEffect(() => setQ(value || ""), [value]);

  const trimmed = (q ?? "").trim();
  const canSearch = useMemo(() => trimmed.length >= minChars, [trimmed, minChars]);

  const closeDropdown = () => {
    setOpen(false);
    setItems([]);
  };

  useEffect(() => {
    // limpiar debounce anterior
    if (tRef.current) clearTimeout(tRef.current);

    // cancelar request anterior
    if (ctrlRef.current) ctrlRef.current.abort();

    // si el cambio vino de un click en la lista, no re-buscar
    if (selectedRef.current) {
      selectedRef.current = false;
      setLoading(false);
      return;
    }

    if (!canSearch) {
      searchedOnceRef.current = false; // resetea estado “sin resultados”
      setLoading(false);
      closeDropdown();
      return;
    }

    const myReqId = ++reqIdRef.current;
    searchedOnceRef.current = true;

    // abrimos el panel en cuanto empieza una búsqueda (lista o “sin resultados”)
    setOpen(true);

    tRef.current = setTimeout(async () => {
      const ctrl = new AbortController();
      ctrlRef.current = ctrl;

      setLoading(true);
      try {
        const data = await buscarTableros(trimmed, { signal: ctrl.signal, limit });

        // ignorar respuestas viejas
        if (reqIdRef.current !== myReqId) return;

        setItems(Array.isArray(data) ? data : []);
      } catch (e) {
        if (e?.name !== "AbortError") {
          if (reqIdRef.current !== myReqId) return;
          setItems([]);
        }
      } finally {
        if (reqIdRef.current === myReqId) setLoading(false);
      }
    }, debounceMs);

    return () => {
      if (tRef.current) clearTimeout(tRef.current);
      if (ctrlRef.current) ctrlRef.current.abort();
    };
  }, [trimmed, canSearch, limit, minChars, debounceMs]);

  const showNoResults =
    open &&
    !loading &&
    canSearch &&
    searchedOnceRef.current &&
    items.length === 0;

  return (
    <div style={{ position: "relative" }}>
      <input
        className="input"
        value={q}
        placeholder={placeholder}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => {
          if (canSearch) setOpen(true);
        }}
        onBlur={() => {
          // delay corto para permitir click en item
          setTimeout(() => closeDropdown(), 140);
        }}
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        inputMode="search"
        enterKeyHint="search"
      />

      {loading && (
        <div className="muted" style={{ marginTop: 6 }}>
          Buscando…
        </div>
      )}

      {open && items.length > 0 && (
        <div
          style={{
            position: "absolute",
            zIndex: 50,
            left: 0,
            right: 0,
            top: "calc(100% + 6px)",
            borderRadius: 12,
            border: "1px solid rgba(148,163,184,.28)",
            background: "rgba(2,6,23,.96)",

            maxHeight: "38vh",
            overflowY: "auto",
            overscrollBehavior: "contain",

            boxShadow: "0 10px 25px rgba(0,0,0,.35)",
            backdropFilter: "blur(4px)",
          }}
        >
          {items.map((t, idx) => (
            <button
              key={t.id ?? `${t.nombre}-${t.zona}-${idx}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()} // evita perder foco antes de click
              onClick={() => {
                selectedRef.current = true; // ✅ evita request con texto completo
                setQ(t.nombre);
                closeDropdown();
                onSelect?.(t); // {id, nombre, zona}
              }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 12px",
                border: "none",
                background: "transparent",
                color: "inherit",
              }}
            >
              <div style={{ fontWeight: 800 }}>{t.nombre}</div>
              <div className="muted" style={{ marginTop: 2 }}>
                {t.zona}
              </div>
            </button>
          ))}
        </div>
      )}

      {showNoResults && (
        <div className="muted" style={{ marginTop: 6 }}>
          Sin resultados.
        </div>
      )}

      {!canSearch && trimmed.length > 0 && (
        <div className="muted" style={{ marginTop: 6 }}>
          Escribí al menos {minChars} caracteres…
        </div>
      )}
    </div>
  );
}
