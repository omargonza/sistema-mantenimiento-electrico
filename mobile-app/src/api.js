// src/api.js

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
//  REINTENTOS AUTOMÁTICOS POR ERROR DE RED
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
//  SESIÓN / AUTH JWT
// ==========================================================
const ACCESS_KEY = "ot_access_token";
const REFRESH_KEY = "ot_refresh_token";
const USER_KEY = "ot_user";

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY) || "";
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY) || "";
}

export function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

export function saveSession({ access, refresh, user }) {
  if (access) localStorage.setItem(ACCESS_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

export function authHeaders(extra = {}) {
  const token = getAccessToken();
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ==========================================================
//  LOGIN / ME / LOGOUT / REFRESH
// ==========================================================
export async function login(legajo, password) {
  const res = await fetch(`${API}/api/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: String(legajo).trim(), // backend: username = legajo
      password,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const detail =
      data?.detail ||
      data?.non_field_errors?.[0] ||
      data?.username?.[0] ||
      `Error login (${res.status})`;

    const e = new Error(detail);
    e.status = res.status;
    e.body = data;
    throw e;
  }

  saveSession(data);
  return data;
}

export async function getMe() {
  const res = await authFetch(`${API}/api/auth/me/`, {
    method: "GET",
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const e = new Error(data?.detail || `Error me (${res.status})`);
    e.status = res.status;
    e.body = data;
    throw e;
  }

  return data;
}

export async function logout() {
  const refresh = getRefreshToken();

  try {
    if (refresh) {
      await fetch(`${API}/api/auth/logout/`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ refresh }),
      });
    }
  } finally {
    clearSession();
  }
}

export async function refreshAccessToken() {
  const refresh = getRefreshToken();

  if (!refresh) {
    clearSession();
    const e = new Error("No hay refresh token");
    e.status = 401;
    throw e;
  }

  const res = await fetch(`${API}/api/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data?.access) {
    clearSession();
    const e = new Error(data?.detail || `Error refresh (${res.status})`);
    e.status = res.status || 401;
    e.body = data;
    throw e;
  }

  localStorage.setItem(ACCESS_KEY, data.access);

  // si el backend rota refresh tokens, lo actualizamos también
  if (data.refresh) {
    localStorage.setItem(REFRESH_KEY, data.refresh);
  }

  return data.access;
}

// ==========================================================
//  FETCH AUTENTICADO + REFRESH AUTOMÁTICO SI 401
// ==========================================================
async function authFetch(url, options = {}, timeout = 10000) {
  const initialOptions = {
    ...options,
    headers: authHeaders(options.headers || {}),
  };

  let res = await fetchRetry(url, initialOptions);

  // Si el access token venció, intenta refresh una sola vez
  if (res.status === 401) {
    const newAccess = await refreshAccessToken();

    const retryOptions = {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${newAccess}`,
      },
    };

    res = await fetchWithTimeout(url, retryOptions, timeout);
  }

  return res;
}

// ==========================================================
//  ENVÍO DE ORDEN — SOLO BACKEND, SIN GUARDAR LOCAL
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
    const e = new Error(
      "Payload demasiado grande (fotos/firma). Reducí cantidad o compresión.",
    );
    e.status = 413;
    e.body = `approxBytes=${approxBytes}`;
    if (!silent) console.error("❌", e.message, e.body);
    throw e;
  }

  const res = await authFetch(`${API}/api/ordenes/pdf/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!silent) {
    console.log(
      "AUTH enviarOT",
      authHeaders({ "Content-Type": "application/json" }),
    );
  }

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    const e = new Error(`Backend respondió ${res.status}`);
    e.status = res.status;
    e.body = bodyText;
    if (!silent) console.error("❌", e.message, bodyText);
    throw e;
  }

  const pdfBlob = await res.blob();

  if (!silent) {
    console.log("[API] PDF recibido", {
      size: pdfBlob?.size,
      type: pdfBlob?.type,
      requestId: payload?.client_request_id || null,
    });
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

  const res = await authFetch(`${API}/api/ordenes/sync/`, {
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
//  TABLEROS AUTOCOMPLETE
// ==========================================================
export async function buscarTableros(q, { signal, limit = 20 } = {}) {
  const params = new URLSearchParams();
  params.set("q", (q ?? "").trim());
  params.set(
    "limit",
    String(Number.isFinite(Number(limit)) ? parseInt(limit, 10) : 20),
  );

  const url = `${API}/api/tableros/?${params.toString()}`;
  const res = await authFetch(url, { signal });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// ==========================================================
//  TABLERO EXISTS (PRO) — valida catálogo
// ==========================================================
export async function tableroExists(nombre, { signal } = {}) {
  const n = (nombre ?? "").trim();
  if (!n) return { exists: false, nombre: "" };

  const params = new URLSearchParams({ nombre: n });
  const url = `${API}/api/tableros/exists/?${params.toString()}`;

  const res = await authFetch(url, { signal });

  console.log("AUTH tableroExists", authHeaders());

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  return await res.json(); // {exists, nombre, zona?}
}

export async function getOrdenesAudit() {
  const res = await authFetch(`${API}/api/ordenes/`, {
    method: "GET",
  });

  const data = await res.json().catch(() => []);

  if (!res.ok) {
    const e = new Error(
      data?.detail || `Error cargando órdenes (${res.status})`,
    );
    e.status = res.status;
    e.body = data;
    throw e;
  }

  return Array.isArray(data) ? data : [];
}
