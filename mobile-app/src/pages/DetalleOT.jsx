// src/pages/DetalleOT.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../styles/detalle.css";
import { getOtById, getPdfBlob, setFlags } from "../storage/ot_db";

function fmt(v) {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function normalizeMultiline(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  const normalized = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const unescaped = normalized.replace(/\\n/g, "\n");
  return unescaped.trim();
}

function hasPendiente(d) {
  return Boolean((d?.tarea_pendiente || "").trim());
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

export default function DetalleOT() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [ot, setOt] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setNotFound(false);
      setErrMsg("");

      try {
        const row = await getOtById(id);
        if (!alive) return;

        if (!row) {
          setNotFound(true);
          setOt(null);
        } else {
          setOt(row);
        }
      } catch (e) {
        console.warn(e);
        if (!alive) return;
        setErrMsg("No se pudo leer la OT del respaldo local.");
        setNotFound(true);
        setOt(null);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  // ✅ Fuente de verdad: si existe detalle, usamos eso
  const d = useMemo(() => {
    const det = ot?.detalle || {};
    // fallback defensivo a campos “rápidos” si faltan
    return {
      ...det,
      fecha: det.fecha ?? ot?.fecha,
      tablero: det.tablero ?? ot?.tablero,
      zona: det.zona ?? ot?.zona,
      ubicacion: det.ubicacion ?? ot?.ubicacion,
      vehiculo: det.vehiculo ?? ot?.vehiculo,
    };
  }, [ot]);

  const filename = useMemo(() => {
    const fecha = d?.fecha || "OT";
    const tablero = d?.tablero || "Tablero";
    return `${fecha} - ${tablero}.pdf`;
  }, [d]);

  const openPdf = async () => {
    const blob = await getPdfBlob(ot?.pdfId || ot?.id);
    if (!blob) {
      setErrMsg("No se encontró el PDF en el respaldo local.");
      return;
    }

    try {
      await setFlags(ot.id, { reimpreso: (ot.reimpreso || 0) + 1 });
    } catch {}

    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const sharePdf = async () => {
    const blob = await getPdfBlob(ot?.pdfId || ot?.id);
    if (!blob) {
      setErrMsg("No se encontró el PDF en el respaldo local.");
      return;
    }

    const title = "Orden de Trabajo";
    const text = `${d?.fecha || ""} — ${d?.tablero || ""}\n${
      d?.ubicacion || ""
    }`.trim();

    try {
      const shared = await sharePdfBlob({ blob, filename, title, text });
      if (shared) {
        try {
          await setFlags(ot.id, { enviado: true });
        } catch {}
      }
    } catch (e) {
      console.warn("Share cancelado o no disponible:", e);
    }
  };

  if (loading) {
    return (
      <div className="detalle-page detalle-loading">
        <div className="detalle-spinner" />
        <p>Cargando orden de trabajo…</p>
      </div>
    );
  }

  if (notFound || !ot) {
    return (
      <div className="detalle-page">
        <header className="detalle-topbar">
          <button className="btn-volver-simple" onClick={() => navigate(-1)}>
            Volver
          </button>
          <h1 className="detalle-topbar-title">Orden no encontrada</h1>
        </header>

        <p className="detalle-empty">
          {errMsg || "No se encontró la OT en el respaldo local (IndexedDB)."}
        </p>
      </div>
    );
  }

  const fechaLabel = d?.fecha || "Sin fecha";
  const numeroOT = ot?.id ?? "-";

  const pedida = normalizeMultiline(d?.tarea_pedida);
  const realizada = normalizeMultiline(d?.tarea_realizada);
  const pendiente = normalizeMultiline(d?.tarea_pendiente);
  const obs = normalizeMultiline(d?.observaciones);

  const tecnicos = Array.isArray(d?.tecnicos) ? d.tecnicos : [];
  const materiales = Array.isArray(d?.materiales) ? d.materiales : [];

  return (
    <div className="detalle-page">
      <header className="detalle-topbar">
        <button className="btn-volver-simple" onClick={() => navigate(-1)}>
          Volver
        </button>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <h1 className="detalle-topbar-title">OT #{numeroOT}</h1>
          {hasPendiente(d) ? (
            <span className="badge-pendiente">PENDIENTE</span>
          ) : null}
        </div>
      </header>

      <main className="detalle-main">
        {/* Header resumen */}
        <section className="detalle-header-card">
          <div className="detalle-header-row">
            <h2>Orden de trabajo</h2>
            <span className="detalle-pill-fecha">{fechaLabel}</span>
          </div>

          {d?.ubicacion ? (
            <p className="detalle-ubicacion">{d.ubicacion}</p>
          ) : null}

          <div className="detalle-chips-row">
            {d?.zona ? (
              <span className="chip chip-zona">Zona: {d.zona}</span>
            ) : null}
            {d?.vehiculo ? (
              <span className="chip chip-veh">Veh: {d.vehiculo}</span>
            ) : null}
            {d?.circuito ? (
              <span className="chip chip-circ">Circ: {d.circuito}</span>
            ) : null}
            {d?.tiene_firma ? (
              <span className="chip chip-ok">Firma</span>
            ) : null}
            {Number(d?.fotos_count || 0) > 0 ? (
              <span className="chip chip-info">Fotos: {d.fotos_count}</span>
            ) : null}
          </div>

          {errMsg ? (
            <p className="detalle-muted" style={{ marginTop: 10 }}>
              {errMsg}
            </p>
          ) : null}
        </section>

        {/* Datos generales */}
        <section className="detalle-section">
          <h3 className="detalle-section-title">Datos generales</h3>
          <div className="detalle-grid">
            <DetalleItem label="Tablero" value={fmt(d?.tablero)} />
            <DetalleItem label="Circuito" value={fmt(d?.circuito)} />
            <DetalleItem label="Zona" value={fmt(d?.zona)} />
            <DetalleItem label="Vehículo" value={fmt(d?.vehiculo)} />
            <DetalleItem
              label="Luminarias / Equipos"
              value={fmt(d?.luminaria_equipos)}
            />
          </div>
        </section>

        {/* Recorrido */}
        <section className="detalle-section">
          <h3 className="detalle-section-title">Recorrido</h3>
          <div className="detalle-grid">
            <DetalleItem label="Km inicial" value={fmt(d?.km_inicial)} />
            <DetalleItem label="Km final" value={fmt(d?.km_final)} />
            <DetalleItem label="Km total" value={fmt(d?.km_total)} />
          </div>
        </section>

        {/* Técnicos */}
        <section className="detalle-section">
          <h3 className="detalle-section-title">Técnicos</h3>
          {tecnicos.length > 0 ? (
            <ul className="detalle-list">
              {tecnicos.map((t, i) => (
                <li key={i} className="detalle-list-item">
                  <span className="detalle-list-main">
                    {t?.nombre || "Sin nombre"}
                  </span>
                  <span className="detalle-list-sub">
                    Legajo {t?.legajo || "—"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="detalle-muted">No se registraron técnicos.</p>
          )}
        </section>

        {/* Materiales */}
        <section className="detalle-section">
          <h3 className="detalle-section-title">Materiales</h3>
          {materiales.length > 0 ? (
            <ul className="detalle-list">
              {materiales.map((m, i) => (
                <li key={i} className="detalle-list-item materiales-item">
                  <span className="detalle-list-main">
                    {m?.material || "—"}
                  </span>
                  <span className="detalle-list-sub">
                    {fmt(m?.cant)} {fmt(m?.unidad)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="detalle-muted">No se registraron materiales.</p>
          )}
        </section>

        {/* Tareas */}
        <section className="detalle-section">
          <h3 className="detalle-section-title">Detalle de tareas</h3>

          <DetalleBloqueTexto label="Tarea pedida" value={pedida} />
          <DetalleBloqueTexto label="Tarea realizada" value={realizada} />
          <DetalleBloqueTexto
            label="Tarea pendiente"
            value={pendiente}
            highlight={Boolean(pendiente)}
          />

          <DetalleBloqueTexto label="Observaciones" value={obs} />
        </section>

        {/* Auditoría */}
        <section className="detalle-section">
          <h3 className="detalle-section-title">Auditoría</h3>
          <div className="detalle-grid">
            <DetalleItem
              label="Firma técnico (aclaración)"
              value={fmt(d?.firma_tecnico)}
            />
            <DetalleItem
              label="Firma supervisor (aclaración)"
              value={fmt(d?.firma_supervisor)}
            />
            <DetalleItem
              label="Tiene firma digital"
              value={d?.tiene_firma ? "Sí" : "No"}
            />
            <DetalleItem label="Fotos (cantidad)" value={fmt(d?.fotos_count)} />
          </div>
        </section>
      </main>

      <footer className="detalle-footer-bar">
        <button className="btn-footer btn-secundario" onClick={sharePdf}>
          Compartir
        </button>
        <button className="btn-footer btn-primario" onClick={openPdf}>
          Abrir PDF
        </button>
      </footer>
    </div>
  );
}

function DetalleItem({ label, value }) {
  return (
    <div className="detalle-item">
      <span className="detalle-item-label">{label}</span>
      <span className="detalle-item-value">{value || "—"}</span>
    </div>
  );
}

function DetalleBloqueTexto({ label, value, highlight = false }) {
  const text = normalizeMultiline(value);
  const lines = text ? text.split("\n").map((l) => l.trimEnd()) : [];

  return (
    <div className={`detalle-bloque-texto ${highlight ? "is-highlight" : ""}`}>
      <div className="detalle-bloque-header">
        <span className="detalle-bloque-label">{label}</span>
      </div>

      {!text ? (
        <div className="detalle-prose detalle-prose-empty">
          Sin información registrada.
        </div>
      ) : (
        <div className="detalle-prose">
          {lines.map((line, i) =>
            line ? (
              <p key={i} className="detalle-prose-line">
                {line}
              </p>
            ) : (
              <div key={i} className="detalle-prose-blank" />
            )
          )}
        </div>
      )}
    </div>
  );
}
