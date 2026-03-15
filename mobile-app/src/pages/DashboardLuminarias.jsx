// src/pages/DashboardLuminarias.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { API, authHeaders, getCurrentUser } from "../api";

const RAMAL_RANGES = {
  ACC_NORTE: { min: 11, max: 32, label: "Acc Norte" },
  CAMPANA: { min: 32, max: 76, label: "Campana" },
  PILAR: { min: 32, max: 58, label: "Pilar" },
  ACC_TIGRE: { min: 21, max: 27, label: "Acc Tigre" },
  GRAL_PAZ: { min: 0, max: 25, label: "Gral Paz" },
};

const RAMALES = Object.keys(RAMAL_RANGES);

const PIE_COLORS = ["#16a34a", "#f59e0b", "#dc2626", "#2563eb"];
const BAR_CYAN = "#0891b2";
const BAR_GREEN = "#16a34a";
const BAR_VIOLET = "#7c3aed";
const BAR_ORANGE = "#ea580c";
const BAR_RED = "#dc2626";
const BAR_BLUE = "#2563eb";

async function fetchLuminarias({ ramal, from, to }) {
  const params = new URLSearchParams();
  if (ramal) params.set("ramal", ramal);
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  const url = `${API}/api/luminarias/historial/?${params.toString()}`;
  const res = await fetch(url, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Error cargando dashboard de luminarias");
  return await res.json();
}

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

function kmBucket(km, step = 5) {
  const x = safeNum(km);
  if (x === null) return "Sin KM";
  const b = Math.floor(x / step) * step;
  return `${b}-${b + step}`;
}

function uniqueSortedOptions(list, accessor) {
  const set = new Set();
  for (const item of list || []) {
    const v = String(accessor(item) || "").trim();
    if (v) set.add(v);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
}

function groupCount(list, keyFn, valueName = "value") {
  const map = new Map();

  for (const item of list) {
    const key = keyFn(item);
    if (!key) continue;
    map.set(key, (map.get(key) || 0) + 1);
  }

  return Array.from(map.entries()).map(([name, value]) => ({
    name,
    [valueName]: value,
  }));
}

function sortDesc(arr, key = "value") {
  return [...arr].sort((a, b) => Number(b[key] || 0) - Number(a[key] || 0));
}

function cardStyle() {
  return {
    background: "rgba(255,255,255,.58)",
    border: "1px solid rgba(71,85,105,.22)",
    borderRadius: 20,
    padding: 16,
    boxShadow: "0 10px 30px rgba(15,23,42,.12)",
    backdropFilter: "blur(10px)",
  };
}

function kpiCardStyle(tone = "default") {
  const tones = {
    default: {
      border: "1px solid rgba(71,85,105,.22)",
      bg: "rgba(255,255,255,.62)",
    },
    ok: {
      border: "1px solid rgba(22,163,74,.35)",
      bg: "rgba(220,252,231,.74)",
    },
    warn: {
      border: "1px solid rgba(245,158,11,.35)",
      bg: "rgba(254,243,199,.78)",
    },
    danger: {
      border: "1px solid rgba(220,38,38,.35)",
      bg: "rgba(254,226,226,.78)",
    },
  };

  return {
    background: tones[tone].bg,
    border: tones[tone].border,
    borderRadius: 20,
    padding: 16,
    boxShadow: "0 10px 30px rgba(15,23,42,.10)",
  };
}

function ExplainBox({ title, children }) {
  return (
    <div
      style={{
        marginTop: 10,
        padding: "10px 12px",
        borderRadius: 14,
        background: "rgba(226,232,240,.72)",
        border: "1px solid rgba(71,85,105,.16)",
        color: "#334155",
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      {title ? (
        <div style={{ fontWeight: 800, marginBottom: 4, color: "#0f172a" }}>
          {title}
        </div>
      ) : null}
      <div>{children}</div>
    </div>
  );
}

function SmartTooltip({ active, payload, label, mode = "default" }) {
  if (!active || !payload || !payload.length) return null;

  const row = payload[0];
  const value = row?.value ?? 0;
  const name = row?.name || row?.dataKey || "Valor";

  let title = label;
  let text = `${name}: ${value}`;

  if (mode === "day") {
    title = `Fecha: ${label}`;
    text = `Cantidad de registros cargados en ese día: ${value}.`;
  }

  if (mode === "month") {
    title = `Mes: ${label}`;
    text = `Cantidad total de registros cargados en ese mes: ${value}.`;
  }

  if (mode === "state") {
    title = `Estado: ${label || name}`;
    text = `Cantidad de luminarias que hoy se encuentran en ese estado dentro del filtro actual: ${value}.`;
  }

  if (mode === "ramal") {
    title = `Ramal: ${label || name}`;
    text = `Cantidad de registros asociados a este ramal: ${value}.`;
  }

  if (mode === "tablero") {
    title = `Tablero: ${label || name}`;
    text = `Cantidad de registros asociados a este tablero: ${value}.`;
  }

  if (mode === "circuito") {
    title = `Circuito: ${label || name}`;
    text = `Cantidad de registros asociados a este circuito: ${value}.`;
  }

  if (mode === "zona") {
    title = `Zona: ${label || name}`;
    text = `Cantidad de registros asociados a esta zona: ${value}.`;
  }

  if (mode === "km") {
    title = `Tramo KM: ${label || name}`;
    text = `Cantidad de registros dentro de este tramo de 5 km: ${value}.`;
  }

  return (
    <div
      style={{
        background: "rgba(15,23,42,.96)",
        border: "1px solid rgba(148,163,184,.24)",
        borderRadius: 14,
        padding: "10px 12px",
        boxShadow: "0 10px 24px rgba(0,0,0,.22)",
        maxWidth: 320,
      }}
    >
      <div style={{ fontWeight: 800, color: "#f8fafc", marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.45 }}>
        {text}
      </div>
    </div>
  );
}

function KpiExplain({ children }) {
  return (
    <div
      style={{
        marginTop: 6,
        color: "#475569",
        fontSize: 12,
        lineHeight: 1.4,
      }}
    >
      {children}
    </div>
  );
}

function DashboardLuminarias() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const user = getCurrentUser();
  const role = user?.profile?.role;

  useEffect(() => {
    if (role && role !== "admin") {
      navigate("/historial-luminarias", { replace: true });
    }
  }, [role, navigate]);

  if (role && role !== "admin") {
    return null;
  }

  const ramal = params.get("ramal") || "";
  const from = params.get("from") || "";
  const to = params.get("to") || "";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [stateFilter, setStateFilter] = useState("ALL");
  const [onlyLatestPerCode, setOnlyLatestPerCode] = useState(true);
  const [tableroFilter, setTableroFilter] = useState("");
  const [circuitoFilter, setCircuitoFilter] = useState("");
  const [zonaFilter, setZonaFilter] = useState("");

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
        setError("No se pudo cargar el dashboard.");
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
      const km = safeNum(r.km);
      return {
        ...r,
        _state: pickState(r),
        _fecha: fmtDateISO(r.fecha),
        _year: getYear(r.fecha),
        _month: getMonth(r.fecha),
        _yearMonth: getYearMonth(r.fecha),
        _codigo: String(r.codigo || "")
          .trim()
          .toUpperCase(),
        _km: km,
        _kmBucket: kmBucket(km, 5),
        _ramalRaw: String(r.ramal || "").trim(),
        _ramalLabel:
          RAMAL_RANGES[String(r.ramal || "").trim()]?.label ||
          String(r.ramal || "").trim() ||
          "Sin ramal",
        _tablero: String(r.tablero || "").trim(),
        _circuito: String(r.circuito || "").trim(),
        _zona: String(r.zona || "").trim(),
        _ubicacion: String(r.ubicacion || "").trim(),
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
        const hit =
          r._codigo.includes(qq) ||
          r._ubicacion.toUpperCase().includes(qq) ||
          r._tablero.toUpperCase().includes(qq) ||
          r._circuito.toUpperCase().includes(qq) ||
          r._zona.toUpperCase().includes(qq) ||
          r._ramalLabel.toUpperCase().includes(qq) ||
          String(r.id_ot || "")
            .toUpperCase()
            .includes(qq);

        if (!hit) return false;
      }

      return true;
    });
  }, [latestByCode, q, stateFilter, tableroFilter, circuitoFilter, zonaFilter]);

  const kpis = useMemo(() => {
    const total = filtered.length;
    const codes = new Set();
    const tableros = new Set();
    const circuitos = new Set();
    const zonas = new Set();

    let ok = 0;
    let pend = 0;
    let apag = 0;
    let otro = 0;

    for (const r of filtered) {
      if (r._codigo) codes.add(r._codigo);
      if (r._tablero) tableros.add(r._tablero);
      if (r._circuito) circuitos.add(r._circuito);
      if (r._zona) zonas.add(r._zona);

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
      codes: codes.size,
      tableros: tableros.size,
      circuitos: circuitos.size,
      zonas: zonas.size,
      okPct: pct(ok),
      pendPct: pct(pend),
      apagPct: pct(apag),
    };
  }, [filtered]);

  const byDay = useMemo(() => {
    return groupCount(filtered, (r) => r._fecha, "total")
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(-30);
  }, [filtered]);

  const byMonth = useMemo(() => {
    return groupCount(filtered, (r) => r._yearMonth, "total").sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [filtered]);

  const byState = useMemo(() => {
    return [
      { name: "OK", value: kpis.ok },
      { name: "Pendiente", value: kpis.pend },
      { name: "Apagado", value: kpis.apag },
      { name: "Otro", value: kpis.otro },
    ].filter((x) => x.value > 0);
  }, [kpis]);

  const byRamal = useMemo(() => {
    return sortDesc(groupCount(filtered, (r) => r._ramalLabel)).slice(0, 10);
  }, [filtered]);

  const byTablero = useMemo(() => {
    return sortDesc(
      groupCount(filtered, (r) => r._tablero || "Sin tablero"),
    ).slice(0, 10);
  }, [filtered]);

  const byCircuito = useMemo(() => {
    return sortDesc(
      groupCount(filtered, (r) => r._circuito || "Sin circuito"),
    ).slice(0, 10);
  }, [filtered]);

  const byZona = useMemo(() => {
    return sortDesc(groupCount(filtered, (r) => r._zona || "Sin zona")).slice(
      0,
      10,
    );
  }, [filtered]);

  const byKm = useMemo(() => {
    return sortDesc(groupCount(filtered, (r) => r._kmBucket || "Sin KM")).slice(
      0,
      12,
    );
  }, [filtered]);

  const recentAlerts = useMemo(() => {
    return [...filtered]
      .filter((r) => r._state === "PENDIENTE" || r._state === "APAGADO")
      .sort((a, b) => {
        const af = a._fecha || "";
        const bf = b._fecha || "";
        if (af > bf) return -1;
        if (af < bf) return 1;
        return Number(b.ot_id || 0) - Number(a.ot_id || 0);
      })
      .slice(0, 8);
  }, [filtered]);

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

    for (const r of filtered) {
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
        r._kmBucket || "",
        r._codigo,
        r._state,
        stateLabel(r._state),
        upper(r.resultado),
        upper(r.luminaria_estado),
        r._ubicacion,
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
    a.download = `dashboard_luminarias_${ramal || "todos"}_${from || "all"}_${to || "all"}_${onlyLatestPerCode ? "latest" : "raw"}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #eef2f7 0%, #d8e0e9 35%, #c4cfdb 100%)",
        color: "#0f172a",
        padding: 16,
      }}
    >
      <div
        style={{
          maxWidth: 1480,
          margin: "0 auto",
          display: "grid",
          gap: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={topBtnStyle}
          >
            ← Volver
          </button>

          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#0f172a" }}>
              Dashboard de Luminarias
            </div>
            <div style={{ color: "#475569", marginTop: 4 }}>
              Visualización operativa para seguimiento del sector y exportación
              a Power BI
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => navigate("/historial-luminarias")}
              style={topBtnStyle}
            >
              Ver historial tabular
            </button>

            {role === "admin" && (
              <button type="button" onClick={exportCSV} style={topBtnStyle}>
                Export CSV
              </button>
            )}
          </div>
        </div>

        {loading && (
          <div style={{ color: "#334155", padding: 12 }}>Cargando…</div>
        )}

        {error && (
          <div
            style={{
              ...cardStyle(),
              color: "#991b1b",
              border: "1px solid rgba(220,38,38,.35)",
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <div style={cardStyle()}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 10,
                }}
              >
                <select
                  value={ramal}
                  onChange={(e) => updateParam("ramal", e.target.value)}
                  style={inputStyle}
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
                  style={inputStyle}
                />

                <input
                  type="date"
                  value={to}
                  onChange={(e) => updateParam("to", e.target.value)}
                  style={inputStyle}
                />

                <select
                  value={stateFilter}
                  onChange={(e) => setStateFilter(e.target.value)}
                  style={inputStyle}
                >
                  <option value="ALL">Todos los estados</option>
                  <option value="OK">Reparado / OK</option>
                  <option value="PENDIENTE">Pendiente</option>
                  <option value="APAGADO">Apagado</option>
                  <option value="OTRO">Otro</option>
                </select>

                <select
                  value={tableroFilter}
                  onChange={(e) => setTableroFilter(e.target.value)}
                  style={inputStyle}
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
                  style={inputStyle}
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
                  style={inputStyle}
                >
                  <option value="">Todas las zonas</option>
                  {zonaOptions.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por código, tablero, OT, ubicación…"
                  style={inputStyle}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  flexWrap: "wrap",
                  marginTop: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => setOnlyLatestPerCode((v) => !v)}
                  style={{
                    ...inputStyle,
                    cursor: "pointer",
                    width: "auto",
                    minWidth: 230,
                    background: onlyLatestPerCode
                      ? "rgba(22,163,74,.16)"
                      : "rgba(255,255,255,.7)",
                  }}
                >
                  {onlyLatestPerCode
                    ? "Último estado por luminaria: ON"
                    : "Último estado por luminaria: OFF"}
                </button>

                <div style={{ color: "#475569", fontSize: 13 }}>
                  ON: una fila por luminaria con su estado más reciente. OFF:
                  todas las intervenciones históricas.
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 10,
              }}
            >
              <div style={kpiCardStyle()}>
                <div style={kpiLabel}>Filas</div>
                <div style={kpiValue}>{kpis.total}</div>
                <div style={kpiSub}>Dataset filtrado</div>
                <KpiExplain>
                  Cantidad total de registros visibles según los filtros
                  actuales.
                </KpiExplain>
              </div>

              <div style={kpiCardStyle()}>
                <div style={kpiLabel}>Luminarias únicas</div>
                <div style={kpiValue}>{kpis.codes}</div>
                <div style={kpiSub}>Por código</div>
                <KpiExplain>
                  Cantidad de códigos distintos de luminarias dentro del filtro
                  actual.
                </KpiExplain>
              </div>

              <div style={kpiCardStyle()}>
                <div style={kpiLabel}>Tableros</div>
                <div style={kpiValue}>{kpis.tableros}</div>
                <div style={kpiSub}>Alcanzados</div>
                <KpiExplain>
                  Número de tableros distintos donde hubo intervenciones.
                </KpiExplain>
              </div>

              <div style={kpiCardStyle()}>
                <div style={kpiLabel}>Circuitos</div>
                <div style={kpiValue}>{kpis.circuitos}</div>
                <div style={kpiSub}>Alcanzados</div>
                <KpiExplain>
                  Número de circuitos distintos incluidos en el análisis.
                </KpiExplain>
              </div>

              <div style={kpiCardStyle("ok")}>
                <div style={kpiLabel}>OK</div>
                <div style={kpiValue}>{kpis.ok}</div>
                <div style={kpiSub}>{kpis.okPct}%</div>
                <KpiExplain>
                  Luminarias registradas como reparadas o resueltas
                  correctamente.
                </KpiExplain>
              </div>

              <div style={kpiCardStyle("warn")}>
                <div style={kpiLabel}>Pendientes</div>
                <div style={kpiValue}>{kpis.pend}</div>
                <div style={kpiSub}>{kpis.pendPct}%</div>
                <KpiExplain>
                  Casos que quedaron sin resolver totalmente o requieren
                  seguimiento.
                </KpiExplain>
              </div>

              <div style={kpiCardStyle("danger")}>
                <div style={kpiLabel}>Apagadas</div>
                <div style={kpiValue}>{kpis.apag}</div>
                <div style={kpiSub}>{kpis.apagPct}%</div>
                <KpiExplain>
                  Luminarias que siguen apagadas según el último estado
                  registrado.
                </KpiExplain>
              </div>
            </div>

            <ExplainBox title="Cómo leer este dashboard">
              Este tablero muestra el comportamiento operativo de las luminarias
              según los filtros aplicados. Los gráficos permiten detectar
              concentración de fallas, volumen de trabajo por período,
              distribución por estado y sectores con mayor carga de
              intervención. Si “Último estado por luminaria” está en ON, cada
              luminaria aparece una sola vez con su estado más reciente. Si está
              en OFF, se visualizan todas las intervenciones históricas.
            </ExplainBox>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
                gap: 12,
              }}
            >
              <div style={cardStyle()}>
                <div style={cardTitle}>Volumen diario de intervenciones</div>
                <div style={cardSub}>Últimos 30 días visibles</div>
                <div style={{ width: "100%", height: 280 }}>
                  <ResponsiveContainer>
                    <LineChart data={byDay}>
                      <CartesianGrid stroke="rgba(71,85,105,.18)" />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "#334155", fontSize: 11 }}
                      />
                      <YAxis
                        tick={{ fill: "#334155", fontSize: 11 }}
                        allowDecimals={false}
                      />
                      <Tooltip content={<SmartTooltip mode="day" />} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="total"
                        name="Intervenciones"
                        stroke={BAR_CYAN}
                        strokeWidth={3}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <ExplainBox title="Qué muestra">
                  Permite ver la evolución diaria del trabajo realizado. Sirve
                  para detectar días con picos de actividad, mayor carga
                  operativa o acumulación de tareas.
                </ExplainBox>
              </div>

              <div style={cardStyle()}>
                <div style={cardTitle}>Tendencia mensual de intervenciones</div>
                <div style={cardSub}>Comparación mes a mes</div>
                <div style={{ width: "100%", height: 280 }}>
                  <ResponsiveContainer>
                    <BarChart data={byMonth}>
                      <CartesianGrid stroke="rgba(71,85,105,.18)" />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "#334155", fontSize: 11 }}
                      />
                      <YAxis
                        tick={{ fill: "#334155", fontSize: 11 }}
                        allowDecimals={false}
                      />
                      <Tooltip content={<SmartTooltip mode="month" />} />
                      <Bar
                        dataKey="total"
                        name="Intervenciones"
                        fill={BAR_BLUE}
                        radius={[10, 10, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <ExplainBox title="Qué muestra">
                  Resume el volumen mensual de intervenciones. Es útil para
                  comparar meses, detectar tendencia de crecimiento o caída, y
                  preparar reportes de gestión.
                </ExplainBox>
              </div>

              <div style={cardStyle()}>
                <div style={cardTitle}>
                  Distribución actual por estado operativo
                </div>
                <div style={cardSub}>Situación actual dentro del filtro</div>
                <div style={{ width: "100%", height: 280 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={byState}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={95}
                        label
                      >
                        {byState.map((entry, index) => (
                          <Cell
                            key={entry.name}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<SmartTooltip mode="state" />} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ExplainBox title="Qué muestra">
                  Indica cuántas luminarias están actualmente en estado OK,
                  Pendiente, Apagado u Otro dentro de los filtros seleccionados.
                  Sirve para medir nivel de resolución y backlog operativo.
                </ExplainBox>
              </div>

              <div style={cardStyle()}>
                <div style={cardTitle}>Ramales con mayor carga de trabajo</div>
                <div style={cardSub}>Mayor cantidad de registros</div>
                <div style={{ width: "100%", height: 320 }}>
                  <ResponsiveContainer>
                    <BarChart
                      data={byRamal}
                      layout="vertical"
                      margin={{ left: 20 }}
                    >
                      <CartesianGrid stroke="rgba(71,85,105,.18)" />
                      <XAxis
                        type="number"
                        tick={{ fill: "#334155", fontSize: 11 }}
                        allowDecimals={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={110}
                        tick={{ fill: "#334155", fontSize: 11 }}
                      />
                      <Tooltip content={<SmartTooltip mode="ramal" />} />
                      <Bar
                        dataKey="value"
                        name="Intervenciones"
                        fill={BAR_GREEN}
                        radius={[0, 10, 10, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <ExplainBox title="Qué muestra">
                  Ordena los ramales según cantidad de registros. Ayuda a
                  detectar en qué corredores o sectores hubo mayor cantidad de
                  intervenciones.
                </ExplainBox>
              </div>

              <div style={cardStyle()}>
                <div style={cardTitle}>
                  Tableros con mayor cantidad de intervenciones
                </div>
                <div style={cardSub}>Más registros asociados</div>
                <div style={{ width: "100%", height: 320 }}>
                  <ResponsiveContainer>
                    <BarChart data={byTablero}>
                      <CartesianGrid stroke="rgba(71,85,105,.18)" />
                      <XAxis dataKey="name" hide />
                      <YAxis
                        tick={{ fill: "#334155", fontSize: 11 }}
                        allowDecimals={false}
                      />
                      <Tooltip content={<SmartTooltip mode="tablero" />} />
                      <Bar
                        dataKey="value"
                        name="Intervenciones"
                        fill={BAR_VIOLET}
                        radius={[10, 10, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <ExplainBox title="Qué muestra">
                  Señala los tableros con mayor actividad registrada. Es útil
                  para detectar focos de mantenimiento recurrente o tableros con
                  alta demanda operativa.
                </ExplainBox>
              </div>

              <div style={cardStyle()}>
                <div style={cardTitle}>
                  Circuitos con mayor cantidad de intervenciones
                </div>
                <div style={cardSub}>Concentración de trabajo por circuito</div>
                <div style={{ width: "100%", height: 320 }}>
                  <ResponsiveContainer>
                    <BarChart data={byCircuito}>
                      <CartesianGrid stroke="rgba(71,85,105,.18)" />
                      <XAxis dataKey="name" hide />
                      <YAxis
                        tick={{ fill: "#334155", fontSize: 11 }}
                        allowDecimals={false}
                      />
                      <Tooltip content={<SmartTooltip mode="circuito" />} />
                      <Bar
                        dataKey="value"
                        name="Intervenciones"
                        fill={BAR_CYAN}
                        radius={[10, 10, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <ExplainBox title="Qué muestra">
                  Permite identificar los circuitos con más intervenciones.
                  Sirve para ver concentración de tareas, posibles puntos
                  críticos o circuitos con fallas repetidas.
                </ExplainBox>
              </div>

              <div style={cardStyle()}>
                <div style={cardTitle}>
                  Zonas con mayor concentración de registros
                </div>
                <div style={cardSub}>Distribución territorial</div>
                <div style={{ width: "100%", height: 320 }}>
                  <ResponsiveContainer>
                    <BarChart data={byZona}>
                      <CartesianGrid stroke="rgba(71,85,105,.18)" />
                      <XAxis dataKey="name" hide />
                      <YAxis
                        tick={{ fill: "#334155", fontSize: 11 }}
                        allowDecimals={false}
                      />
                      <Tooltip content={<SmartTooltip mode="zona" />} />
                      <Bar
                        dataKey="value"
                        name="Intervenciones"
                        fill={BAR_ORANGE}
                        radius={[10, 10, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <ExplainBox title="Qué muestra">
                  Muestra qué zonas concentran mayor cantidad de registros. Es
                  útil para asignación de recursos, priorización y análisis
                  territorial.
                </ExplainBox>
              </div>

              <div style={cardStyle()}>
                <div style={cardTitle}>Puntos críticos por tramo de KM</div>
                <div style={cardSub}>Agrupación en bloques de 5 km</div>
                <div style={{ width: "100%", height: 320 }}>
                  <ResponsiveContainer>
                    <BarChart data={byKm}>
                      <CartesianGrid stroke="rgba(71,85,105,.18)" />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "#334155", fontSize: 11 }}
                      />
                      <YAxis
                        tick={{ fill: "#334155", fontSize: 11 }}
                        allowDecimals={false}
                      />
                      <Tooltip content={<SmartTooltip mode="km" />} />
                      <Bar
                        dataKey="value"
                        name="Intervenciones"
                        fill={BAR_RED}
                        radius={[10, 10, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <ExplainBox title="Qué muestra">
                  Agrupa los registros por tramos de 5 km para detectar sectores
                  con mayor recurrencia de trabajo o fallas. Es especialmente
                  útil para visualizar puntos críticos lineales.
                </ExplainBox>
              </div>

              <div style={cardStyle()}>
                <div style={cardTitle}>Pendientes y apagadas más recientes</div>
                <div style={cardSub}>Panel rápido de seguimiento operativo</div>
                <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                  {recentAlerts.length ? (
                    recentAlerts.map((r) => (
                      <div
                        key={`${r.id}-${r._codigo}`}
                        style={{
                          border: "1px solid rgba(71,85,105,.18)",
                          background: "rgba(255,255,255,.52)",
                          borderRadius: 14,
                          padding: 10,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                            alignItems: "center",
                          }}
                        >
                          <div style={{ fontWeight: 800, color: "#0f172a" }}>
                            {r._codigo || "—"}
                          </div>
                          <span
                            style={{
                              fontSize: 12,
                              padding: "4px 8px",
                              borderRadius: 999,
                              color: "#0f172a",
                              background:
                                r._state === "APAGADO"
                                  ? "rgba(239,68,68,.22)"
                                  : "rgba(245,158,11,.22)",
                              border:
                                r._state === "APAGADO"
                                  ? "1px solid rgba(220,38,38,.35)"
                                  : "1px solid rgba(245,158,11,.35)",
                            }}
                          >
                            {stateLabel(r._state)}
                          </span>
                        </div>
                        <div
                          style={{
                            color: "#475569",
                            marginTop: 4,
                            fontSize: 13,
                          }}
                        >
                          {r._fecha || "—"} · {r._ramalLabel || "—"} · KM{" "}
                          {r._km !== null ? r._km.toFixed(2) : "—"}
                        </div>
                        <div style={{ marginTop: 4, color: "#0f172a" }}>
                          {r._tablero || "—"}
                          {r._circuito ? ` · ${r._circuito}` : ""}
                        </div>
                        {r._ubicacion ? (
                          <div
                            style={{
                              color: "#64748b",
                              marginTop: 4,
                              fontSize: 13,
                            }}
                          >
                            {r._ubicacion}
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div style={{ color: "#475569" }}>Sin alertas.</div>
                  )}
                </div>
                <ExplainBox title="Qué muestra">
                  Lista las luminarias más recientes que quedaron en estado
                  Pendiente o Apagado. Sirve como panel rápido de seguimiento
                  operativo para priorizar recorridas o acciones correctivas.
                </ExplainBox>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid rgba(71,85,105,.20)",
  background: "rgba(255,255,255,.74)",
  color: "#0f172a",
  padding: "10px 12px",
  outline: "none",
};

const topBtnStyle = {
  border: "1px solid rgba(71,85,105,.20)",
  background: "rgba(255,255,255,.68)",
  color: "#0f172a",
  borderRadius: 12,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
};

const kpiLabel = {
  fontSize: 13,
  color: "#475569",
  fontWeight: 700,
};

const kpiValue = {
  fontSize: 30,
  fontWeight: 900,
  marginTop: 4,
  color: "#0f172a",
};

const kpiSub = {
  fontSize: 12,
  color: "#64748b",
  marginTop: 4,
};

const cardTitle = {
  fontSize: 16,
  fontWeight: 900,
  color: "#0f172a",
};

const cardSub = {
  fontSize: 13,
  color: "#64748b",
  marginTop: 4,
};

export default DashboardLuminarias;
