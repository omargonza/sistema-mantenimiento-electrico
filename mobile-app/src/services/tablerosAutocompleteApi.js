import { API, authFetch } from "../api";

const KEY = "tableros_cache_v1";
const TTL = 24 * 60 * 60 * 1000; // 24h

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
    // localStorage puede fallar y no debe romper la app
  }
}

export async function obtenerTablerosCached({ signal } = {}) {
  const cached = readCache();

  if (cached && now() - cached.ts < TTL && Array.isArray(cached.data)) {
    refreshTableros({ signal }).catch(() => {});
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

export async function buscarTableros(q, { signal, limit = 20 } = {}) {
  const query = String(q || "").trim();
  if (!query) {
    return {
      items: [],
      meta: { source: "cache" },
    };
  }

  const safeLimit = Number.isFinite(Number(limit)) ? parseInt(limit, 10) : 20;
  const needle = query.toLowerCase();

  const data = await obtenerTablerosCached({ signal });

  const items = data
    .filter((t) => {
      const nombre = String(t?.nombre || "").toLowerCase();
      const zona = String(t?.zona || "").toLowerCase();
      return nombre.includes(needle) || zona.includes(needle);
    })
    .slice(0, safeLimit);

  if (signal?.aborted) {
    signal.throwIfAborted?.();
    throw signal.reason || new DOMException("Aborted", "AbortError");
  }

  return {
    items,
    meta: {
      source: "cache",
    },
  };
}
