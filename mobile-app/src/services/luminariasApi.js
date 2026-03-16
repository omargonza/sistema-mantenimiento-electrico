import { API, authFetch, getAccessToken, getRefreshToken } from "../api";

function hasSession() {
  return !!(getAccessToken() || getRefreshToken());
}

export async function obtenerHistorialLuminarias({
  ramal = "",
  from = "",
  to = "",
  signal,
} = {}) {
  if (!hasSession()) {
    return [];
  }

  const params = new URLSearchParams();

  if (ramal) params.set("ramal", String(ramal).trim());
  if (from) params.set("from", String(from).trim());
  if (to) params.set("to", String(to).trim());

  const url = `${API}/api/luminarias/historial/?${params.toString()}`;

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
    throw new Error(`HTTP ${res.status}`);
  }

  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? data : [];
}
