// `studio matte <name>`: a person matte for every extracted frame of footage `name` (from `studio frames`), so
// titles and captions can sit behind the speaker (lib/footage.js `subject()`). Runs locally; nothing is uploaded.
import fs from 'node:fs';
import path from 'node:path';
import { ensure, worker } from './deps.mjs';
import { die, info, num, readJSON, run, writeJSON } from './util.mjs';

/** Model input size: shorter side `short`, both sides multiples of 32, same aspect as the frames. */
export function modelSize(w, h, short = 384) {
  const s = short / Math.min(w, h);
  const r32 = (x) => Math.max(32, Math.round((x * s) / 32) * 32);
  return { mw: r32(w), mh: r32(h) };
}

export async function matte(dir, opts) {
  const name = opts._[1];
  const framesDir = path.join(dir, 'assets', 'frames', String(name || ''));
  const metaFile = path.join(framesDir, 'frames.json');
  if (!name || !fs.existsSync(metaFile)) die('usage: studio matte <name> [--every 2] [--size 384]   (run `studio frames <video> --name <name>` first)');
  const meta = readJSON(metaFile);
  const probe = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path.join(framesDir, '000001.jpg')]);
  const [w, h] = probe.trim().split(',').map(Number);
  const { mw, mh } = modelSize(w, h, num(opts.size, 384));
  const every = Math.max(1, num(opts.every, 1));
  await ensure('matte');
  const job = path.join(framesDir, 'matte-job.json');
  const outDir = path.join(framesDir, 'matte');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.writeFileSync(job, JSON.stringify({ frames_dir: framesDir, out_dir: outDir, fps: meta.fps, count: meta.count, w, h, mw, mh, every, model: opts.model }));
  info(`Matting ${meta.count} frames of "${name}" at ${mw}×${mh}${every > 1 ? `, every ${every} frames` : ''} (local; first run downloads the model)…`);
  const started = Date.now();
  try {
    await run(process.execPath, [worker('matte.mjs'), job], { quiet: false });
  } finally {
    fs.rmSync(job, { force: true });
  }
  writeJSON(metaFile, { ...meta, matte: { model: opts.model || 'Xenova/modnet', every, size: [mw, mh] } });
  info(`→ assets/frames/${name}/matte/ (${meta.count} mattes, ${((Date.now() - started) / 1000).toFixed(0)} s). Use subject({ back, front, text }, '${name}', lt) from lib/footage.js; then look at a sheet.`);
}
