import { useEffect, useMemo, useState } from "react";
import { getOrdenesAudit, getCurrentUser } from "../api";

function fmt(v) {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function fmtDate(s) {
  if (!s) return "—";
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return String(s);
    return d.toLocaleString("es-AR");
  } catch {
    return String(s);
  }
}

export default function AuditoriaOT() {
  const user = getCurrentUser();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const data = await getOrdenesAudit();
      setItems(data);
    } catch (err) {
      // segundo intento corto por si justo hubo refresh de token
      try {
        const retry = await getOrdenesAudit();
        setItems(retry);
      } catch (err2) {
        setError(err2?.message || "No se pudo cargar la auditoría.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    const term = String(q || "")
      .trim()
      .toLowerCase();
    if (!term) return items;

    return items.filter((row) => {
      const haystack = [
        row?.id,
        row?.fecha,
        row?.tablero,
        row?.zona,
        row?.circuito,
        row?.vehiculo,
        row?.tarea_pedida,
        row?.tarea_realizada,
        row?.tarea_pendiente,
        row?.creado_por_legajo,
        row?.creado_por_nombre,
      ]
        .map((x) => String(x || "").toLowerCase())
        .join(" ");

      return haystack.includes(term);
    });
  }, [items, q]);

  return (
    <div
      style={{
        padding: 12,
        paddingBottom: 90,
        minHeight: "100dvh",
      }}
    >
      <div
        style={{
          background: "#111827",
          border: "1px solid rgba(255,255,255,.08)",
          borderRadius: 16,
          padding: 14,
          marginBottom: 12,
        }}
      >
        <h1 style={{ margin: 0, marginBottom: 8 }}>Auditoría de OTs</h1>

        <div style={{ opacity: 0.8, marginBottom: 12 }}>
          Usuario actual: <strong>{fmt(user?.profile?.nombre_completo)}</strong>{" "}
          · Rol: <strong>{fmt(user?.profile?.role)}</strong>
        </div>

        <input
          type="text"
          placeholder="Buscar por tablero, técnico, legajo, tarea..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,.12)",
            background: "#0b1220",
            color: "white",
          }}
        />
      </div>

      {loading ? (
        <div
          style={{
            background: "#111827",
            border: "1px solid rgba(255,255,255,.08)",
            borderRadius: 16,
            padding: 14,
          }}
        >
          Cargando órdenes...
        </div>
      ) : null}

      {error ? (
        <div
          style={{
            background: "rgba(220,38,38,.12)",
            border: "1px solid rgba(220,38,38,.25)",
            borderRadius: 16,
            padding: 14,
            display: "grid",
            gap: 10,
          }}
        >
          <div>{error}</div>
          <button
            type="button"
            onClick={loadData}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      ) : null}

      {!loading && !error ? (
        <div style={{ display: "grid", gap: 10 }}>
          <div
            style={{
              background: "#111827",
              border: "1px solid rgba(255,255,255,.08)",
              borderRadius: 16,
              padding: 12,
            }}
          >
            Total: <strong>{filtered.length}</strong>
          </div>

          {filtered.length === 0 ? (
            <div
              style={{
                background: "#111827",
                border: "1px solid rgba(255,255,255,.08)",
                borderRadius: 16,
                padding: 14,
              }}
            >
              No hay órdenes para mostrar.
            </div>
          ) : null}

          {filtered.map((row) => (
            <div
              key={row.id}
              style={{
                background: "#111827",
                border: "1px solid rgba(255,255,255,.08)",
                borderRadius: 16,
                padding: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                  marginBottom: 10,
                }}
              >
                <strong>OT #{fmt(row.id)}</strong>
                <span>{fmtDate(row.creado || row.fecha)}</span>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div>
                  <strong>Fecha:</strong> {fmt(row.fecha)}
                </div>
                <div>
                  <strong>Tablero:</strong> {fmt(row.tablero)}
                </div>
                <div>
                  <strong>Zona:</strong> {fmt(row.zona)}
                </div>
                <div>
                  <strong>Circuito:</strong> {fmt(row.circuito)}
                </div>
                <div>
                  <strong>Vehículo:</strong> {fmt(row.vehiculo)}
                </div>
                <div>
                  <strong>Tarea pedida:</strong> {fmt(row.tarea_pedida)}
                </div>
                <div>
                  <strong>Tarea realizada:</strong> {fmt(row.tarea_realizada)}
                </div>
                <div>
                  <strong>Tarea pendiente:</strong> {fmt(row.tarea_pendiente)}
                </div>
                <div>
                  <strong>Creado por legajo:</strong>{" "}
                  {fmt(row.creado_por_legajo)}
                </div>
                <div>
                  <strong>Creado por nombre:</strong>{" "}
                  {fmt(row.creado_por_nombre)}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
