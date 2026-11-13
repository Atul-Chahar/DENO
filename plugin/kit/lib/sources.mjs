// Getting media in, with zero API keys by default:
// - `studio search youtube <query>` / `studio download "ytsearch5:<query>"` (yt-dlp on the founder's machine);
// - `studio download <link>` (yt-dlp, for footage the founder has the right to use);
// - Openverse: openly licensed images and audio (CC0 / CC BY / CC BY-SA), anonymous by default;
//   `studio openverse register <email>` raises the rate limit;
// - `studio sfx "<sound>"`: the kit's own synthesized sounds (free, licence "synth"), or ElevenLabs on the
//   founder's own key when one is set.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config, setConfig } from './api.mjs';
import { SFX_KINDS, SR, sfx as synthSfx } from './synth.mjs';
import { die, info, loadFilm, num, readJSON, run, safeName, saveFilm, warn, which, writeJSON, writeWav } from './util.mjs';

// Licences a founder can declare for a link they bring. Anything else stays "unknown" and can't go in a final.
const DECLARABLE = ['own', 'licensed', 'cc0', 'cc-by', 'pexels', 'pixabay'];

function recordAsset(dir, film, asset) {
  film.assets = (film.assets || []).filter((a) => a.id !== asset.id);
  film.assets.push(asset);
  const creditsFile = path.join(dir, 'CREDITS.json');
  const credits = readJSON(creditsFile, []).filter((c) => c.id !== asset.id);
  credits.push({ id: asset.id, file: asset.file, license: asset.license, credit: asset.credit, source_url: asset.source_url });
  writeJSON(creditsFile, credits);
}

/** yt-dlp format selector: H.264 + AAC in MP4 when the site has it (plays everywhere, frames extract cleanly). */
export function formatSelector(maxHeight, audioOnly) {
  if (audioOnly) return 'ba[acodec^=mp4a]/ba';
  const h = maxHeight ? `[height<=${maxHeight}]` : '';
  return `bv*[vcodec^=avc1]${h}+ba[acodec^=mp4a]/b[ext=mp4]${h}/bv*${h}+ba/b${h}/b`;
}

const SEARCH = /^ytsearch\d{0,2}:\S/;

function ytdlpPath() {
  const ytdlp = process.env.DENO_STUDIO_YT_DLP || which('yt-dlp');
  if (!ytdlp) die(`yt-dlp is not installed: ${process.platform === 'darwin' ? 'brew install yt-dlp' : 'pipx install yt-dlp (or your package manager)'}`);
  return ytdlp;
}

/** YouTube's own "Creative Commons" flag (CC BY 3.0) is the only licence yt-dlp can read for us. */
export function licenceFromSite(text) {
  return /creative commons/i.test(String(text || '')) ? 'cc-by' : 'unknown';
}

/** `studio search youtube <query>`: find web footage with no Google API key (yt-dlp's ytsearch). */
export async function youtubeSearch(opts) {
  const q = opts._.slice(2).join(' ').trim();
  if (!q) die('usage: studio search youtube <query> [--limit 8]');
  const n = Math.max(1, Math.min(20, num(opts.limit, 8)));
  const out = await run(ytdlpPath(), ['--flat-playlist', '--no-warnings', '-j', `ytsearch${n}:${q}`]).catch((e) => die(`yt-dlp search failed: ${e.message.slice(-300)}`));
  const rows = out.trim().split('\n').filter(Boolean).map((l) => {
    try {
      return JSON.parse(l);
    } catch {
      return null;
    }
  }).filter(Boolean);
  if (!rows.length) return info('Nothing found.');
  for (const r of rows) {
    const url = r.url || r.webpage_url || `https://www.youtube.com/watch?v=${r.id}`;
    const secs = Number(r.duration) ? `${Math.round(r.duration)}s` : '';
    info(`${url.padEnd(44)} ${secs.padEnd(6)} ${String(r.channel || r.uploader || '').slice(0, 24).padEnd(24)} ${r.title || ''}`);
  }
  info('Download one: studio download "<url>" (licence "unknown" = drafts only, unless the video is Creative Commons or the founder holds the rights).');
}

export async function download(dir, opts) {
  const url = opts._[1];
  if (!url || !(/^https?:\/\//.test(url) || SEARCH.test(url))) {
    die('usage: studio download "<link>" | "ytsearch3:<query>" [--name clip] [--max-height 1080] [--audio-only] [--browser chrome|firefox|safari|edge|brave] [--cookies file.txt] [--license own|licensed|cc0|cc-by]\n(quote the link: an unquoted ? or & breaks the shell)');
  }
  const ytdlp = ytdlpPath();
  const film = loadFilm(dir);
  const audioOnly = Boolean(opts['audio-only']);
  const folder = path.join(dir, 'assets', audioOnly ? 'audio' : 'footage');
  fs.mkdirSync(folder, { recursive: true });
  const licence = opts.license && opts.license !== true ? String(opts.license).toLowerCase() : 'unknown';
  if (licence !== 'unknown' && !DECLARABLE.includes(licence)) die(`--license is one of ${DECLARABLE.join(', ')}`);
  const isSearch = SEARCH.test(url);
  // A search can bring several files: keep the founder's --name as a prefix so they stay distinct.
  const stem = opts.name && opts.name !== true ? `${safeName(opts.name)}${isSearch ? '-%(id)s' : ''}` : '%(title).60B [%(id)s]';
  const args = [
    '--no-playlist', '--no-progress', '--restrict-filenames',
    '-f', formatSelector(num(opts['max-height'], 1080), audioOnly),
    '-o', path.join(folder, `${stem}.%(ext)s`),
    '-O', '%(title)s\t%(uploader)s\t%(duration)s\t%(webpage_url)s\t%(extractor_key)s\t%(license)s',
    '-O', 'after_move:filepath', '--no-simulate',
  ];
  if (audioOnly) args.push('-x', '--audio-format', 'm4a');
  else args.push('--merge-output-format', 'mp4');
  if (opts.browser && opts.browser !== true) args.push('--cookies-from-browser', String(opts.browser));
  if (opts.cookies && opts.cookies !== true) args.push('--cookies', path.resolve(String(opts.cookies)));
  info(`Downloading with yt-dlp${opts.browser ? ` (signed in through ${opts.browser})` : ''}…`);
  const out = await run(ytdlp, [...args, url]).catch((e) => die(`yt-dlp could not fetch it: ${e.message.split('\n').filter((l) => /ERROR/.test(l)).join(' ') || e.message.slice(-300)}`));
  const downloads = pairDownloads(out);
  if (!downloads.length) die('yt-dlp finished but no file came down');
  const kind = audioOnly ? (opts.as === 'music' ? 'music' : 'other') : 'video';
  for (const d of downloads) {
    const rel = path.relative(dir, d.file);
    const id = `web:${path.basename(d.file, path.extname(d.file))}`;
    const lic = licence !== 'unknown' ? licence : licenceFromSite(d.license);
    recordAsset(dir, film, { id, kind, file: rel, source: `web:${(d.site || 'link').toLowerCase()}`, license: lic, credit: d.uploader && d.uploader !== 'NA' ? d.uploader : '', source_url: d.pageUrl || (isSearch ? null : url) });
    info(`${rel} · ${d.title || ''} · ${Number(d.duration) ? `${Number(d.duration).toFixed(1)} s` : ''} · licence: ${lic}${lic === 'cc-by' && licence === 'unknown' ? ' (the video is marked Creative Commons; credit the uploader)' : ''}`);
    if (lic === 'unknown') warn('marked "unknown": fine for drafts, blocked in a final. If the founder owns it or holds a licence, download again with --license own|licensed.');
  }
  saveFilm(dir, film);
  const rel = path.relative(dir, downloads[0].file);
  info(audioOnly ? `Next: studio transcribe ${rel}  (word times for cuts), or use it as the music bed.` : `Next: studio frames ${rel}  (footage is drawn from frames), and studio transcribe ${rel} if someone speaks.`);
}

/** yt-dlp prints an info line (tab-separated) then the final path, once per download. */
export function pairDownloads(out) {
  const found = [];
  let meta = null;
  for (const line of String(out).split('\n')) {
    if (!line.trim()) continue;
    if (line.includes('\t')) {
      const [title, uploader, duration, pageUrl, site, license] = line.split('\t');
      meta = { title, uploader, duration, pageUrl, site, license: license === 'NA' ? '' : license };
    } else if (fs.existsSync(line.trim())) {
      found.push({ ...(meta || {}), file: line.trim() });
      meta = null;
    }
  }
  return found;
}

/** The closest synthesized kind for a free-text description ("soft paper whoosh" → whoosh). */
export function synthKindFor(text) {
  const t = String(text).toLowerCase();
  const rules = [
    ['swoosh-out', /swoosh.?out|exit|leave|away/],
    ['whoosh', /whoosh|swoosh|swipe|woosh|swish|fly|slide|transition|wind/],
    ['riser', /rise|riser|build|tension|swell|up.?lift/],
    ['chime', /chime|bell|ding|success|notif|sparkle|ping/],
    ['slam', /slam|impact|hit|boom|crash|punch/],
    ['thump', /thump|thud|drop|land|bass|kick|knock/],
    ['pop', /pop|bubble|appear|blip/],
    ['tick', /tick|clock|count|type|key/],
    ['click', /click|tap|button|press|mouse/],
  ];
  return (rules.find(([, re]) => re.test(t)) || ['pop'])[0];
}

function placeSfx(dir, film, kind, rel, source, license, opts) {
  recordAsset(dir, film, { id: `gen:sfx:${kind}`, kind: 'sfx', file: rel, source, license, credit: '', source_url: null });
  film.sfx = { ...(film.sfx || {}), [kind]: rel };
  const times = opts.at && opts.at !== true ? String(opts.at).split(',').map(Number).filter(Number.isFinite) : [];
  film.cues = [...(film.cues || []), ...times.map((t) => ({ t, kind, gain: num(opts.gain, -8), sfx: 'generated' }))];
  saveFilm(dir, film);
  info(`${rel} → plays on every "${kind}" cue${times.length ? `; placed at ${times.join(', ')} s` : ` (push {t, kind: '${kind}'} into window.CUES, or pass --at)`}. \`studio mix\` puts it in.`);
}

export async function generateSfx(dir, opts) {
  const text = opts._.slice(1).join(' ').trim();
  if (!text) die('usage: studio sfx "<the sound, e.g. soft paper whoosh>" [--as whoosh] [--at 2.4,5.1] [--gain -8] [--synth] [--seed 7] (ElevenLabs only: [--duration 1.2] [--influence 0.4])');
  const key = opts.synth ? '' : process.env.ELEVENLABS_API_KEY || config().elevenlabs_key;
  const film = loadFilm(dir);
  const asKind = opts.as && opts.as !== true ? safeName(String(opts.as)).toLowerCase() : '';
  if (!key) {
    // Free path: the kit's own procedural sounds. No key, no credits, licence "synth".
    const base = SFX_KINDS.includes(asKind) ? asKind : synthKindFor(text);
    const kind = asKind || base;
    const seed = num(opts.seed, 7);
    const rel = path.join('assets', 'sfx', `synth-${kind}.wav`);
    fs.mkdirSync(path.join(dir, 'assets', 'sfx'), { recursive: true });
    writeWav(path.join(dir, rel), [synthSfx(base, seed)], SR);
    info(`Synthesized a "${base}" sound for "${text}" (free, no key; --seed N for a variation; set an ElevenLabs key for a custom sound).`);
    return placeSfx(dir, film, kind, rel, 'kit', 'synth', opts);
  }
  const kind = asKind || safeName(text).toLowerCase().slice(0, 32);
  const body = { text };
  if (opts.duration !== undefined) body.duration_seconds = Math.max(0.5, Math.min(30, num(opts.duration, 1)));
  if (opts.influence !== undefined) body.prompt_influence = Math.max(0, Math.min(1, num(opts.influence, 0.3)));
  info('Generating the sound with ElevenLabs (uses your ElevenLabs credits)…');
  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) die(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const rel = path.join('assets', 'sfx', `gen-${kind}.mp3`);
  fs.mkdirSync(path.join(dir, 'assets', 'sfx'), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), Buffer.from(await res.arrayBuffer()));
  placeSfx(dir, film, kind, rel, 'elevenlabs', 'generated', opts);
}

// --------------------------------------------------------------------------- Openverse

export const OPENVERSE = 'https://api.openverse.org/v1';
// Openverse licence → Deno licence id. Anything else (NC, ND, sampling+) is dropped. `commercial` alone still lets
// BY-ND through (checked live), so searches ask for `commercial,modification` and this table is the second gate.
const OV_LICENCES = { cc0: 'cc0', pdm: 'cc0', by: 'cc-by', 'by-sa': 'cc-by-sa' };
const OV_LENGTH = { sfx: 'shortest', music: 'short,medium' }; // < 30 s; 30 s – 10 min
const OV_FOLDERS = { image: 'images', sfx: 'sfx', music: 'music' };
const OV_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extOf(r, image) {
  const fromType = String(r.filetype || '').toLowerCase().replace('jpeg', 'jpg');
  if (/^[a-z0-9]{2,5}$/.test(fromType)) return fromType;
  const fromUrl = (String(r.url || '').split(/[?#]/)[0].match(/\.([a-z0-9]{2,5})$/i) || [])[1];
  return fromUrl ? fromUrl.toLowerCase().replace('jpeg', 'jpg') : image ? 'jpg' : 'mp3';
}

/** One Openverse result in Deno's asset shape, or null when its licence can't go in marketing. */
export function openverseItem(r, kind) {
  const license = OV_LICENCES[String(r?.license || '').toLowerCase()];
  if (!license || !r.id || !r.url) return null;
  const image = kind === 'image';
  const ms = Number(r.duration) || 0;
  const k = image ? 'image' : kind === 'sfx' || kind === 'music' ? kind : ms >= 20_000 ? 'music' : 'sfx';
  const tag = `${r.license}${r.license_version ? ` ${r.license_version}` : ''}`;
  return {
    id: `openverse:${r.id}`,
    kind: k,
    title: String(r.title || `Openverse ${r.id}`).slice(0, 120),
    preview_url: r.thumbnail || r.url,
    download_url: r.url,
    source: 'openverse',
    source_url: r.foreign_landing_url || null,
    license,
    credit: `${r.creator || 'Unknown'} via Openverse (${tag})`,
    width: r.width || null,
    height: r.height || null,
    duration: ms ? Math.round(ms / 100) / 10 : null,
    ext: extOf(r, image),
  };
}

/** Bearer header when the founder registered (`studio openverse register`), else {} (anonymous). */
export async function openverseHeaders(fetchImpl = fetch) {
  const c = config();
  if (!c.openverse_client_id || !c.openverse_client_secret) return {};
  if (c.openverse_token && Date.now() < (c.openverse_token_expires || 0) - 60_000) return { Authorization: `Bearer ${c.openverse_token}` };
  try {
    const res = await fetchImpl(`${OPENVERSE}/auth_tokens/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: c.openverse_client_id, client_secret: c.openverse_client_secret }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const t = await res.json();
    setConfig('openverse_token', t.access_token);
    setConfig('openverse_token_expires', Date.now() + (Number(t.expires_in) || 36_000) * 1000);
    return { Authorization: `Bearer ${t.access_token}` };
  } catch (err) {
    warn(`Openverse sign-in failed (${err.message}); searching anonymously. Just registered? Click the link in Openverse's verification email first.`);
    return {};
  }
}

/** Build the search URL (exported for tests). */
export function openverseUrl(kind, query, limit = 8) {
  const params = new URLSearchParams({ q: query, page_size: String(Math.max(1, Math.min(20, limit))), license_type: 'commercial,modification' });
  if (OV_LENGTH[kind]) params.set('length', OV_LENGTH[kind]);
  return `${OPENVERSE}/${kind === 'image' ? 'images' : 'audio'}/?${params}`;
}

/** Search Openverse for images, sound effects or music. No key needed. */
export async function searchOpenverse(kind, query, { limit = 8, fetchImpl = fetch, headers } = {}) {
  if (!['image', 'sfx', 'music'].includes(kind)) throw new Error('Openverse has images, sfx and music');
  const res = await fetchImpl(openverseUrl(kind, query, limit), { headers: headers ?? (await openverseHeaders(fetchImpl)) });
  if (res.status === 429) throw new Error('rate limit reached (anonymous: 20 a minute, 200 a day). `studio openverse register <email>` raises it');
  if (!res.ok) throw new Error(`Openverse ${res.status}`);
  const body = await res.json();
  return (body.results || []).map((r) => openverseItem(r, kind)).filter(Boolean);
}

/** `studio fetch openverse:<id>`: download into assets/ and record the credit in film.json + CREDITS.json. */
export async function fetchOpenverse(dir, opts, fetchImpl = fetch) {
  const id = String(opts._[1] || '');
  const uuid = id.slice('openverse:'.length);
  if (!OV_ID.test(uuid)) die('usage: studio fetch openverse:<id from `studio search`> [--as whoosh]');
  const headers = await openverseHeaders(fetchImpl);
  let item = null;
  for (const [route, kind] of [['images', 'image'], ['audio', undefined]]) {
    const res = await fetchImpl(`${OPENVERSE}/${route}/${uuid}/`, { headers });
    if (res.status === 404) continue;
    if (!res.ok) die(`Openverse ${res.status} for ${id}`);
    const r = await res.json();
    item = openverseItem(r, kind);
    if (!item) die(`${id} has a licence that can't be used in marketing (${r.license || 'none'}); pick another`);
    break;
  }
  if (!item) die(`Openverse has no ${id}`);
  if (opts.as && opts.as !== true && item.kind === 'music') item.kind = 'sfx'; // asked for it as a hit
  const file = path.join('assets', OV_FOLDERS[item.kind], `${safeName(id)}.${item.ext}`);
  const res = await fetchImpl(item.download_url, { redirect: 'follow' });
  if (!res.ok) die(`download failed: ${res.status} (${item.download_url})`);
  fs.mkdirSync(path.join(dir, path.dirname(file)), { recursive: true });
  fs.writeFileSync(path.join(dir, file), Buffer.from(await res.arrayBuffer()));
  const film = loadFilm(dir);
  recordAsset(dir, film, { id, kind: item.kind, file, source: 'openverse', license: item.license, credit: item.credit, source_url: item.source_url });
  if (opts.as && opts.as !== true && item.kind === 'sfx') film.sfx = { ...(film.sfx || {}), [String(opts.as).replace(/^sfx:/, '')]: file };
  if (item.kind === 'music' && !film.audio?.music) film.audio = { ...(film.audio || {}), music: { file, gain: -8, start: 0 } };
  saveFilm(dir, film);
  info(`${file} · ${item.license} · ${item.credit}${item.license !== 'cc0' ? '\nCredit required: it is in CREDITS.json; paste it in the post.' : ''}`);
  return item;
}

/** `studio openverse register <email>`: get API credentials for a higher rate limit (optional). */
export async function openverseCommand(opts, fetchImpl = fetch) {
  const [, sub, email] = opts._;
  if (sub !== 'register' || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email))) {
    die('usage: studio openverse register <your email>\n(optional: Openverse works without it; registering raises the 200-a-day anonymous limit)');
  }
  const res = await fetchImpl(`${OPENVERSE}/auth_tokens/register/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `deno-studio-${crypto.randomBytes(4).toString('hex')}`,
      description: "Deno Studio kit: finding openly licensed images and sounds for a founder's own marketing videos.",
      email: String(email),
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.client_id || !body.client_secret) die(`Openverse registration failed (${res.status}): ${JSON.stringify(body).slice(0, 200)}`);
  setConfig('openverse_client_id', body.client_id);
  setConfig('openverse_client_secret', body.client_secret);
  setConfig('openverse_token', undefined);
  info(`Registered with Openverse. Open the email they just sent to ${email} and click the verification link.\nUntil then the kit keeps searching anonymously. Credentials are saved in ~/.deno-studio/config.json (only you can read it).`);
}
