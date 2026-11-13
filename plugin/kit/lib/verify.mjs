// `studio verify`: deterministic checks before anyone looks (docs/13 §4.9, playbook "review").
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Film } from './browser.mjs';
import { pendingItems, sourceHash } from './timeline.mjs';
import { formats, info, loadFilm, num, outDir, run, tc, warn, writeJSON } from './util.mjs';

const SCAN = [
  [/\bsetTimeout\s*\(|\bsetInterval\s*\(/, 'timers: frames must be a pure function of t'],
  [/\brequestAnimationFrame\s*\(/, 'requestAnimationFrame: drive everything from seek(t) (fine only in a preview-only branch)'],
  [/\bMath\.random\s*\(/, 'Math.random: use a seeded hash (rand(i, seed) in lib/motion.js)'],
  [/\bDate\.now\s*\(|\bperformance\.now\s*\(|new Date\(\)/, 'wall clock: use t'],
  [/transition\s*:|animation\s*:|@keyframes/, 'CSS transitions/animations: compute styles from t instead'],
  [/<video\b|<audio\b|<iframe\b/i, '<video>/<audio>/<iframe>: draw footage from frames (studio frames) and mix sound with studio mix'],
  [/https?:\/\/fonts\.(googleapis|gstatic)\.com/, 'remote fonts can stall the export: keep fonts in assets/fonts'],
];

function scanSources(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (['out', 'assets', 'node_modules', '.git'].includes(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(html|js|mjs|css)$/.test(e.name) && !p.includes(`${path.sep}lib${path.sep}motion.js`)) {
        fs.readFileSync(p, 'utf8')
          .split('\n')
          .forEach((line, i) => {
            if (/studio-allow|preview-only/.test(line)) return;
            for (const [re, why] of SCAN) if (re.test(line)) out.push({ severity: 'warn', rule: 'source', where: `${path.relative(dir, p)}:${i + 1}`, message: why });
          });
      }
    }
  };
  walk(dir);
  return out;
}

const hash = (buf) => crypto.createHash('sha1').update(buf).digest('hex');

/** PSNR in dB between two PNGs. GPU rasterisation can flip a few pixels by one level (≈ 90–100 dB); carried
 * state shows up far lower, so ≥ 60 dB counts as the same frame. */
async function psnr(a, b) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-psnr-'));
  try {
    fs.writeFileSync(path.join(dir, 'a.png'), a);
    fs.writeFileSync(path.join(dir, 'b.png'), b);
    const out = await run('ffmpeg', ['-i', path.join(dir, 'a.png'), '-i', path.join(dir, 'b.png'), '-lavfi', 'psnr', '-f', 'null', '-'], { stderr: true }).catch((e) => e.message);
    const m = String(out).match(/average:(inf|[\d.]+)/);
    return m ? (m[1] === 'inf' ? Infinity : Number(m[1])) : 0;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function lumaStats(png) {
  const out = await run('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-vf', 'signalstats,metadata=print:file=-', '-f', 'null', '-'], { input: png });
  const get = (k) => Number((out.match(new RegExp(`lavfi\\.signalstats\\.${k}=([\\d.]+)`)) || [])[1]);
  return { avg: get('YAVG'), min: get('YMIN'), max: get('YMAX') };
}

// Runs in the page: every visible text run with its box, font size and family.
function textBoxes() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const el = n.parentElement;
    if (el.closest('[data-studio-placeholder]')) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.15) continue;
    let o = 1;
    for (let e = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity);
    if (o < 0.15) continue;
    const r = document.createRange();
    r.selectNodeContents(n);
    const b = r.getBoundingClientRect();
    if (b.width < 1 || b.height < 1 || b.right < 0 || b.bottom < 0 || b.left > W || b.top > H) continue;
    const clipped = el.scrollWidth > el.clientWidth + 2 && ['hidden', 'clip'].includes(cs.overflowX);
    const family = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    out.push({ text: text.slice(0, 120), x: b.left, y: b.top, w: b.width, h: b.height, size: parseFloat(cs.fontSize), family, fontOk: document.fonts.check(`16px "${family}"`), clipped, caption: Boolean(el.closest('[data-studio-caption]')), id: el.dataset.clip || el.id || '' });
  }
  return { W, H, boxes: out };
}

export async function verify(dir, opts) {
  const film = loadFilm(dir);
  const fmts = formats(film, opts.formats);
  const findings = scanSources(dir);
  const add = (severity, rule, message, t = null, extra = {}) => findings.push({ severity, rule, message, t, ...extra });
  for (const p of pendingItems(film)) add('block', 'pending', `${p.type} "${p.label || p.id}" (${p.start}–${p.end} s) is still a placeholder: build it, then \`studio fill ${p.id}\``, p.start);
  for (const fmt of fmts) {
    const studio = await Film.open(dir, fmt);
    try {
      const page = await studio.page();
      const meta = await studio.meta(page);
      const isStill = film.kind === 'still';
      const duration = isStill ? meta.pages || film.pages || 1 : meta.duration || film.duration;
      if (!duration) add('block', 'duration', 'window.DURATION (or window.PAGES for a still) is missing');
      const fps = film.fps || 30;
      const chapter = opts.chapter ? [...meta.chapters, ...(film.chapters || [])].find((c) => c.id === opts.chapter) : null;
      if (opts.chapter && !chapter) throw new Error(`no chapter "${opts.chapter}" in window.CHAPTERS or film.json`);
      const inRange = (t) => !chapter || (t >= chapter.start && t < chapter.end);
      const times = isStill
        ? Array.from({ length: duration }, (_, p) => p)
        : [...new Set([0, ...Array.from({ length: 12 }, (_, i) => ((i + 0.5) * duration) / 12), ...meta.chapters.map((c) => c.start ?? 0), duration - 1 / fps].map((t) => Math.max(0, Math.round(t * fps) / fps)))].filter(inRange).sort((a, b) => a - b);

      // 1. Purity: the same t gives the same picture in any order, on a fresh page.
      const first = new Map();
      for (const t of times) first.set(t, await studio.grab(page, t));
      const page2 = await studio.page();
      const mismatched = [];
      for (const t of [...times].reverse()) {
        const again = await studio.grab(page2, t);
        if (hash(again) !== hash(first.get(t)) && (await psnr(first.get(t), again)) < 60) mismatched.push(t);
      }
      await page2.close();
      if (mismatched.length) add('block', 'purity', `frames differ when rendered out of order at ${mismatched.map((t) => tc(t, fps)).join(', ')}: something carries state between frames`, mismatched[0]);
      const after = await studio.meta(page);
      if (after.clockReads > 0) add('warn', 'clock', `the page read Date.now/performance.now/Math.random ${after.clockReads} time(s); they are frozen while rendering, so motion that depends on them won't move`);

      // 2. Blank or blown frames.
      for (const t of times) {
        const s = await lumaStats(first.get(t)).catch(() => null);
        if (!s) continue;
        if (s.max - s.min < 6) add('warn', 'blank', `${isStill ? `page ${t + 1}` : tc(t, fps)} is a flat frame (one colour)`, t);
        else if (s.avg > 248) add('warn', 'blown', `${isStill ? `page ${t + 1}` : tc(t, fps)} is almost white`, t);
      }

      // 3. Text: safe area, size, overlap, clipping, fonts; and how long each line stays readable.
      const vertical = fmt.h > fmt.w;
      const minSize = fmt.h * (vertical ? 0.022 : 0.026);
      const seen = new Map();
      const fontWarned = new Set();
      const step = isStill ? 1 : 1 / 10;
      const sampleTs = isStill ? times : Array.from({ length: Math.floor(duration / step) + 1 }, (_, i) => Math.min(duration, i * step)).filter(inRange);
      const flagged = new Set();
      for (const t of sampleTs) {
        await page.evaluate((x) => window.seek(x), t);
        const { W, H, boxes } = await page.evaluate(textBoxes);
        for (const b of boxes) {
          const where = isStill ? `page ${t + 1}` : tc(t, fps);
          const key = (r) => `${r}:${b.text}`;
          const once = (rule, sev, msg) => {
            if (flagged.has(key(rule))) return;
            flagged.add(key(rule));
            add(sev, rule, `${where} “${b.text.slice(0, 50)}”: ${msg}`, t);
          };
          const top = vertical ? 0.1 : 0.05;
          const bottom = vertical ? 0.85 : 0.95;
          if (b.x < W * 0.05 || b.x + b.w > W * 0.95 || b.y < H * top || b.y + b.h > H * bottom) once('safe_area', 'warn', 'outside the safe area');
          if (b.size < minSize) once('small_text', 'warn', `${Math.round(b.size)} px is hard to read on a phone (aim ≥ ${Math.round(minSize)} px)`);
          if (b.clipped) once('clipped', 'block', 'text is cut off by its box');
          if (!b.fontOk && !fontWarned.has(b.family)) {
            fontWarned.add(b.family);
            add('warn', 'font', `font “${b.family}” isn't loaded; the render falls back to another font. Put it in assets/fonts and @font-face it.`, t);
          }
          if (!isStill && !b.caption) {
            const s = seen.get(b.text) || { spans: [], last: -1 };
            if (s.last >= 0 && t - s.last <= step * 1.5) s.spans[s.spans.length - 1][1] = t;
            else s.spans.push([t, t]);
            s.last = t;
            seen.set(b.text, s);
          }
        }
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i];
            const c = boxes[j];
            if (a.caption && c.caption) continue;
            const ix = Math.max(0, Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x));
            const iy = Math.max(0, Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y));
            if (ix * iy > 0.25 * Math.min(a.w * a.h, c.w * c.h) && a.text !== c.text) {
              const k = `overlap:${a.text}|${c.text}`;
              if (!flagged.has(k)) {
                flagged.add(k);
                add('warn', 'overlap', `${isStill ? `page ${t + 1}` : tc(t, fps)} “${a.text.slice(0, 30)}” overlaps “${c.text.slice(0, 30)}”`, t);
              }
            }
          }
        }
      }
      for (const [text, s] of seen) {
        const words = text.split(/\s+/).length;
        const need = Math.max(1, words * 0.3);
        for (const [a, b] of s.spans) {
          const held = b - a + step;
          if (held + 1e-6 < need && b < duration - step) add(held < need * 0.6 ? 'block' : 'warn', 'reading_time', `${tc(a, fps)} “${text.slice(0, 50)}” is readable for ${held.toFixed(1)} s; ${words} words need ${need.toFixed(1)} s`, a);
        }
      }

      // 4. Loop seam.
      if (film.loop && !isStill) {
        const a = hash(await studio.grab(page, 0));
        const b = hash(await studio.grab(page, duration));
        if (a !== b) add('warn', 'seam', 'the last frame is not the first frame: the loop will jump');
      }
      const missing = await page.evaluate(() => [...(window.__studioMatteMissing || [])]);
      if (missing.length) add('warn', 'matte', `behind-subject text over ${missing.join(', ')} has no person matte, so it falls back: run \`studio matte <name>\``);
      for (const e of studio.errors) add('block', 'page_error', e);
      await page.close();
    } finally {
      await studio.close();
    }
  }
  const blocking = findings.filter((f) => f.severity === 'block');
  writeJSON(path.join(dir, 'out', 'verify.json'), { at: new Date().toISOString(), source: sourceHash(dir), chapter: opts.chapter || null, formats: fmts.map((f) => f.ratio), findings });
  if (!findings.length) info('verify: clean. Now look: `studio sheet`.');
  for (const f of findings) (f.severity === 'block' ? warn : info)(`${f.severity === 'block' ? 'BLOCK' : 'warn '} ${f.rule.padEnd(12)} ${f.where ? `${f.where} ` : ''}${f.message}`);
  info(`verify: ${blocking.length} blocking, ${findings.length - blocking.length} warning(s) → out/verify.json`);
  if (blocking.length && !opts['no-fail']) process.exitCode = 1;
  return findings;
}

export { num };
