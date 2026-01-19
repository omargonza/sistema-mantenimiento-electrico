import { API } from "../api";
import { obtenerTablerosCached } from "./tablerosApi";

// Normaliza para buscar (sin acentos, lower, etc.)
function norm(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function filterLocal(list, q, limit = 20) {
  const nq = norm(q);
  if (!nq) return [];

  // soporta formatos: string o { nombre, zona, ... }
  const rows = Array.isArray(list) ? list : [];

  const scored = rows
    .map((it) => {
      const nombre = typeof it === "string" ? it : it?.nombre;
      const zona = typeof it === "string" ? "" : it?.zona;
      const text = norm(`${nombre || ""} ${zona || ""}`);

      // score simple: prefijo > incluye
      let score = 0;
      if (text.startsWith(nq)) score = 3;
      else if (text.includes(nq)) score = 1;
      else score = 0;

      return { it, score, nombre: nombre || "" };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.nombre.localeCompare(b.nombre));

  return scored.slice(0, limit).map((x) => {
    // siempre devolvemos objeto uniforme { nombre, zona? }
    if (typeof x.it === "string") return { nombre: x.it, zona: "" };
    return { nombre: x.it?.nombre || "", zona: x.it?.zona || "" };
  });
}

export async function buscarTableros(q, { signal, limit = 20 } = {}) {
  const query = (q ?? "").trim();
  if (!query) return { items: [], meta: { source: "remote" } };

  // 1) ONLINE autocomplete
  try {
    const params = new URLSearchParams({
      q: query,
      limit: String(limit),
    });

    const url = `${API}/api/tableros/autocomplete/?${params.toString()}`;
    const res = await fetch(url, { signal });

    if (res.ok) {
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];

      if (arr.length > 0) {
        return { items: arr, meta: { source: "remote" } };
      }

      // vacío -> fallback cache
      const cached = await obtenerTablerosCached();
      return {
        items: filterLocal(cached, query, limit),
        meta: { source: "cache" },
      };
    }

    // status no ok -> fallback cache
    const cached = await obtenerTablerosCached();
    return {
      items: filterLocal(cached, query, limit),
      meta: { source: "cache" },
    };
  } catch (e) {
    if (e?.name === "AbortError") throw e;

    // 2) OFFLINE fallback local
    try {
      const cached = await obtenerTablerosCached();
      return {
        items: filterLocal(cached, query, limit),
        meta: { source: "cache" },
      };
    } catch {
      return { items: [], meta: { source: "cache" } };
    }
  }
}
