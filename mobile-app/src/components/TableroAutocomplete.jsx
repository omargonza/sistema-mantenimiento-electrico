// src/components/TableroAutocomplete.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { buscarTableros } from "../services/tablerosAutocompleteApi";

/**
 * TableroAutocomplete (PRO)
 * - Debounce + AbortController
 * - Busca desde N caracteres
 * - Evita re-buscar cuando el usuario selecciona un item
 * - “Sin resultados” consistente
 * - Cierra en blur (con delay) y al seleccionar
 * - Soporta:
 *    - onChangeText(texto) -> para controlar el valor en el padre
 *    - onSubmit(texto) -> Enter para buscar directo sin seleccionar
 */
export default function TableroAutocomplete({
  value = "",
  onSelect,
  onChangeText, // <-- NUEVO
  onSubmit, // <-- NUEVO
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

  const selectedRef = useRef(false);
  const searchedOnceRef = useRef(false);

  useEffect(() => setQ(value || ""), [value]);

  const trimmed = (q ?? "").trim();
  const canSearch = useMemo(
    () => trimmed.length >= minChars,
    [trimmed, minChars]
  );

  const closeDropdown = () => {
    setOpen(false);
    setItems([]);
  };

  useEffect(() => {
    if (tRef.current) clearTimeout(tRef.current);
    if (ctrlRef.current) ctrlRef.current.abort();

    if (selectedRef.current) {
      selectedRef.current = false;
      setLoading(false);
      return;
    }

    if (!canSearch) {
      searchedOnceRef.current = false;
      setLoading(false);
      closeDropdown();
      return;
    }

    const myReqId = ++reqIdRef.current;
    searchedOnceRef.current = true;
    setOpen(true);

    tRef.current = setTimeout(async () => {
      const ctrl = new AbortController();
      ctrlRef.current = ctrl;

      setLoading(true);
      try {
        const data = await buscarTableros(trimmed, {
          signal: ctrl.signal,
          limit,
        });
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
        onChange={(e) => {
          const v = e.target.value;
          setQ(v);
          onChangeText?.(v); // <-- NUEVO: notifica al padre
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            closeDropdown();
            onSubmit?.(q); // <-- NUEVO: buscar directo
          }
          if (e.key === "Escape") {
            closeDropdown();
          }
        }}
        onFocus={() => {
          if (canSearch) setOpen(true);
        }}
        onBlur={() => {
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
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                selectedRef.current = true;
                setQ(t.nombre);
                onChangeText?.(t.nombre); // <-- NUEVO: mantiene sincronía con padre
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
