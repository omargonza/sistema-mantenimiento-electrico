import { useEffect, useState } from "react";
import { obtenerTablerosCached } from "../services/tablerosApi";

export default function TableroAutocomplete({ placeholder, onSelect }) {
  const [all, setAll] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    obtenerTablerosCached()
      .then((data) => mounted && setAll(data))
      .catch(() => mounted && setAll([]));
    return () => (mounted = false);
  }, []);

  const filtered = q
    ? all.filter(t =>
        t.nombre.toLowerCase().includes(q.toLowerCase())
      ).slice(0, 20)
    : [];

  return (
    <div className="autocomplete">
      <input
        className="input"
        placeholder={placeholder}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />

      {open && filtered.length > 0 && (
        <div className="autocomplete-list">
          {filtered.map(t => (
            <button
              key={t.id}
              type="button"
              className="autocomplete-item"
              onClick={() => {
                onSelect(t);
                setQ(t.nombre);
                setOpen(false);
              }}
            >
              <strong>{t.nombre}</strong>
              <span className="muted"> — {t.zona}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
