// src/storage/ot_db.js
const DB_NAME = "ot_local_db";
const DB_VERSION = 1;

const STORE_OTS = "ots"; // metadata
const STORE_PDFS = "pdfs"; // blobs

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains(STORE_OTS)) {
        const ots = db.createObjectStore(STORE_OTS, { keyPath: "id" });
        ots.createIndex("createdAt", "createdAt");
        ots.createIndex("fecha", "fecha");
        ots.createIndex("tableroLower", "tableroLower");
        ots.createIndex("favorito", "favorito");
      }

      if (!db.objectStoreNames.contains(STORE_PDFS)) {
        db.createObjectStore(STORE_PDFS, { keyPath: "pdfId" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));
  });
}

function makeId() {
  const t = Date.now();
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `${t}_${Math.random().toString(16).slice(2)}`;
}

// Guarda metadata + blob (PDF real)
// Guarda metadata + blob (PDF real)
export async function saveOtPdf(meta, pdfBlob) {
  const db = await openDb();

  const id = makeId();
  const pdfId = id;
  const createdAt = Date.now();

  // Normalización defensiva
  const tecnicos = Array.isArray(meta?.tecnicos) ? meta.tecnicos : [];
  const materiales = Array.isArray(meta?.materiales) ? meta.materiales : [];

  // Importante: NO guardamos base64 pesados acá (firma imagen / fotos)
  // porque el PDF ya es el respaldo final.
  const detalle = {
    // Identidad operativa
    fecha: meta?.fecha || new Date().toISOString().slice(0, 10),
    ubicacion: meta?.ubicacion || "",
    zona: meta?.zona || "",
    tablero: meta?.tablero || "",
    circuito: meta?.circuito || "",
    vehiculo: meta?.vehiculo || "",

    // Recorrido
    km_inicial: meta?.km_inicial ?? null,
    km_final: meta?.km_final ?? null,
    km_total: meta?.km_total ?? null,

    // Operación
    luminaria_equipos: meta?.luminaria_equipos || "",
    tarea_pedida: meta?.tarea_pedida || "",
    tarea_realizada: meta?.tarea_realizada || "",
    tarea_pendiente: meta?.tarea_pendiente || "",

    // RRHH / materiales
    tecnicos: tecnicos.map((t) => ({
      legajo: t?.legajo ?? "",
      nombre: t?.nombre ?? "",
    })),
    materiales: materiales.map((m) => ({
      material: m?.material ?? "",
      cant: m?.cant ?? "",
      unidad: m?.unidad ?? "",
    })),

    // Auditoría (texto)
    observaciones: meta?.observaciones || "",
    firma_tecnico: meta?.firma_tecnico || "",
    firma_supervisor: meta?.firma_supervisor || "",

    // Señales de evidencia (sin base64)
    tiene_firma: Boolean(meta?.firma_tecnico_img),
    fotos_count: Array.isArray(meta?.fotos_b64) ? meta.fotos_b64.length : 0,

    // Impresión
    print_mode: Boolean(meta?.print_mode),
  };

  const record = {
    id,
    pdfId,
    createdAt,

    // Campos “rápidos” para Dashboard / búsquedas
    fecha: detalle.fecha,
    tablero: detalle.tablero,
    tableroLower: String(detalle.tablero || "").toLowerCase(),
    ubicacion: detalle.ubicacion,
    zona: detalle.zona,
    tecnico: detalle.tecnicos?.[0]?.nombre || meta?.tecnico || "",
    vehiculo: detalle.vehiculo,

    // flags locales “pro técnico”
    favorito: false,
    enviado: false,
    reimpreso: 0,

    // tags opcional
    tags: Array.isArray(meta?.tags) ? meta.tags : [],

    // métrica liviana
    pdfBytes: pdfBlob?.size || 0,

    // ✅ TODO lo “operativo” queda acá
    detalle,
  };

  const tx = db.transaction([STORE_OTS, STORE_PDFS], "readwrite");
  tx.objectStore(STORE_OTS).put(record);
  tx.objectStore(STORE_PDFS).put({ pdfId, blob: pdfBlob });

  await txDone(tx);
  db.close();

  return record;
}

export async function listOts() {
  const db = await openDb();
  const tx = db.transaction(STORE_OTS, "readonly");
  const store = tx.objectStore(STORE_OTS);

  const all = await new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });

  await txDone(tx);
  db.close();

  all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return all;
}

export async function queryOts({
  q = "",
  desde = "",
  hasta = "",
  favorito = null,
} = {}) {
  const all = await listOts();
  const qn = String(q || "")
    .trim()
    .toLowerCase();
  const hasQ = qn.length > 0;

  const inRange = (fecha) => {
    if (!fecha) return true;
    if (desde && fecha < desde) return false;
    if (hasta && fecha > hasta) return false;
    return true;
  };

  return all.filter((ot) => {
    if (!inRange(ot.fecha)) return false;
    if (favorito === true && !ot.favorito) return false;
    if (favorito === false && ot.favorito) return false;

    if (!hasQ) return true;

    const det = ot.detalle || {};
    const tecs = Array.isArray(det.tecnicos)
      ? det.tecnicos.map((t) => `${t.legajo} ${t.nombre}`).join(" ")
      : "";
    const mats = Array.isArray(det.materiales)
      ? det.materiales
          .map((m) => `${m.material} ${m.cant} ${m.unidad}`)
          .join(" ")
      : "";

    const hay =
      `${ot.tablero} ${ot.zona} ${ot.ubicacion} ${ot.tecnico} ${ot.vehiculo} ${(
        ot.tags || []
      ).join(" ")} ` +
      `${det.circuito || ""} ${det.luminaria_equipos || ""} ` +
      `${det.tarea_pedida || ""} ${det.tarea_realizada || ""} ${
        det.tarea_pendiente || ""
      } ` +
      `${det.observaciones || ""} ${tecs} ${mats}`.toLowerCase();

    return hay.includes(qn);
  });
}

export async function getPdfBlob(pdfId) {
  const db = await openDb();
  const tx = db.transaction(STORE_PDFS, "readonly");
  const store = tx.objectStore(STORE_PDFS);

  const row = await new Promise((resolve, reject) => {
    const req = store.get(pdfId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });

  await txDone(tx);
  db.close();

  return row?.blob || null;
}

export async function setFlags(otId, patch) {
  const db = await openDb();
  const tx = db.transaction(STORE_OTS, "readwrite");
  const store = tx.objectStore(STORE_OTS);

  const current = await new Promise((resolve, reject) => {
    const req = store.get(otId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });

  if (!current) {
    tx.abort();
    db.close();
    throw new Error("OT no encontrada");
  }

  const next = { ...current, ...patch };
  store.put(next);

  await txDone(tx);
  db.close();
  return next;
}

export async function deleteOt(otId) {
  const db = await openDb();

  // leo pdfId
  const tx0 = db.transaction(STORE_OTS, "readonly");
  const ot = await new Promise((resolve, reject) => {
    const req = tx0.objectStore(STORE_OTS).get(otId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx0);

  const tx = db.transaction([STORE_OTS, STORE_PDFS], "readwrite");
  tx.objectStore(STORE_OTS).delete(otId);
  if (ot?.pdfId) tx.objectStore(STORE_PDFS).delete(ot.pdfId);

  await txDone(tx);
  db.close();
}

export async function getOtById(otId) {
  const db = await openDb();
  const tx = db.transaction(STORE_OTS, "readonly");
  const store = tx.objectStore(STORE_OTS);

  const row = await new Promise((resolve, reject) => {
    const req = store.get(otId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });

  await txDone(tx);
  db.close();

  return row; // metadata o null
}

// Opcional PRO: metadata + pdf blob en una sola función
export async function getOtWithPdf(otId) {
  const db = await openDb();

  const tx = db.transaction([STORE_OTS, STORE_PDFS], "readonly");
  const ots = tx.objectStore(STORE_OTS);
  const pdfs = tx.objectStore(STORE_PDFS);

  const ot = await new Promise((resolve, reject) => {
    const req = ots.get(otId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });

  if (!ot) {
    await txDone(tx);
    db.close();
    return { ot: null, blob: null };
  }

  const row = await new Promise((resolve, reject) => {
    const req = pdfs.get(ot.pdfId || ot.id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });

  await txDone(tx);
  db.close();

  return { ot, blob: row?.blob || null };
}
