import { API } from "../api";

export async function buscarTableros(q, { signal, limit = 20 } = {}) {
  const url = `${API}/api/tableros/?q=${encodeURIComponent(q)}&limit=${limit}`;
  const res = await fetch(url, { signal });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json(); // [{nombre, zona}, ...]
}
