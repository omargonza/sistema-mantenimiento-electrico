// src/components/autopista3d/utils3d.js
export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

export function tone(row) {
  const est = (row.luminaria_estado || "").toUpperCase();
  const res = (row.resultado || "").toUpperCase();

  if (est === "REPARADO" || res === "COMPLETO") return "ok";
  if (est === "PENDIENTE" || res === "PARCIAL") return "warn";
  if (est === "APAGADO") return "danger";
  return "muted";
}

export function toneColor(t) {
  switch (t) {
    case "ok":
      return "#22c55e";
    case "warn":
      return "#f59e0b";
    case "danger":
      return "#ef4444";
    default:
      return "#94a3b8";
  }
}

export function deviceTier() {
  const reduce = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  )?.matches;
  if (reduce) return "low";

  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;

  if (mem <= 2 || cores <= 4) return "low";
  if (mem <= 4) return "mid";
  return "high";
}

export function pickRenderMode(pinCount) {
  if (pinCount > 600) return { mode: "2d", quality: "low" };

  const tier = deviceTier();

  if (tier === "low") {
    if (pinCount <= 250) return { mode: "3d", quality: "low" };
    return { mode: "2d", quality: "low" };
  }

  if (pinCount <= 250)
    return { mode: "3d", quality: tier === "high" ? "high" : "mid" };
  return { mode: "3d", quality: "mid" };
}
