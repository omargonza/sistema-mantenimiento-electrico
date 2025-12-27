// src/api.js
import { saveOtPdf } from "./storage/ot_db";

// ==========================================================
//  CONFIGURACIÓN DE API (DEV/PROD) — ROBUSTA Y AUTOMÁTICA
// ==========================================================
const mode = import.meta.env.MODE;
const envUrl = import.meta.env.VITE_API_URL;

const fallback =
  mode === "production"
    ? "https://ot-backend-pro.onrender.com"
    : "http://127.0.0.1:8000";

export const API = (envUrl || fallback).trim().replace(/\/$/, "");

console.log("[API CONFIG] MODE:", mode);
console.log("[API CONFIG] VITE_API_URL:", envUrl);
console.log("[API CONFIG] API FINAL:", API);

// ==========================================================
//  TIMEOUT CON ABORT REAL
// ==========================================================
async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      ...options,
      signal: options.signal ?? controller.signal,
    });
    return res;
  } finally {
    clearTimeout(t);
  }
}

// ==========================================================
//  REINTENTOS AUTOMÁTICOS
// ==========================================================
async function fetchRetry(url, options, retries = 3) {
  try {
    return await fetchWithTimeout(url, options);
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    if (retries <= 0) throw err;

    const delay = 500 * Math.pow(2, 3 - retries);
    console.warn(`Retry en ${delay}ms…`);
    await new Promise((res) => setTimeout(res, delay));

    return fetchRetry(url, options, retries - 1);
  }
}

// ==========================================================
//  ENVÍO DE ORDEN — GENERA PDF + GUARDA RESPALDO LOCAL (IndexedDB)
// ==========================================================
export async function enviarOT(payload, silent = false) {
  if (!silent) console.log(">>> API BASE:", API);

  if (!navigator.onLine) {
    if (!silent) console.warn("Sin conexión → No puedo enviar OT");
    const e = new Error("offline");
    e.status = 0;
    throw e;
  }

  let approxBytes = 0;
  try {
    approxBytes = JSON.stringify(payload).length;
  } catch {}
  const MAX_BYTES = 4_000_000;
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
    const bodyText = await res.text().catch(() => "");
    const e = new Error(`Backend respondió ${res.status}`);
    e.status = res.status;
    e.body = bodyText;
    if (!silent) console.error("❌", e.message, bodyText);
    throw e;
  }

  const pdfBlob = await res.blob();

  // ✅ Guardar respaldo local (NO rompe si falla)
  try {
    await saveOtPdf(
      {
        fecha: payload?.fecha,
        tablero: payload?.tablero,
        ubicacion: payload?.ubicacion,
        zona: payload?.zona,
        tecnico: payload?.tecnico,
        vehiculo: payload?.vehiculo,
        tags: payload?.tags,
      },
      pdfBlob
    );
  } catch (err) {
    if (!silent) console.warn("⚠️ No se pudo guardar en IndexedDB:", err);
  }

  return pdfBlob;
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

// ==========================================================
//  TABLEROS AUTOCOMPLETE (si querés tenerlo acá mismo)
// ==========================================================
export async function buscarTableros(q, { signal, limit = 20 } = {}) {
  const params = new URLSearchParams();
  params.set("q", (q ?? "").trim());
  params.set("limit", String(Number.isFinite(Number(limit)) ? parseInt(limit, 10) : 20));

  const url = `${API}/api/tableros/?${params.toString()}`;
  const res = await fetch(url, { signal });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}
