// src/services/tablerosAutocompleteApi.js
import { API, authHeaders } from "../api";

const KEY = "tableros_cache_v1";
const TTL = 24 * 60 * 60 * 1000; // 24h

function now() {
  return Date.now();
}

export async function obtenerTablerosCached() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const { ts, data } = JSON.parse(raw);
      if (now() - ts < TTL && Array.isArray(data)) {
        refreshTableros();
        return data;
      }
    }
  } catch {}

  return await refreshTableros();
}

async function refreshTableros() {
  try {
    const res = await fetch(`${API}/api/tableros/`, {
      headers: authHeaders(),
    });

    if (!res.ok) throw new Error("Error cargando tableros");
    const data = await res.json();

    try {
      localStorage.setItem(KEY, JSON.stringify({ ts: now(), data }));
    } catch {}

    return data;
  } catch (e) {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const { data } = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
      }
    } catch {}
    return [];
  }
}

export async function buscarTableros(q, { signal, limit = 20 } = {}) {
  const query = String(q || "").trim();
  if (!query) {
    return { items: [], meta: { source: "remote" } };
  }

  const data = await obtenerTablerosCached();

  const items = data
    .filter((t) => {
      const nombre = String(t?.nombre || "").toLowerCase();
      const zona = String(t?.zona || "").toLowerCase();
      const needle = query.toLowerCase();
      return nombre.includes(needle) || zona.includes(needle);
    })
    .slice(0, limit);

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
