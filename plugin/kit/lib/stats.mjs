// Numbers for what a frame looks like, so the agent measures exposure and colour instead of guessing from a
// thumbnail: luma median/mean, blacks and whites, contrast, crushed and blown pixels, saturation, colour cast.
import { run } from './util.mjs';

const W = 240; // measuring size: plenty for percentiles, cheap to decode

/** Stats of one RGB24 frame (Uint8Array, length w*h*3). Values are 0–1 except the casts (−1..1). */
export function frameStats(rgb) {
  const n = Math.floor(rgb.length / 3);
  const hist = new Uint32Array(256);
  let sum = 0;
  let sat = 0;
  let crushed = 0;
  let blown = 0;
  const band = [0, 1, 2].map(() => ({ n: 0, warm: 0, tint: 0 }));
  for (let i = 0; i < n; i++) {
    const r = rgb[i * 3];
    const g = rgb[i * 3 + 1];
    const b = rgb[i * 3 + 2];
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b; // Rec. 709 luma
    hist[Math.min(255, Math.round(y))]++;
    sum += y;
    if (y <= 3) crushed++;
    if (y >= 252) blown++;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    sat += mx ? (mx - mn) / mx : 0;
    const k = y < 85 ? 0 : y < 170 ? 1 : 2;
    band[k].n++;
    band[k].warm += (r - b) / 255;
    band[k].tint += (g - (r + b) / 2) / 255;
  }
  const pct = (p) => {
    const want = p * n;
    let acc = 0;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= want) return v / 255;
    }
    return 1;
  };
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const blacks = pct(0.02);
  const whites = pct(0.98);
  const cast = (k) => (band[k].n ? { warm: r3(band[k].warm / band[k].n), tint: r3(band[k].tint / band[k].n) } : null);
  return {
    median: r3(pct(0.5)),
    mean: r3(sum / n / 255),
    blacks: r3(blacks),
    whites: r3(whites),
    contrast: r3(whites - blacks),
    crushed: r3(crushed / n),
    blown: r3(blown / n),
    saturation: r3(sat / n),
    cast: { shadows: cast(0), mids: cast(1), highlights: cast(2) },
  };
}

/** Measure an image file, or a video file at time `t`. */
export async function measure(file, t = null) {
  const args = ['-v', 'error'];
  if (t !== null) args.push('-ss', Number(t).toFixed(3));
  args.push('-i', file, '-frames:v', '1', '-vf', `scale=${W}:-2:flags=area,format=rgb24`, '-f', 'rawvideo', '-');
  return frameStats(new Uint8Array(await run('ffmpeg', args, { buffer: true })));
}

/** Average a list of stats (used for "all frames" and for a reference video measured at several times). */
export function pool(list) {
  const avg = (f) => list.reduce((s, x) => s + f(x), 0) / list.length;
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const castAvg = (k) => {
    const xs = list.map((x) => x.cast[k]).filter(Boolean);
    return xs.length ? { warm: r3(xs.reduce((s, c) => s + c.warm, 0) / xs.length), tint: r3(xs.reduce((s, c) => s + c.tint, 0) / xs.length) } : null;
  };
  return {
    median: r3(avg((x) => x.median)),
    mean: r3(avg((x) => x.mean)),
    blacks: r3(avg((x) => x.blacks)),
    whites: r3(avg((x) => x.whites)),
    contrast: r3(avg((x) => x.contrast)),
    crushed: r3(avg((x) => x.crushed)),
    blown: r3(avg((x) => x.blown)),
    saturation: r3(avg((x) => x.saturation)),
    cast: { shadows: castAvg('shadows'), mids: castAvg('mids'), highlights: castAvg('highlights') },
  };
}

/** How far a look is from a reference look (0 = same; ~0.05 is close, > 0.15 is clearly different). */
export function distance(a, b) {
  const c = (x, k, f) => x.cast[k]?.[f] ?? 0;
  const parts = [
    [a.median - b.median, 1.5],
    [a.contrast - b.contrast, 1],
    [a.saturation - b.saturation, 1],
    ...['shadows', 'mids', 'highlights'].flatMap((k) => [[c(a, k, 'warm') - c(b, k, 'warm'), 1], [c(a, k, 'tint') - c(b, k, 'tint'), 1]]),
  ];
  const wsum = parts.reduce((s, [, w]) => s + w, 0);
  return Math.round(Math.sqrt(parts.reduce((s, [d, w]) => s + w * d * d, 0) / wsum) * 1000) / 1000;
}

/** Plain-language notes a viewer would notice. */
export function notes(s) {
  const out = [];
  if (s.crushed > 0.08) out.push(`${Math.round(s.crushed * 100)}% of pixels are pure black (detail lost in shadows)`);
  if (s.blown > 0.05) out.push(`${Math.round(s.blown * 100)}% of pixels are pure white (detail lost in highlights)`);
  if (s.contrast < 0.25) out.push('flat: little difference between darks and lights');
  const warm = s.cast.mids?.warm ?? 0;
  if (Math.abs(warm) > 0.12) out.push(`midtones lean ${warm > 0 ? 'warm (orange)' : 'cool (blue)'}`);
  const tint = s.cast.mids?.tint ?? 0;
  if (Math.abs(tint) > 0.08) out.push(`midtones lean ${tint > 0 ? 'green' : 'magenta'}`);
  return out;
}

export const statsRow = (s) =>
  `exposure ${s.median.toFixed(2)} (mean ${s.mean.toFixed(2)}) · blacks ${s.blacks.toFixed(2)} whites ${s.whites.toFixed(2)} · contrast ${s.contrast.toFixed(2)} · crushed ${(s.crushed * 100).toFixed(1)}% blown ${(s.blown * 100).toFixed(1)}% · saturation ${s.saturation.toFixed(2)} · mids warm ${(s.cast.mids?.warm ?? 0).toFixed(2)} tint ${(s.cast.mids?.tint ?? 0).toFixed(2)}`;
