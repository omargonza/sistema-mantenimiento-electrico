// src/components/LuminariaGrupoTableroBlock.jsx
import React from "react";
import TableroAutocomplete from "./TableroAutocomplete";
import LuminariasChips from "./LuminariasChips";

const RAMALES = [
  { value: "ACC_NORTE", label: "Acc Norte" },
  { value: "CAMPANA", label: "Campana" },
  { value: "PILAR", label: "Pilar" },
  { value: "ACC_TIGRE", label: "Acc Tigre" },
  { value: "GRAL_PAZ", label: "Gral Paz" },
];

export default function LuminariaGrupoTableroBlock({
  grupo,
  index,
  onChange,
  onRemove,
  onItemsChange,
}) {
  const valueText = (grupo.items || [])
    .map((x) => x.codigo_luminaria)
    .filter(Boolean)
    .join(", ");

  return (
    <div className="card" style={{ marginTop: 12, padding: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <div style={{ fontWeight: 800 }}>Tablero {index + 1}</div>

        <button
          type="button"
          className="btn-outline"
          onClick={() => onRemove(index)}
        >
          Quitar tablero
        </button>
      </div>

      <label>Tablero</label>
      <TableroAutocomplete
        value={grupo.tablero || ""}
        placeholder="Buscar/seleccionar tablero…"
        limit={20}
        minChars={2}
        onChangeText={(v) => {
          onChange(index, {
            tablero: v,
            tablero_id: null,
            tablero_confirmado: false,
          });
        }}
        onSelect={(t) => {
          onChange(index, {
            tablero_id: t.id ?? t.tablero_id ?? t.pk ?? null,
            tablero: t.nombre ?? t.tablero ?? t.label ?? "",
            zona: t.zona || "",
            circuito: t.circuito || "",
            tablero_confirmado: true,
          });
        }}
        onSubmit={(texto) => {
          onChange(index, {
            tablero: (texto || grupo.tablero || "").trim(),
            tablero_id: null,
            tablero_confirmado: false,
          });
        }}
      />

      {grupo.tablero && !grupo.tablero_confirmado && (
        <div className="muted" style={{ marginTop: 6 }}>
          Seleccioná el tablero desde la lista para confirmarlo.
        </div>
      )}

      <label style={{ marginTop: 8 }}>Zona</label>
      <input
        value={grupo.zona || ""}
        onChange={(e) => onChange(index, { zona: e.target.value })}
      />

      <label style={{ marginTop: 8 }}>Circuito</label>
      <input
        value={grupo.circuito || ""}
        onChange={(e) => onChange(index, { circuito: e.target.value })}
      />

      <label style={{ marginTop: 8 }}>Ramal</label>
      <select
        value={grupo.ramal || ""}
        onChange={(e) => onChange(index, { ramal: e.target.value })}
      >
        <option value="">—</option>
        {RAMALES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>

      <label style={{ marginTop: 8 }}>Resultado</label>
      <select
        value={grupo.resultado || "COMPLETO"}
        onChange={(e) => onChange(index, { resultado: e.target.value })}
      >
        <option value="COMPLETO">Completo</option>
        <option value="PARCIAL">Parcial</option>
      </select>

      <label style={{ marginTop: 8 }}>Estado luminaria</label>
      <select
        value={grupo.luminaria_estado || ""}
        onChange={(e) => onChange(index, { luminaria_estado: e.target.value })}
      >
        <option value="">—</option>
        <option value="REPARADO">Reparado / encendido</option>
        <option value="APAGADO">Sigue apagado</option>
        <option value="PENDIENTE">Pendiente</option>
      </select>

      <div style={{ marginTop: 12 }}>
        <LuminariasChips
          valueText={valueText}
          onChange={({ list }) => onItemsChange(index, list)}
        />
      </div>

      <label style={{ marginTop: 8 }}>Tarea pedida</label>
      <textarea
        value={grupo.tarea_pedida || ""}
        onChange={(e) => onChange(index, { tarea_pedida: e.target.value })}
      />

      <label style={{ marginTop: 8 }}>Tarea realizada</label>
      <textarea
        value={grupo.tarea_realizada || ""}
        onChange={(e) => onChange(index, { tarea_realizada: e.target.value })}
      />

      <label style={{ marginTop: 8 }}>Tarea pendiente</label>
      <textarea
        value={grupo.tarea_pendiente || ""}
        onChange={(e) => onChange(index, { tarea_pendiente: e.target.value })}
      />

      <label style={{ marginTop: 8 }}>Observaciones</label>
      <textarea
        value={grupo.observaciones || ""}
        onChange={(e) => onChange(index, { observaciones: e.target.value })}
      />
    </div>
  );
}
