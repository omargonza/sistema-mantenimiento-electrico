// src/pages/Dashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/dashboard.css";

import { queryOts, migrateOtsOperationalFields } from "../storage/ot_db";

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}
function isoYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
function lastNDaysIso(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function formatMB(bytes) {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

function normalizeKey(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function tableroColor(estado) {
  switch (estado) {
    case "OK":
      return "hsl(120 70% 45%)";
    case "PARCIAL":
      return "hsl(35 85% 45%)";
    case "CRITICO":
      return "hsl(0 70% 45%)";
    default:
      return "hsl(215 15% 45%)"; // SIN ESTADO
  }
}

// ✅ Lee campos operativos desde detalle (nuevo) con fallback
function readOpFields(ot) {
  const det = ot?.detalle || {};
  const alcance = String(det?.alcance ?? ot?.alcance ?? "")
    .trim()
    .toUpperCase();
  const resultado = String(det?.resultado ?? ot?.resultado ?? "")
    .trim()
    .toUpperCase();
  const estado_tablero = String(det?.estado_tablero ?? ot?.estado_tablero ?? "")
    .trim()
    .toUpperCase();
  const luminaria_estado = String(
    det?.luminaria_estado ?? ot?.luminaria_estado ?? "",
  )
    .trim()
    .toUpperCase();

  return { alcance, resultado, estado_tablero, luminaria_estado };
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtro SOLO para el panel semáforo
  const [filtroEstado, setFiltroEstado] = useState("");
  // "" | "CRITICO" | "PARCIAL" | "OK" | "SIN_ESTADO"

  // Trae items desde IndexedDB (universo)
  const refresh = async () => {
    setLoading(true);
    try {
      const data = await queryOts({
        q: "",
        desde: "",
        hasta: "",
        favorito: null,
      });
      setItems(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // KPIs “globales” (universo)
  const insights = useMemo(() => {
    const total = items.length;
    const hoy = isoToday();
    const ayer = isoYesterday();
    const from7 = lastNDaysIso(7);

    let countHoy = 0;
    let countAyer = 0;
    let count7 = 0;
    let fav = 0;
    let enviados = 0;
    let bytes = 0;

    const byTablero = new Map();
    const byTecnico = new Map();
    const byZona = new Map();

    for (const ot of items) {
      const fecha = ot.fecha || "";
      if (fecha === hoy) countHoy++;
      if (fecha === ayer) countAyer++;
      if (fecha >= from7) count7++;

      if (ot.favorito) fav++;
      if (ot.enviado) enviados++;

      bytes += ot.pdfBytes || 0;

      const tableroKey = (ot.tablero || "Sin tablero").trim();
      byTablero.set(tableroKey, (byTablero.get(tableroKey) || 0) + 1);

      const tecKey = (ot.tecnico || "Sin técnico").trim();
      byTecnico.set(tecKey, (byTecnico.get(tecKey) || 0) + 1);

      const zonaKey = (ot.zona || "Sin zona").trim();
      byZona.set(zonaKey, (byZona.get(zonaKey) || 0) + 1);
    }

    const topTableros = [...byTablero.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const topTecnicos = [...byTecnico.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const topZonas = [...byZona.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const pctEnviados = total ? Math.round((enviados / total) * 100) : 0;
    const pctFav = total ? Math.round((fav / total) * 100) : 0;

    return {
      total,
      countHoy,
      countAyer,
      count7,
      fav,
      enviados,
      pctEnviados,
      pctFav,
      bytes,
      topTableros,
      topTecnicos,
      topZonas,
    };
  }, [items]);

  // ========= Panel tableros (semáforo manual + luminarias aparte) =========
  const tableroPanel = useMemo(() => {
    const map = new Map(); // tableroKey -> info

    for (const ot of items) {
      const k = normalizeKey(ot?.tablero);
      if (!k) continue;

      if (!map.has(k)) {
        map.set(k, {
          name: (ot.tablero || "").trim() || "Sin tablero",
          estado: null, // estado explícito manual (TABLERO/CIRCUITO)
          lumReparadas: 0,
          lumPendientes: 0,
        });
      }

      const info = map.get(k);

      const { alcance, resultado, estado_tablero, luminaria_estado } =
        readOpFields(ot);

      // Semáforo: solo TABLERO/CIRCUITO con estado explícito
      if ((alcance === "TABLERO" || alcance === "CIRCUITO") && estado_tablero) {
        info.estado = estado_tablero; // último manda
      }

      // Luminarias aparte (no afectan semáforo)
      if (alcance === "LUMINARIA") {
        const ok =
          luminaria_estado === "REPARADO" ||
          luminaria_estado === "ENCENDIDO" ||
          resultado === "COMPLETO";
        if (ok) info.lumReparadas += 1;
        else info.lumPendientes += 1;
      }
    }

    let arr = [...map.values()].map((x) => {
      const estadoFinal = x.estado; // null => SIN ESTADO
      return { ...x, estadoFinal, color: tableroColor(estadoFinal) };
    });

    // ✅ aplicar filtro de estado (solo panel)
    if (filtroEstado) {
      arr = arr.filter((t) => {
        if (filtroEstado === "SIN_ESTADO") return !t.estadoFinal;
        return t.estadoFinal === filtroEstado;
      });
    }

    // Orden: sin estado primero, luego crítico, luego parcial, luego ok
    const rank = (e) =>
      e === "OK" ? 3 : e === "PARCIAL" ? 2 : e === "CRITICO" ? 1 : 0;

    arr.sort(
      (a, b) =>
        rank(a.estadoFinal) - rank(b.estadoFinal) ||
        a.name.localeCompare(b.name),
    );

    return arr;
  }, [items, filtroEstado]);

  // (Opcional) Migración: dejada lista por si la necesitás
  const runMigration = async () => {
    try {
      const res = await migrateOtsOperationalFields();
      console.log("Migración OK:", res);
      alert(
        `Migración OK\nEscaneadas: ${res.scanned}\nActualizadas: ${res.updated}`,
      );
      refresh();
    } catch (e) {
      console.error(e);
      alert("Error en migración. Mirá la consola.");
    }
  };

  return (
    <div className="page">
      <h2 className="titulo">Centro de Control</h2>

      {/* Accesos rápidos */}
      <div className="card" style={{ marginTop: 10 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 10,
          }}
        >
          <button
            type="button"
            className="btn-outline"
            onClick={() => navigate("/nueva")}
          >
            ➕ Nueva OT
          </button>

          <button
            type="button"
            className="btn-outline"
            onClick={() => navigate("/mis-pdfs")}
          >
            📜 Ver OTs
          </button>

          <button
            type="button"
            className="btn-outline"
            onClick={() => navigate("/historial-luminarias")}
          >
            💡 Luminarias
          </button>
        </div>

        <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
          Dashboard = KPIs + semáforo + accesos. Los listados completos viven en
          Historial.
        </div>
      </div>

      {/* KPIs */}
      <div className="kpis" style={{ marginTop: 12 }}>
        <div className="kpi">
          <div className="kpi-label">Total OTs</div>
          <div className="kpi-value">{insights.total}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Hoy</div>
          <div className="kpi-value">{insights.countHoy}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Ayer</div>
          <div className="kpi-value">{insights.countAyer}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Últimos 7 días</div>
          <div className="kpi-value">{insights.count7}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Enviados</div>
          <div className="kpi-value">
            {insights.enviados}{" "}
            <span className="kpi-sub">({insights.pctEnviados}%)</span>
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Favoritos</div>
          <div className="kpi-value">
            {insights.fav} <span className="kpi-sub">({insights.pctFav}%)</span>
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Espacio aprox</div>
          <div className="kpi-value">{formatMB(insights.bytes)}</div>
        </div>
      </div>

      {/* Top stats (resumen, no listado largo) */}
      <div className="stats-grid">
        {insights.topZonas.length > 0 && (
          <div className="statbox">
            <div className="stat-title">Top zonas</div>
            {insights.topZonas.map(([name, n]) => (
              <div className="stat-row" key={name}>
                <span className="stat-name">{name}</span>
                <span className="stat-val">{n}</span>
              </div>
            ))}
          </div>
        )}

        {insights.topTableros.length > 0 && (
          <div className="statbox">
            <div className="stat-title">Top tableros</div>
            {insights.topTableros.map(([name, n]) => (
              <div className="stat-row" key={name}>
                <span className="stat-name">{name}</span>
                <span className="stat-val">{n}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Controles del Panel */}
      <div className="card" style={{ marginTop: 12 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            alignItems: "center",
          }}
        >
          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
              Filtro semáforo
            </div>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="CRITICO">Crítico</option>
              <option value="PARCIAL">Parcial</option>
              <option value="OK">OK</option>
              <option value="SIN_ESTADO">Sin estado</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" className="btn-outline" onClick={refresh}>
              🔄 Actualizar
            </button>

            {/* Opcional: dejalo si lo usás */}
            <button
              type="button"
              className="btn-outline"
              onClick={runMigration}
              title="Actualiza campos operativos en OTs viejas (si hace falta)"
            >
              🧩 Migrar
            </button>
          </div>
        </div>

        {loading && (
          <div className="muted" style={{ marginTop: 10 }}>
            Cargando…
          </div>
        )}
      </div>

      {/* Panel semáforo */}
      <div className="panel-tableros">
        <div className="panel-title">
          Estado de tableros
          <span className="panel-sub">
            Semáforo (TABLERO/CIRCUITO) + luminarias aparte
          </span>
        </div>

        <div className="panel-grid">
          {tableroPanel.map((t) => (
            <button
              key={t.name}
              type="button"
              className="tablero-card"
              onClick={() =>
                navigate(`/historial?tablero=${encodeURIComponent(t.name)}`)
              }
              style={{ borderColor: t.color, color: t.color }}
            >
              <div className="tablero-head">
                <span className="dot" style={{ background: t.color }} />
                <span className="nm">{t.name}</span>
                <span
                  className={`badge ${
                    t.estadoFinal ? t.estadoFinal.toLowerCase() : "none"
                  }`}
                >
                  {t.estadoFinal || "SIN ESTADO"}
                </span>
              </div>

              <div className="tablero-foot">
                <span className="mini">Luminarias OK: {t.lumReparadas}</span>
                <span className="mini">Pend: {t.lumPendientes}</span>
              </div>
            </button>
          ))}
        </div>

        {!loading && tableroPanel.length === 0 && (
          <div className="muted" style={{ marginTop: 10 }}>
            No hay tableros para mostrar (¿todavía no cargaste OTs con
            tablero?).
          </div>
        )}
      </div>
    </div>
  );
}
