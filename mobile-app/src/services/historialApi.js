import { API } from "../api";

const TTL = 7 * 24 * 60 * 60 * 1000; // 7 días

function stableParams(params = {}) {
  const clean = {};
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    clean[k] = v;
  });
  const keys = Object.keys(clean).sort();
  const out = {};
  keys.forEach((k) => (out[k] = clean[k]));
  return out;
}

function key(tablero, params = {}) {
  const p = stableParams(params);
  const suffix = Object.keys(p).length ? JSON.stringify(p) : "";
  const t = (tablero || "").trim();
  const base = t ? `historial_${t}` : "historial__ALL";
  return `${base}${
    suffix ? "_" + btoa(unescape(encodeURIComponent(suffix))) : ""
  }`;
}

function buildUrl(tablero, params = {}) {
  const p = stableParams(params);
  const qsObj = { ...p };
  const t = (tablero || "").trim();
  if (t) qsObj.tablero = t;
  const qs = new URLSearchParams(qsObj).toString();
  return `${API}/api/historial/?${qs}`;
}

export async function obtenerHistorial(tablero, params = {}) {
  const k = key(tablero, params);

  try {
    const raw = localStorage.getItem(k);
    if (raw) {
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts < TTL) {
        refresh(tablero, params).catch(() => {});
        return data;
      }
    }
  } catch {}

  return await refresh(tablero, params);
}

async function refresh(tablero, params = {}) {
  const url = buildUrl(tablero, params);

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error("Historial no disponible");
  }

  const data = await res.json();

  try {
    localStorage.setItem(
      key(tablero, params),
      JSON.stringify({ ts: Date.now(), data })
    );
  } catch {}

  return data;
}
