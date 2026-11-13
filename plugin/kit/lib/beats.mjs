// `studio beats track.mp3`: tempo, beats, downbeats, onsets ("hits") and sections from a supplied track.
// Spectral-flux onset envelope → autocorrelation tempo → dynamic-programming beat tracker (Ellis 2007) →
// downbeat phase by bar energy → sections from loudness changes. Plain JS; ffmpeg decodes.
import path from 'node:path';
import { decodeAudio, info, loadFilm, num, saveFilm, writeJSON } from './util.mjs';

const SR = 22050;
const HOP = 256;
const WIN = 1024;
// Log-spaced bands over the 512 FFT bins (≈ 20 Hz – 11 kHz at 22.05 kHz).
const BANDS = [[1, 3], [3, 6], [6, 12], [12, 24], [24, 48], [48, 96], [96, 192], [192, 512]];

function fftMag(frame) {
  // Radix-2 FFT magnitude (WIN = 1024).
  const n = frame.length;
  const re = Float64Array.from(frame);
  const im = new Float64Array(n);
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [re[i], re[j]] = [re[j], re[i]];
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k);
        const wi = Math.sin(ang * k);
        const ur = re[i + k];
        const ui = im[i + k];
        const vr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi;
        const vi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
      }
    }
  }
  const mag = new Float64Array(n / 2);
  for (let k = 0; k < n / 2; k++) mag[k] = Math.log1p(10 * Math.hypot(re[k], im[k]));
  return mag;
}

export function analyse(pcm, sr = SR) {
  const frames = Math.max(0, Math.floor((pcm.length - WIN) / HOP));
  const hann = Float64Array.from({ length: WIN }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / WIN));
  const env = new Float64Array(frames);
  const rms = new Float64Array(frames);
  let prev = null;
  for (let f = 0; f < frames; f++) {
    const seg = new Float64Array(WIN);
    let e = 0;
    for (let i = 0; i < WIN; i++) {
      const v = pcm[f * HOP + i];
      seg[i] = v * hann[i];
      e += v * v;
    }
    rms[f] = Math.sqrt(e / WIN);
    const mag = fftMag(seg);
    if (prev) {
      // Flux per log-spaced band, each band weighted equally: a kick (few low bins) counts as much as a hi-hat
      // (many high bins), so beats lock to the downbeat instruments, not the off-beat cymbals.
      let flux = 0;
      for (const [a, b] of BANDS) {
        let band = 0;
        for (let k = a; k < b; k++) band += Math.max(0, mag[k] - prev[k]);
        flux += band / (b - a);
      }
      env[f] = flux;
    }
    prev = mag;
  }
  // Normalise and remove a local mean.
  const fr = sr / HOP;
  const smooth = Math.round(fr * 0.5);
  const onset = new Float64Array(frames);
  let acc = 0;
  for (let f = 0; f < frames; f++) {
    acc += env[f] - (f >= smooth ? env[f - smooth] : 0);
    onset[f] = Math.max(0, env[f] - acc / Math.min(f + 1, smooth));
  }
  const sd = Math.sqrt(onset.reduce((s, v) => s + v * v, 0) / Math.max(1, frames)) || 1;
  for (let f = 0; f < frames; f++) onset[f] /= sd;

  // Tempo: autocorrelation over 60–200 BPM with a log-Gaussian prior around 120.
  const minLag = Math.round((60 / 200) * fr);
  const maxLag = Math.round((60 / 60) * fr);
  let best = minLag;
  let bestScore = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let f = lag; f < frames; f++) s += onset[f] * onset[f - lag];
    const bpm = (60 * fr) / lag;
    const prior = Math.exp(-0.5 * Math.log2(bpm / 120) ** 2 / 0.9 ** 2);
    if (s * prior > bestScore) {
      bestScore = s * prior;
      best = lag;
    }
  }
  const period = best;

  // Beat tracking by dynamic programming.
  const tight = 100;
  const score = Float64Array.from(onset);
  const back = new Int32Array(frames).fill(-1);
  for (let f = 0; f < frames; f++) {
    let bv = 0;
    let bi = -1;
    for (let p = f - Math.round(2 * period); p <= f - Math.round(period / 2); p++) {
      if (p < 0) continue;
      const v = score[p] - tight * Math.log((f - p) / period) ** 2;
      if (v > bv || bi < 0) {
        bv = v;
        bi = p;
      }
    }
    if (bi >= 0) {
      score[f] += bv;
      back[f] = bi;
    }
  }
  let end = 0;
  for (let f = Math.max(0, frames - period); f < frames; f++) if (score[f] > score[end]) end = f;
  const beatFrames = [];
  for (let f = end; f >= 0; f = back[f]) {
    beatFrames.push(f);
    if (back[f] < 0) break;
  }
  beatFrames.reverse();
  // No beats before the music starts (the tracker can extrapolate into leading silence).
  const peak = Math.max(...rms);
  const firstSound = rms.findIndex((v) => v > peak * 0.05);
  while (beatFrames.length && beatFrames[0] < firstSound - Math.round(0.05 * fr)) beatFrames.shift();
  // Frame time = window centre + one hop: measured on clicks and kicks, this centres beats on the attack (±15 ms).
  const at = (f) => Math.round(((f * HOP + WIN / 2 + HOP) / sr) * 1000) / 1000;
  const beats = beatFrames.map(at);
  // Tempo from a straight-line fit through the tracked beats (finer than the autocorrelation lag grid).
  let bpm = Math.round(((60 * fr) / period) * 10) / 10;
  if (beats.length >= 8) {
    const n = beats.length;
    const mx = (n - 1) / 2;
    const my = beats.reduce((a, b) => a + b, 0) / n;
    let num = 0;
    let den = 0;
    beats.forEach((b, i) => {
      num += (i - mx) * (b - my);
      den += (i - mx) ** 2;
    });
    const slope = num / den;
    if (slope > 0) bpm = Math.round((60 / slope) * 10) / 10;
  }

  // Downbeats: the beat phase (mod 4) with the most onset energy.
  const phaseEnergy = [0, 0, 0, 0];
  beatFrames.forEach((f, i) => (phaseEnergy[i % 4] += onset[f] + rms[f] * 4));
  const phase = phaseEnergy.indexOf(Math.max(...phaseEnergy));
  const downbeats = beats.filter((_, i) => i % 4 === phase);

  // Hits: strong onsets (peaks above 2.5 sd, ≥ 120 ms apart).
  const hits = [];
  for (let f = 1; f < frames - 1; f++) {
    if (onset[f] > 2.5 && onset[f] >= onset[f - 1] && onset[f] >= onset[f + 1]) {
      const t = at(f);
      if (!hits.length || t - hits[hits.length - 1] > 0.12) hits.push(t);
    }
  }

  // Sections: bar-level loudness, split where it jumps by > 35% (at least 4 bars apart).
  const sections = [];
  const barLoud = downbeats.map((t, i) => {
    const a = Math.floor((t * sr) / HOP);
    const b = Math.floor(((downbeats[i + 1] ?? t + (4 * 60) / bpm) * sr) / HOP);
    let s = 0;
    for (let f = a; f < Math.min(b, frames); f++) s += rms[f];
    return s / Math.max(1, b - a);
  });
  let start = 0;
  for (let i = 1; i < barLoud.length; i++) {
    const change = Math.abs(barLoud[i] - barLoud[i - 1]) / Math.max(1e-6, (barLoud[i] + barLoud[i - 1]) / 2);
    if (change > 0.35 && i - start >= 4) {
      sections.push({ start: downbeats[start], end: downbeats[i], loudness: Math.round(barLoud[start] * 1000) / 1000 });
      start = i;
    }
  }
  const duration = pcm.length / sr;
  if (downbeats.length) sections.push({ start: downbeats[start], end: Math.round(duration * 1000) / 1000, loudness: Math.round((barLoud[start] || 0) * 1000) / 1000 });
  return { bpm, offset: beats[0] ?? 0, duration: Math.round(duration * 1000) / 1000, beats, downbeats, hits, sections };
}

export async function beats(dir, opts) {
  const file = opts._[1];
  if (!file) throw new Error('usage: studio beats <audio file>');
  const pcm = await decodeAudio(path.resolve(dir, file), SR);
  const result = { file, ...analyse(pcm) };
  writeJSON(path.join(dir, 'beats.json'), result);
  const film = loadFilm(dir);
  film.beatGrid = { bpm: result.bpm, offset: result.offset };
  film.audio = { ...(film.audio || {}), music: { file, gain: num(opts.gain, -6), start: 0 } };
  saveFilm(dir, film);
  const bar = (4 * 60) / result.bpm;
  info(
    `What I hear: ~${result.bpm} BPM (a bar every ${bar.toFixed(2)} s), first beat at ${result.offset.toFixed(2)} s, ` +
      `${result.downbeats.length} bars, ${result.hits.length} strong hits, ${result.sections.length} section(s): ` +
      result.sections.map((s) => `${s.start.toFixed(1)}–${s.end.toFixed(1)} s`).join(', ') +
      '.\nCuts on downbeats, hits on hits. Wrote beats.json and film.json beatGrid + audio.music.',
  );
}
