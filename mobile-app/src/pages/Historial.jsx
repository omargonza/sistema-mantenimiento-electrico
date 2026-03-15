// src/pages/Historial.jsx
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CalendarDays,
  Filter,
  Layers3,
  ListFilter,
  Search,
} from "lucide-react";

import TableroAutocomplete from "../components/TableroAutocomplete";
import { obtenerHistorial } from "../services/historialApi";
import "../styles/historial.css";

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

  const [desde, setDesde] = useState(searchParams.get("desde") || "");
  const [hasta, setHasta] = useState(searchParams.get("hasta") || "");
  const [circuito, setCircuito] = useState(searchParams.get("circuito") || "");
  const [q, setQ] = useState(searchParams.get("q") || "");

  const [soloPendientes, setSoloPendientes] = useState(
    searchParams.get("pendientes") === "1",
  );

  const [page, setPage] = useState(Number(searchParams.get("page") || 1));

  const [resp, setResp] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

      const next = {};
      if (nombre) next.tablero = nombre;
      if (p.desde) next.desde = p.desde;
      if (p.hasta) next.hasta = p.hasta;
      if (p.circuito) next.circuito = p.circuito;
      if (p.q) next.q = p.q;

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
        { replace: true },
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

  useEffect(() => {
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

  const grouped = useMemo(() => {
    if (!isModoTodo) return null;

    const map = new Map();

    for (const h of results) {
      const tablero = normKey(h.tablero || "—");
      const zona = normKey(h.zona || "");
      const k = tablero.toLowerCase();

      if (!map.has(k)) map.set(k, { tablero, zona, items: [] });
      map.get(k).items.push(h);
    }

    const arr = Array.from(map.values()).sort((a, b) =>
      a.tablero.localeCompare(b.tablero, "es", { sensitivity: "base" }),
    );

    return arr;
  }, [isModoTodo, results]);

  return (
    <div className="page historial-page">
      <section className="card historial-hero">
        <div className="historial-hero__badge">
          <span className="historial-hero__badge-dot" />
          Consulta operativa
        </div>

        <h1 className="titulo historial-hero__title">Historial</h1>

        <p className="historial-hero__text">
          Buscá intervenciones por tablero, fecha, circuito o texto libre. El
          historial puede verse por tablero o agrupado globalmente.
        </p>
      </section>

      <section className="card historial-section">
        <div className="historial-section__head">
          <div>
            <h3 className="subtitulo historial-section__title">Búsqueda</h3>
            <p className="historial-section__copy">
              Elegí tablero o combiná filtros para consultar el historial.
            </p>
          </div>
        </div>

        <div className="historial-stack">
          <div>
            <TableroAutocomplete
              value={tableroSel}
              placeholder="Buscar tablero…"
              onChangeText={(v) => setTableroSel(v)}
              onSubmit={() => {
                aplicarFiltros();
              }}
              onSelect={onSelectTablero}
            />
          </div>

          <div className="historial-filters-grid">
            <div>
              <label className="historial-inline-label" htmlFor="desde">
                <CalendarDays size={14} strokeWidth={2.2} />
                <span>Desde</span>
              </label>
              <input
                id="desde"
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
            </div>

            <div>
              <label className="historial-inline-label" htmlFor="hasta">
                <CalendarDays size={14} strokeWidth={2.2} />
                <span>Hasta</span>
              </label>
              <input
                id="hasta"
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
              />
            </div>

            <div>
              <label className="historial-inline-label" htmlFor="circuito">
                <Layers3 size={14} strokeWidth={2.2} />
                <span>Circuito</span>
              </label>
              <input
                id="circuito"
                type="text"
                placeholder="fd1, alum exterior…"
                value={circuito}
                onChange={(e) => setCircuito(e.target.value)}
              />
            </div>

            <div>
              <label className="historial-inline-label" htmlFor="q">
                <Search size={14} strokeWidth={2.2} />
                <span>Buscar</span>
              </label>
              <input
                id="q"
                type="text"
                placeholder="reparación, cable, luminaria…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>

          <div className="historial-actions-row">
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

            <button
              type="button"
              className={`chip-toggle ${soloPendientes ? "is-on" : ""}`}
              onClick={toggleSoloPendientes}
              disabled={loading}
              title="Filtra en pantalla sin recargar"
            >
              <ListFilter size={15} strokeWidth={2.2} />
              {soloPendientes ? "Solo pendientes" : "Ver pendientes"}
            </button>
          </div>
        </div>
      </section>

      {loading && (
        <div className="historial-status historial-status--loading">
          Cargando…
        </div>
      )}

      {error && <p className="error historial-error">{error}</p>}

      {header && (
        <section className="card historial-summary">
          <div className="historial-summary__main">
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
                <span className="muted historial-summary__pending-note">
                  · mostrando {results.length} pendientes en esta página
                </span>
              ) : null}
            </div>
          </div>

          {Array.isArray(resp?.tableros) && resp.tableros.length > 0 && (
            <div className="historial-summary__chips">
              {resp.tableros.slice(0, 8).map((t, idx) => (
                <button
                  key={t.id ?? `${t.nombre}-${idx}`}
                  type="button"
                  className="btn-outline historial-summary__tab-chip"
                  onClick={() => onSelectTablero(t)}
                  title={t.zona || ""}
                >
                  {t.nombre}
                </button>
              ))}
              {resp.tableros.length > 8 && (
                <span className="muted historial-summary__more">
                  +{resp.tableros.length - 8} más…
                </span>
              )}
            </div>
          )}
        </section>
      )}

      {isModoTodo && grouped && grouped.length > 0 && (
        <div className="timeline historial-timeline">
          {grouped.map((g) => (
            <div key={g.tablero} className="group-block historial-group-block">
              <div className="group-header historial-group-header">
                <div>
                  <div className="historial-group-header__title">
                    {g.tablero}
                  </div>
                  <div className="muted historial-group-header__meta">
                    {g.zona ? g.zona : "—"}
                    <span>· {g.items.length} regs</span>
                  </div>
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
                      } historial-item`}
                    >
                      <div className="row-top">
                        <div className="fecha">{fmtDateISO(h.fecha)}</div>
                        {pendiente ? (
                          <span className="badge-pendiente">Pendiente</span>
                        ) : null}
                      </div>

                      <div className="muted historial-item__meta">
                        {h.circuito ? `Circuito: ${h.circuito}` : ""}
                      </div>

                      <div className="desc historial-item__desc">
                        {pickDescripcion(h)}
                      </div>

                      {(h.tarea_pedida || h.tarea_pendiente) && (
                        <div className="muted historial-item__extra">
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

          {resp?.count != null && (
            <div className="historial-pagination">
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

      {!isModoTodo && results?.length > 0 && (
        <>
          <div className="timeline historial-timeline">
            {results.map((h) => {
              const pendiente = hasPendiente(h);

              return (
                <div
                  key={h.id || `${h.fecha}-${h.creado}-${h.circuito || ""}`}
                  className={`timeline-item ${
                    pendiente ? "is-pendiente" : ""
                  } historial-item`}
                >
                  <div className="row-top">
                    <div className="fecha">{fmtDateISO(h.fecha)}</div>
                    {pendiente ? (
                      <span className="badge-pendiente">Pendiente</span>
                    ) : null}
                  </div>

                  <div className="muted historial-item__meta">
                    {h.zona ? `Zona: ${h.zona}` : ""}
                    {h.circuito ? ` · Circuito: ${h.circuito}` : ""}
                  </div>

                  <div className="desc historial-item__desc">
                    {pickDescripcion(h)}
                  </div>

                  {(h.tarea_pedida || h.tarea_pendiente) && (
                    <div className="muted historial-item__extra">
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
            <div className="historial-pagination">
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

      {resp && results?.length === 0 && !loading && !error && (
        <div className="card historial-empty">
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
