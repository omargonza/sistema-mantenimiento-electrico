// src/pages/MisPdfs.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import "../styles/dashboard.css";
import { queryOts, getPdfBlob, setFlags, deleteOt } from "../storage/ot_db";

function formatMB(bytes) {
  const mb = (bytes || 0) / (1024 * 1024);
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
        </mark>,
      );
  }
  return out;
}

export default function MisPdfs() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [q, setQ] = useState(params.get("q") || "");
  const [desde, setDesde] = useState(params.get("desde") || "");
  const [hasta, setHasta] = useState(params.get("hasta") || "");
  const [soloFavoritos, setSoloFavoritos] = useState(params.get("fav") === "1");

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // sync URL (para que puedas volver y quede filtrado)
  useEffect(() => {
    const next = new URLSearchParams(params);

    const put = (k, v) => {
      if (!v) next.delete(k);
      else next.set(k, v);
    };

    put("q", q.trim());
    put("desde", desde);
    put("hasta", hasta);
    put("fav", soloFavoritos ? "1" : "");

    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, desde, hasta, soloFavoritos]);

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

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, desde, hasta, soloFavoritos]);

  const bytesTotal = useMemo(
    () => items.reduce((acc, it) => acc + (it.pdfBytes || 0), 0),
    [items],
  );

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

  return (
    <div className="page">
      <div
        style={{ display: "flex", justifyContent: "space-between", gap: 10 }}
      >
        <h2 className="titulo" style={{ margin: 0 }}>
          Mis PDFs
        </h2>
        <button type="button" className="btn-outline" onClick={refresh}>
          🔄 Actualizar
        </button>
      </div>

      <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
        {items.length} PDFs · {formatMB(bytesTotal)} aprox (guardados en este
        dispositivo)
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginTop: 12, padding: 12 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          <input
            type="text"
            placeholder="Buscar tablero / ubicación / zona…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <label className="toggle" style={{ justifyContent: "space-between" }}>
            <span>⭐ Favoritos</span>
            <input
              type="checkbox"
              checked={soloFavoritos}
              onChange={(e) => setSoloFavoritos(e.target.checked)}
            />
          </label>

          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
        </div>

        <div
          style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}
        >
          <button
            type="button"
            className="btn-outline"
            onClick={() => {
              setQ("");
              setDesde("");
              setHasta("");
              setSoloFavoritos(false);
            }}
          >
            Limpiar
          </button>

          <button
            type="button"
            className="btn-outline"
            onClick={() => navigate("/")}
          >
            ← Inicio
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="tabla-ot" style={{ marginTop: 12 }}>
        {loading && <p className="sin-datos">Cargando…</p>}

        {!loading && items.length === 0 && (
          <p className="sin-datos">
            No hay PDFs guardados localmente con esos filtros.
          </p>
        )}

        {!loading &&
          items.map((ot) => (
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
                <div className="ot-tablero">{highlightText(ot.tablero, q)}</div>

                <div className="ot-meta">
                  <span className="ot-fecha">{ot.fecha}</span>
                  {ot.zona ? (
                    <span className="zbadge">{highlightText(ot.zona, q)}</span>
                  ) : null}
                  {ot.favorito && <span className="chip">⭐</span>}
                  {ot.enviado && <span className="chip ok">ENVIADO</span>}
                </div>
              </div>

              <div className="ot-sub">{highlightText(ot.ubicacion, q)}</div>

              <div className="ot-info">
                <span className="pill">
                  {highlightText(ot.tecnico || "-", q)}
                </span>
                <span className="pill">
                  {highlightText(ot.vehiculo || "-", q)}
                </span>
                <span className="pill">{formatMB(ot.pdfBytes || 0)}</span>
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
  );
}
