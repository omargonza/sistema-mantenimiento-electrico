import { API } from "../api";

const KEY = "tableros_cache_v1";
const TTL = 24 * 60 * 60 * 1000; // 24h

function now() {
  return Date.now();
}

export async function obtenerTablerosCached() {
  // 1) Intentar cache
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const { ts, data } = JSON.parse(raw);
      if (now() - ts < TTL && Array.isArray(data)) {
        // refresco en background (no bloquea)
        refreshTableros();
        return data;
      }
    }
  } catch {}

  // 2) Si no hay cache válida, ir a red
  return await refreshTableros();
}

async function refreshTableros() {
  try {
    const res = await fetch(`${API}/api/tableros/`);
    if (!res.ok) throw new Error("Error cargando tableros");
    const data = await res.json();

    try {
      localStorage.setItem(KEY, JSON.stringify({ ts: now(), data }));
    } catch {}

    return data;
  } catch (e) {
    // si no hay red, devolver lo último que haya aunque esté vencido
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
