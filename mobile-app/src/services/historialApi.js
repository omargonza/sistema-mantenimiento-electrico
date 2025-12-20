import { API } from "../api";

const TTL = 7 * 24 * 60 * 60 * 1000; // 7 días

function key(tablero) {
  return `historial_${tablero}`;
}

export async function obtenerHistorial(tablero) {
  const k = key(tablero);

  // 1️⃣ Cache
  try {
    const raw = localStorage.getItem(k);
    if (raw) {
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts < TTL) {
        // refresco silencioso
        refresh(tablero).catch(() => {});
        return data;
      }
    }
  } catch {}

  // 2️⃣ Red
  return await refresh(tablero);
}

async function refresh(tablero) {
  const res = await fetch(
    `${API}/api/historial/?tablero=${encodeURIComponent(tablero)}`
  );
  if (!res.ok) throw new Error("Historial no disponible");

  const data = await res.json();
  try {
    localStorage.setItem(
      key(tablero),
      JSON.stringify({ ts: Date.now(), data })
    );
  } catch {}

  return data;
}
