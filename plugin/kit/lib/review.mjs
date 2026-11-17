// `studio review`: a review page served from this machine. The film plays from the founder's own disk (it is never
// uploaded), every frame; notes are pinned to frames and kept in review/notes.json, where the AI reads them with
// `studio notes` and answers with `studio reply`. Works with any AI tool: the state is one local file.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chaptersOf } from './timeline.mjs';
import { die, formats, info, loadFilm, num, outDir, readJSON, tc, writeJSON } from './util.mjs';

const KIT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PAGE = path.join(KIT, 'review', 'index.html');
const DEFAULT_PORT = 4747;
export const TAGS = ['pacing', 'text', 'motion', 'sound', 'brand', 'lost-interest', 'facts', 'composition'];

const notesFile = (dir) => path.join(dir, 'review', 'notes.json');
const serverFile = (dir) => path.join(dir, 'review', 'server.json');
export const hasReview = (dir) => fs.existsSync(notesFile(dir));

/** The review state: which round is open, whether the founder said "done", and every note so far. */
export function loadReview(dir) {
  const r = readJSON(notesFile(dir), {});
  return { round: Math.max(1, num(r.round, 1)), done_round: num(r.done_round, 0), notes: Array.isArray(r.notes) ? r.notes : [] };
}
export const saveReview = (dir, r) => writeJSON(notesFile(dir), r);

/** The chapter and clip on screen at `t`, so a note maps to the code that draws that moment. */
export function whereIn(film, t) {
  const at = (list) => (list || []).filter((c) => t >= c.start && t < c.end).sort((a, b) => b.start - a.start)[0];
  const chapter = at(chaptersOf(film));
  const clip = at(film.clips);
  return { chapter: chapter?.id ?? null, clip: clip?.id ?? null };
}

const clamp01 = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.max(0, Math.min(1, Number(v))) : null);

/** Add a founder's note to the open round. Throws on an empty note. */
export function addNote(review, film, body) {
  const text = String(body.text ?? '').trim().slice(0, 2000);
  if (!text) throw new Error('a note needs some text');
  const fps = film.fps || 30;
  const t = Math.max(0, Number(body.t) || 0);
  const tEnd = Number(body.t_end) > t ? Number(body.t_end) : null;
  const n = review.notes.reduce((m, x) => Math.max(m, Number(String(x.id).slice(1)) || 0), 0) + 1;
  const note = {
    id: `n${n}`,
    round: review.round,
    t: Math.round(t * 1000) / 1000,
    t_end: tEnd === null ? null : Math.round(tEnd * 1000) / 1000,
    frame: Math.floor(t * fps + 1e-4),
    x: clamp01(body.x),
    y: clamp01(body.y),
    text,
    tags: (Array.isArray(body.tags) ? body.tags : []).filter((g) => TAGS.includes(g)),
    status: 'open',
    reply: '',
    created: new Date().toISOString(),
    ...whereIn(film, t),
  };
  review.notes.push(note);
  // A new note reopens a round the founder had closed.
  if (review.done_round === review.round) review.done_round = 0;
  return note;
}

/** Notes as short text for the AI: one line each, with time, frame, chapter/clip, spot and tags. */
export function formatNotes(review, film, { all = false } = {}) {
  const fps = film.fps || 30;
  const rows = review.notes.filter((n) => (all ? true : n.round === review.round && n.status === 'open')).sort((a, b) => a.round - b.round || a.t - b.t);
  const state = review.done_round === review.round ? 'the founder is done reviewing' : 'the founder is still reviewing';
  const lines = [`${film.title || 'film'} · review round ${review.round} · ${state} · ${rows.length} ${all ? '' : 'open '}note(s)`];
  for (const n of rows) {
    const where = n.t_end != null ? `${tc(n.t, fps)}–${tc(n.t_end, fps)} (${n.t.toFixed(2)}–${n.t_end.toFixed(2)} s)` : `${tc(n.t, fps)} (${n.t.toFixed(2)} s, F${n.frame})`;
    const place = [n.chapter && `chapter ${n.chapter}`, n.clip && `clip ${n.clip}`].filter(Boolean).join(', ');
    const spot = n.x != null && n.y != null ? ` at x=${n.x.toFixed(2)} y=${n.y.toFixed(2)}` : '';
    const head = all ? `r${n.round} ${n.status} ` : '';
    lines.push(`- [${n.id}] ${head}${where}${place ? ` [${place}]` : ''}${spot}: ${n.text.replace(/\s*\n+\s*/g, ' ')}${n.tags.length ? ` #${n.tags.join(' #')}` : ''}${all && n.reply ? `  → ${n.reply}` : ''}`);
  }
  if (!all && rows.length) {
    lines.push('Fix one note at a time and keep everything else exactly as it is. Answer each: `studio reply <id> fixed "what changed on screen"`, or `studio reply <id> open "why not"`. Then render again and `studio review --next`.');
  }
  return lines.join('\n');
}

/** Answer a note. `fixed` closes it; `open` keeps it open with the reason. */
export function replyNote(review, id, status, text) {
  const note = review.notes.find((n) => n.id === id);
  if (!note) throw new Error(`no note "${id}" (see \`studio notes --all\`)`);
  if (!['fixed', 'open'].includes(status)) throw new Error('status is `fixed` or `open`');
  note.status = status;
  note.reply = String(text ?? '').trim().slice(0, 600);
  note.replied = new Date().toISOString();
  return note;
}

/** The file to review: `--file`, or the newest render of the first format (a fresh draft beats an old master). */
export function pickVideo(dir, film, opts = {}) {
  if (opts.file && opts.file !== true) {
    const f = path.resolve(dir, String(opts.file));
    return fs.existsSync(f) ? f : null;
  }
  const out = outDir(dir, formats(film, opts.format)[0]);
  return (
    ['master.mp4', 'review.mp4', 'silent.mp4', 'draft.mp4']
      .map((f) => path.join(out, f))
      .filter((f) => fs.existsSync(f))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] ?? null
  );
}

function state(dir, opts) {
  const film = loadFilm(dir);
  const review = loadReview(dir);
  const file = pickVideo(dir, film, opts);
  const stat = file ? fs.statSync(file) : null;
  const fmt = formats(film, opts.format)[0];
  return {
    title: film.title || path.basename(dir),
    fps: film.fps || 30,
    duration: film.duration || 0,
    ratio: fmt.ratio,
    width: fmt.w,
    height: fmt.h,
    chapters: chaptersOf(film).map((c) => ({ id: c.id, start: c.start, end: c.end, label: c.label || c.title || c.id })),
    tags: TAGS,
    round: review.round,
    done: review.done_round === review.round,
    notes: review.notes,
    video: stat ? { name: path.relative(dir, file).split(path.sep).join('/'), v: Math.round(stat.mtimeMs), size: stat.size, draft: path.basename(file) === 'draft.mp4' } : null,
  };
}

function sendVideo(req, res, file) {
  const size = fs.statSync(file).size;
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  const head = { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };
  if (!m) {
    res.writeHead(200, { ...head, 'Content-Length': size });
    return fs.createReadStream(file).pipe(res);
  }
  let start = m[1] === '' ? Math.max(0, size - Number(m[2])) : Number(m[1]);
  let end = m[1] === '' || m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  if (start > end || start >= size) {
    res.writeHead(416, { 'Content-Range': `bytes */${size}` });
    return res.end();
  }
  res.writeHead(206, { ...head, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
  return fs.createReadStream(file, { start, end }).pipe(res);
}

async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 64 * 1024) throw new Error('too large');
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString() || '{}');
}

/** The local review server. Only this machine can reach it, and only its own page may change notes. */
export function reviewServer(dir, opts = {}) {
  return http.createServer(async (req, res) => {
    const json = (code, v) => {
      res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(v));
    };
    try {
      const host = String(req.headers.host || '').replace(/:\d+$/, '');
      if (!['127.0.0.1', 'localhost'].includes(host)) return json(403, { error: 'local only' });
      const url = new URL(req.url, 'http://127.0.0.1');
      const write = req.method !== 'GET' && req.method !== 'HEAD';
      if (write) {
        // Another website open in the same browser must not be able to write notes here.
        const origin = req.headers.origin;
        if (origin && new URL(origin).host !== req.headers.host) return json(403, { error: 'wrong origin' });
        if (!String(req.headers['content-type'] || '').startsWith('application/json')) return json(415, { error: 'json only' });
      }
      if (url.pathname === '/' && !write) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data:; media-src 'self'" });
        return fs.createReadStream(PAGE).pipe(res);
      }
      if (url.pathname === '/api/state' && !write) return json(200, state(dir, opts));
      if (url.pathname === '/video' && !write) {
        const file = pickVideo(dir, loadFilm(dir), opts);
        return file ? sendVideo(req, res, file) : json(404, { error: 'no render yet' });
      }
      const film = loadFilm(dir);
      const review = loadReview(dir);
      const done = (v) => {
        saveReview(dir, review);
        return json(200, v);
      };
      if (url.pathname === '/api/notes' && req.method === 'POST') return done(addNote(review, film, await body(req)));
      if (url.pathname === '/api/done' && req.method === 'POST') {
        review.done_round = (await body(req)).done === false ? 0 : review.round;
        return done({ done: review.done_round === review.round });
      }
      const m = /^\/api\/notes\/(n\d+)$/.exec(url.pathname);
      const note = m && review.notes.find((n) => n.id === m[1]);
      if (m && !note) return json(404, { error: 'no such note' });
      if (m && req.method === 'PATCH') {
        const b = await body(req);
        if (typeof b.text === 'string' && b.text.trim()) note.text = b.text.trim().slice(0, 2000);
        if (['open', 'resolved'].includes(b.status)) note.status = b.status;
        return done(note);
      }
      if (m && req.method === 'DELETE') {
        review.notes = review.notes.filter((n) => n !== note);
        return done({ deleted: note.id });
      }
      return json(404, { error: 'not found' });
    } catch (err) {
      return json(400, { error: err.message });
    }
  });
}

async function running(dir) {
  const s = readJSON(serverFile(dir), null);
  if (!s?.port) return null;
  try {
    const res = await fetch(`http://127.0.0.1:${s.port}/api/state`, { signal: AbortSignal.timeout(1500) });
    const st = await res.json();
    return res.ok && st.title === (loadFilm(dir).title || path.basename(dir)) ? s : null;
  } catch {
    return null;
  }
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server.address().port));
  });
}

/** `studio review [--next] [--file f] [--port n]`: start (or reuse) the review page and print its link. */
export async function review(dir, opts) {
  const film = loadFilm(dir);
  if (film.kind === 'still') die('`studio review` is for videos. For stills, read the pages and use `studio upload`.');
  const r = loadReview(dir);
  if (opts.next) {
    r.round += 1;
    r.done_round = 0;
  }
  saveReview(dir, r);
  const file = pickVideo(dir, film, opts);
  const what = file ? `${path.relative(dir, file)}, round ${r.round}` : 'no render yet: `studio render --draft` first, the page picks it up';
  const live = await running(dir);
  if (live) return info(`Review page: http://127.0.0.1:${live.port}/  (${what}; already running)\nWait for the founder: \`studio notes --wait\`.`);
  const server = reviewServer(dir, opts);
  const want = num(opts.port, DEFAULT_PORT);
  const port = await listen(server, want).catch((err) => (err.code === 'EADDRINUSE' && !opts.port ? listen(reviewServer(dir, opts), 0) : Promise.reject(err)));
  writeJSON(serverFile(dir), { port, pid: process.pid, at: new Date().toISOString() });
  const bye = () => {
    fs.rmSync(serverFile(dir), { force: true });
    process.exit(0);
  };
  process.on('SIGINT', bye);
  process.on('SIGTERM', bye);
  info(`Review page: http://127.0.0.1:${port}/  (${what})
The film plays from this disk and is never uploaded. Notes are saved in review/notes.json.
Keep this running (start it in the background). Give the founder the link, then: \`studio notes --wait\`.`);
  await new Promise(() => undefined);
}

/** `studio notes [--wait] [--all]` for a local review: print the notes; `--wait` blocks until the founder is done. */
export async function localNotes(dir, opts) {
  const film = loadFilm(dir);
  if (opts.wait) {
    const limit = Date.now() + num(opts.timeout, 30) * 60_000;
    for (;;) {
      const r = loadReview(dir);
      if (r.done_round === r.round) break;
      if (Date.now() > limit) {
        info(formatNotes(r, film, opts));
        return info('Still waiting for the founder to press "I\'m done reviewing". Run `studio notes --wait` again.');
      }
      await new Promise((ok) => setTimeout(ok, 1000));
    }
  }
  info(formatNotes(loadReview(dir), film, { all: Boolean(opts.all) }));
}

/** `studio reply <note id> fixed|open "one line"`: answer a note; the founder sees it on the review page. */
export function reply(dir, opts) {
  const [, id, status, ...rest] = opts._;
  if (!id || !status) die('usage: studio reply <note id> fixed|open "what changed on screen, or why not"');
  const r = loadReview(dir);
  try {
    const note = replyNote(r, id, status, rest.join(' '));
    saveReview(dir, r);
    const left = r.notes.filter((n) => n.round === r.round && n.status === 'open' && !n.reply).length;
    info(`${note.id} → ${note.status}. ${left ? `${left} note(s) in this round still unanswered.` : 'Every note in this round is answered: render again, then `studio review --next`.'}`);
  } catch (err) {
    die(err.message);
  }
}
