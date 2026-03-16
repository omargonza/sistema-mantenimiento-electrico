import { API, authFetch, getAccessToken, getRefreshToken } from "../api";

const KEY = "tableros_cache_v1";
const TTL = 24 * 60 * 60 * 1000; // 24h

function hasSession() {
  return !!(getAccessToken() || getRefreshToken());
}

function now() {
  return Date.now();
}

function readCache() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    return parsed;
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        ts: now(),
        data,
      }),
    );
  } catch {
    // no romper si localStorage falla
  }
}

export async function obtenerTablerosCached({ signal } = {}) {
  const cached = readCache();

  if (cached && now() - cached.ts < TTL && Array.isArray(cached.data)) {
    if (hasSession()) {
      refreshTableros({ signal }).catch(() => {});
    }
    return cached.data;
  }

  try {
    return await refreshTableros({ signal });
  } catch {
    return Array.isArray(cached?.data) ? cached.data : [];
  }
}

async function refreshTableros({ signal } = {}) {
  const res = await authFetch(
    `${API}/api/tableros/`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
    },
    10000,
  );

  if (!res.ok) {
    throw new Error(`Error cargando tableros (${res.status})`);
  }

  const data = await res.json().catch(() => []);
  const safeData = Array.isArray(data) ? data : [];

  writeCache(safeData);
  return safeData;
}
