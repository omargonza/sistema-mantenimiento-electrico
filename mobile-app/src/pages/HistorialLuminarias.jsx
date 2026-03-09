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
   Helpers
======================================================= */
function upper(s) {
  return String(s || "")
    .trim()
    .toUpperCase();
}

function normText(s) {
  return String(s || "")
    .trim()
    .toUpperCase();
}

function pickState(row) {
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

function kmBucket5(km) {
  return kmBucket(km, 5);
}

function getYear(fecha) {
  const s = fmtDateISO(fecha);
  return s ? s.slice(0, 4) : "";
}

function getMonth(fecha) {
  const s = fmtDateISO(fecha);
  return s ? s.slice(5, 7) : "";
}

function getYearMonth(fecha) {
  const s = fmtDateISO(fecha);
  return s ? s.slice(0, 7) : "";
}

function uniqueSortedOptions(list, accessor) {
  const set = new Set();
  for (const item of list || []) {
    const v = String(accessor(item) || "").trim();
    if (v) set.add(v);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
}

/* =======================================================
   Mini charts
======================================================= */
function MiniBars({ title, subtitle, items, maxBars = 12 }) {
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

function QuickList({ title, subtitle, items }) {
  return (
    <div className="lumdash-card">
      <div className="lumdash-cardhead">
        <div className="lumdash-cardtitle">{title}</div>
        {subtitle ? <div className="lumdash-muted">{subtitle}</div> : null}
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {items.length ? (
          items.map((it) => (
            <div
              key={it.key}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(148,163,184,.18)",
                background: "rgba(2,6,23,.24)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <div style={{ fontWeight: 700 }}>{it.codigo || "—"}</div>
                <span className={`pill pill-${it.state}`}>
                  {stateLabel(it.state)}
                </span>
              </div>
              <div className="lumdash-muted" style={{ marginTop: 4 }}>
                {it.fecha || "—"} · {it.ramal || "—"} · KM {it.km}
              </div>
              <div style={{ marginTop: 4 }}>
                {it.tablero || "—"}
                {it.circuito ? ` · ${it.circuito}` : ""}
              </div>
              {it.ubicacion ? (
                <div className="lumdash-muted" style={{ marginTop: 4 }}>
                  {it.ubicacion}
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <div className="lumdash-muted">Sin datos.</div>
        )}
      </div>
    </div>
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

  // UI local
  const [q, setQ] = useState("");
  const [stateFilter, setStateFilter] = useState("ALL");
  const [onlyLatestPerCode, setOnlyLatestPerCode] = useState(true);
  const [tableroFilter, setTableroFilter] = useState("");
  const [circuitoFilter, setCircuitoFilter] = useState("");
  const [zonaFilter, setZonaFilter] = useState("");

  const [sortKey, setSortKey] = useState("fecha");
  const [sortDir, setSortDir] = useState("desc");

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

  const enriched = useMemo(() => {
    return (rows || []).map((r) => {
      const state = pickState(r);
      const km = safeNum(r.km);
      const codigo = String(r.codigo || "")
        .trim()
        .toUpperCase();
      const fecha = fmtDateISO(r.fecha);
      const tablero = String(r.tablero || "").trim();
      const zona = String(r.zona || "").trim();
      const circuito = String(r.circuito || "").trim();
      const ramalRaw = String(r.ramal || "").trim();
      const ramalLabel = RAMAL_RANGES[ramalRaw]?.label || ramalRaw || "—";

      return {
        ...r,
        _state: state,
        _km: km,
        _codigo: codigo,
        _fecha: fecha,
        _tablero: tablero,
        _zona: zona,
        _circuito: circuito,
        _ramalRaw: ramalRaw,
        _ramalLabel: ramalLabel,
        _year: getYear(fecha),
        _month: getMonth(fecha),
        _yearMonth: getYearMonth(fecha),
        _kmBucket1: kmBucket(km, 1),
        _kmBucket5: kmBucket5(km),
      };
    });
  }, [rows]);

  const latestByCode = useMemo(() => {
    if (!onlyLatestPerCode) return enriched;

    const map = new Map();
    for (const r of enriched) {
      if (!r._codigo) continue;
      const prev = map.get(r._codigo);
      if (!prev) {
        map.set(r._codigo, r);
        continue;
      }

      const a = String(r._fecha || "");
      const b = String(prev._fecha || "");
      if (a > b) map.set(r._codigo, r);
      else if (a === b && Number(r.ot_id || 0) > Number(prev.ot_id || 0)) {
        map.set(r._codigo, r);
      }
    }

    const noCode = enriched.filter((r) => !r._codigo);
    return [...Array.from(map.values()), ...noCode];
  }, [enriched, onlyLatestPerCode]);

  const tableroOptions = useMemo(
    () => uniqueSortedOptions(enriched, (r) => r._tablero),
    [enriched],
  );

  const circuitoOptions = useMemo(
    () => uniqueSortedOptions(enriched, (r) => r._circuito),
    [enriched],
  );

  const zonaOptions = useMemo(
    () => uniqueSortedOptions(enriched, (r) => r._zona),
    [enriched],
  );

  const filtered = useMemo(() => {
    const qq = normText(q);

    return (latestByCode || []).filter((r) => {
      if (stateFilter !== "ALL" && r._state !== stateFilter) return false;
      if (tableroFilter && r._tablero !== tableroFilter) return false;
      if (circuitoFilter && r._circuito !== circuitoFilter) return false;
      if (zonaFilter && r._zona !== zonaFilter) return false;

      if (qq) {
        const hay =
          (r._codigo || "").includes(qq) ||
          String(r.id_ot || "")
            .toUpperCase()
            .includes(qq) ||
          String(r.ubicacion || "")
            .toUpperCase()
            .includes(qq) ||
          String(r._tablero || "")
            .toUpperCase()
            .includes(qq) ||
          String(r._zona || "")
            .toUpperCase()
            .includes(qq) ||
          String(r._circuito || "")
            .toUpperCase()
            .includes(qq) ||
          String(r._ramalLabel || "")
            .toUpperCase()
            .includes(qq);

        if (!hay) return false;
      }

      return true;
    });
  }, [latestByCode, q, stateFilter, tableroFilter, circuitoFilter, zonaFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;

    const get = (r) => {
      if (sortKey === "fecha") return r._fecha || "";
      if (sortKey === "km") return r._km ?? -1;
      if (sortKey === "codigo") return r._codigo || "";
      if (sortKey === "estado") return r._state || "";
      if (sortKey === "tablero") return r._tablero || "";
      if (sortKey === "circuito") return r._circuito || "";
      if (sortKey === "ramal") return r._ramalLabel || "";
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

  const kpis = useMemo(() => {
    const total = sorted.length;

    let ok = 0;
    let pend = 0;
    let apag = 0;
    let otro = 0;

    const uniqueCodes = new Set();
    const uniqueTableros = new Set();
    const uniqueCircuitos = new Set();
    const uniqueRamales = new Set();

    for (const r of sorted) {
      if (r._codigo) uniqueCodes.add(r._codigo);
      if (r._tablero) uniqueTableros.add(r._tablero);
      if (r._circuito) uniqueCircuitos.add(r._circuito);
      if (r._ramalRaw) uniqueRamales.add(r._ramalRaw);

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
      uniqueCodes: uniqueCodes.size,
      uniqueTableros: uniqueTableros.size,
      uniqueCircuitos: uniqueCircuitos.size,
      uniqueRamales: uniqueRamales.size,
      okPct: pct(ok),
      pendPct: pct(pend),
      apagPct: pct(apag),
    };
  }, [sorted]);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const r of sorted) {
      const d = r._fecha || "—";
      map.set(d, (map.get(d) || 0) + 1);
    }

    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .slice(-14)
      .map(([d, n]) => ({
        x: d,
        label: d,
        value: n,
      }));
  }, [sorted]);

  const byRamal = useMemo(() => {
    const m = new Map();
    for (const r of sorted) {
      const rr = r._ramalLabel || "Sin ramal";
      m.set(rr, (m.get(rr) || 0) + 1);
    }
    return Array.from(m.entries())
      .map(([label, value]) => ({
        label,
        value,
        tone: "neutral",
      }))
      .sort((a, b) => b.value - a.value);
  }, [sorted]);

  const byState = useMemo(() => {
    return [
      { label: "OK", value: kpis.ok, tone: "ok" },
      { label: "Pendiente", value: kpis.pend, tone: "warn" },
      { label: "Apagado", value: kpis.apag, tone: "danger" },
      { label: "Otro", value: kpis.otro, tone: "neutral" },
    ].filter((x) => x.value > 0);
  }, [kpis]);

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

  const byTablero = useMemo(() => {
    const m = new Map();
    for (const r of sorted) {
      const key = r._tablero || "Sin tablero";
      m.set(key, (m.get(key) || 0) + 1);
    }
    return Array.from(m.entries())
      .map(([label, value]) => ({ label, value, tone: "neutral" }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [sorted]);

  const byCircuito = useMemo(() => {
    const m = new Map();
    for (const r of sorted) {
      const key = r._circuito || "Sin circuito";
      m.set(key, (m.get(key) || 0) + 1);
    }
    return Array.from(m.entries())
      .map(([label, value]) => ({ label, value, tone: "neutral" }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [sorted]);

  const byZona = useMemo(() => {
    const m = new Map();
    for (const r of sorted) {
      const key = r._zona || "Sin zona";
      m.set(key, (m.get(key) || 0) + 1);
    }
    return Array.from(m.entries())
      .map(([label, value]) => ({ label, value, tone: "neutral" }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [sorted]);

  const recentAlerts = useMemo(() => {
    return [...sorted]
      .filter((r) => r._state === "PENDIENTE" || r._state === "APAGADO")
      .sort((a, b) => {
        const af = a._fecha || "";
        const bf = b._fecha || "";
        if (af > bf) return -1;
        if (af < bf) return 1;
        return Number(b.ot_id || 0) - Number(a.ot_id || 0);
      })
      .slice(0, 8)
      .map((r) => ({
        key: `${r.id}-${r._codigo}-${r.ot_id}`,
        codigo: r._codigo,
        state: r._state,
        fecha: r._fecha,
        ramal: r._ramalLabel,
        km: r._km !== null ? r._km.toFixed(2) : "—",
        tablero: r._tablero,
        circuito: r._circuito,
        ubicacion: r.ubicacion || "",
      }));
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
    const headers = [
      "id",
      "ot_id",
      "id_ot",
      "fecha",
      "anio",
      "mes",
      "anio_mes",
      "ramal",
      "ramal_label",
      "zona",
      "tablero",
      "circuito",
      "km",
      "km_bucket_1",
      "km_bucket_5",
      "codigo",
      "estado",
      "estado_label",
      "resultado",
      "luminaria_estado",
      "ubicacion",
      "latest_mode",
      "state_filter",
      "ramal_filter",
      "tablero_filter",
      "circuito_filter",
      "zona_filter",
      "query_filter",
    ];

    const lines = [headers.join(",")];

    for (const r of sorted) {
      const row = [
        r.id,
        r.ot_id,
        r.id_ot,
        r._fecha,
        r._year,
        r._month,
        r._yearMonth,
        r._ramalRaw,
        r._ramalLabel,
        r._zona,
        r._tablero,
        r._circuito,
        r._km ?? "",
        r._kmBucket1 || "",
        r._kmBucket5 || "",
        r._codigo,
        r._state,
        stateLabel(r._state),
        upper(r.resultado),
        upper(r.luminaria_estado),
        String(r.ubicacion || "")
          .replace(/\s+/g, " ")
          .trim(),
        onlyLatestPerCode ? "1" : "0",
        stateFilter,
        ramal,
        tableroFilter,
        circuitoFilter,
        zonaFilter,
        q,
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
      "luminarias_powerbi",
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
            KPIs · ramales · tableros · circuitos · hotspots KM · exportable
            para Power BI
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="lumdash-btn"
            onClick={() => navigate("/dashboard-luminarias")}
            title="Ver dashboard"
          >
            Dashboard
          </button>

          <button
            type="button"
            className="lumdash-btn"
            onClick={exportCSV}
            title="Export CSV"
          >
            Export CSV
          </button>
        </div>
      </div>

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
            placeholder="Buscar por código, OT, tablero, circuito, zona, ubicación…"
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

        <div className="lumdash-grid3" style={{ marginTop: 10 }}>
          <select
            value={tableroFilter}
            onChange={(e) => setTableroFilter(e.target.value)}
          >
            <option value="">Todos los tableros</option>
            {tableroOptions.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>

          <select
            value={circuitoFilter}
            onChange={(e) => setCircuitoFilter(e.target.value)}
          >
            <option value="">Todos los circuitos</option>
            {circuitoOptions.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>

          <select
            value={zonaFilter}
            onChange={(e) => setZonaFilter(e.target.value)}
          >
            <option value="">Todas las zonas</option>
            {zonaOptions.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </div>

        <div className="lumdash-muted" style={{ marginTop: 10 }}>
          Para Power BI: dejá <b>Último estado OFF</b> si querés exportar todas
          las intervenciones históricas. Si lo dejás ON, exportás solo el estado
          más reciente por luminaria.
        </div>
      </div>

      {loading && <div className="lumdash-muted">Cargando…</div>}
      {error && <div className="error">{error}</div>}

      {!loading && !error && (
        <>
          <div className="lumdash-kpis">
            <div className="lumdash-kpi">
              <div className="lumdash-kpiLabel">Filas</div>
              <div className="lumdash-kpiVal">{kpis.total}</div>
              <div className="lumdash-kpiSub">Dataset actual</div>
            </div>

            <div className="lumdash-kpi">
              <div className="lumdash-kpiLabel">Luminarias únicas</div>
              <div className="lumdash-kpiVal">{kpis.uniqueCodes}</div>
              <div className="lumdash-kpiSub">Por código</div>
            </div>

            <div className="lumdash-kpi">
              <div className="lumdash-kpiLabel">Tableros</div>
              <div className="lumdash-kpiVal">{kpis.uniqueTableros}</div>
              <div className="lumdash-kpiSub">En filtro actual</div>
            </div>

            <div className="lumdash-kpi">
              <div className="lumdash-kpiLabel">Circuitos</div>
              <div className="lumdash-kpiVal">{kpis.uniqueCircuitos}</div>
              <div className="lumdash-kpiSub">En filtro actual</div>
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
              subtitle="Distribución actual"
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
              title="Hotspots por KM"
              subtitle="Tramos de 1 km"
              items={byKmBucket}
              maxBars={10}
            />

            <MiniBars
              title="Top tableros"
              subtitle="Mayor cantidad de registros"
              items={byTablero}
              maxBars={10}
            />

            <MiniBars
              title="Top circuitos"
              subtitle="Mayor cantidad de registros"
              items={byCircuito}
              maxBars={10}
            />

            <MiniBars
              title="Top zonas"
              subtitle="Mayor cantidad de registros"
              items={byZona}
              maxBars={10}
            />

            <QuickList
              title="Últimos pendientes / apagados"
              subtitle="Foco operativo"
              items={recentAlerts}
            />
          </div>

          <div className="lumdash-card" style={{ marginTop: 14 }}>
            <div className="lumdash-tableHead">
              <div>
                <div className="lumdash-cardtitle">Detalle analítico</div>
                <div className="lumdash-muted">
                  {sorted.length} filas · listo para exportar
                </div>
              </div>

              <div className="lumdash-sortRow">
                <SortBtn
                  active={sortKey === "fecha"}
                  dir={sortDir}
                  label="Fecha"
                  onClick={() => toggleSort("fecha")}
                />
                <SortBtn
                  active={sortKey === "ramal"}
                  dir={sortDir}
                  label="Ramal"
                  onClick={() => toggleSort("ramal")}
                />
                <SortBtn
                  active={sortKey === "tablero"}
                  dir={sortDir}
                  label="Tablero"
                  onClick={() => toggleSort("tablero")}
                />
                <SortBtn
                  active={sortKey === "circuito"}
                  dir={sortDir}
                  label="Circuito"
                  onClick={() => toggleSort("circuito")}
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
                    <th>Zona</th>
                    <th>Tablero</th>
                    <th>Circuito</th>
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
                      <td>{r._ramalLabel || "—"}</td>
                      <td>{r._zona || "—"}</td>
                      <td>{r._tablero || "—"}</td>
                      <td>{r._circuito || "—"}</td>
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
                        colSpan={10}
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
