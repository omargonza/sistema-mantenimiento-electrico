// src/storage/ot_db.js
const DB_NAME = "ot_local_db";
const DB_VERSION = 2;

const STORE_OTS = "ots"; // metadata
const STORE_PDFS = "pdfs"; // blobs (pdf final)
const STORE_PHOTOS = "photos"; // blobs fotos por OT (opcional)

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      // ========= OTs =========
      if (!db.objectStoreNames.contains(STORE_OTS)) {
        const ots = db.createObjectStore(STORE_OTS, { keyPath: "id" });
        ots.createIndex("createdAt", "createdAt");
        ots.createIndex("fecha", "fecha");
        ots.createIndex("tableroLower", "tableroLower");
        ots.createIndex("favorito", "favorito");
      } else {
        const ots = req.transaction.objectStore(STORE_OTS);
        const ensureIndex = (name, keyPath) => {
          if (!ots.indexNames.contains(name)) ots.createIndex(name, keyPath);
        };
        ensureIndex("createdAt", "createdAt");
        ensureIndex("fecha", "fecha");
        ensureIndex("tableroLower", "tableroLower");
        ensureIndex("favorito", "favorito");
      }

      // ========= PDFs =========
      if (!db.objectStoreNames.contains(STORE_PDFS)) {
        db.createObjectStore(STORE_PDFS, { keyPath: "pdfId" });
      }

      // ========= PHOTOS =========
      // keyPath compuesto => una foto por índice dentro de la OT
      if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
        const photos = db.createObjectStore(STORE_PHOTOS, {
          keyPath: ["otId", "idx"],
        });
        photos.createIndex("otId", "otId");
        photos.createIndex("createdAt", "createdAt");
      } else {
        const photos = req.transaction.objectStore(STORE_PHOTOS);
        const ensureIndex = (name, keyPath) => {
          if (!photos.indexNames.contains(name))
            photos.createIndex(name, keyPath);
        };
        ensureIndex("otId", "otId");
        ensureIndex("createdAt", "createdAt");
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

/* =======================================================
   PHOTOS (blobs) — opcional
   - Se guardan por otId + idx
   - No afecta el PDF (el PDF ya puede incluirlas)
======================================================= */
export async function saveOtPhotos(otId, blobs = []) {
  const db = await openDb();
  const tx = db.transaction([STORE_PHOTOS], "readwrite");
  const store = tx.objectStore(STORE_PHOTOS);

  const now = Date.now();
  let saved = 0;

  blobs.forEach((blob, idx) => {
    if (!blob) return;
    store.put({
      otId: String(otId),
      idx,
      blob,
      createdAt: now,
      type: blob?.type || "image/jpeg",
      size: blob?.size || 0,
    });
    saved += 1;
  });

  await txDone(tx);
  db.close();
  return { otId: String(otId), saved };
}

export async function listOtPhotos(otId) {
  const db = await openDb();
  const tx = db.transaction([STORE_PHOTOS], "readonly");
  const store = tx.objectStore(STORE_PHOTOS);
  const idx = store.index("otId");

  const rows = await new Promise((resolve, reject) => {
    const req = idx.getAll(String(otId));
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });

  await txDone(tx);
  db.close();

  rows.sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0));
  return rows.map((x) => x.blob);
}

export async function deleteOtPhotos(otId) {
  const db = await openDb();
  const tx = db.transaction([STORE_PHOTOS], "readwrite");
  const store = tx.objectStore(STORE_PHOTOS);
  const idx = store.index("otId");

  const rows = await new Promise((resolve, reject) => {
    const req = idx.getAll(String(otId));
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });

  rows.forEach((r) => store.delete([String(otId), r.idx]));

  await txDone(tx);
  db.close();
  return { otId: String(otId), deleted: rows.length };
}

/** Limpieza global: borra fotos más viejas que X días */
export async function purgeOldMedia({ olderThanDays = 45 } = {}) {
  const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

  const db = await openDb();
  const tx = db.transaction([STORE_PHOTOS], "readwrite");
  const store = tx.objectStore(STORE_PHOTOS);
  const idx = store.index("createdAt");

  let deleted = 0;

  await new Promise((resolve, reject) => {
    const range = IDBKeyRange.upperBound(cutoff);
    const req = idx.openCursor(range);

    req.onsuccess = () => {
      const cur = req.result;
      if (!cur) return resolve();
      store.delete(cur.primaryKey);
      deleted += 1;
      cur.continue();
    };
    req.onerror = () => reject(req.error);
  });

  await txDone(tx);
  db.close();
  return { cutoff, deleted };
}

/* =======================================================
   OTs + PDF (flujo principal)
======================================================= */
export async function saveOtPdf(meta, pdfBlob) {
  const db = await openDb();

  const id = makeId();
  const pdfId = id;
  const createdAt = Date.now();

  const tecnicos = Array.isArray(meta?.tecnicos) ? meta.tecnicos : [];
  const materiales = Array.isArray(meta?.materiales) ? meta.materiales : [];

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

    // Semáforo / clasificación
    alcance: meta?.alcance || "",
    resultado: meta?.resultado || "",
    estado_tablero: meta?.estado_tablero || "",
    luminaria_estado: meta?.luminaria_estado || "",

    // Impresión
    print_mode: Boolean(meta?.print_mode),
  };

  const record = {
    id,
    pdfId,
    createdAt,

    // Campos “rápidos”
    fecha: detalle.fecha,
    tablero: detalle.tablero,
    tableroLower: String(detalle.tablero || "").toLowerCase(),
    ubicacion: detalle.ubicacion,
    zona: detalle.zona,
    tecnico: detalle.tecnicos?.[0]?.nombre || meta?.tecnico || "",
    vehiculo: detalle.vehiculo,

    // flags locales
    favorito: false,
    enviado: false,
    reimpreso: 0,

    tags: Array.isArray(meta?.tags) ? meta.tags : [],
    pdfBytes: pdfBlob?.size || 0,

    // Operativo completo
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
      `${ot.tablero} ${ot.zona} ${ot.ubicacion} ${ot.tecnico} ${ot.vehiculo} ${(ot.tags || []).join(" ")} ` +
      `${det.circuito || ""} ${det.luminaria_equipos || ""} ` +
      `${det.tarea_pedida || ""} ${det.tarea_realizada || ""} ${det.tarea_pendiente || ""} ` +
      `${det.observaciones || ""} ${tecs} ${mats}`.toLowerCase();

    return hay.includes(qn);
  });
}

export async function getOtById(otId) {
  const db = await openDb();
  const tx = db.transaction(STORE_OTS, "readonly");
  const store = tx.objectStore(STORE_OTS);

  const row = await new Promise((resolve, reject) => {
    const req = store.get(String(otId));
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });

  await txDone(tx);
  db.close();
  return row;
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
    const req = store.get(String(otId));
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
    const req = tx0.objectStore(STORE_OTS).get(String(otId));
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx0);

  // borro OT + pdf + fotos
  const tx = db.transaction([STORE_OTS, STORE_PDFS, STORE_PHOTOS], "readwrite");

  tx.objectStore(STORE_OTS).delete(String(otId));
  if (ot?.pdfId) tx.objectStore(STORE_PDFS).delete(ot.pdfId);

  // fotos asociadas
  const photosStore = tx.objectStore(STORE_PHOTOS);
  const idx = photosStore.index("otId");
  const rows = await new Promise((resolve, reject) => {
    const req = idx.getAll(String(otId));
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  rows.forEach((r) => photosStore.delete([String(otId), r.idx]));

  await txDone(tx);
  db.close();
}

export async function getOtWithPdf(otId) {
  const db = await openDb();

  const tx = db.transaction([STORE_OTS, STORE_PDFS], "readonly");
  const ots = tx.objectStore(STORE_OTS);
  const pdfs = tx.objectStore(STORE_PDFS);

  const ot = await new Promise((resolve, reject) => {
    const req = ots.get(String(otId));
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

/* =======================================================
   Migración: agrega campos operativos faltantes + tableroLower
======================================================= */
export async function migrateOtsOperationalFields() {
  const db = await openDb();
  const tx = db.transaction([STORE_OTS], "readwrite");
  const store = tx.objectStore(STORE_OTS);

  const all = await new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });

  const inferAlcance = (ot) => {
    const det = ot?.detalle || {};
    const hasLum =
      String(det?.luminaria_equipos || "").trim() ||
      String(det?.luminaria || "").trim() ||
      String(det?.luminaria_estado || "").trim() ||
      String(ot?.luminaria_estado || "").trim();
    return hasLum ? "LUMINARIA" : "TABLERO";
  };

  const inferResultado = (det) => {
    const raw = String(det?.resultado || "")
      .trim()
      .toUpperCase();
    if (raw) return raw;
    if (String(det?.tarea_pendiente || "").trim()) return "PARCIAL";
    return "COMPLETO";
  };

  const inferLuminariaEstado = (det) => {
    const raw = String(det?.luminaria_estado || "")
      .trim()
      .toUpperCase();
    if (raw) return raw;
    if (String(det?.tarea_realizada || "").trim()) return "REPARADO";
    if (
      String(det?.tarea_pedida || "").trim() ||
      String(det?.tarea_pendiente || "").trim()
    ) {
      return "PENDIENTE";
    }
    return "";
  };

  let updated = 0;

  for (const ot of all) {
    const det = ot?.detalle || {};

    const hasAll =
      det &&
      typeof det === "object" &&
      "alcance" in det &&
      "resultado" in det &&
      "estado_tablero" in det &&
      "luminaria_estado" in det;

    const needsTableroLower =
      typeof ot?.tableroLower !== "string" ||
      ot.tableroLower !== String(ot?.tablero || "").toLowerCase();

    if (hasAll && !needsTableroLower) continue;

    const next = { ...ot };
    const nextDet = { ...det };

    if (!String(nextDet.alcance || "").trim())
      nextDet.alcance = inferAlcance(ot);
    nextDet.alcance = String(nextDet.alcance || "")
      .trim()
      .toUpperCase();

    if (!String(nextDet.resultado || "").trim())
      nextDet.resultado = inferResultado(nextDet);
    nextDet.resultado = String(nextDet.resultado || "")
      .trim()
      .toUpperCase();

    if (!("estado_tablero" in nextDet)) nextDet.estado_tablero = "";
    nextDet.estado_tablero = String(nextDet.estado_tablero || "")
      .trim()
      .toUpperCase();

    if (nextDet.alcance === "LUMINARIA") {
      if (!String(nextDet.luminaria_estado || "").trim()) {
        nextDet.luminaria_estado = inferLuminariaEstado(nextDet);
      }
      nextDet.luminaria_estado = String(nextDet.luminaria_estado || "")
        .trim()
        .toUpperCase();
    } else {
      nextDet.luminaria_estado = "";
    }

    next.detalle = nextDet;
    next.tableroLower = String(next?.tablero || "").toLowerCase();

    store.put(next);
    updated += 1;
  }

  await txDone(tx);
  db.close();

  return { scanned: all.length, updated };
}
