import { useState } from "react";
import TableroAutocomplete from "../components/TableroAutocomplete";
import { obtenerHistorial } from "../services/historialApi";

export default function Historial() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const buscar = async (tablero) => {
    if (!tablero) return;

    setLoading(true);
    setError("");
    setData(null);

    try {
      const res = await obtenerHistorial(tablero.nombre);
      setData(res);
    } catch {
      setError("No se encontró historial para ese tablero");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <h1 className="titulo">Historial por tablero</h1>

      <TableroAutocomplete
        placeholder="Buscar tablero…"
        onSelect={buscar}
      />

      {loading && <p className="muted">Cargando…</p>}
      {error && <p className="error">{error}</p>}

      {data && (
        <>
          <div className="card">
            <strong>{data.tablero}</strong>
            <div className="muted">Zona: {data.zona}</div>
          </div>

          <div className="timeline">
            {data.historial.map((h, i) => (
              <div key={i} className="timeline-item">
                <div className="fecha">{h.fecha}</div>
                {h.circuito && (
                  <div className="circuito">
                    Circuito: {h.circuito}
                  </div>
                )}
                <div className="desc">{h.descripcion}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
