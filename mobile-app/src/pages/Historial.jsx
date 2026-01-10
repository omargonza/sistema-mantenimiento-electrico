// src/pages/Historial.jsx
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import TableroAutocomplete from "../components/TableroAutocomplete";
import { obtenerHistorial } from "../services/historialApi";

const PAGE_SIZE = 30;

function fmtDateISO(s) {
  if (!s) return "";
  return String(s).slice(0, 10);
}

function pickDescripcion(h) {
  return (
    h?.tarea_realizada?.trim() ||
    h?.tarea_pedida?.trim() ||
    h?.tarea_pendiente?.trim() ||
    h?.descripcion?.trim() ||
    "—"
  );
}

function hasPendiente(h) {
  return Boolean((h?.tarea_pendiente || "").trim());
}

function normKey(s) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, " ");
}

export default function Historial() {
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTablero = searchParams.get("tablero") || "";

  const [tableroSel, setTableroSel] = useState(initialTablero);

  // filtros
  const [desde, setDesde] = useState(searchParams.get("desde") || "");
  const [hasta, setHasta] = useState(searchParams.get("hasta") || "");
  const [circuito, setCircuito] = useState(searchParams.get("circuito") || "");
  const [q, setQ] = useState(searchParams.get("q") || "");

  // UI filter (local)
  const [soloPendientes, setSoloPendientes] = useState(
    searchParams.get("pendientes") === "1"
  );

  // paginación
  const [page, setPage] = useState(Number(searchParams.get("page") || 1));

  // data
  const [resp, setResp] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // params “base” (sin page), para evitar bug de page viejo en goPage()
  const baseParams = useMemo(() => {
    const p = { page_size: PAGE_SIZE };
    if (desde) p.desde = desde;
    if (hasta) p.hasta = hasta;
    if ((circuito || "").trim()) p.circuito = circuito.trim();
    if ((q || "").trim()) p.q = q.trim();
    return p;
  }, [desde, hasta, circuito, q]);

  const rawResults = useMemo(() => {
    if (!resp) return [];
    return resp.results || resp.historial || [];
  }, [resp]);

  // Resultado final a renderizar (con filtro local “solo pendientes”)
  const results = useMemo(() => {
    if (!soloPendientes) return rawResults;
    return rawResults.filter((h) => hasPendiente(h));
  }, [rawResults, soloPendientes]);

  const isModoTodo = useMemo(() => !tableroSel.trim(), [tableroSel]);

  const header = useMemo(() => {
    if (!resp) return null;

    if (isModoTodo) {
      const n = Array.isArray(resp?.tableros) ? resp.tableros.length : 0;
      return {
        tablero: n
          ? `Historial (coinciden ${n} tableros)`
          : "Historial (todos)",
        zona: "—",
      };
    }

    const tablero = resp.tablero || tableroSel || "";
    const zona = resp.zona || (rawResults?.[0]?.zona ?? "");
    return { tablero, zona };
  }, [resp, isModoTodo, tableroSel, rawResults]);

  const totalCount = resp?.count ?? rawResults.length;
  const pageSize = resp?.page_size ?? PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  async function fetchHistorial(tableroNombre, p) {
    const nombre = (tableroNombre || "").trim();

    setLoading(true);
    setError("");
    setResp(null);

    try {
      const data = await obtenerHistorial(nombre, p);
      setResp(data);

      // persistir query params en URL
      const next = {};
      if (nombre) next.tablero = nombre;
      if (p.desde) next.desde = p.desde;
      if (p.hasta) next.hasta = p.hasta;
      if (p.circuito) next.circuito = p.circuito;
      if (p.q) next.q = p.q;

      // ✅ UI filter (local)
      if (soloPendientes) next.pendientes = "1";

      next.page = String(p.page || 1);

      setSearchParams(next, { replace: true });
    } catch (e) {
      console.warn(e);
      setError("No se pudo cargar el historial. Verificá conexión o filtros.");
    } finally {
      setLoading(false);
    }
  }

  function onSelectTablero(t) {
    if (!t?.nombre) return;
    setTableroSel(t.nombre);
    setPage(1);
    fetchHistorial(t.nombre, { ...baseParams, page: 1 });
  }

  function aplicarFiltros() {
    const hasTablero = !!tableroSel.trim();
    const hasFiltros = !!(
      (desde || "").trim() ||
      (hasta || "").trim() ||
      (circuito || "").trim() ||
      (q || "").trim()
    );

    if (!hasTablero && !hasFiltros) {
      setError("Ingresá un tablero o algún filtro (fecha/circuito/búsqueda).");
      return;
    }

    setPage(1);
    fetchHistorial(tableroSel, { ...baseParams, page: 1 });
  }

  function limpiarFiltros() {
    setDesde("");
    setHasta("");
    setCircuito("");
    setQ("");
    setSoloPendientes(false);
    setPage(1);
    setError("");

    const hasTablero = !!tableroSel.trim();

    if (hasTablero) {
      fetchHistorial(tableroSel, { page: 1, page_size: PAGE_SIZE });
      setSearchParams(
        { tablero: tableroSel.trim(), page: "1" },
        { replace: true }
      );
    } else {
      setResp(null);
      setSearchParams({}, { replace: true });
    }
  }

  function verTodoHistorial() {
    setTableroSel("");
    setDesde("");
    setHasta("");
    setCircuito("");
    setQ("");
    setPage(1);
    setError("");

    fetchHistorial("", { page: 1, page_size: PAGE_SIZE });

    const next = { page: "1" };
    if (soloPendientes) next.pendientes = "1";
    setSearchParams(next, { replace: true });
  }

  function goPage(nextPage) {
    const p = Math.min(Math.max(1, nextPage), totalPages);
    setPage(p);
    fetchHistorial(tableroSel, { ...baseParams, page: p });
  }

  // Toggle local “solo pendientes” + sync URL (sin refetch)
  function toggleSoloPendientes() {
    setSoloPendientes((prev) => {
      const nextVal = !prev;

      const urlNext = {};
      const nombre = (tableroSel || "").trim();
      if (nombre) urlNext.tablero = nombre;

      if (desde) urlNext.desde = desde;
      if (hasta) urlNext.hasta = hasta;
      if ((circuito || "").trim()) urlNext.circuito = circuito.trim();
      if ((q || "").trim()) urlNext.q = q.trim();

      if (nextVal) urlNext.pendientes = "1";
      urlNext.page = String(page || 1);

      setSearchParams(urlNext, { replace: true });
      return nextVal;
    });
  }

  // Inicial (si viene tablero desde URL)
  useEffect(() => {
    // Si hay tablero en URL, lo cargamos.
    if (!initialTablero) return;

    const initialPage = Number(searchParams.get("page") || 1);
    const p = { page: initialPage, page_size: PAGE_SIZE };

    const d = searchParams.get("desde");
    const h = searchParams.get("hasta");
    const c = searchParams.get("circuito");
    const qq = searchParams.get("q");

    if (d) p.desde = d;
    if (h) p.hasta = h;
    if (c) p.circuito = c;
    if (qq) p.q = qq;

    setPage(initialPage);
    fetchHistorial(initialTablero, p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =========================
  // Agrupación por tablero (solo en modo “todo”)
  // =========================
  const grouped = useMemo(() => {
    if (!isModoTodo) return null;

    // groupMap: key -> { tablero, zona, items: [] }
    const map = new Map();

    for (const h of results) {
      const tablero = normKey(h.tablero || "—");
      const zona = normKey(h.zona || "");
      const k = tablero.toLowerCase();

      if (!map.has(k)) map.set(k, { tablero, zona, items: [] });
      map.get(k).items.push(h);
    }

    // orden por nombre de tablero, y dentro por fecha desc si el backend no lo hace
    const arr = Array.from(map.values()).sort((a, b) =>
      a.tablero.localeCompare(b.tablero, "es", { sensitivity: "base" })
    );

    return arr;
  }, [isModoTodo, results]);

  return (
    <div className="page">
      <h1 className="titulo">Historial</h1>

      <TableroAutocomplete
        value={tableroSel}
        placeholder="Buscar tablero…"
        onChangeText={(v) => setTableroSel(v)}
        onSubmit={() => {
          // Enter: aplica filtros (permite buscar sin tablero si hay filtros)
          aplicarFiltros();
        }}
        onSelect={onSelectTablero}
      />

      {/* Filtros */}
      <div className="card" style={{ marginTop: 10, padding: 12 }}>
        <div className="muted" style={{ marginBottom: 8 }}>
          Filtros
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
        >
          <div>
            <label>Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
            />
          </div>

          <div>
            <label>Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
            />
          </div>

          <div>
            <label>Circuito</label>
            <input
              type="text"
              placeholder="fd1, alum exterior…"
              value={circuito}
              onChange={(e) => setCircuito(e.target.value)}
            />
          </div>

          <div>
            <label>Buscar</label>
            <input
              type="text"
              placeholder="reparación, cable, luminaria…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        {/* Acciones */}
        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <button
            type="button"
            className="btn-add"
            onClick={aplicarFiltros}
            disabled={loading}
          >
            {loading ? "Cargando…" : "Aplicar"}
          </button>

          <button
            type="button"
            className="btn-outline"
            onClick={limpiarFiltros}
            disabled={loading}
          >
            Limpiar
          </button>

          <button
            type="button"
            className="btn-outline"
            onClick={verTodoHistorial}
            disabled={loading}
          >
            Ver todo
          </button>

          {/* ✅ Toggle local: Solo pendientes */}
          <button
            type="button"
            className={`chip-toggle ${soloPendientes ? "is-on" : ""}`}
            onClick={toggleSoloPendientes}
            disabled={loading}
            title="Filtra en pantalla (no recarga)."
          >
            {soloPendientes ? "✓ Solo pendientes" : "Solo pendientes"}
          </button>
        </div>
      </div>

      {loading && (
        <p className="muted" style={{ marginTop: 10 }}>
          Cargando…
        </p>
      )}
      {error && (
        <p className="error" style={{ marginTop: 10 }}>
          {error}
        </p>
      )}

      {/* Header */}
      {header && (
        <div className="card" style={{ marginTop: 10 }}>
          <strong>{header.tablero}</strong>

          <div className="muted">
            {header.zona && header.zona !== "—"
              ? `Zona: ${header.zona}`
              : "Múltiples zonas"}
          </div>

          <div className="muted">
            Registros: {totalCount}{" "}
            {resp?.count != null ? `(página ${page}/${totalPages})` : ""}
            {soloPendientes ? (
              <span className="muted" style={{ marginLeft: 8 }}>
                · mostrando {results.length} pendientes en esta página
              </span>
            ) : null}
          </div>

          {/* Chips rápidos: tableros match (si backend los manda) */}
          {Array.isArray(resp?.tableros) && resp.tableros.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginTop: 10,
              }}
            >
              {resp.tableros.slice(0, 8).map((t, idx) => (
                <button
                  key={t.id ?? `${t.nombre}-${idx}`}
                  type="button"
                  className="btn-outline"
                  style={{ padding: "6px 10px" }}
                  onClick={() => onSelectTablero(t)}
                  title={t.zona || ""}
                >
                  {t.nombre}
                </button>
              ))}
              {resp.tableros.length > 8 && (
                <span className="muted" style={{ alignSelf: "center" }}>
                  +{resp.tableros.length - 8} más…
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* =========================
          MODO TODO: agrupado por tablero con sticky header
         ========================= */}
      {isModoTodo && grouped && grouped.length > 0 && (
        <div className="timeline" style={{ marginTop: 10 }}>
          {grouped.map((g) => (
            <div key={g.tablero} className="group-block">
              <div className="group-header">
                <div style={{ fontWeight: 900 }}>{g.tablero}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {g.zona ? g.zona : "—"}
                  <span style={{ marginLeft: 10 }}>
                    · {g.items.length} regs
                  </span>
                </div>
              </div>

              <div className="group-items">
                {g.items.map((h) => {
                  const pendiente = hasPendiente(h);

                  return (
                    <div
                      key={h.id || `${h.fecha}-${h.creado}-${h.circuito || ""}`}
                      className={`timeline-item ${
                        pendiente ? "is-pendiente" : ""
                      }`}
                    >
                      <div className="row-top">
                        <div className="fecha">{fmtDateISO(h.fecha)}</div>
                        {pendiente ? (
                          <span className="badge-pendiente">Pendiente</span>
                        ) : null}
                      </div>

                      <div className="muted" style={{ marginTop: 2 }}>
                        {h.circuito ? `Circuito: ${h.circuito}` : ""}
                      </div>

                      <div className="desc" style={{ marginTop: 8 }}>
                        {pickDescripcion(h)}
                      </div>

                      {(h.tarea_pedida || h.tarea_pendiente) && (
                        <div
                          className="muted"
                          style={{ marginTop: 8, lineHeight: 1.3 }}
                        >
                          {h.tarea_pedida ? (
                            <div>
                              <strong>Pedida:</strong> {h.tarea_pedida}
                            </div>
                          ) : null}
                          {h.tarea_pendiente ? (
                            <div>
                              <strong>Pendiente:</strong> {h.tarea_pendiente}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* paginación (en modo todo también aplica si backend soporta) */}
          {resp?.count != null && (
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button
                type="button"
                className="btn-outline"
                onClick={() => goPage(page - 1)}
                disabled={loading || page <= 1}
              >
                ← Anterior
              </button>
              <button
                type="button"
                className="btn-outline"
                onClick={() => goPage(page + 1)}
                disabled={loading || page >= totalPages}
              >
                Siguiente →
              </button>
            </div>
          )}
        </div>
      )}

      {/* =========================
          MODO TABLERO ÚNICO: timeline normal (sin agrupar)
         ========================= */}
      {!isModoTodo && results?.length > 0 && (
        <>
          <div className="timeline" style={{ marginTop: 10 }}>
            {results.map((h) => {
              const pendiente = hasPendiente(h);

              return (
                <div
                  key={h.id || `${h.fecha}-${h.creado}-${h.circuito || ""}`}
                  className={`timeline-item ${pendiente ? "is-pendiente" : ""}`}
                >
                  <div className="row-top">
                    <div className="fecha">{fmtDateISO(h.fecha)}</div>
                    {pendiente ? (
                      <span className="badge-pendiente">Pendiente</span>
                    ) : null}
                  </div>

                  <div className="muted" style={{ marginTop: 2 }}>
                    {h.zona ? `Zona: ${h.zona}` : ""}
                    {h.circuito ? ` · Circuito: ${h.circuito}` : ""}
                  </div>

                  <div className="desc" style={{ marginTop: 8 }}>
                    {pickDescripcion(h)}
                  </div>

                  {(h.tarea_pedida || h.tarea_pendiente) && (
                    <div
                      className="muted"
                      style={{ marginTop: 8, lineHeight: 1.3 }}
                    >
                      {h.tarea_pedida ? (
                        <div>
                          <strong>Pedida:</strong> {h.tarea_pedida}
                        </div>
                      ) : null}
                      {h.tarea_pendiente ? (
                        <div>
                          <strong>Pendiente:</strong> {h.tarea_pendiente}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {resp?.count != null && (
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button
                type="button"
                className="btn-outline"
                onClick={() => goPage(page - 1)}
                disabled={loading || page <= 1}
              >
                ← Anterior
              </button>
              <button
                type="button"
                className="btn-outline"
                onClick={() => goPage(page + 1)}
                disabled={loading || page >= totalPages}
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}

      {/* Vacío */}
      {resp && results?.length === 0 && !loading && !error && (
        <div className="card" style={{ marginTop: 10 }}>
          <div className="muted">
            {soloPendientes
              ? "No hay pendientes con esos filtros (en esta página)."
              : "No hay registros con esos filtros."}
          </div>
        </div>
      )}
    </div>
  );
}
