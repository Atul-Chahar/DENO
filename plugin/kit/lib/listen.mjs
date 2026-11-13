// Hearing without ears: word-timed transcripts for cutting on words, silence for trimming dead air, loudness for
// levels. Times are in the media file's own seconds.
import fs from 'node:fs';
import path from 'node:path';
import { transcribe } from './captions.mjs';
import { die, info, readJSON, run, safeName, writeJSON } from './util.mjs';

const mmss = (t) => {
  const m = Math.floor(t / 60);
  return `${String(m).padStart(2, '0')}:${(t - m * 60).toFixed(3).padStart(6, '0')}`;
};

function mediaArg(dir, opts, usage) {
  const file = opts._[1];
  if (!file) die(usage);
  const abs = path.resolve(dir, file);
  if (!fs.existsSync(abs)) die(`no file ${file}`);
  return abs;
}

/** Word-timed transcript of any audio or video file, cached in assets/transcripts/ until the file changes. */
export async function transcript(dir, opts) {
  const abs = mediaArg(dir, opts, 'usage: studio transcribe <audio or video> [--format words|text|srt|json] [--language en] [--force]');
  const st = fs.statSync(abs);
  const cache = path.join(dir, 'assets', 'transcripts', `${safeName(path.basename(abs))}.json`);
  let data = readJSON(cache, null);
  if (!data || data.size !== st.size || data.mtimeMs !== st.mtimeMs || opts.force) {
    const words = await transcribe(abs, { model: opts.model, language: opts.language });
    data = { file: path.relative(dir, abs), size: st.size, mtimeMs: st.mtimeMs, words };
    writeJSON(cache, data);
  }
  const fmt = opts.format && opts.format !== true ? String(opts.format) : 'words';
  if (fmt === 'json') info(JSON.stringify(data.words));
  else if (fmt === 'text') info(data.words.map((w) => w.text).join(' '));
  else if (fmt === 'srt') {
    data.words.forEach((w, i) => info(`${i + 1}\n${mmss(w.start).replace('.', ',')} --> ${mmss(w.end).replace('.', ',')}\n${w.text}\n`));
  } else for (const w of data.words) info(`[${mmss(w.start)}] ${w.text}`);
  info(`${data.words.length} words · cached in ${path.relative(dir, cache)} · cut points: a word's start is where to cut in; the next word's start is where to cut out.`);
}

/** Parse ffmpeg silencedetect output into [{start, end, length}]; an open silence runs to `duration`. */
export function parseSilence(stderr, duration = null) {
  const out = [];
  let open = null;
  for (const line of stderr.split('\n')) {
    const s = line.match(/silence_start: (-?[\d.]+)/);
    const e = line.match(/silence_end: ([\d.]+)/);
    if (s) open = Math.max(0, Number(s[1]));
    if (e && open !== null) {
      out.push({ start: open, end: Number(e[1]), length: Math.round((Number(e[1]) - open) * 1000) / 1000 });
      open = null;
    }
  }
  if (open !== null && duration) out.push({ start: open, end: duration, length: Math.round((duration - open) * 1000) / 1000 });
  return out;
}

export async function silence(dir, opts) {
  const abs = mediaArg(dir, opts, 'usage: studio silence <audio or video> [--threshold -30] [--min 0.5]');
  const db = Number(opts.threshold ?? -30);
  const min = Number(opts.min ?? 0.5);
  const err = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', abs, '-af', `silencedetect=noise=${db}dB:d=${min}`, '-f', 'null', '-'], { stderr: true });
  const dur = Number((err.match(/Duration: (\d+):(\d+):([\d.]+)/) || []).slice(1).reduce((s, x, i) => s + Number(x) * [3600, 60, 1][i], 0)) || null;
  const gaps = parseSilence(err, dur);
  if (!gaps.length) return info(`no stretch below ${db} dB longer than ${min} s.`);
  for (const g of gaps) info(`${mmss(g.start)} → ${mmss(g.end)}  (${g.length.toFixed(2)} s)`);
  info(`${gaps.length} silent stretch(es), ${gaps.reduce((s, g) => s + g.length, 0).toFixed(1)} s in all. Jump cuts: keep ~0.1 s of each silence so words don't clip.`);
}

export async function loudness(dir, opts) {
  const abs = mediaArg(dir, opts, 'usage: studio loudness <audio or video>');
  const err = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', abs, '-af', 'loudnorm=print_format=json', '-f', 'null', '-'], { stderr: true });
  const json = err.slice(err.lastIndexOf('{'), err.lastIndexOf('}') + 1);
  let m;
  try {
    m = JSON.parse(json);
  } catch {
    die('no audio stream in that file');
  }
  const i = Number(m.input_i);
  const tp = Number(m.input_tp);
  info(`integrated ${i.toFixed(1)} LUFS · true peak ${tp.toFixed(1)} dBTP · range ${Number(m.input_lra).toFixed(1)} LU`);
  info(i < -17 ? 'quiet for social (target -14 LUFS); `studio mix` normalises the final.' : i > -11 ? 'hot: louder than platforms play it (-14 LUFS); it will be turned down.' : 'about right for social (-14 LUFS).');
}
