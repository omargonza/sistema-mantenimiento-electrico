import { useEffect, useRef, useCallback } from "react";

/**
 * useFormStore (PRO)
 * - Persiste en localStorage con debounce
 * - NO persiste payload pesado (base64: fotos/firma)
 * - Protege contra quota exceeded (limpia cache si se excede)
 *
 * @param {string} key
 * @param {object} values
 * @param {(next:any)=>void} setValues
 * @param {object} initialValues
 * @param {object} opts
 */
export default function useFormStore(
  key,
  values,
  setValues,
  initialValues,
  opts = {},
) {
  const timer = useRef(null);
  const previous = useRef("");
  const hydrated = useRef(false);

  const {
    debounceMs = 800,
    // campos que NO se persisten
    omitKeys = ["fotosB64", "firmaTecnicoB64"],
    // hard cap en bytes del JSON final (localStorage suele romper ~5MB total)
    maxBytes = 180_000, // ~180KB: suficiente para texto y arrays livianos
  } = opts;

  const sanitize = (obj) => {
    if (!obj || typeof obj !== "object") return obj;

    // copia shallow (form es plano + arrays)
    const clean = { ...obj };

    for (const k of omitKeys) {
      if (k in clean) {
        // fotos como array vacío, firma como string vacío
        clean[k] = Array.isArray(clean[k]) ? [] : "";
      }
    }

    return clean;
  };

  const safeStringify = (obj) => {
    try {
      const s = JSON.stringify(obj);
      return s;
    } catch {
      return "";
    }
  };

  const withinLimit = (str) => {
    // bytes aproximados utf-8
    try {
      return new Blob([str]).size <= maxBytes;
    } catch {
      return str.length <= maxBytes; // fallback
    }
  };

  // Hydrate
  useEffect(() => {
    if (hydrated.current) return;

    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setValues(parsed);
        previous.current = safeStringify(parsed);
      } catch {
        localStorage.removeItem(key);
      }
    } else {
      previous.current = safeStringify(sanitize(values));
    }

    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, setValues]);

  // Persist (debounced)
  useEffect(() => {
    if (!hydrated.current) return;

    const sanitized = sanitize(values);
    const now = safeStringify(sanitized);
    if (!now) return;

    if (now === previous.current) return;
    previous.current = now;

    if (timer.current) clearTimeout(timer.current);

    timer.current = setTimeout(() => {
      // si por alguna razón quedó grande, no guardamos
      if (!withinLimit(now)) {
        // si quedó grande, limpiamos cache para no reventar quota
        try {
          localStorage.removeItem(key);
        } catch {}
        return;
      }

      try {
        localStorage.setItem(key, now);
      } catch (e) {
        // QuotaExceededError -> limpiamos el draft y seguimos
        try {
          localStorage.removeItem(key);
        } catch {}
        // no tiramos error: el form en memoria sigue
        console.warn("useFormStore: no se pudo persistir (quota).", e);
      }
    }, debounceMs);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [values, key, debounceMs, maxBytes, omitKeys]);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    try {
      localStorage.removeItem(key);
    } catch {}

    if (initialValues) {
      setValues(initialValues);
      previous.current = safeStringify(sanitize(initialValues));
    } else {
      previous.current = "";
    }
  }, [key, setValues, initialValues]);

  return { clear };
}
