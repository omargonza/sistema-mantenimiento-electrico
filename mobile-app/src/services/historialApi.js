import { API } from "../api";

const TTL = 7 * 24 * 60 * 60 * 1000; // 7 días

function stableParams(params = {}) {
  // solo params que afectan respuesta
  const clean = {};
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    clean[k] = v;
  });

  // orden estable para cache key
  const keys = Object.keys(clean).sort();
  const out = {};
  keys.forEach((k) => (out[k] = clean[k]));
  return out;
}

function key(tablero, params = {}) {
  const p = stableParams(params);
  const suffix = Object.keys(p).length ? JSON.stringify(p) : "";
  return `historial_${tablero}${
    suffix ? "_" + btoa(unescape(encodeURIComponent(suffix))) : ""
  }`;
}

function buildUrl(tablero, params = {}) {
  const p = stableParams(params);
  const qs = new URLSearchParams({ tablero, ...p }).toString();
  return `${API}/api/historial/?${qs}`;
}

export async function obtenerHistorial(tablero, params = {}) {
  const t = (tablero || "").trim();
  if (!t) throw new Error("Tablero requerido");

  const k = key(t, params);

  // 1) Cache (stale-while-revalidate)
  try {
    const raw = localStorage.getItem(k);
    if (raw) {
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts < TTL) {
        // refresco silencioso
        refresh(t, params).catch(() => {});
        return data;
      }
    }
  } catch {
    // ignore cache errors
  }

  // 2) Red
  return await refresh(t, params);
}

async function refresh(tablero, params = {}) {
  const url = buildUrl(tablero, params);

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Historial no disponible");
  }

  const data = await res.json();

  try {
    localStorage.setItem(
      key(tablero, params),
      JSON.stringify({ ts: Date.now(), data })
    );
  } catch {
    // ignore quota errors
  }

  return data;
}
