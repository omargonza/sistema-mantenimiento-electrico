import { useEffect, useState } from "react";
import { openDB } from "idb";
import { enviarOT } from "../api";

const DB_NAME = "offlineOTdb";
const STORE = "pendientes";

// ✅ Normaliza payload viejo/nuevo
function normalizarPendiente(data) {
  if (!data || typeof data !== "object") return data;

  // tablero: acepta tablero o tableros[0]
  const tablero =
    data.tablero ||
    (Array.isArray(data.tableros) ? data.tableros[0] : "") ||
    "";

  // circuito: acepta circuito o circuitos
  const circuito =
    data.circuito ||
    (Array.isArray(data.circuitos)
      ? data.circuitos.join(", ")
      : (data.circuitos || "")) ||
    "";

  return {
    ...data,
    tablero,
    circuito,
  };
}

export default function useOfflineQueue() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  async function initDB() {
    return await openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        }
      },
    });
  }

  async function guardarPendiente(ot) {
    const db = await initDB();
    await db.add(STORE, ot);
  }

  async function obtenerPendientes() {
    const db = await initDB();
    return await db.getAll(STORE);
  }

  async function borrarPendiente(id) {
    const db = await initDB();
    await db.delete(STORE, id);
  }

  useEffect(() => {
    if (!online) return;

    async function syncNow() {
      const pendientes = await obtenerPendientes();
      if (pendientes.length === 0) return;

      for (const p of pendientes) {
        const normalized = normalizarPendiente(p.data);

        // ✅ Si sigue sin tablero, es inválida: NO reintentar (evita loop)
        if (!normalized?.tablero || String(normalized.tablero).trim() === "") {
          console.warn("🧹 Pendiente inválida (sin tablero). Se elimina:", p);
          await borrarPendiente(p.id);
          continue;
        }

        try {
          await enviarOT(normalized, true);   // genera PDF
          await borrarPendiente(p.id);  // remove local
        } catch (e) {
          const status = e?.status || 0;


          // ✅ Si es 400: es un error de datos, NO reintentar eternamente
          if (status === 400) {
            console.warn("🧹 Pendiente rechazada por backend (400). Se elimina:", p);
            await borrarPendiente(p.id);
            continue;
          }

          console.warn("❌ Error auto-sinc (se reintentará):", e);
          // para errores de red / 500, dejamos en cola para reintentar
        }
      }
    }

    syncNow();
    const timer = setInterval(syncNow, 20000);
    return () => clearInterval(timer);
  }, [online]);

  return {
    online,
    guardarPendiente,
    obtenerPendientes,
    borrarPendiente,
  };
}
