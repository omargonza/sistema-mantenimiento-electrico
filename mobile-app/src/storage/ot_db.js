// src/storage/ot_db.js
const DB_NAME = "ot_local_db";
const DB_VERSION = 4;

const STORE_OTS = "ots"; // metadata
const STORE_PDFS = "pdfs"; // blobs (pdf final)
const STORE_PHOTOS = "photos"; // blobs fotos por OT (opcional)

// Ventana de deduplicación:
// si entra la misma OT en este rango, se actualiza el mismo registro
// en vez de crear otro nuevo.
const DEDUPE_WINDOW_MS = 2 * 60 * 1000; // 2 minutos

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
        ots.createIndex("dedupeKey", "dedupeKey");
        ots.createIndex("clientRequestId", "clientRequestId");
      } else {
        const ots = req.transaction.objectStore(STORE_OTS);
        const ensureIndex = (name, keyPath) => {
          if (!ots.indexNames.contains(name)) ots.createIndex(name, keyPath);
        };
        ensureIndex("createdAt", "createdAt");
        ensureIndex("fecha", "fecha");
        ensureIndex("tableroLower", "tableroLower");
        ensureIndex("favorito", "favorito");
        ensureIndex("dedupeKey", "dedupeKey");
        ensureIndex("clientRequestId", "clientRequestId");
      }

      // ========= PDFs =========
      if (!db.objectStoreNames.contains(STORE_PDFS)) {
        db.createObjectStore(STORE_PDFS, { keyPath: "pdfId" });
      }

      // ========= PHOTOS =========
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

function normText(v) {
  return String(v || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function stableJson(value) {
  return JSON.stringify(value);
}

// Hash simple y estable para deduplicación local.
// No busca seguridad criptográfica, busca consistencia.
function hashString(input) {
  let h = 2166136261;

  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }

  return (h >>> 0).toString(16);
}

function buildDedupePayload(meta) {
  const tecnicos = Array.isArray(meta?.tecnicos)
    ? meta.tecnicos.map((t) => ({
        legajo: normText(t?.legajo),
        nombre: normText(t?.nombre),
      }))
    : [];

  const materiales = Array.isArray(meta?.materiales)
    ? meta.materiales.map((m) => ({
        material: normText(m?.material),
        cant: String(m?.cant ?? "").trim(),
        unidad: normText(m?.unidad),
      }))
    : [];

  const luminariasPorTablero = Array.isArray(meta?.luminarias_por_tablero)
    ? meta.luminarias_por_tablero.map((g) => ({
        tablero: normText(g?.tablero),
        zona: normText(g?.zona),
        circuito: normText(g?.circuito),
        ramal: normText(g?.ramal),
        resultado: normText(g?.resultado),
        luminaria_estado: normText(g?.luminaria_estado),
        tarea_pedida: normText(g?.tarea_pedida),
        tarea_realizada: normText(g?.tarea_realizada),
        tarea_pendiente: normText(g?.tarea_pendiente),
        observaciones: normText(g?.observaciones),
        items: Array.isArray(g?.items)
          ? g.items.map((it) => ({
              codigo_luminaria: normText(it?.codigo_luminaria),
              sentido: normText(it?.sentido),
            }))
          : [],
      }))
    : [];

  return {
    fecha: String(meta?.fecha || "").trim(),
    ubicacion: normText(meta?.ubicacion),
    tablero: normText(meta?.tablero),
    zona: normText(meta?.zona),
    circuito: normText(meta?.circuito),
    vehiculo: normText(meta?.vehiculo),

    km_inicial: meta?.km_inicial ?? null,
    km_final: meta?.km_final ?? null,
    km_total: meta?.km_total ?? null,

    tarea_pedida: normText(meta?.tarea_pedida),
    tarea_realizada: normText(meta?.tarea_realizada),
    tarea_pendiente: normText(meta?.tarea_pendiente),

    observaciones: normText(meta?.observaciones),
    firma_tecnico: normText(meta?.firma_tecnico),
    firma_supervisor: normText(meta?.firma_supervisor),

    alcance: normText(meta?.alcance),
    resultado: normText(meta?.resultado),
    estado_tablero: normText(meta?.estado_tablero),
    luminaria_estado: normText(meta?.luminaria_estado),

    print_mode: Boolean(meta?.print_mode),

    tecnicos,
    materiales,
    luminarias_por_tablero: luminariasPorTablero,
  };
}

// CAMBIO CLAVE:
// dedupeKey SIEMPRE representa fingerprint funcional.
// clientRequestId va por otro carril, como índice separado.
function buildDedupeKey(meta) {
  const fp = buildDedupePayload(meta);
  return `fp:${hashString(stableJson(fp))}`;
}

function sortNewestFirst(rows = []) {
  return [...rows].sort(
    (a, b) =>
      (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0),
  );
}

async function findExistingByDedupeKey(store, dedupeKey) {
  if (!store.indexNames.contains("dedupeKey")) return null;

  const idx = store.index("dedupeKey");

  const rows = await new Promise((resolve, reject) => {
    const req = idx.getAll(dedupeKey);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });

  if (!rows.length) return null;
  return sortNewestFirst(rows)[0] || null;
}

async function findExistingByClientRequestId(store, clientRequestId) {
  const value = String(clientRequestId || "").trim();
  if (!value) return null;
  if (!store.indexNames.contains("clientRequestId")) return null;

  const idx = store.index("clientRequestId");

  const rows = await new Promise((resolve, reject) => {
    const req = idx.getAll(value);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });

  if (!rows.length) return null;
  return sortNewestFirst(rows)[0] || null;
}

/* =======================================================
   PHOTOS (blobs) — opcional
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
   ENTERPRISE:
   - clientRequestId como idempotencia fuerte
   - dedupeKey como fingerprint funcional
   - upsert inteligente
======================================================= */
export async function saveOtPdf(meta, pdfBlob) {
  const db = await openDb();
  const now = Date.now();

  const clientRequestId = String(meta?.client_request_id || "").trim();
  const dedupeKey = buildDedupeKey(meta);

  const tecnicos = Array.isArray(meta?.tecnicos) ? meta.tecnicos : [];
  const materiales = Array.isArray(meta?.materiales) ? meta.materiales : [];

  const detalle = {
    fecha: meta?.fecha || new Date().toISOString().slice(0, 10),
    ubicacion: meta?.ubicacion || "",
    zona: meta?.zona || "",
    tablero: meta?.tablero || "",
    circuito: meta?.circuito || "",
    vehiculo: meta?.vehiculo || "",

    km_inicial: meta?.km_inicial ?? null,
    km_final: meta?.km_final ?? null,
    km_total: meta?.km_total ?? null,

    luminaria_equipos: meta?.luminaria_equipos || "",
    tarea_pedida: meta?.tarea_pedida || "",
    tarea_realizada: meta?.tarea_realizada || "",
    tarea_pendiente: meta?.tarea_pendiente || "",

    tecnicos: tecnicos.map((t) => ({
      legajo: t?.legajo ?? "",
      nombre: t?.nombre ?? "",
    })),
    materiales: materiales.map((m) => ({
      material: m?.material ?? "",
      cant: m?.cant ?? "",
      unidad: m?.unidad ?? "",
    })),

    observaciones: meta?.observaciones || "",
    firma_tecnico: meta?.firma_tecnico || "",
    firma_supervisor: meta?.firma_supervisor || "",

    tiene_firma: Boolean(meta?.firma_tecnico_img),
    fotos_count: Array.isArray(meta?.fotos_b64) ? meta.fotos_b64.length : 0,

    alcance: meta?.alcance || "",
    resultado: meta?.resultado || "",
    estado_tablero: meta?.estado_tablero || "",
    luminaria_estado: meta?.luminaria_estado || "",

    print_mode: Boolean(meta?.print_mode),
  };

  const tx = db.transaction([STORE_OTS, STORE_PDFS], "readwrite");
  const otsStore = tx.objectStore(STORE_OTS);
  const pdfStore = tx.objectStore(STORE_PDFS);

  // Primero buscamos por idempotencia fuerte (request de cliente)
  const existingByRequest = await findExistingByClientRequestId(
    otsStore,
    clientRequestId,
  );

  // Si no aparece por requestId, buscamos por fingerprint
  const existingByFingerprint = await findExistingByDedupeKey(
    otsStore,
    dedupeKey,
  );

  const existing = existingByRequest || existingByFingerprint || null;

  const isSameClientRequest = Boolean(
    existing &&
    clientRequestId &&
    String(existing.clientRequestId || "") === clientRequestId,
  );

  const isSameRecentFingerprint = Boolean(
    existing &&
    String(existing.dedupeKey || "") === dedupeKey &&
    now - Number(existing.updatedAt || existing.createdAt || 0) <=
      DEDUPE_WINDOW_MS,
  );

  // Política:
  // 1) mismo clientRequestId => misma operación sí o sí
  // 2) si no hay requestId, o no hubo match por requestId, y la huella coincide
  //    dentro de la ventana => upsert
  const shouldUpsert = Boolean(
    existing &&
    (isSameClientRequest ||
      (!clientRequestId && isSameRecentFingerprint) ||
      (clientRequestId && !existingByRequest && isSameRecentFingerprint)),
  );

  const id = shouldUpsert ? String(existing.id) : makeId();
  const pdfId = shouldUpsert ? String(existing.pdfId || existing.id) : id;
  const createdAt = shouldUpsert ? Number(existing.createdAt || now) : now;

  const record = {
    id,
    pdfId,
    createdAt,
    updatedAt: now,

    // trazabilidad
    clientRequestId: clientRequestId || "",
    dedupeKey,

    // campos rápidos
    fecha: detalle.fecha,
    tablero: detalle.tablero,
    tableroLower: String(detalle.tablero || "").toLowerCase(),
    ubicacion: detalle.ubicacion,
    zona: detalle.zona,
    tecnico: detalle.tecnicos?.[0]?.nombre || meta?.tecnico || "",
    vehiculo: detalle.vehiculo,

    // flags locales: si ya existía, se preservan
    favorito: shouldUpsert ? Boolean(existing.favorito) : false,
    enviado: shouldUpsert ? Boolean(existing.enviado) : false,
    reimpreso: shouldUpsert ? Number(existing.reimpreso || 0) : 0,

    // tags
    tags: Array.isArray(meta?.tags)
      ? meta.tags
      : shouldUpsert
        ? Array.isArray(existing.tags)
          ? existing.tags
          : []
        : [],

    pdfBytes: pdfBlob?.size || 0,

    // payload operativo
    detalle,
  };

  otsStore.put(record);
  pdfStore.put({
    pdfId,
    blob: pdfBlob,
    updatedAt: now,
    size: pdfBlob?.size || 0,
    type: pdfBlob?.type || "application/pdf",
  });

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

  all.sort(
    (a, b) =>
      (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0),
  );
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
    const req = store.get(String(pdfId));
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

  const next = { ...current, ...patch, updatedAt: Date.now() };
  store.put(next);

  await txDone(tx);
  db.close();
  return next;
}

export async function deleteOt(otId) {
  const db = await openDb();

  const tx0 = db.transaction(STORE_OTS, "readonly");
  const ot = await new Promise((resolve, reject) => {
    const req = tx0.objectStore(STORE_OTS).get(String(otId));
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx0);

  const tx = db.transaction([STORE_OTS, STORE_PDFS, STORE_PHOTOS], "readwrite");

  tx.objectStore(STORE_OTS).delete(String(otId));
  if (ot?.pdfId) tx.objectStore(STORE_PDFS).delete(String(ot.pdfId));

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
    const req = pdfs.get(String(ot.pdfId || ot.id));
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });

  await txDone(tx);
  db.close();

  return { ot, blob: row?.blob || null };
}

/* =======================================================
   Migración: agrega campos operativos faltantes + tableroLower + dedupeKey + clientRequestId
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

    const needsDedupeKey =
      typeof ot?.dedupeKey !== "string" ||
      !ot.dedupeKey.trim() ||
      String(ot.dedupeKey).startsWith("req:");

    const needsClientRequestId = typeof ot?.clientRequestId !== "string";

    if (
      hasAll &&
      !needsTableroLower &&
      !needsDedupeKey &&
      !needsClientRequestId
    ) {
      continue;
    }

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
    next.updatedAt = next.updatedAt || next.createdAt || Date.now();
    next.clientRequestId = String(next.clientRequestId || "").trim();

    if (needsDedupeKey) {
      next.dedupeKey = buildDedupeKey({
        fecha: nextDet.fecha || next.fecha,
        ubicacion: nextDet.ubicacion || next.ubicacion,
        tablero: nextDet.tablero || next.tablero,
        zona: nextDet.zona || next.zona,
        circuito: nextDet.circuito || next.circuito,
        vehiculo: nextDet.vehiculo || next.vehiculo,
        km_inicial: nextDet.km_inicial,
        km_final: nextDet.km_final,
        km_total: nextDet.km_total,
        tarea_pedida: nextDet.tarea_pedida,
        tarea_realizada: nextDet.tarea_realizada,
        tarea_pendiente: nextDet.tarea_pendiente,
        observaciones: nextDet.observaciones,
        firma_tecnico: nextDet.firma_tecnico,
        firma_supervisor: nextDet.firma_supervisor,
        alcance: nextDet.alcance,
        resultado: nextDet.resultado,
        estado_tablero: nextDet.estado_tablero,
        luminaria_estado: nextDet.luminaria_estado,
        print_mode: nextDet.print_mode,
        tecnicos: nextDet.tecnicos,
        materiales: nextDet.materiales,
      });
    }

    store.put(next);
    updated += 1;
  }

  await txDone(tx);
  db.close();

  return { scanned: all.length, updated };
}
