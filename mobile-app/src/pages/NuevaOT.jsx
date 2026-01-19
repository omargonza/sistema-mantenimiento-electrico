// src/pages/NuevaOT.jsx
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";

import SmartSelect from "../components/SmartSelect";
import NumericInput from "../components/NumericInput";
import useOfflineQueue from "../hooks/useOfflineQueue";
import { enviarOT, tableroExists } from "../api";

import { vibrar } from "../utils/haptics";
import "../styles/app.css";
import useFormStore from "../hooks/useFormStore";
import Toast from "../components/Toast";
import TableroAutocomplete from "../components/TableroAutocomplete";

import { obtenerHistorial } from "../services/historialApi";
import { obtenerCircuitosFrecuentes } from "../services/circuitosApi";
import { saveOtPdf } from "../storage/ot_db";
import LuminariaFields from "../components/LuminariaFields";
import LuminariasChips from "../components/LuminariasChips";

/* =======================================================
   UTILIDADES: cache para autocompletado
======================================================= */
function saveCache(key, value) {
  if (!value) return;
  try {
    const list = JSON.parse(localStorage.getItem(key) || "[]");
    const updated = [value, ...list.filter((v) => v !== value)];
    localStorage.setItem(key, JSON.stringify(updated.slice(0, 10)));
  } catch {}
}

function loadCache(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

/* =======================================================
   HISTORIAL PREVIEW (liviano)
======================================================= */
const PREVIEW_LIMIT = 3;

function fmtDateISO(s) {
  return s ? String(s).slice(0, 10) : "";
}

function pickDescripcion(h) {
  return (
    h?.tarea_realizada?.trim() ||
    h?.tarea_pedida?.trim() ||
    h?.tarea_pendiente?.trim() ||
    h?.descripcion?.trim() ||
    "—"
  );
}

/* =======================================================
   IMG: compresión para que no pese (clave)
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
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  URL.revokeObjectURL(url);
  return canvas.toDataURL("image/jpeg", quality);
}

/* =======================================================
   LISTAS
======================================================= */
const VEHICULOS = [
  "AB101RS",
  "AE026TH",
  "AE026VN",
  "AF836WI",
  "AF078KP",
  "AH223LS",
  "AA801TV",
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
  observaciones: "",
  firmaTecnico: "",
  firmaSupervisor: "",
  firmaTecnicoB64: "",
  fotosB64: [],
  printMode: false,

  // Clasificación
  alcance: "LUMINARIA",
  resultado: "COMPLETO",
  estado_tablero: "",
  luminaria_estado: "",

  // Luminarias (mapa por ramal)
  ramal: "",
  km_luminaria: "",
  codigo_luminaria: "",
};

/* =======================================================
   HELPERS
======================================================= */
function canonTableroUI(s) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, " ");
}

function navigatePostOT(navigate, payload) {
  const alcanceUp = String(payload?.alcance || "").toUpperCase();

  if (alcanceUp === "LUMINARIA") {
    const q = payload?.ramal
      ? `?ramal=${encodeURIComponent(payload.ramal)}`
      : "";
    navigate(`/historial-luminarias${q}`);
  } else {
    navigate("/historial");
  }
}

/* =======================================================
   NORMALIZACIÓN PAYLOAD (SIN DUPLICADOS)
======================================================= */
function normalizarPayloadOT(form) {
  const tableroFinal = canonTableroUI(
    form.tablero ||
      (Array.isArray(form.tableros) ? form.tableros[0] : "") ||
      "",
  );

  const circuitoFinal =
    form.circuito ||
    (Array.isArray(form.circuitos)
      ? form.circuitos.join(", ")
      : form.circuitos) ||
    "";

  // Clasificación
  const alcanceRaw = String(form.alcance || "")
    .trim()
    .toUpperCase();
  const resultado = String(form.resultado || "COMPLETO")
    .trim()
    .toUpperCase();

  // Compat hacia atrás
  let alcance =
    alcanceRaw ||
    (String(form.luminaria || "").trim() ||
    String(form.luminaria_estado || "").trim()
      ? "LUMINARIA"
      : "TABLERO");

  // estado_tablero (solo TABLERO/CIRCUITO)
  const ESTADOS_TABLERO = new Set(["CRITICO", "PARCIAL", "OK"]);
  let estado_tablero = String(form.estado_tablero || "")
    .trim()
    .toUpperCase();

  if (!(alcance === "TABLERO" || alcance === "CIRCUITO")) {
    estado_tablero = "";
  } else if (!ESTADOS_TABLERO.has(estado_tablero)) {
    estado_tablero = "";
  }

  // luminaria_estado (solo LUMINARIA)
  const ESTADOS_LUM = new Set(["REPARADO", "APAGADO", "PENDIENTE"]);
  let luminaria_estado = String(form.luminaria_estado || "")
    .trim()
    .toUpperCase();

  if (alcance !== "LUMINARIA") {
    luminaria_estado = "";
  } else if (luminaria_estado && !ESTADOS_LUM.has(luminaria_estado)) {
    luminaria_estado = "";
  }

  // Compat: si es luminaria y hay tarea realizada, inferimos REPARADO
  if (
    alcance === "LUMINARIA" &&
    !luminaria_estado &&
    String(form.tareaRealizada || "").trim()
  ) {
    luminaria_estado = "REPARADO";
  }

  return {
    fecha: form.fecha,
    ubicacion: form.ubicacion || "",
    tablero: tableroFinal,
    zona: form.zona || "",
    circuito: circuitoFinal,
    vehiculo: form.vehiculo || "",
    km_inicial: form.kmIni === "" ? null : Number(form.kmIni),
    km_final: form.kmFin === "" ? null : Number(form.kmFin),

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

    firma_tecnico_img: form.firmaTecnicoB64 || "",
    fotos_b64: Array.isArray(form.fotosB64)
      ? form.fotosB64.slice(0, MAX_FOTOS)
      : [],

    observaciones: form.observaciones || "",
    firma_tecnico: form.firmaTecnico || "",
    firma_supervisor: form.firmaSupervisor || "",

    print_mode: Boolean(form.printMode),

    // Clasificación
    alcance,
    resultado,
    estado_tablero,
    luminaria_estado,

    // Luminarias (mapa)
    ramal: String(form.ramal || "").trim(),
    km_luminaria:
      form.km_luminaria === "" ||
      form.km_luminaria === null ||
      form.km_luminaria === undefined
        ? null
        : Number(form.km_luminaria),
    codigo_luminaria: String(form.codigo_luminaria || "").trim(),
  };
}

export default function NuevaOT() {
  const navigate = useNavigate();
  const { guardarPendiente } = useOfflineQueue();

  const [form, setForm] = useState(initialForm);

  const { clear: clearForm } = useFormStore(
    "ot_form_cache",
    form,
    setForm,
    initialForm,
  );

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({
    open: false,
    type: "info",
    message: "",
  });

  function showToast(type, message) {
    setToast({ open: true, type, message });
  }

  /* =======================================================
     Historial preview (liviano)
  ======================================================== */
  const tableroKey = useMemo(() => (form.tablero || "").trim(), [form.tablero]);

  const [histPreview, setHistPreview] = useState([]);
  const [histLoading, setHistLoading] = useState(false);

  const [tableroCatalogado, setTableroCatalogado] = useState(true);

  useEffect(() => {
    if (!tableroKey) {
      setHistPreview([]);
      return;
    }

    let alive = true;
    setHistLoading(true);

    obtenerHistorial(tableroKey, { page: 1, page_size: PREVIEW_LIMIT })
      .then((data) => {
        if (!alive) return;
        const rows = data?.results || data?.historial || [];
        setHistPreview(Array.isArray(rows) ? rows.slice(0, PREVIEW_LIMIT) : []);
      })
      .catch(() => {
        if (!alive) return;
        setHistPreview([]);
      })
      .finally(() => {
        if (!alive) return;
        setHistLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [tableroKey]);

  /* =======================================================
     Circuitos frecuentes (chips)
  ======================================================== */
  const [circuitosFreq, setCircuitosFreq] = useState([]);
  const [circuitosLoading, setCircuitosLoading] = useState(false);

  useEffect(() => {
    if (!tableroKey) {
      setCircuitosFreq([]);
      return;
    }

    let alive = true;
    setCircuitosLoading(true);

    obtenerCircuitosFrecuentes(tableroKey, { limit: 8 })
      .then((data) => {
        if (!alive) return;
        const items = Array.isArray(data?.items) ? data.items : [];
        setCircuitosFreq(items);
      })
      .catch(() => {
        if (!alive) return;
        setCircuitosFreq([]);
      })
      .finally(() => {
        if (!alive) return;
        setCircuitosLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [tableroKey]);

  /* =======================================================
     Exists tablero (debounce)
  ======================================================== */
  useEffect(() => {
    const nombre = (form.tablero || "").trim();
    if (!nombre || nombre.length < 2) {
      setTableroCatalogado(true);
      return;
    }

    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await tableroExists(nombre, { signal: controller.signal });
        setTableroCatalogado(Boolean(res?.exists));

        if (!res?.exists) {
          showToast(
            "warn",
            "Tablero NO está en catálogo. Se generará la OT igual, pero avisar al supervisor para cargarlo.",
          );
        }
      } catch (e) {
        if (e?.name === "AbortError") return;
        console.warn("tableroExists error:", e);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [form.tablero]);

  /* =======================================================
     VALIDACIÓN
  ======================================================== */
  function validarCampos() {
    // Mínimos operativos
    if (!String(form.tablero || "").trim())
      return "Debe seleccionar un tablero.";
    if (!String(form.vehiculo || "").trim())
      return "Debe seleccionar un vehículo.";

    // Al menos 1 técnico válido
    const tecnicos = Array.isArray(form.tecnicos) ? form.tecnicos : [];
    const tieneTecnico = tecnicos.some(
      (t) => String(t?.nombre || "").trim() || String(t?.legajo || "").trim(),
    );
    if (!tieneTecnico) return "Cargá al menos un técnico (nombre o legajo).";

    // KM coherentes
    if (
      form.kmIni !== "" &&
      form.kmFin !== "" &&
      Number.isFinite(Number(form.kmIni)) &&
      Number.isFinite(Number(form.kmFin)) &&
      Number(form.kmFin) < Number(form.kmIni)
    ) {
      return "El km final no puede ser menor que el inicial.";
    }

    // Firma
    if (!String(form.firmaTecnico || "").trim())
      return "Falta la aclaración (nombre) del técnico.";
    if (!form.firmaTecnicoB64) return "Falta la firma digital del técnico.";

    // Clasificación (negocio)
    const alcance = String(form.alcance || "LUMINARIA")
      .trim()
      .toUpperCase();
    const resultado = String(form.resultado || "COMPLETO")
      .trim()
      .toUpperCase();
    const estadoTab = String(form.estado_tablero || "")
      .trim()
      .toUpperCase();
    const lumEstado = String(form.luminaria_estado || "")
      .trim()
      .toUpperCase();

    const ESTADOS_TABLERO = new Set(["CRITICO", "PARCIAL", "OK"]);
    const ESTADOS_LUM = new Set(["REPARADO", "APAGADO", "PENDIENTE"]);

    const tareaRealizada = String(form.tareaRealizada || "").trim();
    const tareaPendiente = String(form.tareaPendiente || "").trim();

    if (resultado === "PARCIAL" && !tareaPendiente) {
      return "Si el resultado es PARCIAL, completá 'Tarea pendiente' (qué quedó faltando).";
    }
    if (resultado === "COMPLETO" && !tareaRealizada) {
      return "Si el resultado es COMPLETO, completá 'Tarea realizada' (qué se hizo).";
    }

    if (alcance === "LUMINARIA") {
      // Para mapa: pedimos Ramal + KM
      const ramal = String(form.ramal || "").trim();
      const kmLum = form.km_luminaria;

      if (!ramal) {
        return "En LUMINARIA, seleccioná el Ramal (esto alimenta el mapa de luminarias).";
      }

      if (
        kmLum === "" ||
        kmLum === null ||
        kmLum === undefined ||
        !Number.isFinite(Number(kmLum))
      ) {
        return "En LUMINARIA, completá el KM (ej: 41.05) para ubicar la reparación en el mapa.";
      }

      if (estadoTab) {
        return "En LUMINARIA no se marca 'Estado del tablero'. Cambiá a TABLERO/CIRCUITO si corresponde.";
      }

      const lumTexto = String(form.luminaria || "").trim();
      if (!lumEstado && !lumTexto && !tareaRealizada) {
        return "En LUMINARIA, indicá 'Estado luminaria' o completá 'Luminarias / Equipos' o 'Tarea realizada'.";
      }

      if (lumEstado && !ESTADOS_LUM.has(lumEstado)) {
        return "Estado luminaria inválido.";
      }
    }

    if (alcance === "CIRCUITO" || alcance === "TABLERO") {
      if (!estadoTab) {
        return "Si el alcance es TABLERO/CIRCUITO, elegí 'Estado del tablero' (Crítico/Parcial/OK).";
      }
      if (!ESTADOS_TABLERO.has(estadoTab)) {
        return "Estado del tablero inválido.";
      }

      if (alcance === "CIRCUITO" && !String(form.circuito || "").trim()) {
        return "Si el alcance es CIRCUITO, completá el campo 'Circuito'.";
      }

      if (estadoTab === "OK" && resultado === "PARCIAL") {
        return "No podés marcar tablero OK si el resultado fue PARCIAL. Poné PARCIAL o CRÍTICO.";
      }
    }

    if (alcance === "OTRO") {
      if (!tareaRealizada && !String(form.observaciones || "").trim()) {
        return "Si elegís OTRO, describí la tarea en 'Tarea realizada' u 'Observaciones'.";
      }
    }

    return null;
  }

  // KM TOTAL
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
  const sigRef = useRef(null);
  const drawingRef = useRef(false);

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
    const dataUrl = canvas.toDataURL("image/png");
    setForm((p) => ({ ...p, firmaTecnicoB64: dataUrl }));
    showToast("ok", "Firma digital capturada.");
  }

  /* =======================================================
     FOTOS
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

      showToast(
        "ok",
        `Fotos cargadas: ${Math.min(
          (form.fotosB64?.length || 0) + nuevas.length,
          MAX_FOTOS,
        )}/${MAX_FOTOS}`,
      );
    } catch (err) {
      console.warn(err);
      showToast("warn", "No se pudieron procesar las fotos.");
    } finally {
      setLoading(false);
      e.target.value = "";
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

    // Soft warnings
    const alcance = String(form.alcance || "LUMINARIA")
      .trim()
      .toUpperCase();
    const resultado = String(form.resultado || "COMPLETO")
      .trim()
      .toUpperCase();
    const estadoTablero = String(form.estado_tablero || "")
      .trim()
      .toUpperCase();
    const lumEstado = String(form.luminaria_estado || "")
      .trim()
      .toUpperCase();

    if (
      (alcance === "TABLERO" || alcance === "CIRCUITO") &&
      estadoTablero === "OK"
    ) {
      showToast(
        "warn",
        "Ojo: 'OK (verde)' usalo solo si el tablero quedó realmente en condición aceptable. Si fue un arreglo puntual, marcá 'PARCIAL (naranja)'.",
      );
    }

    if ((alcance === "TABLERO" || alcance === "CIRCUITO") && !estadoTablero) {
      showToast(
        "warn",
        "Falta 'Estado del tablero'. Elegí: Crítico / Parcial / OK. (Esto alimenta el semáforo del dashboard).",
      );
      return;
    }

    if (alcance === "LUMINARIA" && !lumEstado) {
      showToast(
        "info",
        "Tip: si elegís 'Estado luminaria' (Reparado / Apagado / Pendiente), el panel va a contar Luminarias OK y Pendientes automáticamente.",
      );
    }

    if (
      alcance === "LUMINARIA" &&
      resultado === "PARCIAL" &&
      !String(form.tareaPendiente || "").trim()
    ) {
      showToast(
        "warn",
        "Marcaste 'Parcial' pero no escribiste 'Tarea pendiente'. Si quedó algo por hacer, anotá qué faltó (material, falla, etc.).",
      );
    }

    const payload = normalizarPayloadOT(form);
    payload.tablero_catalogado = Boolean(tableroCatalogado);

    saveCache("cache_tableros", form.tablero);
    saveCache("cache_vehiculos", form.vehiculo);

    setLoading(true);
    try {
      try {
        vibrar?.(30);
      } catch {}

      const blob = await enviarOT(payload);

      // Guardado local best-effort
      try {
        await saveOtPdf(
          {
            ...payload,
            tecnico: payload?.tecnicos?.[0]?.nombre || "",
          },
          blob,
        );
      } catch (dbErr) {
        console.warn(
          "No se pudo guardar en IndexedDB (continúo igual):",
          dbErr,
        );
      }

      // Descarga PDF
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `OT_${payload.fecha}_${payload.tablero}.pdf`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);

      clearForm();
      showToast("ok", "Orden generada correctamente. PDF descargado.");

      // Navegación post OK
      navigatePostOT(navigate, payload);
    } catch (e) {
      console.warn("Fallo envío → guardando OT localmente", e);

      const payloadLiviano = { ...payload };
      delete payloadLiviano.firma_tecnico_img;
      delete payloadLiviano.fotos_b64;

      payloadLiviano.evidencias_pendientes = true;
      payloadLiviano._pending_at = new Date().toISOString();

      await guardarPendiente({ data: payloadLiviano });

      showToast(
        "warn",
        "Sin conexión o servidor no disponible. La OT se guardó para enviar más tarde (sin firma/fotos).",
      );

      // Navegación también cuando queda pendiente
      navigatePostOT(navigate, payloadLiviano);
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     AUTOCOMPLETADO
  ======================================================== */
  const sugeridosVehiculos = Array.from(
    new Set([...loadCache("cache_vehiculos"), ...VEHICULOS].filter(Boolean)),
  );

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
        placeholder="Ej: Poste 23 / KM 12.4 / Peaje / Referencia…"
        value={form.ubicacion}
        onChange={(e) => setForm({ ...form, ubicacion: e.target.value })}
      />

      <label>Zona</label>
      <input
        type="text"
        value={form.zona}
        onChange={(e) => setForm({ ...form, zona: e.target.value })}
      />

      <label>Tablero</label>
      <TableroAutocomplete
        value={form.tablero}
        placeholder="Buscar/seleccionar tablero…"
        limit={20}
        minChars={2}
        onChangeText={(v) => {
          setForm((prev) => ({ ...prev, tablero: v }));
        }}
        onSelect={(t) => {
          setForm((prev) => ({
            ...prev,
            tablero: t.nombre,
            zona: t.zona,
          }));
        }}
        onSubmit={(texto) => {
          setForm((prev) => ({
            ...prev,
            tablero: (texto || prev.tablero || "").trim(),
          }));
        }}
      />

      {form.tablero?.trim() && tableroCatalogado === false && (
        <div className="muted" style={{ marginTop: 6 }}>
          ⚠️ Tablero no catalogado. Genera OT igual, pero avisar supervisor.
        </div>
      )}

      {form.zona && (
        <div className="muted" style={{ marginTop: 6 }}>
          Zona: {form.zona}
        </div>
      )}

      {tableroKey && (
        <button
          type="button"
          className="btn-outline"
          style={{ marginTop: 8 }}
          onClick={() =>
            navigate(`/historial?tablero=${encodeURIComponent(tableroKey)}`)
          }
        >
          Ver historial de este tablero
        </button>
      )}

      {/* Preview historial */}
      {tableroKey && (
        <div className="card" style={{ marginTop: 10, padding: 12 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 800 }}>Últimos registros</div>

            <button
              type="button"
              className="btn-outline"
              onClick={() =>
                navigate(`/historial?tablero=${encodeURIComponent(tableroKey)}`)
              }
            >
              Ver completo
            </button>
          </div>

          {histLoading && (
            <div className="muted" style={{ marginTop: 8 }}>
              Cargando…
            </div>
          )}

          {!histLoading && histPreview.length === 0 && (
            <div className="muted" style={{ marginTop: 8 }}>
              Sin registros recientes.
            </div>
          )}

          {!histLoading && histPreview.length > 0 && (
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {histPreview.map((h, idx) => (
                <div
                  key={h.id ?? `${h.fecha}-${h.creado ?? ""}-${idx}`}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(148,163,184,.20)",
                    background: "rgba(2,6,23,.35)",
                  }}
                >
                  <div className="muted" style={{ fontSize: 12 }}>
                    {fmtDateISO(h.fecha)}
                    {h.circuito ? ` · ${h.circuito}` : ""}
                  </div>

                  <div style={{ marginTop: 6, lineHeight: 1.25 }}>
                    {pickDescripcion(h)}
                  </div>

                  {(h.tarea_pedida || h.tarea_pendiente) && (
                    <div
                      className="muted"
                      style={{ marginTop: 8, fontSize: 12 }}
                    >
                      {h.tarea_pedida ? (
                        <div>
                          <strong>Pedida:</strong> {h.tarea_pedida}
                        </div>
                      ) : null}
                      {h.tarea_pendiente ? (
                        <div>
                          <strong>Pendiente:</strong> {h.tarea_pendiente}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <label>Circuito</label>
      <input
        type="text"
        placeholder="FD1, Alum. exterior…"
        value={form.circuito}
        onChange={(e) => setForm({ ...form, circuito: e.target.value })}
      />

      {/* Chips: circuitos frecuentes del tablero */}
      {tableroKey && (
        <div style={{ marginTop: 8 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
            {circuitosLoading
              ? "Cargando circuitos frecuentes…"
              : circuitosFreq.length
                ? "Circuitos frecuentes:"
                : ""}
          </div>

          {(circuitosFreq.length > 0 || form.circuito?.trim()) && (
            <div className="chips">
              {circuitosFreq.length > 0 && (
                <button
                  type="button"
                  className={`chip ${!form.circuito?.trim() ? "chip--active" : ""}`}
                  onClick={() => setForm((prev) => ({ ...prev, circuito: "" }))}
                  title="Mostrar todos (sin circuito)"
                >
                  Todos
                </button>
              )}

              {circuitosFreq.map((c) => {
                const active = (form.circuito || "").trim() === c.circuito;

                return (
                  <button
                    key={c.circuito}
                    type="button"
                    className={`chip ${active ? "chip--active" : ""}`}
                    onClick={() =>
                      setForm((prev) => ({ ...prev, circuito: c.circuito }))
                    }
                    title={`Usar circuito (${c.n} registros)`}
                  >
                    {c.circuito}
                    <span className="chip-count">{c.n}</span>
                  </button>
                );
              })}

              {form.circuito?.trim() && (
                <button
                  type="button"
                  className="chip chip--danger"
                  onClick={() => setForm((prev) => ({ ...prev, circuito: "" }))}
                  title="Limpiar circuito"
                >
                  Limpiar
                </button>
              )}
            </div>
          )}
        </div>
      )}

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
                  i === idx ? { ...t, legajo: v } : t,
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
                  i === idx ? { ...t, nombre: e.target.value } : t,
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

      <h3 className="subtitulo">Clasificación</h3>

      <div className="hint">
        <strong>¿Qué estás haciendo hoy?</strong>
        <ul>
          <li>
            <b>Luminaria</b>: arreglás una luz puntual (NO evalúa el tablero)
          </li>
          <li>
            <b>Circuito / Tablero</b>: trabajo eléctrico del tablero
          </li>
        </ul>
        <small>
          ⚠️ Marcá <b>Estado del tablero</b> solo si realmente evaluaste su
          condición.
        </small>
      </div>

      <label>Alcance del trabajo</label>
      <select
        value={form.alcance || "LUMINARIA"}
        onChange={(e) => {
          const alcance = e.target.value;

          setForm((prev) => {
            let estado_tablero = prev.estado_tablero || "";

            if (alcance === "LUMINARIA") {
              estado_tablero = "";
            } else {
              if (!estado_tablero) estado_tablero = "PARCIAL";
            }

            return { ...prev, alcance, estado_tablero };
          });
        }}
      >
        <option value="LUMINARIA">Luminaria</option>
        <option value="CIRCUITO">Circuito</option>
        <option value="TABLERO">Tablero</option>
        <option value="OTRO">Otro</option>
      </select>

      <label>Resultado</label>
      <select
        value={form.resultado || "COMPLETO"}
        onChange={(e) =>
          setForm((prev) => ({ ...prev, resultado: e.target.value }))
        }
      >
        <option value="COMPLETO">Completo (se resolvió lo planificado)</option>
        <option value="PARCIAL">Parcial (quedó pendiente)</option>
      </select>

      {(form.alcance === "TABLERO" || form.alcance === "CIRCUITO") && (
        <>
          <label>Estado del tablero (semáforo)</label>
          <select
            value={form.estado_tablero || ""}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, estado_tablero: e.target.value }))
            }
          >
            <option value="CRITICO">Crítico (rojo)</option>
            <option value="PARCIAL">Parcial (naranja)</option>
            <option value="OK">OK (verde)</option>
          </select>

          <div className="muted" style={{ marginTop: 6 }}>
            Recomendación: “OK” solo si el tablero quedó realmente en condición
            aceptable.
          </div>
        </>
      )}

      {form.alcance === "LUMINARIA" && (
        <>
          <label>Estado luminaria (opcional)</label>
          <select
            value={form.luminaria_estado || ""}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, luminaria_estado: e.target.value }))
            }
          >
            <option value="">—</option>
            <option value="REPARADO">Reparado / encendido</option>
            <option value="APAGADO">Sigue apagado</option>
            <option value="PENDIENTE">Pendiente (falta material/otro)</option>
          </select>

          <LuminariaFields form={form} setForm={setForm} />
        </>
      )}

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

      {form.alcance === "LUMINARIA" && (
        <LuminariasChips
          valueText={form.luminaria}
          onChange={({ text }) =>
            setForm((prev) => ({
              ...prev,
              luminaria: text, // acá guardamos el string normalizado
            }))
          }
        />
      )}

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
                  i === idx ? { ...mat, material: e.target.value } : mat,
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
                  i === idx ? { ...mat, cant: v } : mat,
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
                  i === idx ? { ...mat, unidad: e.target.value } : mat,
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
            materiales: [
              ...form.materiales,
              { material: "", cant: "", unidad: "" },
            ],
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

      <label>Firma digital del técnico</label>
      <div className="card" style={{ padding: 12 }}>
        <canvas
          width={600}
          height={180}
          ref={sigRef}
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
              Adjuntas: {form.fotosB64?.length || 0}/{MAX_FOTOS} (comprimidas)
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
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
            Máximo {MAX_FOTOS} fotos. Se comprimen automáticamente para no hacer
            pesado el PDF.
          </p>
        </>
      )}

      <label style={{ marginTop: 14 }}>Modo impresión (B/N)</label>
      <select
        value={form.printMode ? "1" : "0"}
        onChange={(e) =>
          setForm({ ...form, printMode: e.target.value === "1" })
        }
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
