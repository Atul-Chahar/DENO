// Person mattes for a folder of footage frames (MODNet portrait matting, Apache-2.0, run locally on the CPU).
// Frames come in and mattes go out through ffmpeg as raw pixels, so no image library is needed.
// Job: { frames_dir, out_dir, fps, count, w, h, mw, mh, every, model }
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { AutoModel, Tensor } from '@huggingface/transformers';

const job = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const { frames_dir: framesDir, out_dir: outDir, fps, count, w, h, mw, mh } = job;
const every = Math.max(1, job.every || 1);

const model = await AutoModel.from_pretrained(job.model || 'Xenova/modnet', { dtype: 'fp32' });

const reader = spawn('ffmpeg', ['-v', 'error', '-framerate', String(fps), '-start_number', '1', '-i', path.join(framesDir, '%06d.jpg'),
  '-frames:v', String(count), '-vf', `scale=${mw}:${mh}:flags=area,format=rgb24`, '-f', 'rawvideo', '-'], { stdio: ['ignore', 'pipe', 'inherit'] });
fs.mkdirSync(outDir, { recursive: true });
// White picture whose alpha is the matte: an element masked with it shows only the person.
const writer = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=white:s=${w}x${h}:r=${fps}`,
  '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', `${mw}x${mh}`, '-r', String(fps), '-i', '-',
  '-filter_complex', `[1:v]scale=${w}:${h}:flags=bicubic[m];[0:v][m]alphamerge,format=rgba`, '-frames:v', String(count),
  '-start_number', '1', path.join(outDir, '%06d.png')], { stdio: ['pipe', 'ignore', 'inherit'] });

const size = mw * mh * 3;
let pending = Buffer.alloc(0);
let index = 0;
let last = null;
const input = new Float32Array(3 * mw * mh);

async function matte(rgb) {
  const plane = mw * mh;
  for (let i = 0; i < plane; i++) {
    input[i] = rgb[i * 3] / 127.5 - 1;
    input[plane + i] = rgb[i * 3 + 1] / 127.5 - 1;
    input[2 * plane + i] = rgb[i * 3 + 2] / 127.5 - 1;
  }
  const { output } = await model({ input: new Tensor('float32', input, [1, 3, mh, mw]) });
  const a = output.data;
  const out = Buffer.alloc(plane);
  for (let i = 0; i < plane; i++) out[i] = Math.max(0, Math.min(255, Math.round(a[i] * 255)));
  return out;
}

const write = (buf) => new Promise((ok) => (writer.stdin.write(buf) ? ok() : writer.stdin.once('drain', ok)));

for await (const chunk of reader.stdout) {
  pending = Buffer.concat([pending, chunk]);
  while (pending.length >= size) {
    const frame = pending.subarray(0, size);
    pending = pending.subarray(size);
    if (index % every === 0 || !last) last = await matte(frame);
    await write(last);
    index++;
    if (index % 30 === 0) process.stderr.write(`\r  ${index}/${count} mattes   `);
  }
}
writer.stdin.end();
const code = await new Promise((r) => writer.on('close', r));
process.stderr.write('\n');
if (code !== 0) process.exit(1);
process.stdout.write(JSON.stringify({ count: index }));
