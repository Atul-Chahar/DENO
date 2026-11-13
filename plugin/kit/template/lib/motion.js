// Closed-form motion: every value is a pure function of time. No state, no clocks.
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, p) => a + (b - a) * p;

/** Damped spring from 0 → 1 starting at t = 0 (unit mass). k stiffness, d damping. */
export function spring(t, k = 170, d = 26) {
  if (t <= 0) return 0;
  const w0 = Math.sqrt(k);
  const zeta = d / (2 * w0);
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
  }
  return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
}

/** A value that springs between targets: keys = [[time, value], …] sorted by time; one spring per change. */
export function track(t, keys, k = 170, d = 26) {
  let v = keys[0][1];
  for (let i = 1; i < keys.length; i++) v += (keys[i][1] - keys[i - 1][1]) * spring(t - keys[i][0], k, d);
  return v;
}

// Presets: UI snaps with a hint of overshoot; type is heavy with none; camera drifts.
export const UI = [260, 26];
export const TYPE = [140, 24];
export const CAM = [90, 19];

/** 0 before a, 1 after b, eased between. */
export const ramp = (t, a, b) => clamp((t - a) / (b - a));
export const ease = (p) => 1 - Math.pow(1 - clamp(p), 3);
/** The last key whose time ≤ t. */
export function step(t, keys) {
  let v = keys[0][1];
  for (const [k, x] of keys) if (t >= k) v = x;
  return v;
}
/** Seeded randomness: rand(i, seed) is always the same number for the same inputs. */
export function rand(i, seed = 1) {
  let h = (Math.imul(i | 0, 374761393) + Math.imul(seed | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** "Boil": re-seed n times a second, per element key. */
export const boil = (t, key, rate = 12) => rand(Math.floor(t * rate), key);
/** Local time inside a shot [a, b): t - a, or null when the shot is off. */
export const local = (t, a, b) => (t >= a && t < b ? t - a : null);
