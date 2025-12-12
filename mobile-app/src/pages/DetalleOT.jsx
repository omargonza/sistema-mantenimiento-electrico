// src/pages/DetalleOT.jsx
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import "../styles/detalle.css";

export default function DetalleOT() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ot, setOT] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    try {
      const lista = JSON.parse(localStorage.getItem("ot_historial") || "[]");
      const encontrada = lista.find((x) => String(x.id) === String(id));

      if (!encontrada) {
        setNotFound(true);
      } else {
        setOT(encontrada);
      }
    } catch (e) {
      console.error("Error leyendo ot_historial:", e);
      setNotFound(true);
    }
  }, [id]);

  const handleBack = () => navigate(-1);

  if (notFound) {
    return (
      <div className="detalle-page">
        <header className="detalle-topbar">
          <button className="btn-volver-simple" onClick={handleBack}>
            Volver
          </button>
          <h1 className="detalle-topbar-title">Orden no encontrada</h1>
        </header>
        <p className="detalle-empty">
          No se encontró la orden de trabajo en el historial local.
        </p>
      </div>
    );
  }

  if (!ot) {
    return (
      <div className="detalle-page detalle-loading">
        <div className="detalle-spinner" />
        <p>Cargando orden de trabajo…</p>
      </div>
    );
  }

  const fechaLabel = ot.fecha || "Sin fecha";
  const numeroOT = ot.id ?? "-";

  return (
    <div className="detalle-page">
      {/* Top bar fija tipo app mobile */}
      <header className="detalle-topbar">
        <button className="btn-volver-simple" onClick={handleBack}>
          Volver
        </button>
        <h1 className="detalle-topbar-title">OT #{numeroOT}</h1>
      </header>

      <main className="detalle-main">
        {/* Encabezado resumido */}
        <section className="detalle-header-card">
          <div className="detalle-header-row">
            <h2>Orden de trabajo</h2>
            <span className="detalle-pill-fecha">{fechaLabel}</span>
          </div>

          <div className="detalle-chips-row">
            {ot.centro_costos && (
              <span className="chip chip-cc">
                CC: {ot.centro_costos}
              </span>
            )}
            {ot.tipo_mantenimiento && (
              <span className="chip chip-tipo">
                {ot.tipo_mantenimiento}
              </span>
            )}
            {ot.prioridad && (
              <span className="chip chip-prio">
                Prioridad: {ot.prioridad}
              </span>
            )}
          </div>

          {ot.ubicacion && (
            <p className="detalle-ubicacion">
              {ot.ubicacion}
            </p>
          )}
        </section>

        {/* Datos generales */}
        <section className="detalle-section">
          <h3 className="detalle-section-title">Datos generales</h3>
          <div className="detalle-grid">
            <DetalleItem label="Tablero" value={ot.tablero} />
            <DetalleItem label="Circuito" value={ot.circuito} />
            <DetalleItem label="Vehículo" value={ot.vehiculo} />
            <DetalleItem label="Luminarias / Equipos" value={ot.luminaria_equipos} />
          </div>
        </section>

        {/* Recorrido / km */}
        <section className="detalle-section">
          <h3 className="detalle-section-title">Recorrido</h3>
          <div className="detalle-grid">
            <DetalleItem label="Km inicial" value={ot.km_inicial} />
            <DetalleItem label="Km final" value={ot.km_final} />
          </div>
        </section>

        {/* Técnicos */}
        <section className="detalle-section">
          <h3 className="detalle-section-title">Técnicos</h3>
          {ot.tecnicos && ot.tecnicos.length > 0 ? (
            <ul className="detalle-list">
              {ot.tecnicos.map((t, i) => (
                <li key={i} className="detalle-list-item">
                  <span className="detalle-list-main">
                    {t.nombre || "Sin nombre"}
                  </span>
                  <span className="detalle-list-sub">
                    Legajo {t.legajo || "-"}
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
          {ot.materiales && ot.materiales.length > 0 ? (
            <ul className="detalle-list">
              {ot.materiales.map((m, i) => (
                <li key={i} className="detalle-list-item materiales-item">
                  <span className="detalle-list-main">{m.material}</span>
                  <span className="detalle-list-sub">
                    {m.cant} {m.unidad}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="detalle-muted">No se registraron materiales.</p>
          )}
        </section>

        {/* Tareas: pedida / realizada / pendiente */}
        <section className="detalle-section">
          <h3 className="detalle-section-title">Detalle de tareas</h3>

          <DetalleBloqueTexto
            label="Tarea pedida"
            value={ot.tarea_pedida}
          />
          <DetalleBloqueTexto
            label="Tarea realizada"
            value={ot.tarea_realizada}
          />
          <DetalleBloqueTexto
            label="Tarea pendiente"
            value={ot.tarea_pendiente}
          />
        </section>
      </main>

      {/* Footer de acciones fijo abajo en mobile */}
      <footer className="detalle-footer-bar">
        <button
          className="btn-footer btn-secundario"
          onClick={() => alert("Función de compartir en desarrollo")}
        >
          Compartir
        </button>
        <button
          className="btn-footer btn-primario"
          onClick={() => alert("Descarga de PDF en desarrollo")}
        >
          Descargar PDF
        </button>
      </footer>
    </div>
  );
}

/* ========= Subcomponentes presentacionales ========= */

function DetalleItem({ label, value }) {
  return (
    <div className="detalle-item">
      <span className="detalle-item-label">{label}</span>
      <span className="detalle-item-value">{value || "—"}</span>
    </div>
  );
}

function DetalleBloqueTexto({ label, value }) {
  const text = normalizeMultiline(value);

  if (!text) {
    return (
      <div className="detalle-bloque-texto">
        <div className="detalle-bloque-header">
          <span className="detalle-bloque-label">{label}</span>
        </div>
        <div className="detalle-prose detalle-prose-empty">
          Sin información registrada.
        </div>
      </div>
    );
  }

  const lines = text.split("\n").map((l) => l.trimEnd());

  return (
    <div className="detalle-bloque-texto">
      <div className="detalle-bloque-header">
        <span className="detalle-bloque-label">{label}</span>
      </div>

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
    </div>
  );
}

function normalizeMultiline(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);

  // Normaliza saltos Windows/Mac a "\n"
  const normalized = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Si se guardó como texto literal "\\n", lo convertimos a salto real
  const unescaped = normalized.replace(/\\n/g, "\n");

  return unescaped.trim();
}


