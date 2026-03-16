// src/api.js

// ==========================================================
// CONFIGURACIÓN API
// ==========================================================
const mode = import.meta.env.MODE;
const envUrl = import.meta.env.VITE_API_URL;

const fallback =
  mode === "production"
    ? "https://ot-backend-pro.onrender.com"
    : "http://127.0.0.1:8000";

export const API = (envUrl || fallback).trim().replace(/\/$/, "");
const IS_DEV = import.meta.env.DEV;

// Logs solo en desarrollo y sin datos sensibles
function devLog(...args) {
  if (IS_DEV) console.log(...args);
}

function devWarn(...args) {
  if (IS_DEV) console.warn(...args);
}

// ==========================================================
// STORAGE KEYS
// ==========================================================
const ACCESS_KEY = "ot_access_token";
const REFRESH_KEY = "ot_refresh_token";
const USER_KEY = "ot_user";

// ==========================================================
// HELPERS SEGUROS
// ==========================================================
function safeParseJSON(text, fallbackValue = {}) {
  try {
    return text ? JSON.parse(text) : fallbackValue;
  } catch {
    return fallbackValue;
  }
}

async function safeReadJson(res, fallbackValue = {}) {
  const text = await res.text().catch(() => "");
  return safeParseJSON(text, fallbackValue);
}

function buildError(message, status = 0, body = null) {
  const error = new Error(message);
  error.status = status;
  error.body = body;
  return error;
}

function hasNetworkConnection() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

// ==========================================================
// JWT HELPERS
// ==========================================================
function parseJwt(token) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);

    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function isTokenExpiringSoon(token, skewSeconds = 30) {
  if (!token) return true;

  const payload = parseJwt(token);
  const exp = Number(payload?.exp || 0);
  if (!exp) return true;

  const now = Math.floor(Date.now() / 1000);
  return exp - now <= skewSeconds;
}

// ==========================================================
// TIMEOUT REAL CON ABORTCONTROLLER
// ==========================================================
async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: options.signal ?? controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ==========================================================
// REINTENTOS AUTOMÁTICOS SOLO POR ERROR DE RED
// ==========================================================
async function fetchRetry(url, options = {}, retries = 2, timeout = 10000) {
  try {
    return await fetchWithTimeout(url, options, timeout);
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    if (retries <= 0) throw err;

    const delay = 400 * Math.pow(2, 2 - retries);
    devWarn(`[API] Retry en ${delay}ms`, {
      url,
      retriesLeft: retries,
      reason: err?.message || String(err),
    });

    await new Promise((resolve) => setTimeout(resolve, delay));
    return fetchRetry(url, options, retries - 1, timeout);
  }
}

// ==========================================================
// SESIÓN / AUTH JWT
// ==========================================================
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
  if (typeof access === "string" && access.trim()) {
    localStorage.setItem(ACCESS_KEY, access.trim());
  }

  if (typeof refresh === "string" && refresh.trim()) {
    localStorage.setItem(REFRESH_KEY, refresh.trim());
  }

  if (user && typeof user === "object") {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function clearSession() {
  devWarn("[AUTH] clearSession()");
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
// REFRESH SINGLE-FLIGHT
// Evita múltiples refresh simultáneos si varias requests
// devuelven 401 al mismo tiempo.
// ==========================================================
let refreshPromise = null;

export async function refreshAccessToken() {
  if (refreshPromise) {
    devLog("[AUTH] Reutilizando refresh en curso");
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const refresh = getRefreshToken();

    devLog("[AUTH] refreshAccessToken() iniciado", {
      hasRefresh: !!refresh,
    });

    if (!refresh) {
      devWarn("[AUTH] No hay refresh token");
      clearSession();
      throw buildError("No hay refresh token", 401);
    }

    const res = await fetchWithTimeout(
      `${API}/api/auth/refresh/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      },
      10000,
    );

    const data = await safeReadJson(res, {});

    devLog("[AUTH] Respuesta refresh", {
      status: res.status,
      ok: res.ok,
      hasAccess: !!data?.access,
      hasRefresh: !!data?.refresh,
    });

    if (!res.ok || !data?.access) {
      devWarn("[AUTH] Refresh inválido o rechazado", {
        status: res.status,
        detail: data?.detail || null,
      });
      clearSession();
      throw buildError(
        data?.detail || `Error refresh (${res.status})`,
        res.status || 401,
        data,
      );
    }

    localStorage.setItem(ACCESS_KEY, data.access);

    if (data.refresh && typeof data.refresh === "string") {
      localStorage.setItem(REFRESH_KEY, data.refresh);
    }

    devLog("[AUTH] Refresh exitoso, access actualizado");
    return data.access;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

// ==========================================================
// FETCH AUTENTICADO
// - agrega Bearer token
// - refresh preventivo si el token está por vencer
// - intenta refresh 1 vez ante 401
// - limpia sesión si no puede renovar
// ==========================================================
export async function authFetch(url, options = {}, timeout = 10000) {
  let access = getAccessToken();
  const hasRefresh = !!getRefreshToken();

  if (access && hasRefresh && isTokenExpiringSoon(access, 30)) {
    devWarn("[AUTH] Access por vencer, refresh preventivo", {
      url,
      method: options?.method || "GET",
    });

    try {
      access = await refreshAccessToken();
    } catch (err) {
      devWarn("[AUTH] Falló refresh preventivo", {
        url,
        method: options?.method || "GET",
        error: err?.message || String(err),
      });
      clearSession();
      throw err;
    }
  }

  const requestOptions = {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
    },
  };

  let res = await fetchRetry(url, requestOptions, 2, timeout);

  if (res.status !== 401) {
    return res;
  }

  devWarn("[AUTH] 401 detectado, intentando refresh", {
    url,
    method: options?.method || "GET",
    hasAccess: !!access,
    hasRefresh,
  });

  try {
    const newAccess = await refreshAccessToken();

    devLog("[AUTH] Reintentando request con nuevo access", {
      url,
      method: options?.method || "GET",
      hasNewAccess: !!newAccess,
    });

    const retryOptions = {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(newAccess ? { Authorization: `Bearer ${newAccess}` } : {}),
      },
    };

    const retryRes = await fetchWithTimeout(url, retryOptions, timeout);

    if (retryRes.status === 401) {
      devWarn("[AUTH] Retry posterior al refresh también devolvió 401", {
        url,
        method: options?.method || "GET",
      });
    } else {
      devLog("[AUTH] Retry posterior al refresh OK", {
        url,
        method: options?.method || "GET",
        status: retryRes.status,
      });
    }

    return retryRes;
  } catch (err) {
    devWarn("[AUTH] Falló refresh o retry autenticado", {
      url,
      method: options?.method || "GET",
      error: err?.message || String(err),
    });
    clearSession();
    throw err;
  }
}

// ==========================================================
// AUTH
// ==========================================================
export async function login(legajo, password) {
  const res = await fetchWithTimeout(
    `${API}/api/auth/login/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: String(legajo ?? "").trim(),
        password: String(password ?? ""),
      }),
    },
    10000,
  );

  const data = await safeReadJson(res, {});

  if (!res.ok) {
    throw buildError(
      data?.detail ||
        data?.non_field_errors?.[0] ||
        data?.username?.[0] ||
        `Error login (${res.status})`,
      res.status,
      data,
    );
  }

  saveSession(data);
  devLog("[AUTH] Login correcto", {
    hasAccess: !!data?.access,
    hasRefresh: !!data?.refresh,
    hasUser: !!data?.user,
  });

  return data;
}

export async function getMe() {
  const res = await authFetch(`${API}/api/auth/me/`, {
    method: "GET",
  });

  const data = await safeReadJson(res, {});

  if (!res.ok) {
    throw buildError(
      data?.detail || `Error me (${res.status})`,
      res.status,
      data,
    );
  }

  return data;
}

export async function logout() {
  const refresh = getRefreshToken();

  try {
    if (refresh) {
      await fetchWithTimeout(
        `${API}/api/auth/logout/`,
        {
          method: "POST",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ refresh }),
        },
        10000,
      );
    }
  } finally {
    clearSession();
  }
}

// ==========================================================
// ORDENES
// ==========================================================
export async function enviarOT(payload, silent = false) {
  if (!hasNetworkConnection()) {
    throw buildError("offline", 0);
  }

  let approxBytes = 0;
  try {
    approxBytes = JSON.stringify(payload).length;
  } catch {
    approxBytes = 0;
  }

  const MAX_BYTES = 4_000_000;

  if (approxBytes > MAX_BYTES) {
    throw buildError(
      "Payload demasiado grande (fotos/firma). Reducí cantidad o compresión.",
      413,
      { approxBytes },
    );
  }

  const res = await authFetch(
    `${API}/api/ordenes/pdf/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    30000,
  );

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    throw buildError(`Backend respondió ${res.status}`, res.status, bodyText);
  }

  const pdfBlob = await res.blob();

  if (!silent) {
    devLog("[API] PDF recibido", {
      size: pdfBlob?.size || 0,
      type: pdfBlob?.type || "application/octet-stream",
      requestId: payload?.client_request_id || null,
    });
  }

  return pdfBlob;
}

export async function syncPendientes(lista, silent = true) {
  if (!hasNetworkConnection()) {
    throw buildError("offline", 0);
  }

  const res = await authFetch(
    `${API}/api/ordenes/sync/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ordenes: lista }),
    },
    30000,
  );

  const data = await safeReadJson(res, {});

  if (!res.ok) {
    throw buildError(
      data?.detail || `Error sincronizando (HTTP ${res.status})`,
      res.status,
      data,
    );
  }

  if (!silent) {
    devLog("[SYNC] Órdenes sincronizadas");
  }

  return data;
}

// ==========================================================
// TABLEROS
// ==========================================================
export async function buscarTableros(q, { signal, limit = 20 } = {}) {
  const params = new URLSearchParams();
  params.set("q", String(q ?? "").trim());
  params.set(
    "limit",
    String(Number.isFinite(Number(limit)) ? parseInt(limit, 10) : 20),
  );

  const url = `${API}/api/tableros/?${params.toString()}`;
  const res = await authFetch(url, { signal, method: "GET" });

  const data = await safeReadJson(res, []);

  if (!res.ok) {
    throw buildError(`HTTP ${res.status}`, res.status, data);
  }

  return Array.isArray(data) ? data : [];
}

export async function tableroExists(nombre, { signal } = {}) {
  const n = String(nombre ?? "").trim();
  if (!n) {
    return { exists: false, nombre: "" };
  }

  const params = new URLSearchParams({ nombre: n });
  const url = `${API}/api/tableros/exists/?${params.toString()}`;

  const res = await authFetch(url, { signal, method: "GET" });
  const data = await safeReadJson(res, {});

  if (!res.ok) {
    throw buildError(`HTTP ${res.status}`, res.status, data);
  }

  return data;
}

export async function getOrdenesAudit() {
  const res = await authFetch(`${API}/api/ordenes/`, {
    method: "GET",
  });

  const data = await safeReadJson(res, []);

  if (!res.ok) {
    throw buildError(
      data?.detail || `Error cargando órdenes (${res.status})`,
      res.status,
      data,
    );
  }

  return Array.isArray(data) ? data : [];
}

export async function adminListUsers({
  search = "",
  role = "",
  includeDeleted = false,
} = {}) {
  const params = new URLSearchParams();

  if (search?.trim()) params.set("search", search.trim());
  if (role?.trim()) params.set("role", role.trim());
  if (includeDeleted) params.set("include_deleted", "1");

  const qs = params.toString();
  const url = `${API}/api/auth/users/${qs ? `?${qs}` : ""}`;

  const res = await authFetch(url, { method: "GET" });
  const data = await safeReadJson(res, []);

  if (!res.ok) {
    throw buildError(
      data?.detail || `Error listando usuarios (${res.status})`,
      res.status,
      data,
    );
  }

  return Array.isArray(data) ? data : [];
}

export async function adminGetUser(id) {
  const res = await authFetch(`${API}/api/auth/users/${id}/`, {
    method: "GET",
  });

  const data = await safeReadJson(res, {});

  if (!res.ok) {
    throw buildError(
      data?.detail || `Error obteniendo usuario (${res.status})`,
      res.status,
      data,
    );
  }

  return data;
}

export async function adminCreateUser(payload) {
  const res = await authFetch(`${API}/api/auth/users/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await safeReadJson(res, {});

  if (!res.ok) {
    throw buildError(
      data?.detail || `Error creando usuario (${res.status})`,
      res.status,
      data,
    );
  }

  return data;
}

export async function adminUpdateUser(id, payload) {
  const res = await authFetch(`${API}/api/auth/users/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await safeReadJson(res, {});

  if (!res.ok) {
    throw buildError(
      data?.detail || `Error actualizando usuario (${res.status})`,
      res.status,
      data,
    );
  }

  return data;
}

export async function adminDeleteUser(id) {
  const res = await authFetch(`${API}/api/auth/users/${id}/`, {
    method: "DELETE",
  });

  const data = await safeReadJson(res, {});

  if (!res.ok) {
    throw buildError(
      data?.detail || `Error eliminando usuario (${res.status})`,
      res.status,
      data,
    );
  }

  return data;
}
