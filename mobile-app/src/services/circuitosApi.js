import { API } from "../api";

const KEY = "circuitos_freq_v1";
const TTL = 24 * 60 * 60 * 1000; // 24h

function cacheKey(tablero, limit) {
  const t = (tablero || "").trim().toLowerCase();
  return `${KEY}__${t}__${limit}`;
}

export async function obtenerCircuitosFrecuentes(tablero, { limit = 8 } = {}) {
  const t = (tablero || "").trim();
  if (!t) return { tablero: "", items: [] };

  const k = cacheKey(t, limit);

  // cache
  try {
    const raw = localStorage.getItem(k);
    if (raw) {
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts < TTL) {
        // refresh silencioso
        refresh(t, limit).catch(() => {});
        return data;
      }
    }
  } catch {}

  return await refresh(t, limit);
}

async function refresh(tablero, limit) {
  const qs = new URLSearchParams({ tablero, limit: String(limit) }).toString();
  const url = `${API}/api/tableros/circuitos/?${qs}`;

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return { tablero, items: [] };

  const data = await res.json();

  try {
    localStorage.setItem(
      cacheKey(tablero, limit),
      JSON.stringify({ ts: Date.now(), data })
    );
  } catch {}

  return data;
}
