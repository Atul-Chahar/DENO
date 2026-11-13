// Place before you fill: the film's shape goes into film.json as labelled placeholders first, so the founder sees
// the structure (preview and draft renders draw each one as a striped block) while the heavy parts are made.
// `studio place` adds one, `studio fill` marks it done, `studio timeline` reads the whole film back.
// Also: the source fingerprint that ties a `studio verify` result to the code it checked.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { die, info, loadFilm, num, saveFilm, tc } from './util.mjs';

const KINDS = ['shot', 'graphic', 'title', 'footage', 'screen', 'voice', 'music', 'sfx', 'caption'];

/** Every chapter and clip still marked pending. */
export const pendingItems = (film) => [
  ...(film.chapters || []).filter((c) => c.pending).map((c) => ({ ...c, type: 'chapter' })),
  ...(film.clips || []).filter((c) => c.pending).map((c) => ({ ...c, type: 'clip' })),
];

export function place(dir, opts) {
  const film = loadFilm(dir);
  const id = opts._[1];
  const start = num(opts.start, NaN);
  const end = num(opts.end, NaN);
  if (!id || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    die('usage: studio place <id> --start 2 --end 4.5 [--label "what it shows"] [--kind graphic] [--chapter id] [--as-chapter]');
  }
  const kind = opts.kind && opts.kind !== true ? String(opts.kind) : 'shot';
  if (!KINDS.includes(kind)) die(`--kind is one of ${KINDS.join(', ')}`);
  const label = typeof opts.label === 'string' ? opts.label : id;
  const list = opts['as-chapter'] ? (film.chapters ||= []) : (film.clips ||= []);
  const existing = list.find((c) => c.id === id);
  if (existing && !existing.pending) die(`${id} is already filled; pick another id or edit film.json`);
  const item = { ...(existing || {}), id, start, end, label, kind, pending: true };
  if (opts.chapter && !opts['as-chapter']) item.chapter = String(opts.chapter);
  if (existing) Object.assign(existing, item);
  else list.push(item);
  list.sort((a, b) => a.start - b.start);
  film.duration = Math.max(num(film.duration, 0), end);
  saveFilm(dir, film);
  info(`placed ${opts['as-chapter'] ? 'chapter' : kind} "${label}" ${start}–${end} s (pending). ${pendingItems(film).length} placeholder(s) to fill.`);
}

export function fill(dir, opts) {
  const film = loadFilm(dir);
  const id = opts._[1];
  if (!id) die('usage: studio fill <id>   (after its content is built)');
  const item = [...(film.clips || []), ...(film.chapters || [])].find((c) => c.id === id);
  if (!item) die(`no clip or chapter "${id}" in film.json`);
  delete item.pending;
  if (typeof opts.label === 'string') item.label = opts.label;
  saveFilm(dir, film);
  const left = pendingItems(film).length;
  info(`filled "${item.label || id}". ${left ? `${left} placeholder(s) left.` : 'No placeholders left: `studio verify`, then `studio sheet`.'}`);
}

/** A compact read-back of the film: the shape, what is still pending, and what the last checks said. */
export function timeline(dir) {
  const film = loadFilm(dir);
  const fps = film.fps || 30;
  const rows = [
    ...(film.chapters || []).map((c) => ({ ...c, type: 'chapter' })),
    ...(film.clips || []).map((c) => ({ ...c, type: c.kind || 'clip' })),
  ].sort((a, b) => a.start - b.start || (a.type === 'chapter' ? -1 : 1));
  info(`${film.title} · ${film.kind} · ${(film.formats || []).map((f) => f.ratio).join(', ')} · ${film.duration} s · style ${film.style || '-'}`);
  for (const r of rows) {
    const indent = r.type === 'chapter' ? '' : '  ';
    info(`${indent}${tc(r.start, fps)}–${tc(r.end, fps)}  ${r.type.padEnd(8)} ${r.id.padEnd(16)} ${r.pending ? '[pending] ' : ''}${r.label || r.title || ''}`);
  }
  const pending = pendingItems(film);
  const lic = (film.assets || []).filter((a) => !a.license || a.license === 'unknown');
  info(`${(film.cues || []).length} cue(s) · ${(film.captions || []).length} caption(s) · ${(film.assets || []).length} asset(s)`);
  if (pending.length) info(`${pending.length} placeholder(s) pending: ${pending.map((p) => p.id).join(', ')}. Fill them all before a full render.`);
  if (lic.length) info(`${lic.length} asset(s) without a confirmed licence: ${lic.map((a) => a.id).join(', ')}. They can't go in a final.`);
  const v = verifyState(dir);
  info(v.ran ? `last verify: ${v.blocking} blocking, ${v.warnings} warning(s)${v.fresh ? '' : ' (stale: the code changed since)'}` : 'not verified yet');
}

/** Hash of everything that decides the picture: page code, styles, data files (film.json without its Deno ids). */
export function sourceHash(dir) {
  const h = crypto.createHash('sha1');
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (['out', 'assets', 'node_modules', '.git'].includes(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(html|js|mjs|css|json)$/.test(e.name) && e.name !== 'CREDITS.json') files.push(p);
    }
  };
  walk(dir);
  for (const p of files) {
    let body = fs.readFileSync(p);
    if (path.relative(dir, p) === 'film.json') {
      const film = JSON.parse(body.toString());
      delete film.deno;
      delete film.stage;
      body = Buffer.from(JSON.stringify(film));
    }
    h.update(path.relative(dir, p)).update('\0').update(body).update('\0');
  }
  return h.digest('hex');
}

export function verifyState(dir) {
  const file = path.join(dir, 'out', 'verify.json');
  if (!fs.existsSync(file)) return { ran: false };
  const v = JSON.parse(fs.readFileSync(file, 'utf8'));
  const blocking = (v.findings || []).filter((f) => f.severity === 'block').length;
  // A chapter-only verify checks part of the film, so it never counts as the whole film being checked.
  return { ran: !v.chapter, blocking, warnings: (v.findings || []).length - blocking, fresh: v.source === sourceHash(dir) };
}

/** Why this project isn't ready to hand over, or [] when verify is clean and current and the sheet shows the file. */
export function readiness(dir, film, out) {
  const why = [];
  const pending = pendingItems(film);
  if (pending.length) why.push(`${pending.length} placeholder(s) still pending (${pending.map((p) => p.id).join(', ')})`);
  const v = verifyState(dir);
  if (!v.ran) why.push('`studio verify` has not run');
  else if (!v.fresh) why.push('the code changed since the last `studio verify`');
  else if (v.blocking) why.push(`\`studio verify\` has ${v.blocking} blocking finding(s)`);
  const sheetFile = path.join(out, 'sheet.json');
  const sheet = fs.existsSync(sheetFile) ? JSON.parse(fs.readFileSync(sheetFile, 'utf8')) : null;
  if (film.kind === 'still') {
    const pages = fs.existsSync(out) ? fs.readdirSync(out).filter((f) => /^page-\d+\.png$/.test(f)) : [];
    const newest = Math.max(0, ...pages.map((f) => fs.statSync(path.join(out, f)).mtimeMs));
    if (!sheet || sheet.at < newest) why.push('no `studio sheet` of the current pages');
  } else {
    const master = path.join(out, 'master.mp4');
    if (!sheet || sheet.from !== 'encoded' || !fs.existsSync(master) || sheet.encodedMtimeMs !== fs.statSync(master).mtimeMs || sheet.encoded !== 'master.mp4') {
      why.push('no `studio sheet` of the final mixed file (render, mix, then sheet)');
    }
  }
  return why;
}
