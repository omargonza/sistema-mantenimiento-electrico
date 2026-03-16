import { API, authFetch, getAccessToken, getRefreshToken } from "../api";

const TTL = 7 * 24 * 60 * 60 * 1000; // 7 días

function hasSession() {
  return !!(getAccessToken() || getRefreshToken());
}

function stableParams(params = {}) {
  const clean = {};

  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (typeof v === "string" && v.trim() === "") return;
    clean[k] = typeof v === "string" ? v.trim() : v;
  });

  const keys = Object.keys(clean).sort();
  const out = {};
  keys.forEach((k) => {
    out[k] = clean[k];
  });

  return out;
}

function toBase64Unicode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function key(tablero, params = {}) {
  const p = stableParams(params);
  const suffix = Object.keys(p).length ? JSON.stringify(p) : "";
  const t = String(tablero || "").trim();
  const base = t ? `historial_${t}` : "historial__ALL";

  return `${base}${suffix ? "_" + toBase64Unicode(suffix) : ""}`;
}

function buildUrl(tablero, params = {}) {
  const p = stableParams(params);
  const qsObj = { ...p };

  const t = String(tablero || "").trim();
  if (t) qsObj.tablero = t;

  const qs = new URLSearchParams(qsObj).toString();
  return `${API}/api/historial/?${qs}`;
}

function readCache(cacheKey) {
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeCache(cacheKey, data) {
  try {
    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        ts: Date.now(),
        data,
      }),
    );
  } catch {
    // no romper si localStorage falla
  }
}

export async function obtenerHistorial(tablero, params = {}, options = {}) {
  const cacheStorageKey = key(tablero, params);
  const cached = readCache(cacheStorageKey);

  if (cached && Date.now() - cached.ts < TTL) {
    if (hasSession()) {
      refreshHistorial(tablero, params, options).catch(() => {});
    }
    return cached.data;
  }

  try {
    return await refreshHistorial(tablero, params, options);
  } catch {
    return (
      cached?.data || { results: [], count: 0, next: null, previous: null }
    );
  }
}

async function refreshHistorial(tablero, params = {}, { signal } = {}) {
  const url = buildUrl(tablero, params);

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
    throw new Error(`Historial no disponible (${res.status})`);
  }

  const data = await res.json().catch(() => ({
    results: [],
    count: 0,
    next: null,
    previous: null,
  }));

  writeCache(key(tablero, params), data);
  return data;
}
