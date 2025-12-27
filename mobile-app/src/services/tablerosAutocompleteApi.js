import { API } from "../api";

export async function buscarTableros(q, { signal, limit = 20 } = {}) {
  const params = new URLSearchParams({
    q: (q ?? "").trim(),
    limit: String(limit),
  });

  const url = `${API}/api/tableros/?${params.toString()}`;
  console.log("[buscarTableros] url =", url); // <- CLAVE

  const res = await fetch(url, { signal });
  console.log("[buscarTableros] status =", res.status);

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  console.log("[buscarTableros] dataLen =", Array.isArray(data) ? data.length : "no-array");

  return Array.isArray(data) ? data : [];
}
