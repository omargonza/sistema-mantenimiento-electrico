import { useEffect, useMemo, useRef, useState } from "react";
import { buscarTableros } from "../services/tablerosAutocompleteApi";

export default function TableroAutocomplete({
  value = "",
  onSelect,
  placeholder = "Buscar tablero…",
}) {
  const [q, setQ] = useState(value);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ctrlRef = useRef(null);
  const tRef = useRef(null);

  useEffect(() => setQ(value), [value]);

  const canSearch = useMemo(() => q.trim().length >= 2, [q]);

  useEffect(() => {
    // limpiar debounce anterior
    if (tRef.current) clearTimeout(tRef.current);

    // cancelar request anterior
    if (ctrlRef.current) ctrlRef.current.abort();

    if (!canSearch) {
      setItems([]);
      setLoading(false);
      return;
    }

    tRef.current = setTimeout(async () => {
      const ctrl = new AbortController();
      ctrlRef.current = ctrl;

      setLoading(true);
      try {
        const data = await buscarTableros(q.trim(), { signal: ctrl.signal, limit: 20 });
        setItems(Array.isArray(data) ? data : []);
        setOpen(true);
      } catch (e) {
        if (e.name !== "AbortError") {
          setItems([]);
        }
      } finally {
        setLoading(false);
      }
    }, 220); // debounce cortito (mobile-friendly)

    return () => {
      if (tRef.current) clearTimeout(tRef.current);
      if (ctrlRef.current) ctrlRef.current.abort();
    };
  }, [q, canSearch]);

  return (
    <div style={{ position: "relative" }}>
      <input
        className="input"
        value={q}
        placeholder={placeholder}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => items.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
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
            overflow: "hidden",
          }}
        >
          {items.map((t) => (
            <button
              key={`${t.nombre}-${t.zona}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()} // evita perder foco antes de click
              onClick={() => {
                setQ(t.nombre);
                setOpen(false);
                onSelect?.(t); // {nombre, zona}
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
              <div className="muted" style={{ marginTop: 2 }}>{t.zona}</div>
            </button>
          ))}
        </div>
      )}

      {open && !loading && canSearch && items.length === 0 && (
        <div className="muted" style={{ marginTop: 6 }}>
          Sin resultados.
        </div>
      )}
    </div>
  );
}
