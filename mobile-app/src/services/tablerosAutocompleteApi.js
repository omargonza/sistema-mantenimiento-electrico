import { API } from "../api";

export async function buscarTableros(q, { signal, limit = 20 } = {}) {
  const params = new URLSearchParams({
    q: (q ?? "").trim(),
    limit: String(limit),
  });

  const url = `${API}/api/tableros/autocomplete/?${params.toString()}`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}
