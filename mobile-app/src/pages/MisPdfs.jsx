import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import "../styles/dashboard.css";
import "../styles/misPdfs.css";
import { queryOts, getPdfBlob, setFlags, deleteOt } from "../storage/ot_db";

/* =========================
   Helpers
   ========================= */

function formatMB(bytes) {
  const value = Number(bytes) || 0;
  const mb = value / (1024 * 1024);
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

function safeFilename(value) {
  return String(value || "")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPdfFilename(ot) {
  const fecha = safeFilename(ot?.fecha || "OT");
  const tablero = safeFilename(ot?.tablero || "Tablero");
  return `${fecha} - ${tablero}.pdf`;
}

function downloadBlob(blob, filename = "OT.pdf") {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function sharePdfBlob({ blob, filename, title, text }) {
  const file = new File([blob], filename, { type: "application/pdf" });

  const canUseNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  let canShareFiles = true;

  if (canUseNativeShare && typeof navigator.canShare === "function") {
    try {
      canShareFiles = navigator.canShare({ files: [file] });
    } catch {
      canShareFiles = false;
    }
  }

  if (canUseNativeShare && canShareFiles) {
    await navigator.share({ title, text, files: [file] });
    return { method: "share" };
  }

  downloadBlob(blob, filename);
  return { method: "download" };
}

/* Cambio importante:
   corregido el resaltado para múltiples términos sin usar re.test() con /g,
   porque eso puede dar falsos negativos por el lastIndex interno del regex. */
function highlightText(text, query) {
  const source = String(text || "");
  const terms = String(query || "")
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (!terms.length) return source;

  const uniqueTerms = [...new Set(terms)]
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length);

  if (!uniqueTerms.length) return source;

  const re = new RegExp(`(${uniqueTerms.join("|")})`, "ig");
  const parts = source.split(re);

  return parts.map((part, index) => {
    const isMatch = uniqueTerms.some(
      (term) => part.toLowerCase() === term.toLowerCase(),
    );

    return isMatch ? (
      <mark key={`${part}-${index}`} className="hl">
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    );
  });
}

function getErrorMessage(error, fallback = "Ocurrió un error inesperado.") {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (error?.message) return error.message;
  return fallback;
}

function buildParams({ q, desde, hasta, soloFavoritos }) {
  const next = new URLSearchParams();

  if (String(q || "").trim()) next.set("q", String(q).trim());
  if (desde) next.set("desde", desde);
  if (hasta) next.set("hasta", hasta);
  if (soloFavoritos) next.set("fav", "1");

  return next;
}

function normalizeTecnico(ot) {
  if (Array.isArray(ot?.tecnicos)) {
    return ot.tecnicos.filter(Boolean).join(", ") || "-";
  }
  return ot?.tecnico || "-";
}

function normalizeVehiculo(ot) {
  return ot?.vehiculo || ot?.movil || "-";
}

export default function MisPdfs() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [q, setQ] = useState(() => params.get("q") || "");
  const [desde, setDesde] = useState(() => params.get("desde") || "");
  const [hasta, setHasta] = useState(() => params.get("hasta") || "");
  const [soloFavoritos, setSoloFavoritos] = useState(
    () => params.get("fav") === "1",
  );

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const requestSeqRef = useRef(0);

  const [debouncedQ, setDebouncedQ] = useState(q);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q);
    }, 300);

    return () => clearTimeout(t);
  }, [q]);

  const hasInvalidRange = Boolean(desde && hasta && desde > hasta);
  const paramsSignature = params.toString();

  /* Sync URL -> state */
  useEffect(() => {
    const urlQ = params.get("q") || "";
    const urlDesde = params.get("desde") || "";
    const urlHasta = params.get("hasta") || "";
    const urlFav = params.get("fav") === "1";

    if (urlQ !== q) setQ(urlQ);
    if (urlDesde !== desde) setDesde(urlDesde);
    if (urlHasta !== hasta) setHasta(urlHasta);
    if (urlFav !== soloFavoritos) setSoloFavoritos(urlFav);
  }, [paramsSignature]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Sync state -> URL */
  useEffect(() => {
    const next = buildParams({ q, desde, hasta, soloFavoritos });
    const nextSignature = next.toString();

    if (nextSignature !== paramsSignature) {
      setParams(next, { replace: true });
    }
  }, [q, desde, hasta, soloFavoritos, paramsSignature, setParams]);

  const showNotice = useCallback((type, text) => {
    setNotice({ type, text });
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const refresh = useCallback(
    async ({ silent = false } = {}) => {
      const requestId = ++requestSeqRef.current;

      if (hasInvalidRange) {
        setError(
          "El rango de fechas es inválido: 'desde' no puede ser mayor que 'hasta'.",
        );
        setItems([]);
        setLoading(false);
        return;
      }

      if (!silent) setLoading(true);
      setError("");

      try {
        const data = await queryOts({
          q: debouncedQ,
          desde,
          hasta,
          favorito: soloFavoritos ? true : null,
        });

        if (requestId !== requestSeqRef.current) return;
        setItems(Array.isArray(data) ? data : []);
      } catch (err) {
        if (requestId !== requestSeqRef.current) return;
        setItems([]);
        setError(
          getErrorMessage(
            err,
            "No se pudieron cargar los PDFs guardados localmente.",
          ),
        );
      } finally {
        if (requestId === requestSeqRef.current) {
          setLoading(false);
        }
      }
    },
    [debouncedQ, desde, hasta, soloFavoritos, hasInvalidRange],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const bytesTotal = useMemo(
    () => items.reduce((acc, it) => acc + (Number(it?.pdfBytes) || 0), 0),
    [items],
  );

  const favoritosCount = useMemo(
    () => items.filter((it) => Boolean(it?.favorito)).length,
    [items],
  );

  const enviadosCount = useMemo(
    () => items.filter((it) => Boolean(it?.enviado)).length,
    [items],
  );

  const openPdf = async (ot) => {
    const actionKey = `open-${ot.id}`;
    setBusyKey(actionKey);

    // Abrir ventana inmediatamente para evitar popup blocker
    const win = window.open("", "_blank");

    try {
      const blob = await getPdfBlob(ot.pdfId || ot.id);

      if (!blob) {
        win?.close();
        showNotice(
          "error",
          "No se encontró el PDF en el almacenamiento local de este dispositivo.",
        );
        return;
      }

      const pdfBlob =
        blob.type === "application/pdf"
          ? blob
          : new Blob([blob], { type: "application/pdf" });

      const pdfUrl = URL.createObjectURL(pdfBlob);

      if (!win) {
        URL.revokeObjectURL(pdfUrl);
        showNotice(
          "warning",
          "El navegador bloqueó la apertura del PDF. Permití popups para esta app.",
        );
        return;
      }

      win.location.href = pdfUrl;

      // limpiar URL temporal más tarde
      setTimeout(() => {
        URL.revokeObjectURL(pdfUrl);
      }, 120_000);

      try {
        await setFlags(ot.id, { reimpreso: (Number(ot.reimpreso) || 0) + 1 });
        await refresh({ silent: true });
      } catch {
        // no romper UX por flag auxiliar
      }
    } catch (err) {
      win?.close();
      showNotice("error", getErrorMessage(err, "No se pudo abrir el PDF."));
    } finally {
      setBusyKey("");
    }
  };

  const sharePdf = async (ot) => {
    const actionKey = `share-${ot.id}`;
    setBusyKey(actionKey);

    try {
      const blob = await getPdfBlob(ot.pdfId || ot.id);

      if (!blob) {
        showNotice(
          "error",
          "No se encontró el PDF en el almacenamiento local de este dispositivo.",
        );
        return;
      }

      const filename = buildPdfFilename(ot);
      const title = "Orden de Trabajo";
      const text = `${ot.fecha || ""} — ${ot.tablero || ""}\n${
        ot.ubicacion || ""
      }`.trim();

      const result = await sharePdfBlob({ blob, filename, title, text });

      /* Cambio crítico:
         solo marcar enviado cuando realmente se compartió */
      if (result.method === "share") {
        await setFlags(ot.id, { enviado: true });
        await refresh({ silent: true });
        showNotice("success", "PDF compartido correctamente.");
      } else {
        showNotice(
          "info",
          "Tu navegador no soporta compartir archivos. El PDF se descargó.",
        );
      }
    } catch (err) {
      showNotice("error", getErrorMessage(err, "No se pudo compartir el PDF."));
    } finally {
      setBusyKey("");
    }
  };

  const toggleFav = async (ot) => {
    const actionKey = `fav-${ot.id}`;
    setBusyKey(actionKey);

    try {
      await setFlags(ot.id, { favorito: !ot.favorito });
      await refresh({ silent: true });

      showNotice(
        "success",
        ot.favorito
          ? "El PDF se quitó de favoritos."
          : "El PDF se agregó a favoritos.",
      );
    } catch (err) {
      showNotice(
        "error",
        getErrorMessage(err, "No se pudo actualizar el favorito."),
      );
    } finally {
      setBusyKey("");
    }
  };

  const askRemove = (ot) => {
    setPendingDelete(ot);
  };

  const confirmRemove = async () => {
    if (!pendingDelete) return;

    const ot = pendingDelete;
    const actionKey = `delete-${ot.id}`;
    setBusyKey(actionKey);

    try {
      await deleteOt(ot.id);
      setPendingDelete(null);
      await refresh({ silent: true });
      showNotice("success", "El PDF se eliminó del respaldo local.");
    } catch (err) {
      showNotice("error", getErrorMessage(err, "No se pudo eliminar el PDF."));
    } finally {
      setBusyKey("");
    }
  };

  const clearFilters = () => {
    setQ("");
    setDesde("");
    setHasta("");
    setSoloFavoritos(false);
  };

  return (
    <div className="page mispdfs-page">
      <section className="card mispdfs-hero">
        <div className="mispdfs-hero__top">
          <div className="mispdfs-hero__title-wrap">
            <h2 className="titulo">Mis PDFs</h2>
            <div className="muted mispdfs-hero__subtitle">
              Biblioteca local de órdenes de trabajo descargadas en este
              dispositivo.
            </div>
          </div>

          <div className="mispdfs-hero__actions">
            <button
              type="button"
              className="btn-outline"
              onClick={() => refresh()}
              disabled={loading}
              aria-label="Actualizar listado de PDFs"
            >
              {loading ? "Actualizando..." : "🔄 Actualizar"}
            </button>

            <button
              type="button"
              className="btn-outline"
              onClick={() => navigate("/")}
            >
              ← Inicio
            </button>
          </div>
        </div>

        <div className="mispdfs-stats">
          <div className="card mispdfs-stat">
            <div className="muted mispdfs-stat__label">PDFs visibles</div>
            <div className="mispdfs-stat__value">{items.length}</div>
          </div>

          <div className="card mispdfs-stat">
            <div className="muted mispdfs-stat__label">Tamaño visible</div>
            <div className="mispdfs-stat__value">{formatMB(bytesTotal)}</div>
          </div>

          <div className="card mispdfs-stat">
            <div className="muted mispdfs-stat__label">Favoritos</div>
            <div className="mispdfs-stat__value">{favoritosCount}</div>
          </div>

          <div className="card mispdfs-stat">
            <div className="muted mispdfs-stat__label">
              Marcados como enviados
            </div>
            <div className="mispdfs-stat__value">{enviadosCount}</div>
          </div>
        </div>
      </section>

      <section className="card mispdfs-filters">
        <div className="mispdfs-filters__grid">
          <input
            type="text"
            placeholder="Buscar por tablero, ubicación, zona, técnico o móvil..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Buscar PDFs"
          />

          <label className="toggle mispdfs-filters__toggle">
            <span>⭐ Solo favoritos</span>
            <input
              type="checkbox"
              checked={soloFavoritos}
              onChange={(e) => setSoloFavoritos(e.target.checked)}
            />
          </label>

          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            aria-label="Fecha desde"
          />

          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            aria-label="Fecha hasta"
          />
        </div>

        {hasInvalidRange && (
          <div className="mispdfs-banner mispdfs-banner--warning">
            Revisá el rango: la fecha <strong>desde</strong> no puede ser mayor
            que la fecha <strong>hasta</strong>.
          </div>
        )}

        <div className="mispdfs-filters__footer">
          <button
            type="button"
            className="btn-outline"
            onClick={clearFilters}
            disabled={!q && !desde && !hasta && !soloFavoritos}
          >
            Limpiar filtros
          </button>

          <span className="muted mispdfs-filters__hint">
            La búsqueda tiene un pequeño delay para evitar recargas
            innecesarias.
          </span>
        </div>
      </section>

      {error && (
        <div role="alert" className="mispdfs-banner mispdfs-banner--error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {notice && (
        <div
          role="status"
          aria-live="polite"
          className={`mispdfs-banner ${
            notice.type === "success"
              ? "mispdfs-banner--success"
              : notice.type === "error"
                ? "mispdfs-banner--error"
                : notice.type === "warning"
                  ? "mispdfs-banner--warning"
                  : "mispdfs-banner--info"
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="tabla-ot mispdfs-list">
        {loading && (
          <p className="sin-datos">Cargando PDFs guardados localmente...</p>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="sin-datos mispdfs-empty">
            No hay PDFs guardados localmente con esos filtros.
          </p>
        )}

        {!loading &&
          !error &&
          items.map((ot) => {
            const tecnicoLabel = normalizeTecnico(ot);
            const vehiculoLabel = normalizeVehiculo(ot);

            const isOpenBusy = busyKey === `open-${ot.id}`;
            const isShareBusy = busyKey === `share-${ot.id}`;
            const isFavBusy = busyKey === `fav-${ot.id}`;
            const isDeleteBusy = busyKey === `delete-${ot.id}`;
            const isRowBusy =
              isOpenBusy || isShareBusy || isFavBusy || isDeleteBusy;

            return (
              <article
                key={ot.id}
                className={`fila-ot ${
                  ot.enviado ? "is-sent" : ""
                } ${ot.favorito ? "is-fav" : ""} ${isRowBusy ? "is-busy" : ""}`}
              >
                <button
                  type="button"
                  className="ot-linea"
                  onClick={() => navigate(`/detalle/${ot.id}`)}
                  aria-label={`Ver detalle del PDF ${ot.tablero || ot.id}`}
                >
                  <div className="ot-tablero">
                    {highlightText(ot.tablero, q)}
                  </div>

                  <div className="ot-meta">
                    <span className="ot-fecha">{ot.fecha || "Sin fecha"}</span>

                    {ot.zona ? (
                      <span className="zbadge">
                        {highlightText(ot.zona, q)}
                      </span>
                    ) : null}

                    {ot.favorito && <span className="chip">⭐ Favorito</span>}
                    {ot.enviado && <span className="chip ok">ENVIADO</span>}
                  </div>
                </button>

                <div className="ot-sub">
                  {highlightText(ot.ubicacion || "Sin ubicación", q)}
                </div>

                <div className="ot-info">
                  <span className="pill">{highlightText(tecnicoLabel, q)}</span>
                  <span className="pill">
                    {highlightText(vehiculoLabel, q)}
                  </span>
                  <span className="pill">{formatMB(ot.pdfBytes || 0)}</span>
                </div>

                <div className="ot-actions">
                  <button
                    type="button"
                    className="btn-mini"
                    onClick={() => openPdf(ot)}
                    disabled={isRowBusy}
                  >
                    {isOpenBusy ? "Abriendo..." : "Abrir PDF"}
                  </button>

                  <button
                    type="button"
                    className="btn-mini primary"
                    onClick={() => sharePdf(ot)}
                    disabled={isRowBusy}
                  >
                    {isShareBusy ? "Procesando..." : "Compartir"}
                  </button>

                  <button
                    type="button"
                    className="btn-mini"
                    onClick={() => toggleFav(ot)}
                    disabled={isRowBusy}
                  >
                    {isFavBusy
                      ? "Guardando..."
                      : ot.favorito
                        ? "Quitar ⭐"
                        : "Favorito ⭐"}
                  </button>

                  <button
                    type="button"
                    className="btn-mini danger"
                    onClick={() => askRemove(ot)}
                    disabled={isRowBusy}
                  >
                    {isDeleteBusy ? "Eliminando..." : "Eliminar"}
                  </button>
                </div>
              </article>
            );
          })}
      </div>

      {pendingDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-pdf-title"
          className="mispdfs-modal"
          onClick={() => setPendingDelete(null)}
        >
          <div
            className="card mispdfs-modal__card"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="delete-pdf-title">Eliminar PDF local</h3>

            <p>Vas a eliminar del almacenamiento local este PDF:</p>

            <div className="mispdfs-modal__box">
              <strong>{pendingDelete.tablero || "Sin tablero"}</strong>
              <div className="muted mispdfs-modal__meta">
                {pendingDelete.fecha || "Sin fecha"} ·{" "}
                {pendingDelete.ubicacion || "Sin ubicación"}
              </div>
            </div>

            <p className="muted mispdfs-modal__hint">
              Esta acción solo afecta el respaldo guardado en este dispositivo.
            </p>

            <div className="mispdfs-modal__actions">
              <button
                type="button"
                className="btn-outline"
                onClick={() => setPendingDelete(null)}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="btn-mini danger"
                onClick={confirmRemove}
                disabled={busyKey === `delete-${pendingDelete.id}`}
              >
                {busyKey === `delete-${pendingDelete.id}`
                  ? "Eliminando..."
                  : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
