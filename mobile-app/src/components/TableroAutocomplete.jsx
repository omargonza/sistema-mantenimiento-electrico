// src/components/TableroAutocomplete.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { buscarTableros } from "../services/tablerosAutocompleteApi";

/**
 * TableroAutocomplete (PRO)
 * - Debounce + AbortController
 * - Busca desde N caracteres
 * - Evita re-buscar cuando el usuario selecciona un item
 * - “Sin resultados” + acción “Usar texto”
 * - Cierra en blur (con delay) y al seleccionar
 * - Badge "OFFLINE" si viene del cache
 * - Soporta:
 *    - onChangeText(texto)
 *    - onSubmit(texto)
 */
export default function TableroAutocomplete({
  value = "",
  onSelect,
  onChangeText,
  onSubmit,
  placeholder = "Buscar tablero…",
  limit = 20,
  minChars = 3,
  debounceMs = 220,
}) {
  const [q, setQ] = useState(value || "");
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // NUEVO: source del resultado (remote/cache)
  const [source, setSource] = useState("remote"); // "remote" | "cache"

  const ctrlRef = useRef(null);
  const tRef = useRef(null);
  const reqIdRef = useRef(0);

  const selectedRef = useRef(false);
  const searchedOnceRef = useRef(false);

  useEffect(() => setQ(value || ""), [value]);

  const trimmed = (q ?? "").trim();
  const canSearch = useMemo(
    () => trimmed.length >= minChars,
    [trimmed, minChars],
  );

  const closeDropdown = () => {
    setOpen(false);
    setItems([]);
  };

  const commitTextAsValue = () => {
    const txt = (q ?? "").trim();
    closeDropdown();
    if (!txt) return;
    onChangeText?.(txt);
    onSubmit?.(txt);
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
      setSource("remote");
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
        const res = await buscarTableros(trimmed, {
          signal: ctrl.signal,
          limit,
        });

        if (reqIdRef.current !== myReqId) return;

        // soporta:
        // - viejo formato: array
        // - nuevo formato: { items, meta:{source} }
        const nextItems = Array.isArray(res)
          ? res
          : Array.isArray(res?.items)
            ? res.items
            : [];

        const nextSource = Array.isArray(res)
          ? "remote"
          : res?.meta?.source || "remote";

        setItems(nextItems);
        setSource(nextSource);
      } catch (e) {
        if (e?.name !== "AbortError") {
          if (reqIdRef.current !== myReqId) return;
          setItems([]);
          setSource("remote");
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
          onChangeText?.(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitTextAsValue();
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

      {/* Badge OFFLINE (cache) */}
      {open && canSearch && !loading && source === "cache" && (
        <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
          Modo offline: sugerencias desde cache local.
        </div>
      )}

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

                const nombre = t?.nombre || "";
                setQ(nombre);
                onChangeText?.(nombre);

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
              <div style={{ fontWeight: 800, display: "flex", gap: 10 }}>
                <span>{t.nombre}</span>
                {source === "cache" && (
                  <span
                    className="muted"
                    style={{
                      fontSize: 12,
                      alignSelf: "center",
                      padding: "2px 8px",
                      borderRadius: 999,
                      border: "1px solid rgba(148,163,184,.25)",
                    }}
                  >
                    cache
                  </span>
                )}
              </div>

              {!!t.zona && (
                <div className="muted" style={{ marginTop: 2 }}>
                  {t.zona}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {showNoResults && (
        <div style={{ marginTop: 8 }}>
          <div className="muted">Sin resultados.</div>

          <button
            type="button"
            className="btn-outline"
            style={{ marginTop: 8 }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={commitTextAsValue}
          >
            Usar “{trimmed}”
          </button>
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
// src/services/tablerosAutocompleteApi.js
