// One set of curves so every moving part of the atlas shares a personality.
export const easeOutCubic = (t) => 1 - (1 - t) ** 3;
export const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;

export const clamp01 = (t) => Math.max(0, Math.min(1, t));

// Keys a tween walks over: record keys (union of both sides) or array indexes.
export function tweenKeys(from, to) {
  if (Array.isArray(to)) return to.map((_, i) => i);
  if (to && typeof to === "object")
    return [...new Set([...Object.keys(from || {}), ...Object.keys(to)])];
  return [];
}

// Blend numbers, arrays of numbers, or records of numbers. `t` is a number or
// a per-key function. Records treat missing keys as zero, so entering marks
// grow from nothing and leaving marks shrink away. Arrays only morph when the
// shape matches; otherwise the new series replaces the old one.
export function blend(from, to, t) {
  const at = typeof t === "function" ? t : () => t;
  if (typeof to === "number") {
    const start = typeof from === "number" ? from : 0;
    return start + (to - start) * at(0);
  }
  if (Array.isArray(to)) {
    if (!Array.isArray(from) || from.length !== to.length) return to;
    return to.map((value, i) => from[i] + (value - from[i]) * at(i));
  }
  const out = {};
  for (const key of tweenKeys(from, to)) {
    const start = from?.[key] ?? 0,
      end = to[key] ?? 0;
    out[key] = start + (end - start) * at(key);
  }
  return out;
}
