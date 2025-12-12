// ==========================================================
//  CONFIGURACIÓN DE API (DEV/PROD) — ROBUSTA Y AUTOMÁTICA
// ==========================================================

const isProd = import.meta.env.MODE === "production";

export const API =
  import.meta.env.VITE_BACKEND_URL ||
  (isProd
    ? "https://orden-mant.onrender.com"
    : "http://127.0.0.1:8000");

// ==========================================================
//  UTILIDAD: TIMEOUT PARA EVITAR FETCH COLGADO
// ==========================================================

function fetchWithTimeout(url, options = {}, timeout = 10000) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), timeout)
    ),
  ]);
}

// ==========================================================
//  UTILIDAD: REINTENTOS AUTOMÁTICOS (EXPONENTIAL BACKOFF)
// ==========================================================

async function fetchRetry(url, options, retries = 3) {
  try {
    return await fetchWithTimeout(url, options);
  } catch (err) {
    if (retries <= 0) throw err;

    const delay = 500 * Math.pow(2, 3 - retries); // 500 → 1000 → 2000 ms
    console.warn(`Retry en ${delay}ms…`);

    await new Promise((res) => setTimeout(res, delay));
    return fetchRetry(url, options, retries - 1);
  }
}

// ==========================================================
//  ENVÍO DE ORDEN — GENERA PDF
// ==========================================================
export async function enviarOT(payload, silent = false) {
  console.log(">>> PAYLOAD ENVIADO AL BACKEND:", JSON.stringify(payload, null, 2));

  if (!navigator.onLine) {
    if (!silent) console.warn("Sin conexión → No puedo enviar OT");
    const e = new Error("offline");
    e.status = 0;
    throw e;
  }

  try {
    const res = await fetchRetry(`${API}/api/ordenes/pdf/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // ✅ Si falla, armar Error con status REAL
    if (!res.ok) {
      let bodyText = "";
      try {
        bodyText = await res.text();
      } catch {}

      const e = new Error(`Backend respondió ${res.status}`);
      e.status = res.status;          // ✅ clave para cortar loop
      e.body = bodyText;              // opcional: ver detalle
      if (!silent) console.error("❌", e.message, bodyText);
      throw e;
    }

    return await res.blob(); // ✅ PDF listo
  } catch (err) {
    if (!silent) console.error("Error enviando OT:", err?.message || err);
    throw err; // ✅ relanzar manteniendo status
  }
}

// ==========================================================
//  SINCRONIZACIÓN DE ORDENES PENDIENTES — BACKGROUND SAFE
// ==========================================================

export async function syncPendientes(lista, silent = true) {
  if (!navigator.onLine) {
    if (!silent) console.warn("Sin conexión → No puedo sincronizar");
    throw new Error("offline");
  }

  try {
    const res = await fetchRetry(`${API}/api/ordenes/sync/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ordenes: lista }),
    });

    if (!res.ok) {
      const msg = `Error sincronizando (HTTP ${res.status})`;
      if (!silent) console.error(msg);
      throw new Error(msg);
    }

    return await res.json();
  } catch (err) {
    if (!silent) console.error("Sync error:", err.message);
    throw err;
  }
}
