import { useState } from "react";
import SmartSelect from "../components/SmartSelect";
import NumericInput from "../components/NumericInput";
import useOfflineQueue from "../hooks/useOfflineQueue";
import { enviarOT } from "../api";
import { vibrar } from "../utils/haptics";
import "../styles/app.css";
import useFormStore from "../hooks/useFormStore";

/* =======================================================
   UTILIDADES: cache para autocompletado
======================================================= */
function saveCache(key, value) {
  const list = JSON.parse(localStorage.getItem(key) || "[]");
  const updated = [value, ...list.filter((v) => v !== value)];
  localStorage.setItem(key, JSON.stringify(updated.slice(0, 10)));
}

function loadCache(key) {
  return JSON.parse(localStorage.getItem(key) || "[]");
}

/* =======================================================
   LISTAS
======================================================= */
const VEHICULOS = [
  "AB101RS", "AE026TH", "AE026VN", "AF836WI",
  "AF078KP", "AH223LS", "AA801TV"
];

const TABLEROS = [
  "TI 1400", "TI 1300", "TI 1200", "TI 1100", "TI 1000",
  "TI 900", "TI 800", "TI 700", "TI 600", "TI 500",
  "TI 400", "TI 300", "TI 200", "TI 100",
  "Tablero Cámara 1", "Tablero Cámara 2",
  "Ibarrola", "Tuyuti", "Madrid", "San Cayetano",
  "Peaje Debenedetti ASC", "Peaje Campana Troncal"
];

/* =======================================================
   FORMULARIO INICIAL (base para reset)
======================================================= */
const initialForm = {
  fecha: new Date().toISOString().slice(0, 10),
  ubicacion: "",
  tablero: "",
  circuito: "",
  vehiculo: "",
  kmIni: "",
  kmFin: "",
  tecnicos: [{ legajo: "", nombre: "" }],
  materiales: [{ material: "", cant: "", unidad: "" }],
  tareaPedida: "",
  tareaRealizada: "",
  tareaPendiente: "",
  luminaria: "",
};

/* =======================================================
   GUARDAR HISTORIAL LOCAL (Dashboard)
   (FIX: antes estabas usando payload.tableros/circuitos)
======================================================= */
function guardarHistorialOT(payload) {
  const prev = JSON.parse(localStorage.getItem("ot_historial") || "[]");

  const nueva = {
    id: Date.now(),
    fecha: payload.fecha,
    ubicacion: payload.ubicacion,
    tablero: payload.tablero || "",
    circuito: payload.circuito || "",
    vehiculo: payload.vehiculo || "",
    km_inicial: payload.km_inicial,
    km_final: payload.km_final,
    tecnicos: payload.tecnicos,
    materiales: payload.materiales,
    luminaria_equipos: payload.luminaria_equipos,
    tarea_pedida: payload.tarea_pedida,
    tarea_realizada: payload.tarea_realizada,
    tarea_pendiente: payload.tarea_pendiente,
    tecnico: payload.tecnicos?.[0]?.nombre || "—",
  };

  localStorage.setItem("ot_historial", JSON.stringify([nueva, ...prev]));
}


function normalizarPayloadOT(form) {
  const tableroFinal =
    form.tablero ||
    (Array.isArray(form.tableros) ? form.tableros[0] : "") ||
    "";

  const circuitoFinal =
    form.circuito ||
    (Array.isArray(form.circuitos)
      ? form.circuitos.join(", ")
      : form.circuitos) ||
    "";

  return {
    fecha: form.fecha,
    ubicacion: form.ubicacion,
    tablero: tableroFinal,          // ✅ SIEMPRE SINGULAR
    circuito: circuitoFinal,        // ✅ SIEMPRE SINGULAR
    vehiculo: form.vehiculo || "",

    km_inicial: form.kmIni || null,
    km_final: form.kmFin || null,

    tecnicos: form.tecnicos || [],
    materiales: form.materiales || [],

    tarea_pedida: form.tareaPedida || "",
    tarea_realizada: form.tareaRealizada || "",
    tarea_pendiente: form.tareaPendiente || "",

    luminaria_equipos: form.luminaria || "",
  };
}


export default function NuevaOT() {
  const { guardarPendiente } = useOfflineQueue();

  /* =======================================================
     ESTADO CENTRAL DEL FORMULARIO
  ======================================================== */
  const [form, setForm] = useState(initialForm);

  // ✅ Autoguardado + devuelve clearForm para limpiar
  const { clear: clearForm } = useFormStore(
    "ot_form_cache",
    form,
    setForm,
    initialForm
  );

  /* =======================================================
     VALIDACIÓN
  ======================================================== */
  function validarCampos() {
    if (!form.ubicacion.trim()) return "La ubicación es obligatoria.";
    if (!form.tablero.trim()) return "Debe seleccionar un tablero.";
    if (!form.vehiculo.trim()) return "Debe seleccionar un vehículo.";

    if (form.kmIni && form.kmFin && Number(form.kmFin) < Number(form.kmIni))
      return "El km final no puede ser menor que el inicial.";

    return null;
  }

  /* =======================================================
     ENVÍO
  ======================================================== */
  async function generarPDF() {
    const error = validarCampos();
    if (error) {
      alert("⚠ " + error);
      return;
    }

   const payload = normalizarPayloadOT(form);


    // cache sugerencias
    saveCache("cache_tableros", form.tablero);
    saveCache("cache_vehiculos", form.vehiculo);

    try {
      // vibración pro (si la tenés implementada)
      try { vibrar?.(30); } catch {}

      // ✅ genera PDF en backend
      const blob = await enviarOT(payload);

      // ✅ descarga PDF en mobile/webview
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `OT_${payload.fecha}_${payload.tablero}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      // ✅ recién acá: guardar historial (porque se generó OK)
      guardarHistorialOT(payload);

      // ✅ limpieza enterprise: reset + borra cache del formulario
      clearForm();

    } catch (e) {
      console.warn("Sin conexión → almacenando OT localmente", e);

      // offline queue
      await guardarPendiente({ data: payload });

      alert("Sin señal. La OT fue guardada para enviar más tarde.");

      // ❌ no limpiamos en offline (para no perder trabajo)
    }
  }

  /* =======================================================
     AUTOCOMPLETADO
  ======================================================== */
  const sugeridosVehiculos = [...loadCache("cache_vehiculos"), ...VEHICULOS];
  const sugeridosTableros = [...loadCache("cache_tableros"), ...TABLEROS];

  /* =======================================================
     RENDER
  ======================================================== */
  return (
    <div className="page">
      <h2 className="titulo">Nueva Orden de Trabajo</h2>

      {/* Fecha */}
      <label>Fecha</label>
      <input
        type="date"
        value={form.fecha}
        onChange={(e) => setForm({ ...form, fecha: e.target.value })}
      />

      {/* Ubicación */}
      <label>Ubicación</label>
      <input
        type="text"
        value={form.ubicacion}
        onChange={(e) => setForm({ ...form, ubicacion: e.target.value })}
      />

      {/* Tablero */}
      <SmartSelect
        label="Tablero"
        options={sugeridosTableros}
        value={form.tablero}
        onChange={(v) => setForm({ ...form, tablero: v })}
      />

      {/* Circuito */}
      <label>Circuito</label>
      <input
        type="text"
        placeholder="FD1, Alum. exterior…"
        value={form.circuito}
        onChange={(e) => setForm({ ...form, circuito: e.target.value })}
      />

      {/* Vehículo */}
      <SmartSelect
        label="Vehículo"
        options={sugeridosVehiculos}
        value={form.vehiculo}
        onChange={(v) => setForm({ ...form, vehiculo: v })}
      />

      {/* Kilómetros */}
      <label>Kilómetro Inicial</label>
      <NumericInput
        value={form.kmIni}
        onChange={(v) => setForm({ ...form, kmIni: v })}
      />

      <label>Kilómetro Final</label>
      <NumericInput
        value={form.kmFin}
        onChange={(v) => setForm({ ...form, kmFin: v })}
      />

      {/* TÉCNICOS */}
      <h3 className="subtitulo">Técnicos</h3>

      {form.tecnicos.map((tec, idx) => (
        <div key={idx} className="fila-tecnico">
          <NumericInput
            placeholder="Legajo"
            value={tec.legajo}
            onChange={(v) =>
              setForm({
                ...form,
                tecnicos: form.tecnicos.map((t, i) =>
                  i === idx ? { ...t, legajo: v } : t
                ),
              })
            }
          />

          <input
            placeholder="Nombre"
            value={tec.nombre}
            onChange={(e) =>
              setForm({
                ...form,
                tecnicos: form.tecnicos.map((t, i) =>
                  i === idx ? { ...t, nombre: e.target.value } : t
                ),
              })
            }
          />

          {idx > 0 && (
            <button
              type="button"
              className="btn-x"
              onClick={() =>
                setForm({
                  ...form,
                  tecnicos: form.tecnicos.filter((_, i) => i !== idx),
                })
              }
            >
              ❌
            </button>
          )}
        </div>
      ))}

      <button
        type="button"
        className="btn-add"
        onClick={() =>
          setForm({
            ...form,
            tecnicos: [...form.tecnicos, { legajo: "", nombre: "" }],
          })
        }
      >
        ➕ Agregar técnico
      </button>

      {/* TAREAS */}
      <h3 className="subtitulo">Tareas</h3>

      <label>Tarea pedida</label>
      <input
        value={form.tareaPedida}
        onChange={(e) => setForm({ ...form, tareaPedida: e.target.value })}
      />

      <label>Tarea realizada</label>
      <textarea
        rows={3}
        value={form.tareaRealizada}
        onChange={(e) => setForm({ ...form, tareaRealizada: e.target.value })}
      />

      <label>Tarea pendiente</label>
      <textarea
        rows={3}
        value={form.tareaPendiente}
        onChange={(e) => setForm({ ...form, tareaPendiente: e.target.value })}
      />

      {/* LUMINARIA */}
      <label>Luminarias / Equipos</label>
      <input
        value={form.luminaria}
        onChange={(e) => setForm({ ...form, luminaria: e.target.value })}
      />

      {/* MATERIALES */}
      <h3 className="subtitulo">Materiales</h3>

      {form.materiales.map((m, idx) => (
        <div key={idx} className="fila-mat">
          <input
            placeholder="Material"
            value={m.material}
            onChange={(e) =>
              setForm({
                ...form,
                materiales: form.materiales.map((mat, i) =>
                  i === idx ? { ...mat, material: e.target.value } : mat
                ),
              })
            }
          />

          <NumericInput
            placeholder="Cant."
            value={m.cant}
            onChange={(v) =>
              setForm({
                ...form,
                materiales: form.materiales.map((mat, i) =>
                  i === idx ? { ...mat, cant: v } : mat
                ),
              })
            }
          />

          <input
            placeholder="Unidad"
            value={m.unidad}
            onChange={(e) =>
              setForm({
                ...form,
                materiales: form.materiales.map((mat, i) =>
                  i === idx ? { ...mat, unidad: e.target.value } : mat
                ),
              })
            }
          />

          {idx > 0 && (
            <button
              type="button"
              className="btn-x"
              onClick={() =>
                setForm({
                  ...form,
                  materiales: form.materiales.filter((_, i) => i !== idx),
                })
              }
            >
              ❌
            </button>
          )}
        </div>
      ))}

      <button
        type="button"
        className="btn-add"
        onClick={() =>
          setForm({
            ...form,
            materiales: [...form.materiales, { material: "", cant: "", unidad: "" }],
          })
        }
      >
        ➕ Agregar material
      </button>

      {/* BOTÓN FINAL */}
      <button className="btn-enviar" onClick={generarPDF}>
        📄 Generar PDF
      </button>
    </div>
  );
}
