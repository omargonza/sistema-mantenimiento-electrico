import { useMemo, useState } from "react";

const CODE_RE = /^[A-Z]{1,4}\d{3,6}$/; // PC4026 / CC4105 etc.

function normalizeCode(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function uniq(list) {
  const out = [];
  const seen = new Set();
  for (const x of list) {
    if (!x) continue;
    if (seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
}

/**
 * LuminariasChips
 * - Input + Enter para agregar
 * - pega múltiple (separa por espacios/enter/ coma)
 * - valida patrón
 * - evita duplicados
 * - expone lista + string normalizado
 *
 * Props:
 * - valueText: string actual de luminaria_equipos (si venís de OT vieja)
 * - onChange: ({ list, text }) => ...
 */
export default function LuminariasChips({ valueText = "", onChange }) {
  const initialList = useMemo(() => {
    // parse suave por si venía cargado viejo
    const tokens = String(valueText || "")
      .toUpperCase()
      .match(/[A-Z]{1,4}\d{3,6}/g);
    return uniq(tokens || []);
  }, [valueText]);

  const [list, setList] = useState(initialList);
  const [raw, setRaw] = useState("");
  const [err, setErr] = useState("");

  function emit(nextList) {
    const normList = uniq(nextList);
    const text = normList.join(", ");
    onChange?.({ list: normList, text });
  }

  function addMany(input) {
    const parts = String(input || "")
      .toUpperCase()
      .split(/[\s,;\n\r\t]+/g)
      .map(normalizeCode)
      .filter(Boolean);

    if (!parts.length) return;

    const bad = parts.find((p) => !CODE_RE.test(p));
    if (bad) {
      setErr(`Código inválido: ${bad} (ej: PC4026)`);
      return;
    }

    setErr("");
    const next = uniq([...list, ...parts]);
    setList(next);
    emit(next);
  }

  function remove(code) {
    const next = list.filter((x) => x !== code);
    setList(next);
    emit(next);
  }

  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>
        Luminarias reparadas (códigos)
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          className="input"
          value={raw}
          placeholder="Ej: PC4026 (Enter para agregar) o pegá varios"
          onChange={(e) => setRaw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addMany(raw);
              setRaw("");
            }
          }}
          onPaste={(e) => {
            // pegar múltiples: PC4026 PC4027, PC4028...
            const txt = e.clipboardData.getData("text");
            if (txt) {
              e.preventDefault();
              addMany(txt);
              setRaw("");
            }
          }}
        />
        <button
          type="button"
          className="btn-add"
          onClick={() => {
            addMany(raw);
            setRaw("");
          }}
        >
          Agregar
        </button>
      </div>

      {err && (
        <div className="muted" style={{ marginTop: 8 }}>
          ⚠️ {err}
        </div>
      )}

      <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
        {list.length === 0 ? (
          <div className="muted">Sin luminarias cargadas.</div>
        ) : (
          list.map((code) => (
            <button
              key={code}
              type="button"
              className="chip chip--active"
              onClick={() => remove(code)}
              title="Click para quitar"
            >
              {code} <span className="chip-count">✕</span>
            </button>
          ))
        )}
      </div>

      <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
        Formato guardado: <b>{list.join(", ") || "—"}</b>
      </div>
    </div>
  );
}
