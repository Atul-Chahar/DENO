// `studio captions <audio> [--text script.md]`: word timings (local Whisper), grouped into captions, SRT + VTT.
import fs from 'node:fs';
import path from 'node:path';
import { ensure, worker } from './deps.mjs';
import { decodeAudio, formats, info, loadFilm, num, run, saveFilm, writeJSON } from './util.mjs';

const norm = (w) => w.toLowerCase().replace(/[^\p{L}\p{N}%$]+/gu, '');

export function scriptWords(text) {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#+\s.*$/gm, ' ')
    .replace(/[*_>`]/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => ({ text: raw.replace(/[{}]/g, ''), cue: /^\{.*\}[.,!?;:]*$/.test(raw) || /\{[^}]+\}/.test(raw) }));
}

/** Give each script word the time of its matching transcribed word (edit-distance alignment); interpolate gaps. */
export function align(script, heard) {
  const n = script.length;
  const m = heard.length;
  const cost = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  const move = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1));
  for (let i = 1; i <= n; i++) {
    cost[i][0] = i;
    move[i][0] = 1;
  }
  for (let j = 1; j <= m; j++) {
    cost[0][j] = j;
    move[0][j] = 2;
  }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const same = norm(script[i - 1].text) === norm(heard[j - 1].text) ? 0 : 1;
      const opts = [cost[i - 1][j - 1] + same * 1.2, cost[i - 1][j] + 1, cost[i][j - 1] + 1];
      const k = opts.indexOf(Math.min(...opts));
      cost[i][j] = opts[k];
      move[i][j] = k === 0 ? 3 : k;
    }
  }
  const times = new Array(n).fill(null);
  for (let i = n, j = m; i > 0 || j > 0; ) {
    const mv = move[i][j];
    if (mv === 3) {
      times[i - 1] = [heard[j - 1].start, heard[j - 1].end];
      i--;
      j--;
    } else if (mv === 1) i--;
    else j--;
  }
  // Fill unmatched words between matched neighbours.
  for (let i = 0; i < n; i++) {
    if (times[i]) continue;
    let a = i - 1;
    while (a >= 0 && !times[a]) a--;
    let b = i + 1;
    while (b < n && !times[b]) b++;
    const t0 = a >= 0 ? times[a][1] : 0;
    const t1 = b < n ? times[b][0] : t0 + 0.4 * (b - a);
    const span = (t1 - t0) / (b - a);
    times[i] = [t0 + span * (i - a - 1), t0 + span * (i - a)];
  }
  return script.map((w, i) => ({ text: w.text, start: round(times[i][0]), end: round(times[i][1]), cue: w.cue || undefined }));
}

const round = (x) => Math.round(x * 1000) / 1000;

// Words a caption shouldn't end on: they belong with what follows ("for a" / "review." reads badly).
const WEAK = new Set(['a', 'an', 'the', 'to', 'for', 'of', 'and', 'or', 'but', 'in', 'on', 'at', 'with', 'by', 'from', 'your', 'our', 'my', 'is', 'are']);

export function group(words, { vertical }) {
  const out = [];
  let cur = [];
  const push = (ws) => {
    if (!ws.length) return;
    out.push({ start: ws[0].start, end: Math.max(ws[ws.length - 1].end, ws[0].start + (vertical ? 0.3 : 1)), text: ws.map((w) => w.text).join(' '), words: ws });
  };
  for (const w of words) {
    const prev = cur[cur.length - 1];
    const text = [...cur, w].map((x) => x.text).join(' ');
    const gap = prev ? w.start - prev.end : 0;
    const full = vertical ? cur.length >= 4 : text.length > 84 || w.end - (cur[0]?.start ?? w.start) > 6;
    if (cur.length && (full || gap > 0.35)) {
      // Carry trailing weak words into the next caption (but never empty this one).
      const carry = [];
      while (!gap || gap <= 0.35) {
        if (cur.length <= 1 || !WEAK.has(norm(cur[cur.length - 1].text))) break;
        carry.unshift(cur.pop());
      }
      push(cur);
      cur = carry;
    }
    cur.push(w);
    if (/[.!?]$/.test(w.text) || (vertical && /[,;:]$/.test(w.text))) {
      push(cur);
      cur = [];
    }
  }
  push(cur);
  // Landscape captions hold at least 1 s where the next one allows.
  if (!vertical) for (let i = 0; i < out.length; i++) out[i].end = round(Math.max(out[i].end, Math.min(out[i].start + 1, out[i + 1]?.start ?? Infinity)));
  return out;
}

const stamp = (t, sep) => {
  const ms = Math.round(t * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${sep}${String(ms % 1000).padStart(3, '0')}`;
};
const wrap = (text, width = 42) => {
  const lines = [''];
  for (const w of text.split(' ')) {
    if ((lines[lines.length - 1] + ' ' + w).trim().length > width && lines[lines.length - 1]) lines.push(w);
    else lines[lines.length - 1] = (lines[lines.length - 1] + ' ' + w).trim();
  }
  return lines.join('\n');
};
export const srt = (groups) => groups.map((g, i) => `${i + 1}\n${stamp(g.start, ',')} --> ${stamp(g.end, ',')}\n${wrap(g.text)}\n`).join('\n');
export const vtt = (groups) => `WEBVTT\n\n${groups.map((g) => `${stamp(g.start, '.')} --> ${stamp(g.end, '.')}\n${wrap(g.text)}\n`).join('\n')}`;

export async function transcribe(file, { model, language } = {}) {
  await ensure('captions');
  const pcm = await decodeAudio(file, 16000);
  const raw = path.join(path.dirname(worker('asr.mjs')), `asr-${process.pid}.f32`);
  fs.writeFileSync(raw, Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength));
  try {
    info('Transcribing locally with Whisper (first run downloads the model)…');
    const out = JSON.parse(await run(process.execPath, [worker('asr.mjs'), raw, model || 'onnx-community/whisper-base_timestamped', language || ''], { quiet: true }));
    return out.chunks.map((c) => ({ text: c.text.trim(), start: round(c.timestamp[0] ?? 0), end: round(c.timestamp[1] ?? c.timestamp[0] ?? 0) })).filter((w) => w.text);
  } finally {
    fs.rmSync(raw, { force: true });
  }
}

export async function captions(dir, opts) {
  const film = loadFilm(dir);
  const file = opts._[1];
  if (!file) throw new Error('usage: studio captions <audio> [--text script.md] [--model id] [--language en]');
  const heard = await transcribe(path.resolve(dir, file), { model: opts.model, language: opts.language });
  const words = opts.text ? align(scriptWords(fs.readFileSync(path.resolve(dir, opts.text), 'utf8')), heard) : heard;
  const offset = num(opts.offset, num(film.audio?.voice?.start, 0));
  for (const w of words) {
    w.start = round(w.start + offset);
    w.end = round(w.end + offset);
  }
  const vertical = formats(film).some((f) => f.h > f.w);
  const groups = group(words, { vertical });
  writeJSON(path.join(dir, 'captions.json'), { words, groups });
  fs.writeFileSync(path.join(dir, 'captions.srt'), srt(groups));
  fs.writeFileSync(path.join(dir, 'captions.vtt'), vtt(groups));
  film.captions = groups.map((g) => ({ start: g.start, end: g.end, text: g.text }));
  saveFilm(dir, film);
  info(`${words.length} words → ${groups.length} captions · captions.json (word times for burned-in captions via lib/captions.js), captions.srt, captions.vtt. Check them: check_copy(kind="captions").`);
  return words;
}
