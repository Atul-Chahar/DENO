// `studio check`: verify + one contact sheet at phone size + colour numbers, in one browser and one short
// report. It replaces `verify`, `sheet`, `sheet --phone` and `sheet --stats` in the build and fix loop
// (docs/22 S2): one command and one image to read instead of four commands and three images.
import fs from 'node:fs';
import path from 'node:path';
import { Film, launch } from './browser.mjs';
import { sampleTimes, sheet, tile } from './look.mjs';
import { frameStats, notes, pool, statsRow } from './stats.mjs';
import { sourceHash } from './timeline.mjs';
import { formats, info, loadFilm, num, outDir, readJSON, run, tc, warn, writeJSON } from './util.mjs';
import { saveVerify, staticFindings, verify, verifyFormat, SLOW_SEEK_MS } from './verify.mjs';

/** Frames are shown this wide: the width of a phone screen, so text that is hard to read here is hard to read there. */
export const PHONE_W = 360;
const STATS_W = 240;

/** The encoded file that shows the current code, or null: the newest render (render.json), or the mix made from it. */
export function currentEncoded(dir, out) {
  const r = readJSON(path.join(out, 'render.json'), null);
  if (!r || r.source !== sourceHash(dir)) return null;
  const rendered = path.join(out, r.file);
  if (!fs.existsSync(rendered) || fs.statSync(rendered).mtimeMs !== r.mtimeMs) return null;
  const master = path.join(out, 'master.mp4');
  if (r.file === 'silent.mp4' && fs.existsSync(master) && fs.statSync(master).mtimeMs >= r.mtimeMs) return { file: master, fps: r.fps };
  return { file: rendered, fps: r.fps };
}

/** All sheet frames from an encoded file in ONE decode pass (one ffmpeg per frame cost ~0.3 s each on Windows):
 * phone-width JPEGs into `tmp`, and the colour numbers of each. */
async function fromEncoded(enc, times, tmp) {
  const want = [...new Set(times.map((t) => Math.round(t * enc.fps)))];
  const sel = want.map((n) => `eq(n\\,${n})`).join('+');
  const raw = await run(
    'ffmpeg',
    ['-v', 'error', '-y', '-i', enc.file, '-filter_complex', `[0:v]select='${sel}',split=2[a][b];[a]scale=${PHONE_W}:-2[ta];[b]scale=${STATS_W}:-2:flags=area,format=rgb24[sb]`,
      '-map', '[ta]', '-fps_mode', 'passthrough', '-q:v', '3', path.join(tmp, '%03d.jpg'),
      '-map', '[sb]', '-fps_mode', 'passthrough', '-f', 'rawvideo', '-'],
    { buffer: true },
  );
  const thumbs = fs.readdirSync(tmp).filter((f) => f.endsWith('.jpg')).sort().map((f) => path.join(tmp, f));
  const size = thumbs.length ? raw.length / thumbs.length : 0;
  const rows = thumbs.map((_, i) => frameStats(new Uint8Array(raw.buffer, raw.byteOffset + i * size, size)));
  return { thumbs, rows, times: want.slice(0, thumbs.length).map((n) => n / enc.fps) };
}

/** Default sheet times: about one a second, at most 24 (12 for a vertical film, whose frames are tall). */
function checkTimes(film, duration, vertical, opts) {
  if (opts.at || opts.times || opts.range || opts.every) return sampleTimes(film, duration, opts);
  const n = Math.max(6, Math.min(vertical ? 12 : 24, Math.round(duration)));
  return Array.from({ length: n }, (_, i) => ((i + 0.5) * duration) / n);
}

/** One ffmpeg call per frame: a phone-width JPEG for the sheet and the raw pixels for the colour numbers. */
async function thumbAndStats(input, buffer, thumb) {
  const raw = await run(
    'ffmpeg',
    ['-v', 'error', '-y', ...input, '-frames:v', '1', '-vf', `scale=${PHONE_W}:-2`, '-q:v', '3', thumb,
      '-frames:v', '1', '-vf', `scale=${STATS_W}:-2:flags=area,format=rgb24`, '-f', 'rawvideo', '-'],
    { buffer: true, input: buffer },
  );
  return frameStats(new Uint8Array(raw));
}

async function inBatches(items, size, fn) {
  const out = new Array(items.length);
  for (let i = 0; i < items.length; i += size) {
    const part = await Promise.all(items.slice(i, i + size).map((x, j) => fn(x, i + j)));
    part.forEach((v, j) => (out[i + j] = v));
  }
  return out;
}

export async function check(dir, opts) {
  const film = loadFilm(dir);
  if (film.kind === 'still') {
    // A still has a handful of pages: verify, then a sheet of the pages.
    await verify(dir, { ...opts, 'no-fail': true });
    return sheet(dir, opts);
  }
  const fmts = formats(film, opts.formats);
  const findings = staticFindings(dir, film);
  const add = (severity, rule, message, t = null) => findings.push({ severity, rule, message, t });
  const looks = [];
  const browser = await launch();
  try {
    for (const fmt of fmts) {
      const studio = await Film.open(dir, fmt, { browser });
      try {
        const res = await verifyFormat(studio, film, fmt, opts, add);
        const out = outDir(dir, fmt);
        const tmp = path.join(out, 'check-frames');
        fs.rmSync(tmp, { recursive: true, force: true });
        fs.mkdirSync(tmp, { recursive: true });
        const fps = film.fps || 30;
        const encoded = opts.live ? null : currentEncoded(dir, out);
        let times;
        let rows;
        let thumbs = [];
        if (encoded) {
          ({ thumbs, rows, times } = await fromEncoded(encoded, checkTimes(film, res.duration, fmt.h > fmt.w, opts), tmp));
          if (!thumbs.length) throw new Error(`no frames came out of ${path.relative(dir, encoded.file)}: render it again`);
        } else {
          // No render of the current code: the frames verify just grabbed from the live page are the sheet.
          times = opts.at || opts.range || opts.every ? checkTimes(film, res.duration, fmt.h > fmt.w, opts) : [...res.frames.keys()];
          const page = times.some((t) => !res.frames.has(t)) ? await studio.page() : null;
          const pngs = [];
          for (const t of times) pngs.push(res.frames.get(t) || (await studio.grab(page, t)));
          if (page) await page.close();
          rows = await inBatches(pngs, 4, (png, i) => {
            const f = path.join(tmp, `${String(i).padStart(3, '0')}.jpg`);
            thumbs[i] = f;
            return thumbAndStats(['-f', 'png_pipe', '-i', 'pipe:0'], png, f);
          });
        }
        const labels = times.map((t) => tc(t, fps));
        const dest = path.join(out, 'contact.png');
        const grid = await tile(thumbs, dest, { cols: num(opts.cols, 6), width: PHONE_W, label: labels, browser, scaled: true });
        fs.rmSync(tmp, { recursive: true, force: true });
        const frames = rows.map((r, i) => ({ at: labels[i], ...r }));
        const all = pool(rows);
        // The same record `studio sheet` writes, so `upload` and the review page treat it as a sheet.
        const record = { at: Date.now(), from: encoded ? 'encoded' : 'live', sheet: 'contact.png', frames: labels, by: 'check', stats: { all, frames } };
        if (grid && grid.cells.length === times.length) record.index = { w: grid.w, h: grid.h, frames: grid.cells.map((c, i) => ({ t: Math.round(times[i] * 1000) / 1000, ...c })) };
        if (encoded) Object.assign(record, { encoded: path.basename(encoded.file), encodedMtimeMs: fs.statSync(encoded.file).mtimeMs });
        writeJSON(path.join(out, 'sheet.json'), record);
        looks.push({ fmt, encoded, dest, all, frames, seek: res.seek, n: times.length });
      } finally {
        await studio.close();
      }
    }
  } finally {
    await browser.close().catch(() => undefined);
  }
  const blocking = saveVerify(dir, opts, fmts, findings);
  report(dir, findings, blocking, looks, opts);
  if (blocking.length && !opts['no-fail']) process.exitCode = 1;
  return { findings, looks };
}

const ms = (v) => `${v < 10 ? v.toFixed(1) : Math.round(v)} ms`;

function report(dir, findings, blocking, looks, opts) {
  const warns = findings.filter((f) => f.severity !== 'block');
  info(`verify: ${blocking.length} blocking, ${warns.length} warning(s)`);
  for (const f of blocking) warn(`BLOCK ${f.rule.padEnd(12)} ${f.where ? `${f.where} ` : ''}${f.message}`);
  const shown = opts.all ? warns : warns.slice(0, 6);
  for (const f of shown) info(`  warn ${f.rule.padEnd(12)} ${f.where ? `${f.where} ` : ''}${f.message}`);
  if (warns.length > shown.length) info(`  … ${warns.length - shown.length} more in out/verify.json (or \`studio check --all\`)`);
  for (const l of looks) {
    const from = l.encoded ? `${path.relative(dir, l.encoded.file)} (the current render: what viewers see)` : 'the live page (no render of the current code yet; `studio render --draft` first to check the file itself)';
    info(`${l.fmt.ratio}: ${l.n} frames at phone width from ${from}`);
    info(`  look: ${statsRow(l.all)}`);
    for (const n of notes(l.all)) info(`  note: ${n}`);
    const odd = l.frames.filter((r) => notes(r).length).slice(0, 4);
    for (const r of odd) info(`  ${r.at}: ${notes(r).join('; ')}`);
    if (l.seek) info(`  seek(t): median ${ms(l.seek.median)}, slowest ${ms(l.seek.max)} (budget ${SLOW_SEEK_MS} ms)`);
    info(`→ ${path.relative(dir, l.dest)}  (read this image before you say it looks right)`);
  }
}
