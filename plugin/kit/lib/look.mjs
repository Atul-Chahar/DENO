// The habit of looking: stills, contact sheets (live or from the encoded file), strips, crops, page stills,
// footage frames and product screenshots.
import fs from 'node:fs';
import path from 'node:path';
import { Film } from './browser.mjs';
import { ensure, requireDep, chromiumPath } from './deps.mjs';
import { distance, measure, notes, pool, statsRow } from './stats.mjs';
import { ffprobeDuration, formats, info, loadFilm, num, outDir, run, safeName, saveFilm, tc, warn, writeJSON } from './util.mjs';

/** Lay images out in a labelled grid and screenshot it (Chromium does the layout; no font setup needed). */
async function tile(files, out, { cols = 6, width = 320, label = [] } = {}) {
  cols = Math.max(1, Math.min(cols, files.length));
  await ensure('core');
  const { chromium } = requireDep('playwright-core');
  const browser = await chromium.launch({ executablePath: await chromiumPath() });
  try {
    const small = [];
    for (const f of files) {
      const s = `${f}.thumb.jpg`;
      await run('ffmpeg', ['-v', 'error', '-y', '-i', f, '-vf', `scale=${width}:-2`, '-q:v', '3', s]);
      small.push(s);
    }
    const cells = small
      .map((f, i) => `<figure><img src="data:image/jpeg;base64,${fs.readFileSync(f).toString('base64')}"><figcaption>${label[i] ?? ''}</figcaption></figure>`)
      .join('');
    const page = await browser.newPage({ viewport: { width: cols * (width + 8) + 8, height: 200 } });
    await page.setContent(
      `<style>body{margin:0;background:#fff;font:600 13px ui-monospace,monospace}main{display:grid;grid-template-columns:repeat(${cols},${width}px);gap:8px;padding:8px}figure{margin:0;border:1.5px solid #101613}img{display:block;width:${width}px}figcaption{padding:3px 6px;background:#101613;color:#fff}</style><main>${cells}</main>`,
    );
    await page.waitForFunction(() => [...document.images].every((i) => i.complete));
    // Each frame's box inside the sheet, so the review page can show one frame and scrub the rest.
    const grid = await page.evaluate(() => {
      const main = document.querySelector('main').getBoundingClientRect();
      const r = (v) => Math.round(v * 10) / 10;
      return {
        w: r(main.width),
        h: r(main.height),
        cells: [...document.images].map((img) => {
          const b = img.getBoundingClientRect();
          return { x: r(b.left - main.left), y: r(b.top - main.top), w: r(b.width), h: r(b.height) };
        }),
      };
    });
    await page.locator('main').screenshot({ path: out });
    for (const f of small) fs.rmSync(f, { force: true });
    return grid;
  } finally {
    await browser.close();
  }
}

function sampleTimes(film, duration, opts) {
  const list = opts.at ?? opts.times;
  if (list !== undefined && list !== true) return String(list).split(',').map(Number).filter((t) => Number.isFinite(t) && t >= 0 && t < duration);
  if (opts.range && opts.range !== true) {
    const [a, b] = String(opts.range).split(',').map(Number);
    const every = num(opts.every, 1);
    const out = [];
    for (let t = Math.max(0, a); t <= Math.min(b, duration - 0.01) + 1e-6; t += every) out.push(Math.round(t * 1000) / 1000);
    return out.slice(0, 120);
  }
  const every = num(opts.every, 0);
  if (every > 0) return Array.from({ length: Math.floor(duration / every) + 1 }, (_, i) => Math.min(duration - 0.01, i * every));
  if (film.beatGrid?.bpm && !opts.seconds) {
    const beat = 60 / film.beatGrid.bpm;
    const out = [];
    for (let t = film.beatGrid.offset || 0; t < duration; t += beat * 2) out.push(t);
    if (out.length <= 40) return out;
  }
  const n = Math.min(36, Math.max(6, Math.round(duration)));
  return Array.from({ length: n }, (_, i) => (i * duration) / n + 0.25 * (duration / n));
}

export async function sheet(dir, opts) {
  const film = loadFilm(dir);
  const fmt = formats(film, opts.format || opts.formats)[0];
  const out = outDir(dir, fmt);
  const tmp = path.join(out, 'sheet-frames');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  const encoded = ['master.mp4', 'silent.mp4', 'draft.mp4'].map((f) => path.join(out, f)).find((f) => fs.existsSync(f));
  const phone = Boolean(opts.phone);
  const files = [];
  const labels = [];
  const seconds = [];
  if (film.kind === 'still') {
    const pages = fs.readdirSync(out).filter((f) => /^page-\d+\.png$/.test(f)).sort();
    if (!pages.length) return warn('no pages yet: run `studio still` first.');
    pages.forEach((p, i) => {
      files.push(path.join(out, p));
      labels.push(`page ${i + 1}`);
    });
  } else if (encoded && !opts.live && !opts.chapter) {
    const duration = await ffprobeDuration(encoded);
    const times = phone ? Array.from({ length: Math.min(15, Math.ceil(duration)) }, (_, i) => (i * duration) / Math.min(15, Math.ceil(duration))) : sampleTimes(film, duration, opts);
    for (const [i, t] of times.entries()) {
      const f = path.join(tmp, `${String(i).padStart(3, '0')}.png`);
      await run('ffmpeg', ['-v', 'error', '-y', '-ss', t.toFixed(3), '-i', encoded, '-frames:v', '1', f]);
      files.push(f);
      labels.push(tc(t, film.fps || 30));
      seconds.push(t);
    }
    info(`sheet from the encoded file ${path.relative(dir, encoded)} (what viewers will see)`);
  } else {
    const studio = await Film.open(dir, fmt);
    try {
      const page = await studio.page();
      const meta = await studio.meta(page);
      const duration = meta.duration || film.duration;
      let times = sampleTimes(film, duration, opts);
      if (opts.chapter) {
        const ch = [...meta.chapters, ...(film.chapters || [])].find((c) => c.id === opts.chapter);
        if (!ch) throw new Error(`no chapter "${opts.chapter}" in window.CHAPTERS or film.json`);
        const n = Math.max(6, Math.min(24, Math.round((ch.end - ch.start) * 2)));
        times = Array.from({ length: n }, (_, i) => ch.start + ((i + 0.5) * (ch.end - ch.start)) / n);
      }
      for (const [i, t] of times.entries()) {
        const f = path.join(tmp, `${String(i).padStart(3, '0')}.png`);
        fs.writeFileSync(f, await studio.grab(page, t));
        files.push(f);
        labels.push(tc(t, film.fps || 30));
        seconds.push(t);
      }
    } finally {
      await studio.close();
    }
  }
  const dest = path.join(out, phone ? 'phone.png' : 'contact.png');
  if (!files.length) throw new Error('no frames to show: check --at / --range against the film length');
  const grid = await tile(files, dest, phone ? { cols: 5, width: 360, label: labels } : { cols: num(opts.cols, 6), width: num(opts.width, 320), label: labels });
  const from = film.kind === 'still' ? 'pages' : encoded && !opts.live && !opts.chapter ? 'encoded' : 'live';
  const record = { at: Date.now(), from, sheet: path.basename(dest), frames: labels };
  if (grid && seconds.length === grid.cells.length) {
    record.index = { w: grid.w, h: grid.h, frames: grid.cells.map((c, i) => ({ t: Math.round(seconds[i] * 1000) / 1000, ...c })) };
  }
  if (from === 'encoded') Object.assign(record, { encoded: path.basename(encoded), encodedMtimeMs: fs.statSync(encoded).mtimeMs });
  if (opts.stats || opts.reference) {
    const rows = [];
    for (const [i, f] of files.entries()) rows.push({ at: labels[i], ...(await measure(f)) });
    const all = pool(rows);
    info(`look, all frames: ${statsRow(all)}`);
    for (const r of rows) info(`  ${String(r.at).padEnd(9)} ${statsRow(r)}`);
    for (const n of notes(all)) info(`  note: ${n}`);
    record.stats = { all, frames: rows };
    if (opts.reference && opts.reference !== true) {
      const ref = path.resolve(dir, String(opts.reference));
      if (!fs.existsSync(ref)) throw new Error(`no reference file ${opts.reference}`);
      const isVideo = /\.(mp4|mov|webm|mkv|m4v)$/i.test(ref);
      const refStats = isVideo ? pool(await Promise.all([0.1, 0.3, 0.5, 0.7, 0.9].map(async (p) => measure(ref, p * (await ffprobeDuration(ref)))))) : await measure(ref);
      const d = distance(all, refStats);
      info(`reference ${path.basename(ref)}: ${statsRow(refStats)}`);
      info(`distance to reference: ${d} (0 = same look; under 0.05 is close; over 0.15 is clearly different)`);
      record.reference = { file: path.basename(ref), stats: refStats, distance: d };
    }
  }
  writeJSON(path.join(out, phone ? 'sheet-phone.json' : 'sheet.json'), record);
  if (opts.audio && encoded && film.kind !== 'still') {
    const wave = path.join(out, 'waveform.png');
    try {
      await run('ffmpeg', ['-v', 'error', '-y', '-i', encoded, '-filter_complex', 'showwavespic=s=1920x240:colors=0x101613|0x0B5E3A', '-frames:v', '1', wave]);
      info(`→ ${path.relative(dir, wave)}  (the sound; hits should line up with cuts on the sheet)`);
    } catch {
      warn('no audio in the encoded file yet: run `studio mix` first.');
    }
  }
  info(`→ ${path.relative(dir, dest)}  (read this image before you say it looks right)`);
  return dest;
}

export async function strip(dir, opts) {
  const film = loadFilm(dir);
  const fmt = formats(film, opts.format)[0];
  const fps = film.fps || 30;
  const at = num(opts.at, 0);
  const n = num(opts.n, 12);
  const studio = await Film.open(dir, fmt);
  const tmp = path.join(outDir(dir, fmt), 'strip-frames');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  const files = [];
  const labels = [];
  try {
    const page = await studio.page();
    const f0 = Math.max(0, Math.round(at * fps) - Math.floor(n / 2));
    for (let i = 0; i < n; i++) {
      const t = (f0 + i) / fps;
      const f = path.join(tmp, `${String(i).padStart(3, '0')}.png`);
      fs.writeFileSync(f, await studio.grab(page, t));
      files.push(f);
      labels.push(`F${f0 + i}`);
    }
  } finally {
    await studio.close();
  }
  const dest = path.join(outDir(dir, fmt), `strip-${at.toFixed(2)}.png`);
  await tile(files, dest, { cols: 6, width: 300, label: labels });
  info(`→ ${path.relative(dir, dest)}  (every frame around ${tc(at, fps)})`);
}

export async function crop(dir, opts) {
  const film = loadFilm(dir);
  const fmt = formats(film, opts.format)[0];
  const at = num(opts.at, 0);
  const [x, y, w, h] = String(opts.box || `0,0,${fmt.w},${fmt.h}`).split(',').map(Number);
  const studio = await Film.open(dir, fmt);
  try {
    const page = await studio.page();
    await page.evaluate((t) => window.seek(t), at);
    const dest = path.join(outDir(dir, fmt), `crop-${at.toFixed(2)}.png`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, await page.screenshot({ type: 'png', clip: { x, y, width: w, height: h } }));
    info(`→ ${path.relative(dir, dest)}  (1:1 pixels)`);
  } finally {
    await studio.close();
  }
}

export async function still(dir, opts) {
  const film = loadFilm(dir);
  for (const fmt of formats(film, opts.formats)) {
    const studio = await Film.open(dir, fmt);
    const out = outDir(dir, fmt);
    fs.mkdirSync(out, { recursive: true });
    for (const f of fs.readdirSync(out)) if (/^page-\d+\.png$/.test(f)) fs.rmSync(path.join(out, f));
    try {
      const page = await studio.page();
      const meta = await studio.meta(page);
      const pages = film.kind === 'still' ? meta.pages || film.pages || 1 : 1;
      const files = [];
      for (let p = 0; p < pages; p++) {
        const t = film.kind === 'still' ? p : num(opts.at, num(film.poster, 1));
        const f = path.join(out, `page-${String(p + 1).padStart(2, '0')}.png`);
        fs.writeFileSync(f, await studio.grab(page, t));
        files.push(f);
      }
      info(`${fmt.ratio}: ${files.length} page(s) → ${path.relative(dir, out)}/page-*.png`);
      if (opts.pdf && files.length) {
        const pdf = path.join(out, 'carousel.pdf');
        const pdfPage = await studio.browser.newPage();
        const imgs = files.map((f) => `<img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}">`).join('');
        await pdfPage.setContent(`<style>@page{size:${fmt.w}px ${fmt.h}px;margin:0}body{margin:0}img{display:block;width:${fmt.w}px;height:${fmt.h}px;page-break-after:always}</style>${imgs}`);
        await pdfPage.pdf({ path: pdf, width: `${fmt.w}px`, height: `${fmt.h}px`, printBackground: true });
        info(`  → ${path.relative(dir, pdf)}`);
      }
    } finally {
      await studio.close();
    }
  }
}

export async function frames(dir, opts) {
  const film = loadFilm(dir);
  const src = opts._[1];
  if (!src || !fs.existsSync(path.resolve(dir, src))) throw new Error('usage: studio frames <video file> [--fps 30] [--width 1920] [--name clip]');
  const name = safeName(opts.name || path.basename(src, path.extname(src)));
  const fps = num(opts.fps, film.fps || 30);
  const width = num(opts.width, Math.max(...formats(film).map((f) => f.w)));
  const dest = path.join(dir, 'assets', 'frames', name);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  await run('ffmpeg', ['-v', 'error', '-y', '-i', path.resolve(dir, src), '-vf', `fps=${fps},scale=${width}:-2`, '-q:v', '3', path.join(dest, '%06d.jpg')]);
  const count = fs.readdirSync(dest).filter((f) => f.endsWith('.jpg')).length;
  fs.writeFileSync(path.join(dest, 'frames.json'), JSON.stringify({ name, fps, count, duration: count / fps }, null, 1));
  info(`${count} frames → assets/frames/${name}/ · use footage('${name}', t) from lib/footage.js inside seek(t)`);
}

export async function capture(dir, opts) {
  const url = opts._[1];
  if (!url || !/^https?:\/\//.test(url)) throw new Error('usage: studio capture <https://url> [--name home] [--width 1440 --height 900] [--mobile] [--steps steps.json]');
  await ensure('core');
  const { chromium } = requireDep('playwright-core');
  const browser = await chromium.launch({ executablePath: await chromiumPath() });
  const film = loadFilm(dir);
  try {
    const mobile = Boolean(opts.mobile);
    const ctx = await browser.newContext({
      viewport: { width: num(opts.width, mobile ? 390 : 1440), height: num(opts.height, mobile ? 844 : 900) },
      deviceScaleFactor: 2,
      isMobile: mobile,
    });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
    const shots = [];
    const save = async (name) => {
      const f = path.join(dir, 'assets', 'shots', `${safeName(name)}.png`);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      await page.screenshot({ path: f, fullPage: Boolean(opts.full) });
      shots.push(path.relative(dir, f));
    };
    const steps = opts.steps ? JSON.parse(fs.readFileSync(path.resolve(dir, opts.steps), 'utf8')) : [{ shot: opts.name || 'page' }];
    for (const s of steps) {
      if (s.click) await page.click(s.click);
      if (s.type) await page.fill(s.type[0], s.type[1]);
      if (s.scroll) await page.mouse.wheel(0, s.scroll);
      if (s.wait) await page.waitForTimeout(s.wait);
      if (s.goto) await page.goto(s.goto, { waitUntil: 'networkidle' });
      if (s.shot) await save(s.shot);
    }
    film.assets = film.assets || [];
    for (const f of shots) {
      if (!film.assets.some((a) => a.file === f)) film.assets.push({ id: `shot:${path.basename(f, '.png')}`, kind: 'screenshot', file: f, source: 'own', license: 'own', credit: '', source_url: url });
    }
    saveFilm(dir, film);
    info(`${shots.length} screenshot(s): ${shots.join(', ')}  (real UI, used unchanged)`);
  } finally {
    await browser.close();
  }
}
