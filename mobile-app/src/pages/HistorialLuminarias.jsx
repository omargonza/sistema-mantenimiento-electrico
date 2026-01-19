// src/pages/HistorialLuminarias.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { API } from "../api";
import "../styles/app.css";

import Autopista3D from "../components/autopista3d/Autopista3D";
import {
  clamp,
  tone,
  toneColor,
  pickRenderMode,
} from "../components/autopista3d/utils3d";

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
   Track 2D (autopista)
======================================================= */
function AutopistaTrack({ ramal, rows, onPinClick }) {
  const range = RAMAL_RANGES[ramal];
  const kmMin = range.min;
  const kmMax = range.max;
  const span = Math.max(0.01, kmMax - kmMin);

  const pins = useMemo(() => {
    const base = rows
      .filter((r) => Number.isFinite(Number(r.km)))
      .map((r) => {
        const km = Number(r.km);
        const xPct = ((km - kmMin) / span) * 100;
        const label = String(r.codigo || "").trim() || "Luminaria";
        return {
          ...r,
          km,
          xPct: clamp(xPct, 0, 100),
          t: tone(r),
          label,
        };
      })
      .filter((p) => p.km >= kmMin && p.km <= kmMax)
      .sort((a, b) => a.xPct - b.xPct || a.km - b.km);

    const BUCKET = 1.6;
    const DX = 1.0;
    const buckets = new Map();

    return base.map((p) => {
      const k = Math.round(p.xPct / BUCKET);
      const n = buckets.get(k) || 0;
      buckets.set(k, n + 1);

      const lane = n % 4;
      const sign = n % 2 === 0 ? 1 : -1;
      const dx = n === 0 ? 0 : sign * Math.ceil(n / 2) * DX;

      return {
        ...p,
        xAdj: clamp(p.xPct + dx, 0, 100),
        lane,
      };
    });
  }, [rows, kmMin, kmMax, span]);

  const ticks = useMemo(() => {
    const n = 7;
    return Array.from({ length: n }).map((_, i) => {
      const x = (i / (n - 1)) * 100;
      const km = kmMin + (span * i) / (n - 1);
      return { x, km: km.toFixed(0) };
    });
  }, [kmMin, span]);

  const laneTop = (lane) => {
    switch (lane) {
      case 0:
        return 22;
      case 1:
        return 34;
      case 2:
        return 66;
      case 3:
        return 78;
      default:
        return 50;
    }
  };

  const isTop = (lane) => lane === 0 || lane === 1;

  return (
    <div className="card" style={{ padding: 14, marginBottom: 16 }}>
      <div
        style={{ display: "flex", justifyContent: "space-between", gap: 10 }}
      >
        <div style={{ fontWeight: 900, letterSpacing: 0.2 }}>{range.label}</div>
        <div className="muted" style={{ fontSize: 12 }}>
          KM {kmMin} — {kmMax} · {pins.length} registros · 2D
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        {/* carteles KM (2D) */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 8,
            flexWrap: "wrap",
          }}
        >
          {ticks.map((t, i) => (
            <div
              key={i}
              style={{
                position: "relative",
                padding: "7px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,.14)",
                background:
                  "linear-gradient(180deg, rgba(16,185,129,.18), rgba(2,6,23,.35))",
                boxShadow: "0 12px 26px rgba(0,0,0,.25)",
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: 0.2,
              }}
            >
              KM <span style={{ marginLeft: 6 }}>{t.km}</span>
            </div>
          ))}
        </div>

        {/* autopista */}
        <div
          style={{
            position: "relative",
            height: 170,
            borderRadius: 18,
            border: "1px solid rgba(148,163,184,.22)",
            overflow: "hidden",
            boxShadow: "0 16px 34px rgba(0,0,0,.35)",
            background:
              "radial-gradient(1200px 220px at 50% 20%, rgba(59,130,246,.10), rgba(0,0,0,0))",
          }}
        >
          {/* “asfalto” */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(2,6,23,.55), rgba(2,6,23,.35)), repeating-linear-gradient(90deg, rgba(255,255,255,.02) 0px, rgba(255,255,255,.02) 2px, rgba(0,0,0,0) 6px, rgba(0,0,0,0) 14px)",
            }}
          />

          {/* calzada arriba */}
          <div
            style={{
              position: "absolute",
              left: 10,
              right: 10,
              top: 44,
              height: 44,
              borderRadius: 14,
              background:
                "linear-gradient(180deg, rgba(8,12,20,.92), rgba(2,6,23,.92))",
              border: "1px solid rgba(255,255,255,.06)",
              boxShadow: "inset 0 10px 20px rgba(0,0,0,.35)",
            }}
          />
          {/* calzada abajo */}
          <div
            style={{
              position: "absolute",
              left: 10,
              right: 10,
              bottom: 44,
              height: 44,
              borderRadius: 14,
              background:
                "linear-gradient(180deg, rgba(8,12,20,.92), rgba(2,6,23,.92))",
              border: "1px solid rgba(255,255,255,.06)",
              boxShadow: "inset 0 10px 20px rgba(0,0,0,.35)",
            }}
          />

          {/* separador amarillo */}
          <div
            style={{
              position: "absolute",
              left: 14,
              right: 14,
              top: "50%",
              height: 3,
              transform: "translateY(-50%)",
              background:
                "linear-gradient(90deg, rgba(245,158,11,.0), rgba(245,158,11,.95), rgba(245,158,11,.0))",
              opacity: 0.9,
            }}
          />

          {/* líneas discontinuas arriba */}
          {Array.from({ length: 22 }).map((_, i) => (
            <div
              key={`a-${i}`}
              style={{
                position: "absolute",
                left: `${(i / 22) * 100}%`,
                top: 64,
                width: 20,
                height: 2,
                borderRadius: 2,
                background: "rgba(241,245,249,.30)",
                opacity: 0.65,
              }}
            />
          ))}
          {/* líneas discontinuas abajo */}
          {Array.from({ length: 22 }).map((_, i) => (
            <div
              key={`b-${i}`}
              style={{
                position: "absolute",
                left: `${(i / 22) * 100}%`,
                bottom: 64,
                width: 20,
                height: 2,
                borderRadius: 2,
                background: "rgba(241,245,249,.30)",
                opacity: 0.65,
              }}
            />
          ))}

          {/* ticks verticales */}
          {ticks.map((t, i) => (
            <div
              key={`tick-${i}`}
              style={{
                position: "absolute",
                left: `${t.x}%`,
                top: 0,
                bottom: 0,
                width: 1,
                background: "rgba(226,232,240,.10)",
              }}
            />
          ))}

          {/* pins */}
          {pins.map((p) => {
            const topSide = isTop(p.lane);
            return (
              <button
                key={`${p.id}-${p.label}-${p.km}`}
                type="button"
                onClick={() => onPinClick(p)}
                title={`${p.label} · KM ${p.km.toFixed(2)} · ${p.fecha} · ${
                  p.luminaria_estado || p.resultado || ""
                }`}
                style={{
                  position: "absolute",
                  left: `${p.xAdj}%`,
                  top: `${laneTop(p.lane)}%`,
                  transform: "translate(-50%, -50%)",
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                }}
              >
                {/* pin */}
                <span
                  style={{
                    position: "relative",
                    display: "inline-block",
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    background: toneColor(p.t),
                    boxShadow: "0 10px 22px rgba(0,0,0,.35)",
                    outline: "2px solid rgba(2,6,23,.55)",
                  }}
                />
                {/* “poste” */}
                <span
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: topSide ? "100%" : "auto",
                    bottom: topSide ? "auto" : "100%",
                    transform: "translateX(-50%)",
                    width: 2,
                    height: 16,
                    borderRadius: 2,
                    background:
                      "linear-gradient(180deg, rgba(226,232,240,.28), rgba(148,163,184,.10))",
                    boxShadow: "0 10px 18px rgba(0,0,0,.25)",
                  }}
                />
                {/* label */}
                <span
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: topSide ? -26 : 18,
                    transform: "translateX(-50%)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,.14)",
                    background:
                      "linear-gradient(180deg, rgba(2,6,23,.92), rgba(15,23,42,.82))",
                    boxShadow: "0 14px 30px rgba(0,0,0,.45)",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: toneColor(p.t),
                      boxShadow: "0 0 0 3px rgba(2,6,23,.55)",
                    }}
                  />
                  <span style={{ fontWeight: 900, fontSize: 11 }}>
                    {p.label}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
          Tocá un poste para abrir la OT.
        </div>
      </div>
    </div>
  );
}

/* =======================================================
   Página
======================================================= */
export default function HistorialLuminarias() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Toggle vista: auto | 2d | 3d-low | 3d-high
  const [viewMode, setViewMode] = useState("auto");

  const ramal = params.get("ramal") || "";
  const from = params.get("from") || "";
  const to = params.get("to") || "";

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

  const grouped = useMemo(() => {
    const out = {};
    for (const r of rows) {
      const k = r.ramal || "UNKNOWN";
      if (!out[k]) out[k] = [];
      out[k].push(r);
    }
    return out;
  }, [rows]);

  function updateParam(key, value) {
    const next = new URLSearchParams(params);
    if (!value) next.delete(key);
    else next.set(key, value);
    setParams(next);
  }

  const list = ramal ? [ramal] : RAMALES;

  return (
    <div className="page">
      {/* Header PRO: Volver + Título */}
      <button
        type="button"
        onClick={() => {
          if (window.history.length > 1) navigate(-1);
          else navigate("/"); // ajustá si tu home es otra ruta
        }}
        title="Volver"
        className="back-fab"
      >
        <span className="back-fab-icon" aria-hidden>
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </span>
        <span className="back-fab-text">Volver</span>
      </button>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 8,
        }}
      >
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            if (window.history.length > 1) navigate(-1);
            else navigate("/"); // ajustá si tu home es otra ruta
          }}
          title="Volver"
          style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          <ArrowLeft size={18} />
          Volver
        </button>

        <h2 className="titulo" style={{ margin: 0 }}>
          Ruta de Luminarias
        </h2>
      </div>

      {/* Controles: filtros + toggle */}
      <div className="card" style={{ padding: 12, marginBottom: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 10,
            marginBottom: 10,
          }}
        >
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

        {/* Toggle vista */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className={viewMode === "auto" ? "btn" : "btn ghost"}
            onClick={() => setViewMode("auto")}
          >
            Auto
          </button>
          <button
            type="button"
            className={viewMode === "2d" ? "btn" : "btn ghost"}
            onClick={() => setViewMode("2d")}
          >
            2D
          </button>
          <button
            type="button"
            className={viewMode === "3d-low" ? "btn" : "btn ghost"}
            onClick={() => setViewMode("3d-low")}
          >
            3D Lite
          </button>
          <button
            type="button"
            className={viewMode === "3d-high" ? "btn" : "btn ghost"}
            onClick={() => setViewMode("3d-high")}
          >
            3D Pro
          </button>

          <span className="muted" style={{ alignSelf: "center", fontSize: 12 }}>
            Auto recomienda por volumen y dispositivo.
          </span>
        </div>
      </div>

      {/* Leyenda */}
      <div className="card" style={{ padding: 12, marginBottom: 16 }}>
        <div
          style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13 }}
        >
          <span>
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: 3,
                background: toneColor("ok"),
                marginRight: 8,
              }}
            />
            Reparado / Completo
          </span>
          <span>
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: 3,
                background: toneColor("warn"),
                marginRight: 8,
              }}
            />
            Pendiente / Parcial
          </span>
          <span>
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: 3,
                background: toneColor("danger"),
                marginRight: 8,
              }}
            />
            Apagado
          </span>
        </div>
      </div>

      {loading && <div className="muted">Cargando ruta…</div>}
      {error && <div className="muted">{error}</div>}

      {!loading &&
        !error &&
        list.map((r) => {
          const rowsR = grouped[r] || [];
          const pinCount = rowsR.length;

          // Decide según toggle
          let mode = "2d";
          let quality = "low";

          if (viewMode === "2d") {
            mode = "2d";
          } else if (viewMode === "3d-low") {
            mode = "3d";
            quality = "low";
          } else if (viewMode === "3d-high") {
            mode = "3d";
            quality = "high";
          } else {
            // auto
            const auto = pickRenderMode(pinCount);
            mode = auto.mode;
            quality = auto.quality;
          }

          if (mode === "3d") {
            return (
              <Autopista3D
                key={r}
                ramalLabel={RAMAL_RANGES[r].label}
                kmMin={RAMAL_RANGES[r].min}
                kmMax={RAMAL_RANGES[r].max}
                rows={rowsR}
                quality={quality}
                onPinClick={(row) => navigate(`/detalle/${row.id}`)}
              />
            );
          }

          return (
            <AutopistaTrack
              key={r}
              ramal={r}
              rows={rowsR}
              onPinClick={(p) => navigate(`/detalle/${p.id}`)}
            />
          );
        })}
    </div>
  );
}
