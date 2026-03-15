import { API, authFetch } from "../api";

const KEY = "circuitos_freq_v1";
const TTL = 24 * 60 * 60 * 1000; // 24h

function cacheKey(tablero, limit) {
  const t = String(tablero || "")
    .trim()
    .toLowerCase();
  return `${KEY}__${t}__${limit}`;
}

function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    return parsed;
  } catch {
    return null;
  }
}

function writeCache(key, data) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        ts: Date.now(),
        data,
      }),
    );
  } catch {
    // sin romper UX si localStorage falla
  }
}

export async function obtenerCircuitosFrecuentes(
  tablero,
  { limit = 8, signal } = {},
) {
  const t = String(tablero || "").trim();
  if (!t) return { tablero: "", items: [] };

  const safeLimit = Number.isFinite(Number(limit)) ? parseInt(limit, 10) : 8;
  const k = cacheKey(t, safeLimit);

  const cached = readCache(k);
  if (cached && Date.now() - cached.ts < TTL) {
    refreshCircuitos(t, safeLimit, { signal }).catch(() => {});
    return cached.data;
  }

  try {
    return await refreshCircuitos(t, safeLimit, { signal });
  } catch {
    return cached?.data || { tablero: t, items: [] };
  }
}

async function refreshCircuitos(tablero, limit, { signal } = {}) {
  const qs = new URLSearchParams({
    tablero: String(tablero).trim(),
    limit: String(limit),
  }).toString();

  const url = `${API}/api/tableros/circuitos/?${qs}`;

  const res = await authFetch(
    url,
    {
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
    },
    10000,
  );

  if (!res.ok) {
    throw new Error(`Circuitos no disponibles (${res.status})`);
  }

  const data = await res.json().catch(() => ({ tablero, items: [] }));
  writeCache(cacheKey(tablero, limit), data);

  return data;
}
