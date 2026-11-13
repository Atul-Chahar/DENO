// Render a film to H.264, per format, in 2-second chunks across parallel pages. Chunks are cached, so
// `--from 6 --to 9` re-renders only the chunks that touch those seconds and splices them back (stream copy).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { Film } from './browser.mjs';
import { pendingItems } from './timeline.mjs';
import { formats, info, loadFilm, num, outDir, run, warn } from './util.mjs';

const CHUNK_S = 2;

function encoder(file, fps, sub, w, h) {
  const vf = [];
  if (sub > 1) vf.push(`tmix=frames=${sub}`, `select='eq(mod(n\\,${sub})\\,${sub - 1})'`, `setpts=N/(${fps}*TB)`);
  // Screenshots are full-range RGB/JPEG: convert to TV-range BT.709 explicitly, or players show it washed out.
  vf.push(`scale=${w}:${h}:flags=lanczos:out_color_matrix=bt709:out_range=tv`, 'format=yuv420p');
  const args = ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps * sub), '-i', '-', '-vf', vf.join(','), '-r', String(fps),
    '-c:v', 'libx264', '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-color_range', 'tv',
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
  const fps = num(opts.fps, film.fps || 30);
  const sub = Math.max(1, num(opts.sub, opts.draft ? 1 : film.motionBlur?.samples || 2));
  const scale = opts.draft ? 0.5 : 1;
  const workers = Math.max(1, num(opts.workers, Math.min(6, Math.max(1, os.cpus().length - 2))));
  for (const fmt of formats(film, opts.formats)) {
    const started = Date.now();
    const out = outDir(dir, fmt);
    const chunks = path.join(out, opts.draft ? 'chunks-draft' : 'chunks');
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
      const from = num(opts.from, 0);
      const to = num(opts.to, duration);
      const want = [];
      for (let c = 0; c < total; c++) {
        const a = c * CHUNK_S;
        const b = Math.min(duration, a + CHUNK_S);
        const file = path.join(chunks, `c${String(c).padStart(4, '0')}.mp4`);
        if ((b > from && a < to) || !fs.existsSync(file)) want.push({ c, a, b, file });
      }
      const w = Math.round(fmt.w * scale) - (Math.round(fmt.w * scale) % 2);
      const h = Math.round(fmt.h * scale) - (Math.round(fmt.h * scale) % 2);
      info(`${fmt.ratio}: rendering ${want.length}/${total} chunk(s) · ${fps} fps · ${sub} sub-frame(s) · ${w}×${h} · ${workers} worker(s)`);
      let done = 0;
      const frames = want.reduce((s, j) => s + Math.round((j.b - j.a) * fps), 0);
      const queue = [...want];
      await Promise.all(
        Array.from({ length: Math.min(workers, queue.length) }, async () => {
          const page = await studio.page();
          for (let job = queue.shift(); job; job = queue.shift()) {
            const tmp = `${job.file}.part.mp4`;
            const ff = encoder(tmp, fps, sub, w, h);
            const closed = new Promise((r) => ff.on('close', r));
            const f0 = Math.round(job.a * fps);
            const f1 = Math.round(job.b * fps);
            for (let f = f0; f < f1; f++) {
              for (let s = 0; s < sub; s++) {
                const t = Math.max(0, (f - (sub - 1 - s) / sub) / fps);
                const buf = await studio.grab(page, t, sub > 1 ? 'jpeg' : 'png');
                if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
              }
              done++;
              if (done % 30 === 0) process.stdout.write(`\r  ${done}/${frames} frames · ${((Date.now() - started) / 1000).toFixed(0)} s   `);
            }
            ff.stdin.end();
            const code = await closed;
            if (code !== 0) throw new Error(`ffmpeg failed on chunk ${job.c}`);
            fs.renameSync(tmp, job.file); // never replace a good chunk with a failed one
          }
          await page.close();
        }),
      );
      const list = path.join(chunks, 'list.txt');
      fs.writeFileSync(list, Array.from({ length: total }, (_, c) => `file 'c${String(c).padStart(4, '0')}.mp4'`).join('\n'));
      const silent = path.join(out, opts.draft ? 'draft.mp4' : 'silent.mp4');
      await run('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', silent]);
      if (studio.errors.length) warn(`${studio.errors.length} page error(s) while rendering; run \`studio verify\`. First: ${studio.errors[0]}`);
      info(`\n  → ${path.relative(dir, silent)} · ${((Date.now() - started) / 1000).toFixed(0)} s`);
    } finally {
      await studio.close();
    }
  }
  info(opts.draft ? 'Draft done. Look at it, then `studio render` for full quality.' : 'Picture done. Next: `studio mix` (sound + delivery copies), then `studio sheet` to look at the encoded file.');
}
