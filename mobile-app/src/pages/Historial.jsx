import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import TableroAutocomplete from "../components/TableroAutocomplete";
import { obtenerHistorial } from "../services/historialApi";

const PAGE_SIZE = 30;

function fmtDateISO(s) {
  // deja YYYY-MM-DD como viene (si viene ISO completo recorta)
  if (!s) return "";
  return String(s).slice(0, 10);
}

function pickDescripcion(h) {
  // Prioridad para UI (analítica queda en campos):
  return (
    h?.tarea_realizada?.trim() ||
    h?.tarea_pedida?.trim() ||
    h?.tarea_pendiente?.trim() ||
    h?.descripcion?.trim() ||
    "—"
  );
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

  // paginación
  const [page, setPage] = useState(Number(searchParams.get("page") || 1));

  // data
  const [resp, setResp] = useState(null); // puede ser {count,page,page_size,results} o tu formato actual
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const params = useMemo(() => {
    const p = {
      page,
      page_size: PAGE_SIZE,
    };
    if (desde) p.desde = desde;
    if (hasta) p.hasta = hasta;
    if (circuito) p.circuito = circuito;
    if (q) p.q = q;
    return p;
  }, [page, desde, hasta, circuito, q]);

  const results = useMemo(() => {
    if (!resp) return [];
    // soporta ambas formas:
    // 1) nuevo: resp.results (paginado)
    // 2) viejo: resp.historial
    return resp.results || resp.historial || [];
  }, [resp]);

  const header = useMemo(() => {
    if (!resp) return null;
    // soporta ambos formatos
    const tablero = resp.tablero || tableroSel || "";
    const zona = resp.zona || (results?.[0]?.zona ?? "");
    return { tablero, zona };
  }, [resp, tableroSel, results]);

  const totalCount = resp?.count ?? results.length;
  const pageSize = resp?.page_size ?? PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  async function fetchHistorial(tableroNombre, p = params) {
    const nombre = (tableroNombre || "").trim();
    if (!nombre) return;

    setLoading(true);
    setError("");
    setResp(null);

    try {
      // Recomendado: obtenerHistorial(tablero, params)
      const data = await obtenerHistorial(nombre, p);
      setResp(data);

      // persistir query params en URL
      const next = {};
      next.tablero = nombre;
      if (p.desde) next.desde = p.desde;
      if (p.hasta) next.hasta = p.hasta;
      if (p.circuito) next.circuito = p.circuito;
      if (p.q) next.q = p.q;
      next.page = String(p.page || 1);
      setSearchParams(next, { replace: true });
    } catch (e) {
      console.warn(e);
      setError("No se pudo cargar el historial. Verificá conexión o tablero.");
    } finally {
      setLoading(false);
    }
  }

  function onSelectTablero(t) {
    if (!t?.nombre) return;
    setTableroSel(t.nombre);
    setPage(1);
    fetchHistorial(t.nombre, { ...params, page: 1 });
  }

  function aplicarFiltros() {
    if (!tableroSel.trim()) {
      setError("Seleccioná un tablero para buscar.");
      return;
    }
    setPage(1);
    fetchHistorial(tableroSel, { ...params, page: 1 });
  }

  function limpiarFiltros() {
    setDesde("");
    setHasta("");
    setCircuito("");
    setQ("");
    setPage(1);
    if (tableroSel.trim()) {
      fetchHistorial(tableroSel, { page: 1, page_size: PAGE_SIZE });
    } else {
      setResp(null);
      setError("");
    }
    setSearchParams(tableroSel ? { tablero: tableroSel, page: "1" } : {}, {
      replace: true,
    });
  }

  function goPage(nextPage) {
    const p = Math.min(Math.max(1, nextPage), totalPages);
    setPage(p);
    fetchHistorial(tableroSel, { ...params, page: p });
  }

  useEffect(() => {
    if (!initialTablero) return;

    const initialPage = Number(searchParams.get("page") || 1);

    // armamos params iniciales leyendo de la URL (no del estado)
    const p = {
      page: initialPage,
      page_size: PAGE_SIZE,
    };

    const d = searchParams.get("desde");
    const h = searchParams.get("hasta");
    const c = searchParams.get("circuito");
    const qq = searchParams.get("q");

    if (d) p.desde = d;
    if (h) p.hasta = h;
    if (c) p.circuito = c;
    if (qq) p.q = qq;

    fetchHistorial(initialTablero, p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="page">
      <h1 className="titulo">Historial por tablero</h1>

      <TableroAutocomplete
        value={tableroSel}
        placeholder="Buscar tablero…"
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

        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
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

      {/* Header tablero */}
      {header && (
        <div className="card" style={{ marginTop: 10 }}>
          <strong>{header.tablero}</strong>
          <div className="muted">Zona: {header.zona || "—"}</div>
          <div className="muted">
            Registros: {totalCount}{" "}
            {resp?.count != null ? `(página ${page}/${totalPages})` : ""}
          </div>
        </div>
      )}

      {/* Timeline */}
      {results?.length > 0 && (
        <>
          <div className="timeline" style={{ marginTop: 10 }}>
            {results.map((h) => (
              <div
                key={h.id || `${h.fecha}-${h.creado}-${h.circuito || ""}`}
                className="timeline-item"
              >
                <div className="fecha">{fmtDateISO(h.fecha)}</div>

                <div className="muted" style={{ marginTop: 2 }}>
                  {h.zona ? `Zona: ${h.zona}` : ""}
                  {h.circuito ? ` · Circuito: ${h.circuito}` : ""}
                </div>

                {/* Texto principal */}
                <div className="desc" style={{ marginTop: 8 }}>
                  {pickDescripcion(h)}
                </div>

                {/* Detalle analítico (opcional, pero útil) */}
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
            ))}
          </div>

          {/* Paginación (si backend la soporta) */}
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
          <div className="muted">No hay registros con esos filtros.</div>
        </div>
      )}
    </div>
  );
}
