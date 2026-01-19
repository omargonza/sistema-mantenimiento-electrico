import { API } from "../api";

export async function obtenerHistorialLuminarias({
  ramal = "",
  from = "",
  to = "",
  signal,
} = {}) {
  const params = new URLSearchParams();
  if (ramal) params.set("ramal", ramal);
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  const url = `${API}/api/luminarias/historial/?${params.toString()}`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}
