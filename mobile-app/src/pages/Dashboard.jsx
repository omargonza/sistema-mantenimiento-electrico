// src/pages/Dashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/dashboard.css";
import {
  queryOts,
  getPdfBlob,
  setFlags,
  deleteOt,
  migrateOtsOperationalFields,
} from "../storage/ot_db";

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

function downloadBlob(blob, filename = "OT.pdf") {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

async function sharePdfBlob({ blob, filename, title, text }) {
  const file = new File([blob], filename, { type: "application/pdf" });

  if (
    navigator.share &&
    (!navigator.canShare || navigator.canShare({ files: [file] }))
  ) {
    await navigator.share({ title, text, files: [file] });
    return true;
  }

  downloadBlob(blob, filename);
  return false;
}

// Resaltado seguro (sin dangerouslySetInnerHTML)
function highlightText(text, query) {
  const s = String(text || "");
  const q = String(query || "").trim();
  if (!q) return s;

  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped, "ig");

  const parts = s.split(re);
  const matches = s.match(re);
  if (!matches) return s;

  const out = [];
  for (let i = 0; i < parts.length; i++) {
    out.push(parts[i]);
    if (matches[i])
      out.push(
        <mark key={`${i}-${matches[i]}`} className="hl">
          {matches[i]}
        </mark>
      );
  }
  return out;
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
    det?.luminaria_estado ?? ot?.luminaria_estado ?? ""
  )
    .trim()
    .toUpperCase();

  return { alcance, resultado, estado_tablero, luminaria_estado };
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [q, setQ] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [soloFavoritos, setSoloFavoritos] = useState(false);
  const [filtroZona, setFiltroZona] = useState("");

  const [filtroEstado, setFiltroEstado] = useState("");
  // "" | "CRITICO" | "PARCIAL" | "OK" | "SIN_ESTADO"

  const [compacto, setCompacto] = useState(() => {
    try {
      return localStorage.getItem("dashboard_compacto") === "1";
    } catch {
      return false;
    }
  });

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      localStorage.setItem("dashboard_compacto", compacto ? "1" : "0");
    } catch {}
  }, [compacto]);

  // Trae items desde IndexedDB (queryOts)
  const refresh = async () => {
    setLoading(true);
    try {
      const data = await queryOts({
        q,
        desde,
        hasta,
        favorito: soloFavoritos ? true : null,
      });
      setItems(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };
  const runMigration = async () => {
    try {
      const res = await migrateOtsOperationalFields();
      console.log("Migración OK:", res);
      alert(
        `Migración OK\nEscaneadas: ${res.scanned}\nActualizadas: ${res.updated}`
      );
      refresh();
    } catch (e) {
      console.error(e);
      alert("Error en migración. Mirá la consola.");
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, desde, hasta, soloFavoritos]);

  // Zonas disponibles (derivadas de items actuales)
  const zonas = useMemo(() => {
    const set = new Set();
    for (const ot of items) {
      const z = String(ot?.zona || "").trim();
      if (z) set.add(z);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [items]);

  // Filtro base por zona (rápido y seguro)
  const itemsFiltrados = useMemo(() => {
    if (!filtroZona) return items;
    const target = filtroZona.trim().toLowerCase();
    return items.filter(
      (ot) =>
        String(ot?.zona || "")
          .trim()
          .toLowerCase() === target
    );
  }, [items, filtroZona]);

  // Insights / KPIs / Stats (sobre itemsFiltrados)
  const insights = useMemo(() => {
    const total = itemsFiltrados.length;
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

    for (const ot of itemsFiltrados) {
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
      hoy,
      ayer,
      from7,
    };
  }, [itemsFiltrados]);

  // Timeline (sobre itemsFiltrados)
  const timeline = useMemo(() => {
    const hoy = insights.hoy;
    const ayer = insights.ayer;
    const from7 = insights.from7;

    const sections = [
      { key: "hoy", title: "HOY", items: [] },
      { key: "ayer", title: "AYER", items: [] },
      { key: "semana", title: "ESTA SEMANA", items: [] },
      { key: "anteriores", title: "ANTERIORES", items: [] },
    ];

    for (const ot of itemsFiltrados) {
      const fecha = ot.fecha || "";
      if (fecha === hoy) sections[0].items.push(ot);
      else if (fecha === ayer) sections[1].items.push(ot);
      else if (fecha >= from7) sections[2].items.push(ot);
      else sections[3].items.push(ot);
    }

    return sections.filter((s) => s.items.length > 0);
  }, [itemsFiltrados, insights.hoy, insights.ayer, insights.from7]);

  const openPdf = async (ot) => {
    const blob = await getPdfBlob(ot.pdfId || ot.id);
    if (!blob) return;

    try {
      await setFlags(ot.id, { reimpreso: (ot.reimpreso || 0) + 1 });
      refresh();
    } catch {}

    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const sharePdf = async (ot) => {
    const blob = await getPdfBlob(ot.pdfId || ot.id);
    if (!blob) return;

    const filename = `${ot.fecha || "OT"} - ${ot.tablero || "Tablero"}.pdf`;
    const title = "Orden de Trabajo";
    const text = `${ot.fecha || ""} — ${ot.tablero || ""}\n${
      ot.ubicacion || ""
    }`.trim();

    try {
      await sharePdfBlob({ blob, filename, title, text });
      await setFlags(ot.id, { enviado: true });
      refresh();
    } catch (err) {
      console.warn("Share cancelado o no disponible:", err);
    }
  };

  const toggleFav = async (ot) => {
    await setFlags(ot.id, { favorito: !ot.favorito });
    refresh();
  };

  const remove = async (ot) => {
    if (!confirm("¿Eliminar este PDF del respaldo local?")) return;
    await deleteOt(ot.id);
    refresh();
  };

  // ========= Panel tableros (semáforo manual + luminarias aparte) =========
  // ✅ Se calcula sobre "items" (universo) para no apagarse con filtroZona
  const tableroPanel = useMemo(() => {
    const map = new Map(); // tableroKey -> info

    for (const ot of items) {
      const k = normalizeKey(ot?.tablero);
      if (!k) continue;

      if (!map.has(k)) {
        map.set(k, {
          name: (ot.tablero || "").trim() || "Sin tablero",
          // estado explícito manual
          estado: null,
          // luminarias
          lumReparadas: 0,
          lumPendientes: 0,
        });
      }

      const info = map.get(k);

      const { alcance, resultado, estado_tablero, luminaria_estado } =
        readOpFields(ot);

      const estadoExp = estado_tablero;
      const lumEstado = luminaria_estado;

      // Semáforo: solo TABLERO/CIRCUITO con estado explícito
      if ((alcance === "TABLERO" || alcance === "CIRCUITO") && estadoExp) {
        info.estado = estadoExp; // último manda
      }

      // Luminarias aparte (no afectan semáforo)
      if (alcance === "LUMINARIA") {
        const ok =
          lumEstado === "REPARADO" ||
          lumEstado === "ENCENDIDO" ||
          resultado === "COMPLETO";
        if (ok) info.lumReparadas += 1;
        else info.lumPendientes += 1;
      }
    }

    let arr = [...map.values()].map((x) => {
      const estadoFinal = x.estado; // null => SIN ESTADO
      return {
        ...x,
        estadoFinal,
        color: tableroColor(estadoFinal),
      };
    });

    // ✅ aplicar filtro de estado (solo panel)
    if (filtroEstado) {
      arr = arr.filter((t) => {
        if (filtroEstado === "SIN_ESTADO") return !t.estadoFinal;
        return t.estadoFinal === filtroEstado;
      });
    }

    // Orden: primero sin estado / crítico, después parcial, después ok
    const rank = (e) =>
      e === "OK" ? 3 : e === "PARCIAL" ? 2 : e === "CRITICO" ? 1 : 0;
    arr.sort(
      (a, b) =>
        rank(a.estadoFinal) - rank(b.estadoFinal) ||
        a.name.localeCompare(b.name)
    );

    return arr;
  }, [items, filtroEstado]);

  return (
    <div className={`page ${compacto ? "is-compact" : ""}`}>
      <h2 className="titulo">Mis PDFs</h2>
      {/*
<button
  type="button"
  className="btn-mini"
  style={{ marginBottom: 12 }}
  onClick={async () => {
    if (
      !confirm(
        "Esto va a actualizar OTs viejas para el semáforo.\n\n¿Continuar?"
      )
    )
      return;

    try {
      const res = await migrateOtsOperationalFields();
      console.log("Migración OK:", res);
      alert(
        `Migración completada\n\nEscaneadas: ${res.scanned}\nActualizadas: ${res.updated}`
      );
      refresh();
    } catch (e) {
      console.error(e);
      alert("Error en la migración. Mirá la consola.");
    }
  }}
>
  Migrar OTs viejas (semáforo)
</button>
*/}

      {/* KPIs */}
      <div className="kpis">
        <div className="kpi">
          <div className="kpi-label">Total</div>
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

      {/* Filtros */}
      <div className="filtros-box">
        <div style={{ flex: 1 }}>
          <label>Búsqueda</label>
          <input
            type="text"
            placeholder="tablero / ubicación / zona / vehículo…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div>
          <label>Zona</label>
          <select
            value={filtroZona}
            onChange={(e) => setFiltroZona(e.target.value)}
          >
            <option value="">Todas</option>
            {zonas.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Estado</label>
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

        <div className="toggles">
          <label className="toggle">
            <span>⭐ Favoritos</span>
            <input
              type="checkbox"
              checked={soloFavoritos}
              onChange={(e) => setSoloFavoritos(e.target.checked)}
            />
          </label>

          <label className="toggle">
            <span>Compacto</span>
            <input
              type="checkbox"
              checked={compacto}
              onChange={(e) => setCompacto(e.target.checked)}
            />
          </label>
        </div>
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
              onClick={() => {
                // ✅ evita quedar en 0 por filtros previos
                setSoloFavoritos(false);
                setFiltroZona("");
                setFiltroEstado("");

                setQ(t.name);

                // ✅ no forzar 7 días: solo pone 30 días si no había rango
                if (!desde && !hasta) setDesde(lastNDaysIso(30));
                setHasta("");
              }}
              title={`${t.name} — Estado: ${
                t.estadoFinal || "SIN ESTADO"
              } · Luminarias ok:${t.lumReparadas} pend:${t.lumPendientes}`}
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
      </div>

      {/* Timeline */}
      <div className="tabla-ot">
        {loading && <p className="sin-datos">Cargando…</p>}

        {!loading &&
          timeline.map((section) => (
            <div key={section.key} className="section">
              <div className="section-title">{section.title}</div>

              <div className="section-list">
                {section.items.map((ot) => (
                  <div
                    key={ot.id}
                    className={`fila-ot ${ot.enviado ? "is-sent" : ""} ${
                      ot.favorito ? "is-fav" : ""
                    }`}
                  >
                    <div
                      className="ot-linea"
                      onClick={() => navigate(`/detalle/${ot.id}`)}
                    >
                      <div className="ot-tablero">
                        {highlightText(ot.tablero, q)}
                      </div>

                      <div className="ot-meta">
                        <span className="ot-fecha">{ot.fecha}</span>
                        {ot.zona ? (
                          <span className="zbadge">
                            {highlightText(ot.zona, q)}
                          </span>
                        ) : null}
                        {ot.favorito && <span className="chip">⭐</span>}
                        {ot.enviado && <span className="chip ok">ENVIADO</span>}
                      </div>
                    </div>

                    <div className="ot-sub">
                      {highlightText(ot.ubicacion, q)}
                    </div>

                    <div className="ot-info">
                      <span className="pill">
                        {highlightText(ot.tecnico || "-", q)}
                      </span>
                      <span className="pill">
                        {highlightText(ot.vehiculo || "-", q)}
                      </span>
                    </div>

                    <div className="ot-actions">
                      <button
                        type="button"
                        className="btn-mini"
                        onClick={() => openPdf(ot)}
                      >
                        Abrir PDF
                      </button>
                      <button
                        type="button"
                        className="btn-mini primary"
                        onClick={() => sharePdf(ot)}
                      >
                        Compartir
                      </button>
                      <button
                        type="button"
                        className="btn-mini"
                        onClick={() => toggleFav(ot)}
                      >
                        {ot.favorito ? "Quitar ⭐" : "Favorito ⭐"}
                      </button>
                      <button
                        type="button"
                        className="btn-mini danger"
                        onClick={() => remove(ot)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

        {!loading && itemsFiltrados.length === 0 && (
          <p className="sin-datos">
            No hay resultados con esos filtros. Probá limpiar Zona, fechas o
            búsqueda.
          </p>
        )}
      </div>
    </div>
  );
}
