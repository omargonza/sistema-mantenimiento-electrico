import React from "react";

/**
 * Campos específicos para trabajos de LUMINARIA
 * Alimentan el mapa por ramal + ubicación por KM
 *
 * Props:
 *  - form
 *  - setForm
 */
export default function LuminariaFields({ form, setForm }) {
  const RAMALES = [
    { value: "ACC_NORTE", label: "Acc Norte" },
    { value: "CAMPANA", label: "Campana" },
    { value: "PILAR", label: "Pilar" },
    { value: "ACC_TIGRE", label: "Acc Tigre" },
    { value: "GRAL_PAZ", label: "Gral Paz" },
  ];

  return (
    <div className="card" style={{ marginTop: 12, padding: 12 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>
        Ubicación de luminaria (mapa)
      </div>

      {/* Ramal */}
      <select
        value={form.ramal || ""}
        onChange={(e) => setForm((p) => ({ ...p, ramal: e.target.value }))}
      >
        <option value="">—</option>
        {RAMALES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>

      {/* KM */}
      <label style={{ marginTop: 8 }}>
        Kilómetro de la luminaria (ej: 41.05)
      </label>
      <input
        type="number"
        step="0.01"
        inputMode="decimal"
        placeholder="Ej: 41.05"
        value={form.km_luminaria || ""}
        onChange={(e) =>
          setForm((prev) => ({ ...prev, km_luminaria: e.target.value }))
        }
      />

      {/* Código columna / luminaria */}
      <label style={{ marginTop: 8 }}>Código luminaria / columna</label>
      <input
        placeholder="Ej: CC4105"
        value={form.codigo_luminaria || ""}
        onChange={(e) =>
          setForm((prev) => ({
            ...prev,
            codigo_luminaria: e.target.value.toUpperCase(),
          }))
        }
      />

      <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
        Ejemplo de código: <b>CC4105</b> = Cantero Central · KM 41 · Columna 05
      </div>
    </div>
  );
}
