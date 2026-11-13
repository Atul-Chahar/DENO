// Getting media in, with zero API keys by default:
// - `studio search youtube <query>` / `studio download "ytsearch5:<query>"` (yt-dlp on the founder's machine);
// - `studio download <link>` (yt-dlp, for footage the founder has the right to use);
// - `studio sfx "<sound>"`: the kit's own synthesized sounds (free, licence "synth"), or ElevenLabs on the
//   founder's own key when one is set.
import fs from 'node:fs';
import path from 'node:path';
import { config } from './api.mjs';
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
