// src/storage/ot_db.js
const DB_NAME = "ot_local_db";
const DB_VERSION = 1;

const STORE_OTS = "ots";   // metadata
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
export async function saveOtPdf(meta, pdfBlob) {
  const db = await openDb();

  const id = makeId();
  const pdfId = id;
  const createdAt = Date.now();

  const record = {
    id,
    pdfId,

    fecha: meta?.fecha || new Date().toISOString().slice(0, 10),
    tablero: meta?.tablero || "",
    tableroLower: String(meta?.tablero || "").toLowerCase(),
    ubicacion: meta?.ubicacion || "",
    zona: meta?.zona || "",
    tecnico: meta?.tecnico || "",
    vehiculo: meta?.vehiculo || "",

    // flags locales “pro técnico”
    favorito: false,
    enviado: false,
    reimpreso: 0,
    tags: Array.isArray(meta?.tags) ? meta.tags : [],

    // métrica liviana
    pdfBytes: pdfBlob?.size || 0,
    createdAt,
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

export async function queryOts({ q = "", desde = "", hasta = "", favorito = null } = {}) {
  const all = await listOts();
  const qn = String(q || "").trim().toLowerCase();
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

    const hay =
      `${ot.tablero} ${ot.zona} ${ot.ubicacion} ${ot.tecnico} ${ot.vehiculo} ${(ot.tags || []).join(" ")}`.toLowerCase();

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
