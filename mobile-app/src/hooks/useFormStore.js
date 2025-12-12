import { useEffect, useRef, useCallback } from "react";

export default function useFormStore(key, values, setValues, initialValues) {
  const timer = useRef(null);
  const previous = useRef(JSON.stringify(values));
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;

    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setValues(parsed);
        previous.current = JSON.stringify(parsed);
      } catch {
        localStorage.removeItem(key);
      }
    }

    hydrated.current = true;
  }, [key, setValues]);

  useEffect(() => {
    if (!hydrated.current) return;

    const now = JSON.stringify(values);
    if (now === previous.current) return;

    previous.current = now;

    if (timer.current) clearTimeout(timer.current);

    timer.current = setTimeout(() => {
      localStorage.setItem(key, now);
    }, 800);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [values, key]);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    localStorage.removeItem(key);

    if (initialValues) {
      setValues(initialValues);
      previous.current = JSON.stringify(initialValues);
    }
  }, [key, setValues, initialValues]);

  return { clear };
}
