// src/pages/HistorialLuminarias.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API } from "../api";
import "../styles/historial_luminarias.css";

/* =======================================================
   RANGOS POR RAMAL (aprox)
======================================================= */
const RAMAL_RANGES = {
  ACC_NORTE: { min: 11, max: 32, label: "Acc Norte" },
  CAMPANA: { min: 32, max: 76, label: "Campana" },
  PILAR: { min: 32, max: 58, label: "Pilar" },
  ACC_TIGRE: { min: 21, max: 27, label: "Acc Tigre" },
  GRAL_PAZ: { min: 0, max: 25, label: "Gral Paz" },
};
const RAMALES = Object.keys(RAMAL_RANGES);

async function fetchLuminarias({ ramal, from, to }) {
  const params = new URLSearchParams();
  if (ramal) params.set("ramal", ramal);
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  const url = `${API}/api/luminarias/historial/?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando historial luminarias");
  return await res.json();
}

/* =======================================================
   Helpers: estados / etiquetas
======================================================= */
function upper(s) {
  return String(s || "")
    .trim()
    .toUpperCase();
}

function pickState(row) {
  // Prioridad: luminaria_estado (si existe), sino inferir por resultado
  const le = upper(row?.luminaria_estado);
  if (le === "REPARADO") return "OK";
  if (le === "APAGADO") return "APAGADO";
  if (le === "PENDIENTE") return "PENDIENTE";

  const r = upper(row?.resultado);
  if (r === "COMPLETO") return "OK";
  if (r === "PARCIAL") return "PENDIENTE";
  return "OTRO";
}

function stateLabel(state) {
  switch (state) {
    case "OK":
      return "Reparado / OK";
    case "PENDIENTE":
      return "Pendiente";
    case "APAGADO":
      return "Apagado";
    default:
      return "Otro";
  }
}

function safeNum(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : null;
}

function fmtDateISO(s) {
  return s ? String(s).slice(0, 10) : "";
}

function kmBucket(km, step = 1) {
  const x = safeNum(km);
  if (x === null) return null;
  const b = Math.floor(x / step) * step;
  return `${b.toFixed(0)}-${(b + step).toFixed(0)}`;
}

/* =======================================================
   Mini charts (sin libs)
======================================================= */
function MiniBars({ title, subtitle, items, maxBars = 12 }) {
  // items: [{ label, value, tone }]
  const sliced = items.slice(0, maxBars);
  const maxV = Math.max(1, ...sliced.map((x) => x.value));

  return (
    <div className="lumdash-card">
      <div className="lumdash-cardhead">
        <div className="lumdash-cardtitle">{title}</div>
        {subtitle ? <div className="lumdash-muted">{subtitle}</div> : null}
      </div>

      <div className="lumdash-bars">
        {sliced.map((it) => (
          <div
            key={it.label}
            className="lumdash-barrow"
            title={`${it.label}: ${it.value}`}
          >
            <div className="lumdash-barlabel">{it.label}</div>
            <div className="lumdash-bartrack">
              <div
                className={`lumdash-barfill tone-${it.tone || "neutral"}`}
                style={{ width: `${(it.value / maxV) * 100}%` }}
              />
            </div>
            <div className="lumdash-barval">{it.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Sparkline({ points }) {
  // points: [{x,label,value}] - dibujado con divs para no meter canvas/svg complejo
  const maxV = Math.max(1, ...points.map((p) => p.value));
  return (
    <div className="lumdash-spark">
      {points.map((p) => (
        <div
          key={p.x}
          className="lumdash-sparkcol"
          title={`${p.label}: ${p.value}`}
        >
          <div
            className="lumdash-sparkbar"
            style={{ height: `${(p.value / maxV) * 100}%` }}
          />
        </div>
      ))}
    </div>
  );
}

/* =======================================================
   Tabla: Sort button
======================================================= */
function SortBtn({ active, dir, label, onClick }) {
  return (
    <button
      type="button"
      className={`lumdash-sort ${active ? "is-active" : ""}`}
      onClick={onClick}
      title="Ordenar"
    >
      {label}
      {active ? (
        <span className="lumdash-sortdir">{dir === "asc" ? "▲" : "▼"}</span>
      ) : null}
    </button>
  );
}

export default function HistorialLuminarias() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const ramal = params.get("ramal") || "";
  const from = params.get("from") || "";
  const to = params.get("to") || "";

  // UI local (no URL)
  const [q, setQ] = useState("");
  const [stateFilter, setStateFilter] = useState("ALL"); // ALL|OK|PENDIENTE|APAGADO|OTRO
  const [onlyLatestPerCode, setOnlyLatestPerCode] = useState(true);

  const [sortKey, setSortKey] = useState("fecha"); // fecha|km|codigo|estado
  const [sortDir, setSortDir] = useState("desc"); // asc|desc

  function updateParam(key, value) {
    const next = new URLSearchParams(params);
    if (!value) next.delete(key);
    else next.set(key, value);
    setParams(next);
  }

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");

    fetchLuminarias({ ramal, from, to })
      .then((data) => {
        if (!alive) return;
        setRows(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (!alive) return;
        console.warn(e);
        setError("No se pudo cargar el historial.");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [ramal, from, to]);

  // Normalización + enriquecimiento
  const enriched = useMemo(() => {
    return (rows || []).map((r) => {
      const state = pickState(r);
      const km = safeNum(r.km);
      const codigo = String(r.codigo || "")
        .trim()
        .toUpperCase();
      return {
        ...r,
        _state: state,
        _km: km,
        _codigo: codigo,
        _fecha: fmtDateISO(r.fecha),
      };
    });
  }, [rows]);

  // “Último estado por luminaria” (para métricas más limpias)
  const latestByCode = useMemo(() => {
    if (!onlyLatestPerCode) return enriched;

    // tomamos la más nueva por código (fecha + ot_id)
    const map = new Map();
    for (const r of enriched) {
      if (!r._codigo) continue;
      const prev = map.get(r._codigo);
      if (!prev) {
        map.set(r._codigo, r);
        continue;
      }
      // compara por fecha ISO y luego ot_id
      const a = String(r._fecha || "");
      const b = String(prev._fecha || "");
      if (a > b) map.set(r._codigo, r);
      else if (a === b && Number(r.ot_id || 0) > Number(prev.ot_id || 0)) {
        map.set(r._codigo, r);
      }
    }

    // si no tiene código, lo dejamos igual (son raros, pero no los oculto)
    const noCode = enriched.filter((r) => !r._codigo);
    return [...Array.from(map.values()), ...noCode];
  }, [enriched, onlyLatestPerCode]);

  // Filtro búsqueda + estado
  const filtered = useMemo(() => {
    const qq = String(q || "")
      .trim()
      .toUpperCase();
    return (latestByCode || []).filter((r) => {
      if (stateFilter !== "ALL" && r._state !== stateFilter) return false;

      if (qq) {
        const hay =
          (r._codigo || "").includes(qq) ||
          String(r.id_ot || "")
            .toUpperCase()
            .includes(qq) ||
          String(r.ubicacion || "")
            .toUpperCase()
            .includes(qq);
        if (!hay) return false;
      }
      return true;
    });
  }, [latestByCode, q, stateFilter]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;

    const get = (r) => {
      if (sortKey === "fecha") return r._fecha || "";
      if (sortKey === "km") return r._km ?? -1;
      if (sortKey === "codigo") return r._codigo || "";
      if (sortKey === "estado") return r._state || "";
      return "";
    };

    arr.sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  // KPIs
  const kpis = useMemo(() => {
    const total = sorted.length;

    let ok = 0,
      pend = 0,
      apag = 0,
      otro = 0;

    for (const r of sorted) {
      if (r._state === "OK") ok++;
      else if (r._state === "PENDIENTE") pend++;
      else if (r._state === "APAGADO") apag++;
      else otro++;
    }

    const pct = (n) => (total ? Math.round((n / total) * 100) : 0);

    return {
      total,
      ok,
      pend,
      apag,
      otro,
      okPct: pct(ok),
      pendPct: pct(pend),
      apagPct: pct(apag),
    };
  }, [sorted]);

  // Series por día (últimos 14 puntos)
  const byDay = useMemo(() => {
    const map = new Map();
    for (const r of sorted) {
      const d = r._fecha || "—";
      map.set(d, (map.get(d) || 0) + 1);
    }

    const days = Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .slice(-14);

    return days.map(([d, n]) => ({
      x: d,
      label: d,
      value: n,
    }));
  }, [sorted]);

  // Top por ramal
  const byRamal = useMemo(() => {
    const m = new Map();
    for (const r of sorted) {
      const rr = r.ramal || "UNKNOWN";
      m.set(rr, (m.get(rr) || 0) + 1);
    }
    return Array.from(m.entries())
      .map(([key, value]) => ({
        label: RAMAL_RANGES[key]?.label || key,
        value,
        tone: "neutral",
      }))
      .sort((a, b) => b.value - a.value);
  }, [sorted]);

  // Distribución por estado
  const byState = useMemo(() => {
    return [
      { label: "OK", value: kpis.ok, tone: "ok" },
      { label: "Pendiente", value: kpis.pend, tone: "warn" },
      { label: "Apagado", value: kpis.apag, tone: "danger" },
      { label: "Otro", value: kpis.otro, tone: "neutral" },
    ].filter((x) => x.value > 0);
  }, [kpis]);

  // Hotspots por KM (bucket 1km) -> top 12
  const byKmBucket = useMemo(() => {
    const m = new Map();
    for (const r of sorted) {
      const b = kmBucket(r._km, 1);
      if (!b) continue;
      m.set(b, (m.get(b) || 0) + 1);
    }
    return Array.from(m.entries())
      .map(([label, value]) => ({ label, value, tone: "neutral" }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [sorted]);

  function toggleSort(key) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("desc");
      return;
    }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  }

  function exportCSV() {
    // Dataset listo para metrics/ML (simple, consistente)
    const headers = [
      "id",
      "ot_id",
      "id_ot",
      "fecha",
      "ramal",
      "km",
      "codigo",
      "estado",
      "resultado",
      "luminaria_estado",
      "ubicacion",
    ];

    const lines = [headers.join(",")];

    for (const r of sorted) {
      const row = [
        r.id,
        r.ot_id,
        r.id_ot,
        r._fecha,
        r.ramal,
        r._km ?? "",
        (r._codigo || "").replace(/,/g, " "),
        r._state,
        upper(r.resultado),
        upper(r.luminaria_estado),
        String(r.ubicacion || "")
          .replace(/\s+/g, " ")
          .replace(/,/g, " "),
      ];

      lines.push(
        row.map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(","),
      );
    }

    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;

    const nameParts = [
      "luminarias",
      ramal || "todos",
      from || "all",
      to || "all",
      onlyLatestPerCode ? "latest" : "raw",
    ];
    a.download = `${nameParts.join("_")}.csv`;

    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  return (
    <div className="page lumdash">
      {/* Header */}
      <div className="lumdash-top">
        <button
          type="button"
          className="lumdash-back"
          onClick={() => {
            if (window.history.length > 1) navigate(-1);
            else navigate("/");
          }}
          title="Volver"
        >
          <span className="lumdash-backIcon" aria-hidden>
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </span>
          Volver
        </button>

        <div>
          <div className="lumdash-title">Historial de Luminarias</div>
          <div className="lumdash-sub">
            KPIs · hotspots · exportable dataset | Indicadores clave · puntos
            críticos · datos exportables
          </div>
        </div>

        <button
          type="button"
          className="lumdash-btn"
          onClick={exportCSV}
          title="Export CSV"
        >
          Export CSV
        </button>
      </div>

      {/* Filtros */}
      <div className="lumdash-card lumdash-filters">
        <div className="lumdash-grid3">
          <select
            value={ramal}
            onChange={(e) => updateParam("ramal", e.target.value)}
          >
            <option value="">Todos los ramales</option>
            {RAMALES.map((r) => (
              <option key={r} value={r}>
                {RAMAL_RANGES[r].label}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={from}
            onChange={(e) => updateParam("from", e.target.value)}
          />
          <input
            type="date"
            value={to}
            onChange={(e) => updateParam("to", e.target.value)}
          />
        </div>

        <div className="lumdash-grid3" style={{ marginTop: 10 }}>
          <input
            type="text"
            placeholder="Buscar por código (PC4026), OT, ubicación…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
          >
            <option value="ALL">Todos los estados</option>
            <option value="OK">Reparado / OK</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="APAGADO">Apagado</option>
            <option value="OTRO">Otro</option>
          </select>

          <button
            type="button"
            className={`lumdash-toggle ${onlyLatestPerCode ? "is-on" : ""}`}
            onClick={() => setOnlyLatestPerCode((v) => !v)}
            title="Si está ON: una fila por luminaria (último estado)"
          >
            {onlyLatestPerCode ? "Último estado: ON" : "Último estado: OFF"}
          </button>
        </div>

        <div className="lumdash-muted" style={{ marginTop: 10 }}>
          Tip: dejá <b>Último estado ON</b> para métricas limpias (una fila por
          luminaria). Ponelo OFF si querés ver todas las intervenciones
          históricas.
        </div>
      </div>

      {loading && <div className="lumdash-muted">Cargando…</div>}
      {error && <div className="error">{error}</div>}

      {!loading && !error && (
        <>
          {/* KPIs */}
          <div className="lumdash-kpis">
            <div className="lumdash-kpi">
              <div className="lumdash-kpiLabel">Total</div>
              <div className="lumdash-kpiVal">{kpis.total}</div>
              <div className="lumdash-kpiSub">Filtrado actual</div>
            </div>

            <div className="lumdash-kpi tone-ok">
              <div className="lumdash-kpiLabel">OK</div>
              <div className="lumdash-kpiVal">{kpis.ok}</div>
              <div className="lumdash-kpiSub">{kpis.okPct}%</div>
            </div>

            <div className="lumdash-kpi tone-warn">
              <div className="lumdash-kpiLabel">Pendientes</div>
              <div className="lumdash-kpiVal">{kpis.pend}</div>
              <div className="lumdash-kpiSub">{kpis.pendPct}%</div>
            </div>

            <div className="lumdash-kpi tone-danger">
              <div className="lumdash-kpiLabel">Apagadas</div>
              <div className="lumdash-kpiVal">{kpis.apag}</div>
              <div className="lumdash-kpiSub">{kpis.apagPct}%</div>
            </div>
          </div>

          {/* “Charts” */}
          <div className="lumdash-grid2">
            <div className="lumdash-card">
              <div className="lumdash-cardhead">
                <div className="lumdash-cardtitle">Volumen por día</div>
                <div className="lumdash-muted">
                  Últimos {Math.min(14, byDay.length)} días
                </div>
              </div>
              <Sparkline points={byDay} />
            </div>

            <MiniBars
              title="Estados"
              subtitle="Distribución (según filtros)"
              items={byState}
              maxBars={6}
            />

            <MiniBars
              title="Top ramales"
              subtitle="Dónde hubo más registros"
              items={byRamal}
              maxBars={8}
            />

            <MiniBars
              title="Hotspots KM · Puntos críticos por KM"
              subtitle="Tramos de 1 km (top 10)"
              items={byKmBucket}
              maxBars={10}
            />
          </div>

          {/* Tabla */}
          <div className="lumdash-card" style={{ marginTop: 14 }}>
            <div className="lumdash-tableHead">
              <div>
                <div className="lumdash-cardtitle">Detalle</div>
                <div className="lumdash-muted">{sorted.length} filas</div>
              </div>

              <div className="lumdash-sortRow">
                <SortBtn
                  active={sortKey === "fecha"}
                  dir={sortDir}
                  label="Fecha"
                  onClick={() => toggleSort("fecha")}
                />
                <SortBtn
                  active={sortKey === "km"}
                  dir={sortDir}
                  label="KM"
                  onClick={() => toggleSort("km")}
                />
                <SortBtn
                  active={sortKey === "codigo"}
                  dir={sortDir}
                  label="Código"
                  onClick={() => toggleSort("codigo")}
                />
                <SortBtn
                  active={sortKey === "estado"}
                  dir={sortDir}
                  label="Estado"
                  onClick={() => toggleSort("estado")}
                />
              </div>
            </div>

            <div className="lumdash-tableWrap">
              <table
                className="lumdash-table"
                aria-label="Tabla analítica de luminarias"
              >
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Ramal</th>
                    <th>KM</th>
                    <th>Código</th>
                    <th>Estado</th>
                    <th>OT</th>
                    <th>Ubicación</th>
                  </tr>
                </thead>

                <tbody>
                  {sorted.map((r) => (
                    <tr key={String(r.id)} className={`row-${r._state}`}>
                      <td className="mono">{r._fecha || "—"}</td>
                      <td>{RAMAL_RANGES[r.ramal]?.label || r.ramal || "—"}</td>
                      <td className="mono">
                        {r._km !== null ? r._km.toFixed(2) : "—"}
                      </td>
                      <td className="mono">{r._codigo || "—"}</td>
                      <td>
                        <span className={`pill pill-${r._state}`}>
                          {stateLabel(r._state)}
                        </span>
                      </td>
                      <td className="mono">
                        {r.id_ot ||
                          `OT-${Number(r.ot_id || 0)
                            .toString()
                            .padStart(6, "0")}`}
                      </td>
                      <td className="clip">{r.ubicacion || "—"}</td>
                    </tr>
                  ))}

                  {!sorted.length && (
                    <tr>
                      <td
                        colSpan={7}
                        className="lumdash-muted"
                        style={{ padding: 14 }}
                      >
                        Sin resultados con los filtros actuales.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
