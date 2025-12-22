
import { useNavigate } from "react-router-dom";


import { useRef, useState } from "react";
import SmartSelect from "../components/SmartSelect";
import NumericInput from "../components/NumericInput";
import useOfflineQueue from "../hooks/useOfflineQueue";
import { enviarOT } from "../api";
import { vibrar } from "../utils/haptics";
import "../styles/app.css";
import useFormStore from "../hooks/useFormStore";
import Toast from "../components/Toast";
import TableroAutocomplete from "../components/TableroAutocomplete";


/* =======================================================
   UTILIDADES: cache para autocompletado
======================================================= */
function saveCache(key, value) {
  if (!value) return;
  const list = JSON.parse(localStorage.getItem(key) || "[]");
  const updated = [value, ...list.filter((v) => v !== value)];
  localStorage.setItem(key, JSON.stringify(updated.slice(0, 10)));
}

function loadCache(key) {
  return JSON.parse(localStorage.getItem(key) || "[]");
}

/* =======================================================
   IMG: compresión para que no pese (clave)
   - convierte File -> dataURL jpeg comprimido
======================================================= */
async function fileToCompressedDataURL(file, maxW = 1280, quality = 0.72) {
  const img = new Image();
  const url = URL.createObjectURL(file);

  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = url;
  });

  const scale = Math.min(1, maxW / img.width);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  // fondo blanco para fotos (evita transparencias raras)
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  URL.revokeObjectURL(url);

  return canvas.toDataURL("image/jpeg", quality);
}

/* =======================================================
   LISTAS
======================================================= */
const VEHICULOS = ["AB101RS", "AE026TH", "AE026VN", "AF836WI", "AF078KP", "AH223LS", "AA801TV"];

const TABLEROS = [
  "TI 1400", "TI 1300", "TI 1200", "TI 1100", "TI 1000",
  "TI 900", "TI 800", "TI 700", "TI 600", "TI 500",
  "TI 400", "TI 300", "TI 200", "TI 100",
  "Tablero Cámara 1", "Tablero Cámara 2",
  "Ibarrola", "Tuyuti", "Madrid", "San Cayetano",
  "Peaje Debenedetti ASC", "Peaje Campana Troncal"
];

const MAX_FOTOS = 4;

/* =======================================================
   FORMULARIO INICIAL
======================================================= */
const initialForm = {
  fecha: new Date().toISOString().slice(0, 10),
  ubicacion: "",
  tablero: "",
  zona: "",
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

  // Auditoría / Legal
  observaciones: "",
  firmaTecnico: "",
  firmaSupervisor: "",

  // Firma digital (PNG base64)
  firmaTecnicoB64: "",

  // Fotos (JPG base64 comprimidas)
  fotosB64: [], // array de dataURL (jpg) máx 4

  // Modo impresión B/N (opcional)
  printMode: false,
};

/* =======================================================
   HISTORIAL LOCAL
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
    km_total: payload.km_total, // ✅
    tecnicos: payload.tecnicos,
    materiales: payload.materiales,
    luminaria_equipos: payload.luminaria_equipos,
    tarea_pedida: payload.tarea_pedida,
    tarea_realizada: payload.tarea_realizada,
    tarea_pendiente: payload.tarea_pendiente,
    tecnico: payload.tecnicos?.[0]?.nombre || "—",



    // Auditoría
    observaciones: payload.observaciones,
    firma_tecnico: payload.firma_tecnico,
    firma_supervisor: payload.firma_supervisor,
    tiene_firma: Boolean(payload.firma_tecnico_img),
    fotos: payload.fotos_b64?.length || 0,
  };

  localStorage.setItem("ot_historial", JSON.stringify([nueva, ...prev]));
}

/* =======================================================
   NORMALIZACIÓN PAYLOAD (SIN DUPLICADOS)
======================================================= */
function normalizarPayloadOT(form) {
  const tableroFinal =
    form.tablero || (Array.isArray(form.tableros) ? form.tableros[0] : "") || "";

  const circuitoFinal =
    form.circuito ||
    (Array.isArray(form.circuitos) ? form.circuitos.join(", ") : form.circuitos) ||
    "";

  return {
    fecha: form.fecha,
    ubicacion: form.ubicacion,
    tablero: tableroFinal,
    circuito: circuitoFinal,
    vehiculo: form.vehiculo || "",
    km_inicial: form.kmIni === "" ? null : Number(form.kmIni),
    km_final: form.kmFin === "" ? null : Number(form.kmFin),

    // ✅ nuevo: km_total
    km_total:
      form.kmIni !== "" &&
        form.kmFin !== "" &&
        Number.isFinite(Number(form.kmIni)) &&
        Number.isFinite(Number(form.kmFin))
        ? Number(form.kmFin) - Number(form.kmIni)
        : null,


    tecnicos: form.tecnicos || [],
    materiales: form.materiales || [],

    tarea_pedida: form.tareaPedida || "",
    tarea_realizada: form.tareaRealizada || "",
    tarea_pendiente: form.tareaPendiente || "",

    luminaria_equipos: form.luminaria || "",

    // ✅ Evidencias (request)
    firma_tecnico_img: form.firmaTecnicoB64 || "",
    fotos_b64: Array.isArray(form.fotosB64) ? form.fotosB64.slice(0, MAX_FOTOS) : [],

    // ✅ Auditoría / Legal
    observaciones: form.observaciones || "",
    firma_tecnico: form.firmaTecnico || "",
    firma_supervisor: form.firmaSupervisor || "",

    // ✅ Modo impresión opcional
    print_mode: Boolean(form.printMode),
  };
}

export default function NuevaOT() {
  const navigate = useNavigate();

  const { guardarPendiente } = useOfflineQueue();

  const [form, setForm] = useState(initialForm);

  // autoguardado + clear
  const { clear: clearForm } = useFormStore("ot_form_cache", form, setForm, initialForm);



  // UI state
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ open: false, type: "info", message: "" });

  // Firma canvas
  const sigRef = useRef(null);
  const drawingRef = useRef(false);

  function showToast(type, message) {
    setToast({ open: true, type, message });
  }

  /* =======================================================
     VALIDACIÓN
  ======================================================== */

  function validarCampos() {
    if (!form.ubicacion.trim()) return "La ubicación es obligatoria.";
    if (!form.tablero.trim()) return "Debe seleccionar un tablero.";
    if (!form.vehiculo.trim()) return "Debe seleccionar un vehículo.";

    // km coherente (una sola vez)
    if (form.kmIni !== "" && form.kmFin !== "" && Number(form.kmFin) < Number(form.kmIni)) {
      return "El km final no puede ser menor que el inicial.";
    }

    // Auditoría mínima
    if (!form.firmaTecnico.trim()) return "Falta la aclaración (nombre) del técnico.";
    if (!form.firmaTecnicoB64) return "Falta la firma digital del técnico.";

    return null; // ✅ “no hay error”
  }
  // =========================
  // KM TOTAL (calculado)
  // =========================
  const kmIniNum = Number(form.kmIni);
  const kmFinNum = Number(form.kmFin);

  const kmTotal =
    form.kmIni !== "" &&
      form.kmFin !== "" &&
      Number.isFinite(kmIniNum) &&
      Number.isFinite(kmFinNum)
      ? kmFinNum - kmIniNum
      : null;



  /* =======================================================
     FIRMA (canvas)
  ======================================================== */
  function getPos(e, canvas) {
    const r = canvas.getBoundingClientRect();
    const t = e.touches?.[0];
    const x = (t ? t.clientX : e.clientX) - r.left;
    const y = (t ? t.clientY : e.clientY) - r.top;
    return { x, y };
  }

  function startDraw(e) {
    const canvas = sigRef.current;
    if (!canvas) return;
    drawingRef.current = true;

    const ctx = canvas.getContext("2d");
    const { x, y } = getPos(e, canvas);

    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111";

    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function moveDraw(e) {
    const canvas = sigRef.current;
    if (!canvas || !drawingRef.current) return;

    const ctx = canvas.getContext("2d");
    const { x, y } = getPos(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function endDraw() {
    drawingRef.current = false;
  }

  function limpiarFirma() {
    const canvas = sigRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setForm((p) => ({ ...p, firmaTecnicoB64: "" }));
  }

  function guardarFirma() {
    const canvas = sigRef.current;
    if (!canvas) return;
    // PNG -> base64
    const dataUrl = canvas.toDataURL("image/png");
    setForm((p) => ({ ...p, firmaTecnicoB64: dataUrl }));
    showToast("ok", "Firma digital capturada.");
  }

  /* =======================================================
     FOTOS (acumula hasta 4, comprimidas)
  ======================================================== */
  async function onAddFotos(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const cupo = MAX_FOTOS - (form.fotosB64?.length || 0);
    const take = files.slice(0, Math.max(0, cupo));

    if (!take.length) {
      showToast("warn", `Máximo ${MAX_FOTOS} fotos.`);
      e.target.value = "";
      return;
    }

    setLoading(true);
    try {
      const nuevas = [];
      for (const f of take) {
        const b64 = await fileToCompressedDataURL(f, 1280, 0.72);
        nuevas.push(b64);
      }

      setForm((prev) => ({
        ...prev,
        fotosB64: [...(prev.fotosB64 || []), ...nuevas].slice(0, MAX_FOTOS),
      }));

      showToast("ok", `Fotos cargadas: ${Math.min((form.fotosB64?.length || 0) + nuevas.length, MAX_FOTOS)}/${MAX_FOTOS}`);
    } catch (err) {
      console.warn(err);
      showToast("warn", "No se pudieron procesar las fotos.");
    } finally {
      setLoading(false);
      e.target.value = ""; // permite re-seleccionar la misma foto
    }
  }

  function borrarFoto(idx) {
    setForm((prev) => ({
      ...prev,
      fotosB64: (prev.fotosB64 || []).filter((_, i) => i !== idx),
    }));
  }

  /* =======================================================
     ENVÍO / PDF
  ======================================================== */
  async function generarPDF() {
    const error = validarCampos();
    if (error) {
      showToast("warn", error);
      return;
    }

    const payload = normalizarPayloadOT(form);

    // cache sugerencias
    saveCache("cache_tableros", form.tablero);
    saveCache("cache_vehiculos", form.vehiculo);

    setLoading(true);
    try {
      try {
        vibrar?.(30);
      } catch { }

      const blob = await enviarOT(payload);

      // descarga PDF
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `OT_${payload.fecha}_${payload.tablero}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      guardarHistorialOT(payload);
      clearForm();

      showToast("ok", "Orden generada correctamente. PDF descargado.");
    } catch (e) {
      console.warn("Fallo envío → guardando OT localmente", e);

      // 🚫 NO guardamos base64 (fotos/firma) en pendientes → rompe localStorage
      const payloadLiviano = { ...payload };
      delete payloadLiviano.firma_tecnico_img;
      delete payloadLiviano.fotos_b64;

      payloadLiviano.evidencias_pendientes = true;

      await guardarPendiente({ data: payloadLiviano });

      showToast(
        "warn",
        "Sin conexión o servidor no disponible. La OT se guardó para enviar más tarde (sin firma/fotos). Reintentar cuando haya señal."
      );
    } finally {
      setLoading(false);
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

      <label>Fecha</label>
      <input
        type="date"
        value={form.fecha}
        onChange={(e) => setForm({ ...form, fecha: e.target.value })}
      />

      <label>Ubicación</label>
      <input
        type="text"
        value={form.ubicacion}
        onChange={(e) => setForm({ ...form, ubicacion: e.target.value })}
      />

      {/* TABLERO — AUTOCOMPLETE PRO */}
      <label>Tablero</label>

      <TableroAutocomplete
        value={form.tablero} // ✅ mantiene sincronizado input ↔ state
        placeholder="Seleccionar tablero…"
        onSelect={(t) => {
          setForm((prev) => ({
            ...prev,
            tablero: t.nombre,
            zona: t.zona,
          }));
        }}
      />

      {/* ZONA visible (solo lectura) */}
      {form.zona && (
        <div className="muted" style={{ marginTop: 6 }}>
          Zona: {form.zona}
        </div>
      )}

      {/* Botón historial del tablero seleccionado */}
      {form.tablero && (
        <button
          type="button"
          className="btn-outline"
          style={{ marginTop: 8 }}
          onClick={() =>
            navigate(`/historial?tablero=${encodeURIComponent(form.tablero)}`)
          }
        >
          📜 Ver historial de este tablero
        </button>
      )}





      {/* ZONA (opcional, solo lectura) */}
      {form.zona && (
        <div className="muted" style={{ marginTop: 6 }}>
          Zona: {form.zona}
        </div>
      )}



      <label>Circuito</label>
      <input
        type="text"
        placeholder="FD1, Alum. exterior…"
        value={form.circuito}
        onChange={(e) => setForm({ ...form, circuito: e.target.value })}
      />

      <SmartSelect
        label="Vehículo"
        options={sugeridosVehiculos}
        value={form.vehiculo}
        onChange={(v) => setForm({ ...form, vehiculo: v })}
      />

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

      {kmTotal !== null && (
        <div className="card" style={{ marginTop: 10, padding: 12 }}>
          <div className="text-muted">Kilómetros recorridos</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>
            {kmTotal.toFixed(2)} km
          </div>
        </div>
      )}

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

      <label>Luminarias / Equipos</label>
      <input
        value={form.luminaria}
        onChange={(e) => setForm({ ...form, luminaria: e.target.value })}
      />

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
            placeholder="Unidad/Mtrs"
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

      <label>Observaciones</label>
      <textarea
        rows={3}
        value={form.observaciones}
        onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
      />

      <label>Aclaración firma técnico</label>
      <input
        value={form.firmaTecnico}
        onChange={(e) => setForm({ ...form, firmaTecnico: e.target.value })}
        placeholder="Nombre y apellido"
      />

      {/* Firma digital */}
      <label>Firma digital del técnico</label>
      <div className="card" style={{ padding: 12 }}>
        <canvas
          ref={sigRef}
          width={600}
          height={180}
          style={{
            width: "100%",
            height: 180,
            borderRadius: 12,
            background: "#fff",
            border: "1px solid rgba(148,163,184,.35)",
            touchAction: "none",
          }}
          onMouseDown={startDraw}
          onMouseMove={moveDraw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={(e) => {
            e.preventDefault();
            startDraw(e);
          }}
          onTouchMove={(e) => {
            e.preventDefault();
            moveDraw(e);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            endDraw();
          }}
        />

        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <button type="button" className="btn-add" onClick={guardarFirma}>
            💾 Guardar firma
          </button>
          <button type="button" className="btn-outline" onClick={limpiarFirma}>
            🧼 Limpiar
          </button>
        </div>

        {form.firmaTecnicoB64 && (
          <div style={{ marginTop: 10 }}>
            <div className="text-muted" style={{ marginBottom: 6 }}>
              Vista previa:
            </div>
            <img
              src={form.firmaTecnicoB64}
              alt="Firma técnico"
              style={{
                width: "100%",
                maxWidth: 520,
                borderRadius: 10,
                border: "1px solid rgba(148,163,184,.25)",
              }}
            />
          </div>
        )}
      </div>

      <label>Aclaración firma supervisor</label>
      <input
        value={form.firmaSupervisor}
        onChange={(e) => setForm({ ...form, firmaSupervisor: e.target.value })}
        placeholder="Nombre y apellido"
      />

      {/* Evidencias (Fotos) */}
      <h3 className="subtitulo">Evidencias (Fotos)</h3>

      <input
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        onChange={onAddFotos}
      />

      {(form.fotosB64?.length || 0) > 0 && (
        <>
          <div className="card" style={{ marginTop: 10 }}>
            <div className="text-muted" style={{ marginBottom: 8 }}>
              Adjuntas: {(form.fotosB64?.length || 0)}/{MAX_FOTOS} (comprimidas)
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {(form.fotosB64 || []).map((src, idx) => (
                <div key={idx} style={{ position: "relative" }}>
                  <img
                    src={src}
                    alt={`Foto ${idx + 1}`}
                    style={{
                      width: "100%",
                      borderRadius: 12,
                      border: "1px solid rgba(148,163,184,.25)",
                    }}
                  />
                  <button
                    type="button"
                    className="btn-x"
                    style={{ position: "absolute", top: 6, right: 6 }}
                    onClick={() => borrarFoto(idx)}
                    aria-label="Eliminar foto"
                    title="Eliminar foto"
                  >
                    ❌
                  </button>
                </div>
              ))}
            </div>
          </div>

          <p className="text-muted" style={{ marginTop: 8 }}>
            Máximo {MAX_FOTOS} fotos. Se comprimen automáticamente para no hacer pesado el PDF.
          </p>
        </>
      )}

      {/* Opción impresión */}
      <label style={{ marginTop: 14 }}>Modo impresión (B/N)</label>
      <select
        value={form.printMode ? "1" : "0"}
        onChange={(e) => setForm({ ...form, printMode: e.target.value === "1" })}
      >
        <option value="0">Pantalla premium</option>
        <option value="1">Impresión B/N</option>
      </select>

      <button className="btn-enviar" onClick={generarPDF} disabled={loading}>
        {loading ? "Generando…" : "📄 Generar PDF"}
      </button>

      <Toast
        open={toast.open}
        type={toast.type}
        message={toast.message}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      />
    </div>
  );
}
