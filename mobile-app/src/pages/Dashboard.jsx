// src/pages/Dashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Bolt,
  CalendarDays,
  CheckCircle2,
  FileText,
  HardDrive,
  LayoutGrid,
  Lightbulb,
  ListFilter,
  RefreshCw,
  ShieldAlert,
  Star,
} from "lucide-react";
import "../styles/dashboard.css";

import { queryOts, migrateOtsOperationalFields } from "../storage/ot_db";
import AdminAuditButton from "../components/AdminAuditButton";

/**
 * Feature flags
 */
const SHOW_SEMAFORO_TABLEROS = true;
const SHOW_SEMAFORO_CONTROLS = true;
const SHOW_MIGRATION_BUTTON = true;

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
      return "var(--ok)";
    case "PARCIAL":
      return "var(--warning)";
    case "CRITICO":
      return "var(--danger)";
    default:
      return "rgba(156, 163, 175, 0.95)";
  }
}

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

function KpiCard({ icon: Icon, label, value, sub, tone = "neutral" }) {
  return (
    <div className={`kpi-card kpi-card--${tone}`}>
      <div className="kpi-card__top">
        <div className="kpi-card__icon">
          <Icon size={18} strokeWidth={2.2} />
        </div>
        <div className="kpi-card__label">{label}</div>
      </div>

      <div className="kpi-card__value">
        {value}
        {sub ? <span className="kpi-card__sub">{sub}</span> : null}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("");

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

  const tableroPanel = useMemo(() => {
    if (!SHOW_SEMAFORO_TABLEROS) return [];

    const map = new Map();

    for (const ot of items) {
      const k = normalizeKey(ot?.tablero);
      if (!k) continue;

      if (!map.has(k)) {
        map.set(k, {
          name: (ot.tablero || "").trim() || "Sin tablero",
          estado: null,
          lumReparadas: 0,
          lumPendientes: 0,
        });
      }

      const info = map.get(k);

      const { alcance, resultado, estado_tablero, luminaria_estado } =
        readOpFields(ot);

      if ((alcance === "TABLERO" || alcance === "CIRCUITO") && estado_tablero) {
        info.estado = estado_tablero;
      }

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
      const estadoFinal = x.estado;
      return { ...x, estadoFinal, color: tableroColor(estadoFinal) };
    });

    if (filtroEstado) {
      arr = arr.filter((t) => {
        if (filtroEstado === "SIN_ESTADO") return !t.estadoFinal;
        return t.estadoFinal === filtroEstado;
      });
    }

    const rank = (e) =>
      e === "OK" ? 3 : e === "PARCIAL" ? 2 : e === "CRITICO" ? 1 : 0;

    arr.sort(
      (a, b) =>
        rank(a.estadoFinal) - rank(b.estadoFinal) ||
        a.name.localeCompare(b.name),
    );

    return arr;
  }, [items, filtroEstado]);

  const runMigration = async () => {
    try {
      const res = await migrateOtsOperationalFields();
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
    <div className="page dashboard-page">
      <div className="dashboard-hero card">
        <div className="dashboard-hero__badge">
          <span className="dashboard-hero__badge-dot" />
          Centro de control operativo
        </div>

        <div className="dashboard-hero__head">
          <div>
            <h2 className="titulo dashboard-hero__title">Centro de Control</h2>
            <p className="dashboard-hero__text">
              Panel general de órdenes de trabajo, actividad reciente, estado de
              tableros y accesos operativos del sistema.
            </p>
          </div>

          <div className="dashboard-hero__status">
            <div className="dashboard-status-chip">
              <Activity size={16} strokeWidth={2.2} />
              <span>{loading ? "Sincronizando" : "Sistema operativo"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card dashboard-actions-card">
        <div className="dashboard-section-head">
          <div>
            <div className="subtitulo" style={{ marginTop: 0 }}>
              Accesos rápidos
            </div>
            <p className="dashboard-section-copy">
              Operaciones frecuentes para técnicos y supervisión.
            </p>
          </div>
        </div>

        <div className="dashboard-actions-grid">
          <button
            type="button"
            className="dashboard-action-btn"
            onClick={() => navigate("/nueva")}
          >
            <span className="dashboard-action-btn__icon">
              <Bolt size={18} strokeWidth={2.2} />
            </span>
            <span className="dashboard-action-btn__text">
              <strong>Nueva OT</strong>
              <small>Registrar intervención</small>
            </span>
          </button>

          <button
            type="button"
            className="dashboard-action-btn"
            onClick={() => navigate("/mis-pdfs")}
          >
            <span className="dashboard-action-btn__icon">
              <FileText size={18} strokeWidth={2.2} />
            </span>
            <span className="dashboard-action-btn__text">
              <strong>Ver OTs</strong>
              <small>PDFs y documentos</small>
            </span>
          </button>

          <button
            type="button"
            className="dashboard-action-btn"
            onClick={() => navigate("/historial-luminarias")}
          >
            <span className="dashboard-action-btn__icon">
              <Lightbulb size={18} strokeWidth={2.2} />
            </span>
            <span className="dashboard-action-btn__text">
              <strong>Luminarias</strong>
              <small>Historial específico</small>
            </span>
          </button>
        </div>

        <div className="dashboard-actions-foot">
          <button type="button" className="btn-outline" onClick={refresh}>
            <RefreshCw size={16} strokeWidth={2.2} />
            <span>Actualizar</span>
          </button>

          {loading ? (
            <div className="dashboard-loading-note">Cargando información…</div>
          ) : (
            <div className="dashboard-loading-note">
              Dashboard = KPIs + accesos. Los listados completos viven en
              Historial.
            </div>
          )}
        </div>
      </div>

      <div className="dashboard-kpis-grid">
        <KpiCard
          icon={LayoutGrid}
          label="Total OTs"
          value={insights.total}
          tone="neutral"
        />
        <KpiCard
          icon={CalendarDays}
          label="Hoy"
          value={insights.countHoy}
          tone="ok"
        />
        <KpiCard
          icon={CalendarDays}
          label="Ayer"
          value={insights.countAyer}
          tone="neutral"
        />
        <KpiCard
          icon={Activity}
          label="Últimos 7 días"
          value={insights.count7}
          tone="neutral"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Enviados"
          value={insights.enviados}
          sub={`(${insights.pctEnviados}%)`}
          tone="ok"
        />
        <KpiCard
          icon={Star}
          label="Favoritos"
          value={insights.fav}
          sub={`(${insights.pctFav}%)`}
          tone="warn"
        />
        <KpiCard
          icon={HardDrive}
          label="Espacio aprox"
          value={formatMB(insights.bytes)}
          tone="neutral"
        />
      </div>

      <div className="dashboard-stats-grid">
        {insights.topZonas.length > 0 && (
          <div className="card statbox statbox--panel">
            <div className="statbox__head">
              <div className="statbox__title">Top zonas</div>
            </div>

            <div className="statbox__list">
              {insights.topZonas.map(([name, n]) => (
                <div className="stat-row" key={name}>
                  <span className="stat-name">{name}</span>
                  <span className="stat-val">{n}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {insights.topTableros.length > 0 && (
          <div className="card statbox statbox--panel">
            <div className="statbox__head">
              <div className="statbox__title">Top tableros</div>
            </div>

            <div className="statbox__list">
              {insights.topTableros.map(([name, n]) => (
                <div className="stat-row" key={name}>
                  <span className="stat-name">{name}</span>
                  <span className="stat-val">{n}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {insights.topTecnicos.length > 0 && (
          <div className="card statbox statbox--panel">
            <div className="statbox__head">
              <div className="statbox__title">Top técnicos</div>
            </div>

            <div className="statbox__list">
              {insights.topTecnicos.map(([name, n]) => (
                <div className="stat-row" key={name}>
                  <span className="stat-name">{name}</span>
                  <span className="stat-val">{n}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {SHOW_SEMAFORO_CONTROLS && (
        <div className="card dashboard-filter-card">
          <div className="dashboard-section-head">
            <div>
              <div className="subtitulo" style={{ marginTop: 0 }}>
                Panel semáforo
              </div>
              <p className="dashboard-section-copy">
                Filtrado visual del estado de tableros y circuitos.
              </p>
            </div>
          </div>

          <div className="dashboard-filter-grid">
            <div className="dashboard-filter-field">
              <label htmlFor="filtroEstado" className="dashboard-inline-label">
                <ListFilter size={14} strokeWidth={2.2} />
                <span>Filtro semáforo</span>
              </label>

              <select
                id="filtroEstado"
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

            <div className="dashboard-filter-actions">
              <button type="button" className="btn-outline" onClick={refresh}>
                <RefreshCw size={16} strokeWidth={2.2} />
                <span>Actualizar</span>
              </button>

              {SHOW_MIGRATION_BUTTON && (
                <button
                  type="button"
                  className="btn-outline"
                  onClick={runMigration}
                  title="Actualiza campos operativos en OTs viejas"
                >
                  <ShieldAlert size={16} strokeWidth={2.2} />
                  <span>Migrar</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {SHOW_SEMAFORO_TABLEROS && (
        <div className="panel-tableros card">
          <div className="dashboard-section-head dashboard-section-head--tight">
            <div>
              <div className="subtitulo" style={{ marginTop: 0 }}>
                Estado de tableros
              </div>
              <p className="dashboard-section-copy">
                Semáforo de TABLERO / CIRCUITO con luminarias informadas por
                separado.
              </p>
            </div>
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
                style={{
                  "--tablero-color": t.color,
                }}
              >
                <div className="tablero-head">
                  <div className="tablero-head__left">
                    <span className="dot" />
                    <span className="nm">{t.name}</span>
                  </div>

                  <span
                    className={`badge ${
                      t.estadoFinal ? t.estadoFinal.toLowerCase() : "none"
                    }`}
                  >
                    {t.estadoFinal || "SIN ESTADO"}
                  </span>
                </div>

                <div className="tablero-foot">
                  <span className="mini">
                    Luminarias OK: <strong>{t.lumReparadas}</strong>
                  </span>
                  <span className="mini">
                    Pend: <strong>{t.lumPendientes}</strong>
                  </span>
                </div>
              </button>
            ))}
          </div>

          {!loading && tableroPanel.length === 0 && (
            <div className="dashboard-empty-state">
              No hay tableros para mostrar todavía.
            </div>
          )}
        </div>
      )}

      <div className="dashboard-admin-row">
        <AdminAuditButton />
      </div>
    </div>
  );
}
