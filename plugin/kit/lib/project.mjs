// Project commands: init, preview, ideas, search, fetch, upload, notes, doctor.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './browser.mjs';
import { apiUrl, call, putFile } from './api.mjs';
import { fetchOpenverse, searchOpenverse, youtubeSearch } from './sources.mjs';
import { DEPS, chromiumPath, ensure, missing } from './deps.mjs';
import { readiness } from './timeline.mjs';
import { RATIOS, die, formats, info, loadFilm, num, outDir, readJSON, run, safeName, saveFilm, warn, which, writeJSON } from './util.mjs';

const KIT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TEMPLATE = path.join(KIT, 'template');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else if (!fs.existsSync(d)) fs.copyFileSync(s, d);
  }
}

function brandCss(kit) {
  const c = kit?.colors || {};
  const f = kit?.fonts || {};
  const q = (name, fallback) => (name ? `"${name}", ${fallback}` : fallback);
  return `/* From your Deno brand kit (set_brand_kit). Fonts must be local files in assets/fonts with @font-face below. */
:root {
  --paper: ${c.background || '#FAF8F3'};
  --ink: ${c.ink || '#101613'};
  --accent: ${c.accent || '#C6F24E'};
  --display: ${q(f.display, 'Georgia, serif')};
  --body: ${q(f.body, 'system-ui, sans-serif')};
  --mono: ${q(f.mono, 'ui-monospace, monospace')};
}
`;
}

export async function init(opts) {
  const name = opts._[1];
  if (!name) die('usage: studio init <folder> [--idea <idea_id>] [--ratio 9:16[,16:9]] [--duration 20] [--style living-ui] [--still --pages 8 --size 1080x1350]');
  const dir = path.resolve(name);
  if (fs.existsSync(path.join(dir, 'film.json'))) die(`${name} already has a film.json`);
  copyDir(TEMPLATE, dir);
  const still = Boolean(opts.still);
  let ratios = String(opts.ratio || (still ? '4:5' : '16:9')).split(',');
  const custom = opts.size ? String(opts.size).split('x').map(Number) : null;
  for (const r of ratios) if (!RATIOS[r] && !custom) die(`unknown ratio ${r}; use ${Object.keys(RATIOS).join(', ')}`);
  if (custom) ratios = [ratios[0]];
  const film = {
    schema: 'deno.film/1',
    title: opts.title || path.basename(dir),
    kind: still ? 'still' : 'video',
    style: opts.style || null,
    recipe: opts.recipe || null,
    formats: ratios.map((r) => (custom ? { ratio: r, w: custom[0], h: custom[1] } : { ratio: r })),
    fps: num(opts.fps, 30),
    duration: still ? 0 : num(opts.duration, 15),
    pages: still ? num(opts.pages, 1) : 0,
    stage: 'plan',
    poster: 1,
    chapters: [],
    clips: [],
    captions: [],
    cues: [],
    assets: [],
    deno: { idea_id: opts.idea || null, item_id: null, brief_id: opts.brief || null },
  };
  let kit = null;
  if (opts.idea) {
    try {
      kit = (await call('GET', `/projects/${encodeURIComponent(opts.idea)}/brand`)).brand_kit;
      if (!kit) warn('this idea has no brand kit yet: ask your AI to call set_brand_kit with the product URL, then `studio init` again or edit brand.css.');
    } catch (err) {
      warn(`couldn't read the brand kit (${err.message}); using defaults in brand.css`);
    }
  }
  fs.writeFileSync(path.join(dir, 'brand.css'), brandCss(kit));
  if (kit) writeJSON(path.join(dir, 'brand.json'), kit);
  if (still) fs.renameSync(path.join(dir, 'still.html'), path.join(dir, 'index.html'));
  else fs.rmSync(path.join(dir, 'still.html'), { force: true });
  saveFilm(dir, film);
  writeJSON(path.join(dir, 'CREDITS.json'), []);
  info(`Created ${name}/ (${film.kind}, ${ratios.join(', ')}). Files: film.json, index.html, brand.css, lib/, CLAUDE.md, assets/.
Next: write TREATMENT.md and get "go", then build in index.html. \`studio preview\` to watch, \`studio verify\` to check.`);
}

export async function preview(dir, opts) {
  const site = await serve(dir);
  const film = loadFilm(dir);
  const fmt = formats(film, opts.format)[0];
  info(`Preview: ${site.url}/index.html?ratio=${encodeURIComponent(fmt.ratio)}&w=${fmt.w}&h=${fmt.h}
Keys: space play · ← → frame · , . frame · [ ] chapter · l loop chapter · ?t=12.5 jumps. Ctrl+C to stop.`);
  await new Promise(() => undefined);
}

export async function ideas() {
  const page = await call('GET', '/projects?limit=20');
  if (!page.items.length) return info('No ideas yet. Validate one on Deno first.');
  for (const p of page.items) info(`${p.id}  ${p.latest_run?.verdict ? p.latest_run.verdict.toUpperCase().padEnd(8) : '—'.padEnd(8)} ${p.title}`);
}

export async function search(opts) {
  const [, kind, ...q] = opts._;
  if (!kind || !q.length) die('usage: studio search <video|image|sfx|music|icon|youtube> <query> [--orientation portrait] [--max-duration 10]');
  if (kind === 'youtube' || kind === 'web') return youtubeSearch(opts);
  const query = q.join(' ');
  const limit = num(opts.limit, 8);
  // Openverse (CC0 / CC BY / CC BY-SA images and audio) runs from this machine, keyless; Deno's search runs
  // on the server. `--source openverse` or `--source deno` picks one.
  const withOpenverse = ['image', 'sfx', 'music'].includes(kind) && opts.source !== 'deno';
  let res = { results: [], notes: [] };
  if (opts.source !== 'openverse') {
    const params = new URLSearchParams({ kind, q: query, limit: String(limit) });
    if (opts.orientation) params.set('orientation', opts.orientation);
    if (opts['max-duration']) params.set('max_duration', String(opts['max-duration']));
    try {
      res = await call('GET', `/studio/media/search?${params}`);
    } catch (err) {
      if (!withOpenverse) throw err;
      warn(`Deno's media search is unavailable (${err.message}); showing Openverse only.`);
    }
  }
  const ov = withOpenverse ? await searchOpenverse(kind, query, { limit }).catch((err) => (warn(`Openverse: ${err.message}`), [])) : [];
  for (const n of res.notes || []) warn(n);
  for (const r of [...res.results, ...ov]) info(`${r.id.padEnd(26)} ${String(r.width ? `${r.width}×${r.height}` : '').padEnd(10)} ${r.duration ? `${r.duration}s`.padEnd(6) : ''.padEnd(6)} ${r.license.padEnd(8)} ${r.title}`);
  if (res.results.length || ov.length) info('Download one: studio fetch <id>');
  else info('Nothing found. Try other words, `studio search youtube <query>`, or the kit\'s synthesized sounds (`studio sfx`).');
}

export async function fetchAsset(dir, opts) {
  const id = opts._[1];
  if (!id) die('usage: studio fetch <media id from search_media> [--as sfx:whoosh]');
  if (String(id).startsWith('openverse:')) return fetchOpenverse(dir, opts);
  const item = await call('GET', `/studio/media/item?id=${encodeURIComponent(id)}`);
  const folder = { video: 'footage', image: 'images', sfx: 'sfx', music: 'music', icon: 'icons' }[item.kind] || 'media';
  const file = path.join('assets', folder, `${safeName(id)}.${item.ext || 'bin'}`);
  const res = await fetch(item.download_url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  fs.mkdirSync(path.join(dir, path.dirname(file)), { recursive: true });
  fs.writeFileSync(path.join(dir, file), Buffer.from(await res.arrayBuffer()));
  const film = loadFilm(dir);
  film.assets = (film.assets || []).filter((a) => a.id !== id);
  film.assets.push({ id, kind: item.kind, file, source: item.source, license: item.license, credit: item.credit, source_url: item.source_url });
  if (opts.as && item.kind === 'sfx') film.sfx = { ...(film.sfx || {}), [String(opts.as).replace(/^sfx:/, '')]: file };
  if (item.kind === 'music' && !film.audio?.music) film.audio = { ...(film.audio || {}), music: { file, gain: -8, start: 0 } };
  saveFilm(dir, film);
  const credits = readJSON(path.join(dir, 'CREDITS.json'), []).filter((c) => c.id !== id);
  credits.push({ id, file, license: item.license, credit: item.credit, source_url: item.source_url });
  writeJSON(path.join(dir, 'CREDITS.json'), credits);
  info(`${file} · ${item.license} · ${item.credit}${item.kind === 'video' ? `\nFootage is drawn from frames: studio frames ${file}` : ''}`);
}

/** A JPEG copy for the dashboard: at most `width` px wide, stepped down until it fits `maxBytes`. */
export async function toJpeg(src, dest, width, maxBytes) {
  for (const [w, q] of [[width, 4], [width, 7], [Math.round(width * 0.75), 9], [Math.round(width / 2), 12]]) {
    await run('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vf', `scale=w=min(${w}\\,iw):h=-2`, '-q:v', String(q), dest]);
    if (fs.statSync(dest).size <= maxBytes) return dest;
  }
  return dest;
}

async function uploadFile(file, kind) {
  const ext = path.extname(file).slice(1).toLowerCase();
  const size = fs.statSync(file).size;
  const up = await call('POST', '/studio/uploads', { kind, ext, size });
  await putFile(up.upload_url, file, up.content_type);
  return up.path;
}

export async function upload(dir, opts) {
  const film = loadFilm(dir);
  const ideaId = opts.idea || film.deno?.idea_id;
  if (!ideaId) die('which idea is this for? `studio upload --idea <idea_id>` (see `studio ideas`), or set deno.idea_id in film.json');
  const fmt = formats(film, opts.format)[0];
  const out = outDir(dir, fmt);
  // The done gate: nothing goes to the founder until verify is clean on the current code and someone has
  // looked at a contact sheet of the file being sent.
  const why = readiness(dir, film, out);
  if (why.length && (opts.final || !opts.unchecked)) {
    die(`not ready to hand over:\n  - ${why.join('\n  - ')}\nFix these, then upload. (A work-in-progress upload can pass --unchecked; a --final one can't.)`);
  }
  if (why.length) warn(`uploading unchecked (${why.join('; ')}). Tell the founder it is a work in progress.`);
  const files = {};
  const videoUrl = opts['video-url'] && opts['video-url'] !== true ? String(opts['video-url']).trim() : '';
  if (videoUrl) {
    if (!/^https:\/\/\S{4,990}$/.test(videoUrl)) die('--video-url must be a full https:// link (YouTube unlisted, R2, a tunnel)');
    // A direct file plays in a <video>; anything else (YouTube, Vimeo, a page) is embedded as a link.
    if (/\.(mp4|webm|m3u8)(\?|$)/i.test(videoUrl)) film.stream_url = videoUrl;
    else film.external_url = videoUrl;
  }
  if (film.kind === 'still') {
    const pages = fs.readdirSync(out).filter((f) => /^page-\d+\.png$/.test(f)).sort();
    if (!pages.length) die('no pages: run `studio still` first');
    files.pages = [];
    for (const p of pages) files.pages.push(await uploadFile(path.join(out, p), 'page'));
    files.poster = files.pages[0];
  } else {
    // Only light files go to Deno (about 250 KB a version); the master and review MP4s stay in out/.
    const poster = ['poster.png', 'poster.jpg'].map((f) => path.join(out, f)).find((f) => fs.existsSync(f));
    if (poster) files.poster = await uploadFile(await toJpeg(poster, path.join(out, 'poster.upload.jpg'), 960, 300 * 1024), 'poster');
    if (fs.existsSync(path.join(dir, 'captions.vtt'))) files.captions = await uploadFile(path.join(dir, 'captions.vtt'), 'captions');
    if (opts['with-video']) {
      const review = path.join(out, 'review.mp4');
      if (!fs.existsSync(review)) die('no review copy: run `studio render` and `studio mix` first');
      files.review = await uploadFile(review, 'review');
    }
  }
  const contact = path.join(out, 'contact.png');
  if (fs.existsSync(contact)) {
    files.sheet = await uploadFile(await toJpeg(contact, path.join(out, 'sheet.upload.jpg'), 1600, 500 * 1024), 'sheet');
    const index = readJSON(path.join(out, 'sheet.json'), {}).index;
    if (index && film.kind !== 'still') film.sheet_index = index;
  }
  if (film.kind !== 'still' && !files.sheet && !files.review && !videoUrl && !film.external_url && !film.stream_url) {
    warn('nothing to watch on Deno: run `studio sheet` (a contact sheet the founder can scrub) or pass --video-url.');
  }
  const manifest = { ...film };
  delete manifest.deno;
  const saved = await call('POST', '/studio/versions', {
    idea_id: ideaId,
    item_id: film.deno?.item_id || undefined,
    brief_id: opts.brief || film.deno?.brief_id || undefined,
    manifest,
    files,
    title: opts.title || film.title,
    summary: typeof opts.summary === 'string' ? opts.summary : undefined,
    final: Boolean(opts.final),
  });
  film.deno = { ...(film.deno || {}), idea_id: ideaId, item_id: saved.item_id };
  saveFilm(dir, film);
  const blocking = saved.checks.filter((c) => c.severity === 'block');
  info(`Saved v${saved.version} to Deno Studio → ${saved.review_url}`);
  const sent = Object.values(files).flat().length;
  info(`Sent ${sent} light file(s)${files.review ? ' and the review MP4' : ''}; the master${files.review ? '' : ' and review copy'} stay in ${path.relative(dir, out) || out}.`);
  if (saved.checks.length) info(`Deno's checks: ${blocking.length} blocking, ${saved.checks.length - blocking.length} warning(s):`);
  for (const c of saved.checks.slice(0, 15)) info(`  ${c.severity === 'block' ? 'BLOCK' : 'warn '} ${c.message} → ${c.fix}`);
  if (saved.credits?.length) info(`Credits to paste with the post:\n${saved.credits.map((c) => `  ${c.credit} (${c.license})`).join('\n')}`);
}

export async function notes(dir, opts) {
  const film = dir ? loadFilm(dir) : {};
  const id = opts._[1] || film.deno?.item_id;
  if (!id) die('usage: studio notes [item_id]  (defaults to this project\'s item)');
  const res = await call('GET', `/studio/items/${encodeURIComponent(id)}/notes?open_only=${opts.all ? 'false' : 'true'}`);
  info(`${res.title} · ${res.status} · v${res.current_version}`);
  if (!res.notes.length) info('No open notes.');
  for (const n of res.notes) {
    const where = n.page != null ? `page ${n.page + 1}` : n.t != null ? `${n.t.toFixed(2)}s${n.t_end != null ? `–${n.t_end.toFixed(2)}s` : ''} (F${n.frame})` : '';
    info(`- [${n.id}] v${n.version} ${where}${n.clip_id ? ` clip ${n.clip_id}` : ''}${n.x != null ? ` at ${n.x.toFixed(2)},${n.y.toFixed(2)}` : ''}${n.author === 'system' ? ' (check)' : ''}: ${n.text}${n.tags?.length ? ` #${n.tags.join(' #')}` : ''}`);
  }
  info(res.how);
}

export async function doctor(opts) {
  const ok = (m) => info(`✓ ${m}`);
  const bad = (m) => info(`✗ ${m}`);
  const major = Number(process.versions.node.split('.')[0]);
  major >= 22 ? ok(`Node ${process.versions.node}`) : bad(`Node ${process.versions.node}: need 22 or newer (https://nodejs.org)`);
  for (const tool of ['ffmpeg', 'ffprobe']) {
    if (which(tool)) ok(tool);
    else bad(`${tool} not found: ${process.platform === 'darwin' ? 'brew install ffmpeg' : process.platform === 'win32' ? 'winget install ffmpeg' : 'sudo apt install ffmpeg (or your package manager)'}`);
  }
  if (opts.install) await ensure('core');
  const core = missing('core');
  if (core.length) bad(`render engine not installed: run \`studio doctor --install\` (installs into ${DEPS})`);
  else {
    ok('render engine (playwright-core)');
    const chrome = await chromiumPath({ install: Boolean(opts.install) }).catch(() => null);
    chrome ? ok(`Chromium: ${chrome}`) : bad('no Chromium: run `studio doctor --install`');
  }
  if (which('yt-dlp')) ok('yt-dlp (for `studio download`)');
  else info(`· yt-dlp: only needed for \`studio download\` (${process.platform === 'darwin' ? 'brew install yt-dlp' : 'pipx install yt-dlp, or your package manager'})`);
  for (const g of ['captions', 'voice', 'matte']) {
    if (opts.install && opts[g]) await ensure(g);
    missing(g).length ? info(`· ${g}: installs on first use (or \`studio doctor --install --${g}\`)`) : ok(g);
  }
  info(`· Deno API: ${apiUrl()}`);
  try {
    await call('GET', '/me');
    ok('signed in to Deno');
  } catch {
    bad('not signed in: run `studio login`');
  }
  await run('ffmpeg', ['-hide_banner', '-encoders']).then((o) => (o.includes('libx264') ? ok('H.264 encoder (libx264)') : bad('ffmpeg has no libx264 encoder'))).catch(() => undefined);
}
