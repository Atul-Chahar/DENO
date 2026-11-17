// Render a film to H.264, per format, in 2-second chunks across parallel pages. Chunks are cached by a
// fingerprint of what can change their picture (chunkKeys: the shared code plus the scenes and chapters that
// overlap them), so after editing one scene only its chunks are rendered again and spliced back (stream copy).
// `--from 6 --to 9` forces those seconds. `--draft`: half size, 15 fps, JPEG frames, no motion blur.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { Film } from './browser.mjs';
import { chunkKeys, pendingItems, sourceHash } from './timeline.mjs';
import { formats, info, loadFilm, num, outDir, readJSON, run, warn, writeJSON } from './util.mjs';

const CHUNK_S = 2;
export const DRAFT_FPS = 15;
/** Shutter as a fraction of a frame: 0.5 is the 180° film look. */
export const SHUTTER = 0.5;

/** When each of `sub` sub-frames of frame `f` is shot: centred on the frame time, spread over the shutter.
 * (They used to trail the frame by (sub−1)/sub of a frame, so blur lagged the picture and the sound.) */
export function subFrameTimes(f, fps, sub, shutter = SHUTTER) {
  if (sub <= 1) return [f / fps];
  return Array.from({ length: sub }, (_, s) => (f + ((s + 0.5) / sub - 0.5) * shutter) / fps);
}

// Sub-frames are averaged in linear light (2.2 gamma, 16-bit), as a camera's shutter would; averaging the
// sRGB values directly makes bright things blur too dark (white over black came out 128, not 186).
const LIN = 'lutrgb=r=gammaval(2.2):g=gammaval(2.2):b=gammaval(2.2)';
const GAM = 'lutrgb=r=gammaval(0.454545):g=gammaval(0.454545):b=gammaval(0.454545)';

function encoder(file, fps, sub, w, h, { draft = false } = {}) {
  const vf = [];
  if (sub > 1) vf.push('format=gbrp16le', LIN, `tmix=frames=${sub}`, `select='eq(mod(n\\,${sub})\\,${sub - 1})'`, GAM, `setpts=N/(${fps}*TB)`);
  // Screenshots are full-range RGB/JPEG: convert to TV-range BT.709 explicitly, or players show it washed out.
  vf.push(`scale=${w}:${h}:flags=${draft ? 'bilinear' : 'lanczos'}:out_color_matrix=bt709:out_range=tv`, 'format=yuv420p');
  const args = ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps * sub), '-i', '-', '-vf', vf.join(','), '-r', String(fps),
    '-c:v', 'libx264', '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709', '-preset', draft ? 'veryfast' : 'medium', '-crf', draft ? '20' : '16', '-pix_fmt', 'yuv420p', '-color_range', 'tv',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', file];
  return spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'inherit'] });
}

export async function render(dir, opts) {
  const film = loadFilm(dir);
  if (film.kind === 'still') return warn('this is a still: use `studio still`.');
  const pending = pendingItems(film);
  if (pending.length && !opts.draft) {
    throw new Error(`${pending.length} placeholder(s) still pending (${pending.map((p) => p.id).join(', ')}). Fill them first, or \`studio render --draft\` to see the shape.`);
  }
  const draft = Boolean(opts.draft);
  const fps = num(opts.fps, draft ? Math.min(DRAFT_FPS, film.fps || 30) : film.fps || 30);
  const sub = Math.max(1, num(opts.sub, draft ? 1 : film.motionBlur?.samples || 2));
  const scale = draft ? 0.5 : 1;
  const frameType = draft ? 'jpeg' : sub > 1 ? 'jpeg' : 'png';
  const workers = Math.max(1, num(opts.workers, Math.min(6, Math.max(1, os.cpus().length - 2))));
  const source = sourceHash(dir);
  for (const fmt of formats(film, opts.formats)) {
    const started = Date.now();
    const out = outDir(dir, fmt);
    const chunks = path.join(out, draft ? 'chunks-draft' : 'chunks');
    fs.mkdirSync(chunks, { recursive: true });
    const studio = await Film.open(dir, fmt, { scale, gpu: !opts['no-gpu'] });
    try {
      const probe = await studio.page();
      const meta = await studio.meta(probe);
      await probe.close();
      const duration = num(opts.dur, meta.duration || film.duration);
      if (!duration) throw new Error('window.DURATION (or film.json duration) is missing');
      if (meta.cues.length) fs.writeFileSync(path.join(out, 'cues.json'), JSON.stringify(meta.cues, null, 1));
      const total = Math.ceil(duration / CHUNK_S);
      const w = Math.round(fmt.w * scale) - (Math.round(fmt.w * scale) % 2);
      const h = Math.round(fmt.h * scale) - (Math.round(fmt.h * scale) % 2);
      const spans = Array.from({ length: total }, (_, c) => ({ a: c * CHUNK_S, b: Math.min(duration, (c + 1) * CHUNK_S) }));
      // Motion blur reaches a quarter frame past each chunk edge; a frame of margin covers it.
      const keys = chunkKeys(dir, film, spans, { settings: JSON.stringify({ fps, sub, w, h, frameType, shutter: SHUTTER, duration }), chapters: meta.chapters, margin: 1 / fps });
      const manifestFile = path.join(chunks, 'chunks.json');
      const manifest = readJSON(manifestFile, {});
      const from = num(opts.from, null);
      const to = num(opts.to, null);
      const forced = (a, b) => opts.all || (from !== null && to !== null ? b > from && a < to : from !== null ? b > from : to !== null ? a < to : false);
      const want = [];
      for (let c = 0; c < total; c++) {
        const { a, b } = spans[c];
        const name = `c${String(c).padStart(4, '0')}.mp4`;
        const file = path.join(chunks, name);
        if (forced(a, b) || !fs.existsSync(file) || manifest[name] !== keys[c]) want.push({ c, a, b, file, name, key: keys[c] });
      }
      info(`${fmt.ratio}: rendering ${want.length}/${total} chunk(s)${want.length < total ? ' (the rest have not changed)' : ''} · ${fps} fps · ${sub} sub-frame(s) · ${w}×${h} · ${frameType} · ${workers} worker(s)`);
      let done = 0;
      const frames = want.reduce((s, j) => s + Math.round(j.b * fps) - Math.round(j.a * fps), 0);
      const queue = [...want];
      await Promise.all(
        Array.from({ length: Math.min(workers, queue.length) }, async () => {
          const page = await studio.page();
          for (let job = queue.shift(); job; job = queue.shift()) {
            const tmp = `${job.file}.part.mp4`;
            const ff = encoder(tmp, fps, sub, w, h, { draft });
            const closed = new Promise((r) => ff.on('close', r));
            const f0 = Math.round(job.a * fps);
            const f1 = Math.round(job.b * fps);
            for (let f = f0; f < f1; f++) {
              for (const t of subFrameTimes(f, fps, sub)) {
                const buf = await studio.grab(page, Math.min(Math.max(0, t), duration - 1e-3), frameType, draft ? 80 : 92);
                if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
              }
              done++;
              if (done % 30 === 0) process.stdout.write(`\r  ${done}/${frames} frames · ${((Date.now() - started) / 1000).toFixed(0)} s   `);
            }
            ff.stdin.end();
            const code = await closed;
            if (code !== 0) throw new Error(`ffmpeg failed on chunk ${job.c}`);
            fs.renameSync(tmp, job.file); // never replace a good chunk with a failed one
            manifest[job.name] = job.key;
            writeJSON(manifestFile, manifest); // after every chunk, so a stopped render keeps what it finished
          }
          await page.close();
        }),
      );
      for (const name of Object.keys(manifest)) if (Number(name.slice(1, 5)) >= total) delete manifest[name];
      writeJSON(manifestFile, manifest);
      const list = path.join(chunks, 'list.txt');
      fs.writeFileSync(list, Array.from({ length: total }, (_, c) => `file 'c${String(c).padStart(4, '0')}.mp4'`).join('\n'));
      const silent = path.join(out, draft ? 'draft.mp4' : 'silent.mp4');
      await run('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', silent]);
      // Which code this file shows, so `studio check` can tell a current render from an old one.
      writeJSON(path.join(out, 'render.json'), { file: path.basename(silent), source, mtimeMs: fs.statSync(silent).mtimeMs, fps, draft });
      if (studio.errors.length) warn(`${studio.errors.length} page error(s) while rendering; run \`studio verify\`. First: ${studio.errors[0]}`);
      info(`\n  → ${path.relative(dir, silent)} · ${((Date.now() - started) / 1000).toFixed(0)} s`);
    } finally {
      await studio.close();
    }
  }
  info(draft ? 'Draft done. Next: `studio check` (verify + one contact sheet at phone size + colour numbers).' : 'Picture done. Next: `studio mix` (sound + delivery copies), then `studio check` to look at the encoded file.');
}
