// ==========================================================
//  CONFIGURACIÓN DE API (DEV/PROD) — ROBUSTA Y AUTOMÁTICA
// ==========================================================

const mode = import.meta.env.MODE; // "development" | "production"

//  UN SOLO nombre de env var para todo el proyecto:
const envUrl = import.meta.env.VITE_API_URL; // <- Render + local

const fallback =
  mode === "production"
    ? "https://ot-backend-pro.onrender.com" // <- backend real en Render
    : "http://127.0.0.1:8000";

// Normaliza: sin espacios y sin "/" final
export const API = (envUrl || fallback).trim().replace(/\/$/, "");

// ==========================================================
//  UTILIDAD: TIMEOUT PARA EVITAR FETCH COLGADO
// ==========================================================

function fetchWithTimeout(url, options = {}, timeout = 10000) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), timeout)
    ),
  ]);
}

// ==========================================================
//  UTILIDAD: REINTENTOS AUTOMÁTICOS (EXPONENTIAL BACKOFF)
// ==========================================================

async function fetchRetry(url, options, retries = 3) {
  try {
    return await fetchWithTimeout(url, options);
  } catch (err) {
    if (retries <= 0) throw err;

    const delay = 500 * Math.pow(2, 3 - retries);
    console.warn(`Retry en ${delay}ms…`);

    await new Promise((res) => setTimeout(res, delay));
    return fetchRetry(url, options, retries - 1);
  }
}

// ==========================================================
//  ENVÍO DE ORDEN — GENERA PDF
// ==========================================================
export async function enviarOT(payload, silent = false) {
  if (!silent) {
    console.log(">>> API BASE:", API);
  }

  if (!navigator.onLine) {
    if (!silent) console.warn("Sin conexión → No puedo enviar OT");
    const e = new Error("offline");
    e.status = 0;
    throw e;
  }

  // ✅ Guardia de peso (evita mandar JSON enorme)
  // Aproximación: 1 char ~ 1 byte en ASCII (base64 es ASCII)
  let approxBytes = 0;
  try {
    approxBytes = JSON.stringify(payload).length;
  } catch {}
  const MAX_BYTES = 4_000_000; // ~4MB para ir seguro (podés subir a 6-8MB)
  if (approxBytes > MAX_BYTES) {
    const e = new Error("Payload demasiado grande (fotos/firma). Reducí cantidad o compresión.");
    e.status = 413;
    e.body = `approxBytes=${approxBytes}`;
    if (!silent) console.error("❌", e.message, e.body);
    throw e;
  }

  const res = await fetchRetry(`${API}/api/ordenes/pdf/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let bodyText = "";
    try { bodyText = await res.text(); } catch {}

    const e = new Error(`Backend respondió ${res.status}`);
    e.status = res.status;
    e.body = bodyText;
    if (!silent) console.error("❌", e.message, bodyText);
    throw e;
  }

  return await res.blob();
}

// ==========================================================
//  SINCRONIZACIÓN DE ORDENES PENDIENTES
// ==========================================================

export async function syncPendientes(lista, silent = true) {
  if (!navigator.onLine) {
    if (!silent) console.warn("Sin conexión → No puedo sincronizar");
    const e = new Error("offline");
    e.status = 0;
    throw e;
  }

  const res = await fetchRetry(`${API}/api/ordenes/sync/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ordenes: lista }),
  });

  if (!res.ok) {
    const msg = `Error sincronizando (HTTP ${res.status})`;
    if (!silent) console.error(msg);
    const e = new Error(msg);
    e.status = res.status;
    throw e;
  }

  return await res.json();
}
