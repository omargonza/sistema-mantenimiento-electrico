// src/pages/NuevaOT.jsx
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";

import SmartSelect from "../components/SmartSelect";
import NumericInput from "../components/NumericInput";
import useOfflineQueue from "../hooks/useOfflineQueue";
import { enviarOT, tableroExists } from "../api";

import { vibrar } from "../utils/haptics";
import "../styles/app.css";
import "../styles/nuevaOt.css";
import useFormStore from "../hooks/useFormStore";
import Toast from "../components/Toast";
import TableroAutocomplete from "../components/TableroAutocomplete";

import { obtenerHistorial } from "../services/historialApi";
import { obtenerCircuitosFrecuentes } from "../services/circuitosApi";

import { saveOtPdf, saveOtPhotos, purgeOldMedia } from "../storage/ot_db";
import LuminariaGrupoTableroBlock from "../components/LuminariaGrupoTableroBlock";

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
   IMG: utilidades robustas (Blob/File/dataURL)
======================================================= */
function isDataURL(v) {
  return typeof v === "string" && v.startsWith("data:");
}

function dataURLToBlob(dataUrl) {
  const [head, b64] = String(dataUrl).split(",");
  const mime =
    (head.match(/data:(.*?);base64/) || [])[1] || "application/octet-stream";
  const bin = atob(b64 || "");
  const u8 = new Uint8Array(bin.length);

  for (let i = 0; i < bin.length; i++) {
    u8[i] = bin.charCodeAt(i);
  }

  return new Blob([u8], { type: mime });
}

async function blobToDataURL(input) {
  if (!input) return "";
  if (isDataURL(input)) return input;

  if (!(input instanceof Blob)) {
    console.warn("blobToDataURL recibió no-Blob:", input);
    return "";
  }

  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(r.error || new Error("FileReader error"));
    r.readAsDataURL(input);
  });
}

/* =======================================================
   IMG: compresión + compat (Android + iPhone HEIC)
======================================================= */
async function photoToJpegBlob(input, { maxSide = 1600, quality = 0.82 } = {}) {
  if (!input) return null;

  let src = input;

  if (isDataURL(src)) {
    src = dataURLToBlob(src);
  }

  if (src && typeof src === "object" && "blob" in src && src.blob) {
    src = src.blob;
  }

  if (!(src instanceof Blob)) {
    console.warn("photoToJpegBlob recibió no-Blob:", src);
    return null;
  }

  const type = String(src.type || "").toLowerCase();

  if (type.includes("heic") || type.includes("heif")) {
    try {
      const { default: heic2any } = await import("heic2any");
      const conv = await heic2any({ blob: src, toType: "image/jpeg", quality });
      src = Array.isArray(conv) ? conv[0] : conv;
    } catch (e) {
      console.warn("No se pudo convertir HEIC/HEIF:", e);
      return null;
    }
  }

  const url = URL.createObjectURL(src);

  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });

    const w0 = img.naturalWidth || img.width;
    const h0 = img.naturalHeight || img.height;
    const scale = Math.min(1, maxSide / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return null;

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const out = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/jpeg",
        quality,
      );
    });

    return out;
  } catch (e) {
    console.warn("photoToJpegBlob error:", e);
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function fileToCompressedBlob(file, maxW = 1280, quality = 0.72) {
  return photoToJpegBlob(file, { maxSide: maxW, quality });
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
  fotos: [],
  printMode: false,
  alcance: "LUMINARIA",
  resultado: "COMPLETO",
  estado_tablero: "",
  luminaria_estado: "",
  ramal: "",
  km_luminaria: "",
  codigo_luminaria: "",
  luminariasPorTablero: [
    {
      uid: crypto.randomUUID(),
      tablero_id: null,
      tablero: "",
      tablero_confirmado: false,
      zona: "",
      circuito: "",
      ramal: "",
      resultado: "COMPLETO",
      luminaria_estado: "",
      tarea_pedida: "",
      tarea_realizada: "",
      tarea_pendiente: "",
      observaciones: "",
      items: [],
    },
  ],
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
    const ramal =
      payload?.ramal || payload?.luminarias_por_tablero?.[0]?.ramal || "";
    const q = ramal ? `?ramal=${encodeURIComponent(ramal)}` : "";
    navigate(`/historial-luminarias${q}`);
  } else {
    navigate("/historial");
  }
}

function extraerCodigosLuminaria(texto) {
  const s = String(texto || "").toUpperCase();
  const matches = s.match(/\b[A-Z]{1,4}[\s-]?\d{3,6}\b/g) || [];
  const norm = matches
    .map((m) => m.replace(/\s+/g, "").replace("-", ""))
    .filter(Boolean);

  const seen = new Set();
  const out = [];

  for (const c of norm) {
    if (!seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  }

  return out;
}

function emptyLuminariaGrupo() {
  return {
    uid: crypto.randomUUID(),
    tablero_id: null,
    tablero: "",
    tablero_confirmado: false,
    zona: "",
    circuito: "",
    ramal: "",
    resultado: "COMPLETO",
    luminaria_estado: "",
    tarea_pedida: "",
    tarea_realizada: "",
    tarea_pendiente: "",
    observaciones: "",
    items: [],
  };
}

function normalizeCode(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function uniqCodes(list) {
  const out = [];
  const seen = new Set();

  for (const x of list || []) {
    const c = normalizeCode(x);
    if (!c) continue;
    if (seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }

  return out;
}

/* =======================================================
   NORMALIZACIÓN PAYLOAD
======================================================= */
function normalizarPayloadOT(form) {
  const alcance = String(form.alcance || "LUMINARIA")
    .trim()
    .toUpperCase();
  const esLum = alcance === "LUMINARIA";

  const ESTADOS_TABLERO = new Set(["CRITICO", "PARCIAL", "OK"]);
  const ESTADOS_LUM = new Set(["REPARADO", "APAGADO", "PENDIENTE"]);

  let estado_tablero = String(form.estado_tablero || "")
    .trim()
    .toUpperCase();
  if (!["TABLERO", "CIRCUITO"].includes(alcance)) {
    estado_tablero = "";
  } else if (!ESTADOS_TABLERO.has(estado_tablero)) {
    estado_tablero = "";
  }

  const luminarias_por_tablero = esLum
    ? (form.luminariasPorTablero || [])
        .map((g) => ({
          tablero_id: g.tablero_id || null,
          tablero: canonTableroUI(g.tablero || ""),
          tablero_confirmado: Boolean(g.tablero_confirmado),
          zona: g.zona || "",
          circuito: g.circuito || "",
          ramal: g.ramal || "",
          resultado: String(g.resultado || "COMPLETO")
            .trim()
            .toUpperCase(),
          luminaria_estado: ESTADOS_LUM.has(
            String(g.luminaria_estado || "")
              .trim()
              .toUpperCase(),
          )
            ? String(g.luminaria_estado || "")
                .trim()
                .toUpperCase()
            : "",
          tarea_pedida: g.tarea_pedida || "",
          tarea_realizada: g.tarea_realizada || "",
          tarea_pendiente: g.tarea_pendiente || "",
          observaciones: g.observaciones || "",
          items: (g.items || [])
            .map((it, j) => ({
              orden: j,
              codigo_luminaria: String(it.codigo_luminaria || "")
                .trim()
                .toUpperCase(),
              km_luminaria:
                it.km_luminaria === "" ||
                it.km_luminaria === null ||
                it.km_luminaria === undefined
                  ? null
                  : Number(it.km_luminaria),
            }))
            .filter((it) => it.codigo_luminaria),
        }))
        .filter(
          (g) =>
            g.tablero_confirmado &&
            String(g.tablero || "").trim() &&
            String(g.ramal || "").trim() &&
            Array.isArray(g.items) &&
            g.items.length > 0,
        )
    : [];

  const primerGrupoLum =
    esLum && luminarias_por_tablero.length ? luminarias_por_tablero[0] : null;

  const resultadoFinal = esLum
    ? String(primerGrupoLum?.resultado || "COMPLETO")
        .trim()
        .toUpperCase()
    : String(form.resultado || "COMPLETO")
        .trim()
        .toUpperCase();

  const luminariaEstadoFinal = esLum
    ? String(primerGrupoLum?.luminaria_estado || "")
        .trim()
        .toUpperCase()
    : String(form.luminaria_estado || "")
        .trim()
        .toUpperCase();

  const tableroFinal = esLum
    ? canonTableroUI(primerGrupoLum?.tablero || "")
    : canonTableroUI(form.tablero || "");

  const zonaFinal = esLum ? primerGrupoLum?.zona || "" : form.zona || "";
  const circuitoFinal = esLum
    ? primerGrupoLum?.circuito || ""
    : form.circuito || "";
  const ramalFinal = esLum
    ? String(primerGrupoLum?.ramal || "").trim()
    : String(form.ramal || "").trim();

  const tareaPedidaFinal = esLum
    ? primerGrupoLum?.tarea_pedida || ""
    : form.tareaPedida || "";

  const tareaRealizadaFinal = esLum
    ? primerGrupoLum?.tarea_realizada || ""
    : form.tareaRealizada || "";

  const tareaPendienteFinal = esLum
    ? primerGrupoLum?.tarea_pendiente || ""
    : form.tareaPendiente || "";

  const observacionesFinal = esLum
    ? primerGrupoLum?.observaciones || ""
    : form.observaciones || "";

  const codigos_luminarias = esLum
    ? extraerCodigosLuminaria(form.luminaria)
    : [];

  const codigoPrincipal = esLum
    ? String(form.codigo_luminaria || "").trim() || codigos_luminarias[0] || ""
    : "";

  const codigoPrincipalCapped = codigoPrincipal.slice(0, 30);

  const km_luminaria = esLum
    ? form.km_luminaria === "" ||
      form.km_luminaria === null ||
      form.km_luminaria === undefined
      ? null
      : Number(form.km_luminaria)
    : null;

  const luminaria_equipos = esLum ? form.luminaria || "" : "";

  return {
    fecha: form.fecha,
    ubicacion: form.ubicacion || "",
    tablero: tableroFinal,
    zona: zonaFinal,
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
    tarea_pedida: tareaPedidaFinal,
    tarea_realizada: tareaRealizadaFinal,
    tarea_pendiente: tareaPendienteFinal,
    firma_tecnico_img: form.firmaTecnicoB64 || "",
    fotos_b64: Array.isArray(form.fotosB64)
      ? form.fotosB64.slice(0, MAX_FOTOS)
      : [],
    observaciones: observacionesFinal,
    firma_tecnico: form.firmaTecnico || "",
    firma_supervisor: form.firmaSupervisor || "",
    print_mode: Boolean(form.printMode),
    alcance,
    resultado: resultadoFinal,
    estado_tablero,
    luminaria_estado: esLum ? luminariaEstadoFinal : "",
    ramal: ramalFinal,
    km_luminaria: esLum && luminarias_por_tablero.length ? null : km_luminaria,
    codigo_luminaria:
      esLum && luminarias_por_tablero.length ? "" : codigoPrincipalCapped,
    codigos_luminarias:
      esLum && luminarias_por_tablero.length ? [] : codigos_luminarias,
    luminaria_equipos:
      esLum && luminarias_por_tablero.length ? "" : luminaria_equipos,
    luminarias_por_tablero,
  };
}

export default function NuevaOT() {
  const navigate = useNavigate();
  const { guardarPendiente } = useOfflineQueue();

  const [form, setForm] = useState(initialForm);

  const formCacheSafe = useMemo(
    () => ({
      ...form,
      fotos: [],
    }),
    [form],
  );

  const { clear: clearForm } = useFormStore(
    "ot_form_cache",
    formCacheSafe,
    setForm,
    initialForm,
  );

  useEffect(() => {
    setForm((prev) => {
      const fotosOk = (prev.fotos || []).filter(
        (it) => it?.blob instanceof Blob,
      );
      if (fotosOk.length !== (prev.fotos || []).length) {
        return { ...prev, fotos: fotosOk };
      }
      return prev;
    });
  }, []);

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({
    open: false,
    type: "info",
    message: "",
  });

  function showToast(type, message) {
    setToast({ open: true, type, message });
  }

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

  useEffect(() => {
    if (form.alcance === "LUMINARIA") {
      setTableroCatalogado(true);
      return;
    }

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
  }, [form.tablero, form.alcance]);

  function validarCampos() {
    const alcance = String(form.alcance || "LUMINARIA")
      .trim()
      .toUpperCase();

    if (!String(form.vehiculo || "").trim()) {
      return "Debe seleccionar un vehículo.";
    }

    const tecnicos = Array.isArray(form.tecnicos) ? form.tecnicos : [];
    const tieneTecnico = tecnicos.some(
      (t) => String(t?.nombre || "").trim() || String(t?.legajo || "").trim(),
    );

    if (!tieneTecnico) {
      return "Cargá al menos un técnico (nombre o legajo).";
    }

    if (
      form.kmIni !== "" &&
      form.kmFin !== "" &&
      Number.isFinite(Number(form.kmIni)) &&
      Number.isFinite(Number(form.kmFin)) &&
      Number(form.kmFin) < Number(form.kmIni)
    ) {
      return "El km final no puede ser menor que el inicial.";
    }

    if (!String(form.firmaTecnico || "").trim()) {
      return "Falta la aclaración (nombre) del técnico.";
    }

    if (!form.firmaTecnicoB64) {
      return "Falta la firma digital del técnico.";
    }

    const ESTADOS_TABLERO = new Set(["CRITICO", "PARCIAL", "OK"]);
    const ESTADOS_LUM = new Set(["REPARADO", "APAGADO", "PENDIENTE"]);

    if (alcance === "LUMINARIA") {
      const grupos = form.luminariasPorTablero || [];

      if (!grupos.length) {
        return "Agregá al menos un tablero trabajado.";
      }

      for (let i = 0; i < grupos.length; i++) {
        const g = grupos[i];
        const resultadoGrupo = String(g.resultado || "COMPLETO")
          .trim()
          .toUpperCase();
        const tareaRealizadaGrupo = String(g.tarea_realizada || "").trim();
        const tareaPendienteGrupo = String(g.tarea_pendiente || "").trim();

        if (!String(g.tablero || "").trim() || !g.tablero_confirmado) {
          return `Grupo ${i + 1}: seleccioná un tablero del catálogo.`;
        }

        if (!String(g.ramal || "").trim()) {
          return `Grupo ${i + 1}: seleccioná el ramal.`;
        }

        if (!Array.isArray(g.items) || g.items.length === 0) {
          return `Grupo ${i + 1}: cargá al menos una luminaria.`;
        }

        if (
          g.luminaria_estado &&
          !ESTADOS_LUM.has(String(g.luminaria_estado).trim().toUpperCase())
        ) {
          return `Grupo ${i + 1}: estado de luminaria inválido.`;
        }

        if (resultadoGrupo === "COMPLETO" && !tareaRealizadaGrupo) {
          return `Grupo ${i + 1}: si el resultado es COMPLETO, completá 'Tarea realizada'.`;
        }

        if (resultadoGrupo === "PARCIAL" && !tareaPendienteGrupo) {
          return `Grupo ${i + 1}: si el resultado es PARCIAL, completá 'Tarea pendiente'.`;
        }
      }

      return null;
    }

    if (!String(form.tablero || "").trim()) {
      return "Debe seleccionar un tablero.";
    }

    const resultado = String(form.resultado || "COMPLETO")
      .trim()
      .toUpperCase();
    const estadoTablero = String(form.estado_tablero || "")
      .trim()
      .toUpperCase();
    const tareaRealizada = String(form.tareaRealizada || "").trim();
    const tareaPendiente = String(form.tareaPendiente || "").trim();

    if (resultado === "PARCIAL" && !tareaPendiente) {
      return "Si el resultado es PARCIAL, completá 'Tarea pendiente'.";
    }

    if (resultado === "COMPLETO" && !tareaRealizada) {
      return "Si el resultado es COMPLETO, completá 'Tarea realizada'.";
    }

    if (alcance === "CIRCUITO" || alcance === "TABLERO") {
      if (!estadoTablero) {
        return "Si el alcance es TABLERO/CIRCUITO, elegí 'Estado del tablero'.";
      }

      if (!ESTADOS_TABLERO.has(estadoTablero)) {
        return "Estado del tablero inválido.";
      }

      if (alcance === "CIRCUITO" && !String(form.circuito || "").trim()) {
        return "Si el alcance es CIRCUITO, completá el campo 'Circuito'.";
      }

      if (estadoTablero === "OK" && resultado === "PARCIAL") {
        return "No podés marcar tablero OK si el resultado fue PARCIAL.";
      }
    }

    if (alcance === "OTRO") {
      if (!tareaRealizada && !String(form.observaciones || "").trim()) {
        return "Si elegís OTRO, describí la tarea en 'Tarea realizada' u 'Observaciones'.";
      }
    }

    return null;
  }

  const kmIniNum = Number(form.kmIni);
  const kmFinNum = Number(form.kmFin);
  const kmTotal =
    form.kmIni !== "" &&
    form.kmFin !== "" &&
    Number.isFinite(kmIniNum) &&
    Number.isFinite(kmFinNum)
      ? kmFinNum - kmIniNum
      : null;

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
    if (!ctx) return;

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
    if (!ctx) return;

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
    if (!ctx) return;

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

  async function onAddFotos(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const prevCount = form.fotos?.length || 0;
    const cupo = MAX_FOTOS - prevCount;
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
        const blob = await fileToCompressedBlob(f, 1280, 0.72);

        if (!(blob instanceof Blob)) {
          console.warn("Foto descartada: no se pudo convertir a Blob", f);
          continue;
        }

        const url = URL.createObjectURL(blob);
        nuevas.push({ blob, url, bytes: blob.size || 0 });
      }

      if (!nuevas.length) {
        showToast(
          "warn",
          "No se pudieron procesar las fotos (formato no soportado).",
        );
        return;
      }

      setForm((prev) => ({
        ...prev,
        fotos: [...(prev.fotos || []), ...nuevas].slice(0, MAX_FOTOS),
      }));

      showToast(
        "ok",
        `Fotos cargadas: ${Math.min(prevCount + nuevas.length, MAX_FOTOS)}/${MAX_FOTOS}`,
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
    setForm((prev) => {
      const list = prev.fotos || [];
      const item = list[idx];

      if (item?.url) {
        URL.revokeObjectURL(item.url);
      }

      return {
        ...prev,
        fotos: list.filter((_, i) => i !== idx),
      };
    });
  }

  function updateLuminariaGrupo(index, patch) {
    setForm((prev) => ({
      ...prev,
      luminariasPorTablero: prev.luminariasPorTablero.map((g, i) =>
        i === index ? { ...g, ...patch } : g,
      ),
    }));
  }

  function addLuminariaGrupo() {
    setForm((prev) => ({
      ...prev,
      luminariasPorTablero: [
        ...(prev.luminariasPorTablero || []),
        emptyLuminariaGrupo(),
      ],
    }));
  }

  function removeLuminariaGrupo(index) {
    setForm((prev) => {
      const next = (prev.luminariasPorTablero || []).filter(
        (_, i) => i !== index,
      );

      return {
        ...prev,
        luminariasPorTablero: next.length ? next : [emptyLuminariaGrupo()],
      };
    });
  }

  function updateLuminariaGrupoItems(index, list) {
    setForm((prev) => ({
      ...prev,
      luminariasPorTablero: prev.luminariasPorTablero.map((g, i) =>
        i === index
          ? {
              ...g,
              items: uniqCodes(list).map((codigo) => ({
                codigo_luminaria: codigo,
                km_luminaria: null,
              })),
            }
          : g,
      ),
    }));
  }

  async function generarPDF() {
    const error = validarCampos();

    if (error) {
      showToast("warn", error);
      return;
    }

    const alcance = String(form.alcance || "LUMINARIA")
      .trim()
      .toUpperCase();
    const estadoTablero = String(form.estado_tablero || "")
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
        "Falta 'Estado del tablero'. Elegí: Crítico / Parcial / OK.",
      );
      return;
    }

    const payload = normalizarPayloadOT(form);
    payload.tablero_catalogado =
      alcance === "LUMINARIA" ? true : Boolean(tableroCatalogado);

    const fotosB64 = await Promise.all(
      (form.fotos || []).map(async (it, idx) => {
        const b = it?.blob ?? it;
        if (!b) return null;

        let jpeg = await photoToJpegBlob(b, {
          maxSide: 1600,
          quality: 0.82,
        });

        if (!jpeg) return null;

        let dataUrl = await blobToDataURL(jpeg);

        if (dataUrl && dataUrl.length > 1_800_000) {
          const jpeg2 = await photoToJpegBlob(b, {
            maxSide: 1280,
            quality: 0.72,
          });
          dataUrl = jpeg2 ? await blobToDataURL(jpeg2) : dataUrl;
        }

        console.log(
          `[foto ${idx}] in=${b.type || "?"} ${(b.size ? b.size / 1024 / 1024 : 0).toFixed(1)}MB -> b64=${dataUrl?.length}`,
        );

        return dataUrl || null;
      }),
    );

    payload.fotos_b64 = fotosB64.filter(Boolean).slice(0, MAX_FOTOS);

    const tableroCacheValue =
      alcance === "LUMINARIA"
        ? form.luminariasPorTablero?.[0]?.tablero || ""
        : form.tablero;

    saveCache("cache_tableros", tableroCacheValue);
    saveCache("cache_vehiculos", form.vehiculo);

    setLoading(true);

    try {
      try {
        vibrar?.(30);
      } catch {}

      console.log("payload normalizado:", payload);
      console.log("fotos_b64 count:", payload.fotos_b64?.length);

      const blob = await enviarOT(payload);

      try {
        const record = await saveOtPdf(
          {
            ...payload,
            tecnico: payload?.tecnicos?.[0]?.nombre || "",
          },
          blob,
        );

        try {
          const blobs = (form.fotos || []).map((x) => x.blob).filter(Boolean);

          if (blobs.length) {
            await saveOtPhotos(record.id, blobs);
          }

          purgeOldMedia({ olderThanDays: 45 }).catch(() => {});
        } catch (e) {
          console.warn("No se pudieron guardar fotos en IndexedDB:", e);
        }
      } catch (dbErr) {
        console.warn(
          "No se pudo guardar en IndexedDB (continúo igual):",
          dbErr,
        );
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `OT_${payload.fecha}_${payload.tablero || "LUMINARIAS"}.pdf`;
      anchor.click();

      setTimeout(() => URL.revokeObjectURL(url), 30000);

      try {
        (form.fotos || []).forEach((it) => {
          if (it?.url) URL.revokeObjectURL(it.url);
        });
      } catch {}

      clearForm();
      showToast("ok", "Orden generada correctamente. PDF descargado.");
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
      navigatePostOT(navigate, payloadLiviano);
    } finally {
      setLoading(false);
    }
  }

  const sugeridosVehiculos = Array.from(
    new Set([...loadCache("cache_vehiculos"), ...VEHICULOS].filter(Boolean)),
  );

  return (
    <div className="page op-mode">
      <h2 className="titulo">Nueva Orden de Trabajo</h2>

      <label>Fecha</label>
      <input
        type="date"
        value={form.fecha}
        onChange={(e) => setForm({ ...form, fecha: e.target.value })}
      />

      <label>Ubicación/Referencia</label>
      <input
        type="text"
        placeholder="Ej: Poste 23 / KM 12.4 / Peaje / Referencia…"
        value={form.ubicacion}
        onChange={(e) => setForm({ ...form, ubicacion: e.target.value })}
      />

      {form.alcance !== "LUMINARIA" ? (
        <>
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
                    navigate(
                      `/historial?tablero=${encodeURIComponent(tableroKey)}`,
                    )
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
                      onClick={() =>
                        setForm((prev) => ({ ...prev, circuito: "" }))
                      }
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
                      onClick={() =>
                        setForm((prev) => ({ ...prev, circuito: "" }))
                      }
                      title="Limpiar circuito"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="card" style={{ marginTop: 10, padding: 12 }}>
          <div className="muted">
            En <b>LUMINARIA</b>, el tablero, zona, circuito, ramal, resultado,
            estado y tareas se cargan dentro de cada grupo.
          </div>
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
            <b>Luminaria</b>: arreglás luces agrupadas por tablero
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
          const alcanceSel = e.target.value;

          setForm((prev) => {
            let estado_tablero = prev.estado_tablero || "";
            const esLum = alcanceSel === "LUMINARIA";

            if (esLum) {
              estado_tablero = "";
            } else if (!estado_tablero) {
              estado_tablero = "PARCIAL";
            }

            return {
              ...prev,
              alcance: alcanceSel,
              estado_tablero,
              ...(esLum
                ? {
                    luminariasPorTablero:
                      prev.luminariasPorTablero?.length > 0
                        ? prev.luminariasPorTablero
                        : [emptyLuminariaGrupo()],
                  }
                : {
                    ramal: "",
                    km_luminaria: "",
                    codigo_luminaria: "",
                    luminaria_estado: "",
                    luminaria: "",
                    luminariasPorTablero: [],
                  }),
            };
          });
        }}
      >
        <option value="LUMINARIA">Luminaria</option>
        <option value="CIRCUITO">Circuito</option>
        <option value="TABLERO">Tablero</option>
        <option value="OTRO">Otro</option>
      </select>

      {form.alcance !== "LUMINARIA" && (
        <>
          <label>Resultado</label>
          <select
            value={form.resultado || "COMPLETO"}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, resultado: e.target.value }))
            }
          >
            <option value="COMPLETO">
              Completo (se resolvió lo planificado)
            </option>
            <option value="PARCIAL">Parcial (quedó pendiente)</option>
          </select>
        </>
      )}

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
        <div className="card" style={{ marginTop: 12, padding: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>
            Luminarias por tablero
          </div>

          <div className="muted" style={{ marginBottom: 10 }}>
            Primero elegí el tablero, después cargá todas las luminarias
            reparadas de ese tablero. Resultado, estado y tareas se completan
            por grupo.
          </div>

          {(form.luminariasPorTablero || []).map((grupo, index) => (
            <LuminariaGrupoTableroBlock
              key={grupo.uid}
              grupo={grupo}
              index={index}
              onChange={updateLuminariaGrupo}
              onRemove={removeLuminariaGrupo}
              onItemsChange={updateLuminariaGrupoItems}
            />
          ))}

          <button
            type="button"
            className="btn-add"
            style={{ marginTop: 12 }}
            onClick={addLuminariaGrupo}
          >
            + Agregar tablero trabajado
          </button>
        </div>
      )}

      {form.alcance !== "LUMINARIA" && (
        <>
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
            onChange={(e) =>
              setForm({ ...form, tareaRealizada: e.target.value })
            }
          />

          <label>Tarea pendiente</label>
          <textarea
            rows={3}
            value={form.tareaPendiente}
            onChange={(e) =>
              setForm({ ...form, tareaPendiente: e.target.value })
            }
          />
        </>
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

      {form.alcance !== "LUMINARIA" && (
        <>
          <label>Observaciones</label>
          <textarea
            rows={3}
            value={form.observaciones}
            onChange={(e) =>
              setForm({ ...form, observaciones: e.target.value })
            }
          />
        </>
      )}

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
          onTouchStart={startDraw}
          onTouchMove={moveDraw}
          onTouchEnd={endDraw}
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

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <label className="btn-outline" style={{ cursor: "pointer" }}>
          📸 Cámara
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            hidden
            onChange={onAddFotos}
          />
        </label>

        <label className="btn-outline" style={{ cursor: "pointer" }}>
          🖼️ Galería
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={onAddFotos}
          />
        </label>
      </div>

      {(form.fotos?.length || 0) > 0 && (
        <>
          <div className="card" style={{ marginTop: 10 }}>
            <div className="text-muted" style={{ marginBottom: 8 }}>
              Adjuntas: {form.fotos?.length || 0}/{MAX_FOTOS} (blobs
              comprimidos)
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              {(form.fotos || []).map((it, idx) => (
                <div key={idx} style={{ position: "relative" }}>
                  <img
                    src={it.url}
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
            Máximo {MAX_FOTOS} fotos. Se comprimen automáticamente para no
            explotar memoria.
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
