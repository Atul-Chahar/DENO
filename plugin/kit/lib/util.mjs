// Small helpers shared by every command: argument parsing, processes, files, formats, output.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const RATIOS = { '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350], '16:9': [1920, 1080], '1.91:1': [1200, 630] };
export const HOME = process.env.DENO_STUDIO_HOME || path.join(os.homedir(), '.deno-studio');

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, inline] = a.slice(2).split('=', 2);
      const next = argv[i + 1];
      if (inline !== undefined) out[k] = inline;
      else if (next !== undefined && !next.startsWith('--')) {
        out[k] = next;
        i++;
      } else out[k] = true;
    } else out._.push(a);
  }
  return out;
}

export const num = (v, d) => (v === undefined || v === true || v === '' ? d : Number(v));

export function die(message, code = 1) {
  process.stderr.write(`studio: ${message}\n`);
  process.exit(code);
}

export const info = (m) => process.stdout.write(`${m}\n`);
export const warn = (m) => process.stderr.write(`! ${m}\n`);

/** Run a process; resolves with stdout (string, or Buffer with {buffer:true}); rejects with stderr on failure. */
export function run(cmd, args, { input, buffer = false, cwd, env, quiet = true, stderr = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, env: env ? { ...process.env, ...env } : process.env, stdio: ['pipe', 'pipe', 'pipe'] });
    const out = [];
    const err = [];
    child.stdout.on('data', (d) => out.push(d));
    child.stderr.on('data', (d) => {
      err.push(d);
      if (!quiet) process.stderr.write(d);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      const stdout = Buffer.concat(out);
      if (code === 0) resolve(stderr ? Buffer.concat(err).toString() : buffer ? stdout : stdout.toString());
      else reject(new Error(`${cmd} exited ${code}: ${Buffer.concat(err).toString().slice(-2000)}`));
    });
    if (input !== undefined) child.stdin.end(input);
    else child.stdin.end();
  });
}

export function which(cmd) {
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    for (const ext of exts) {
      const p = path.join(dir, cmd + ext);
      try {
        fs.accessSync(p, fs.constants.X_OK);
        return p;
      } catch {
        /* keep looking */
      }
    }
  }
  return null;
}

export const readJSON = (p, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (err) {
    if (fallback !== undefined) return fallback;
    throw err;
  }
};
export const writeJSON = (p, v) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n');
};

export function projectDir(required = true) {
  let dir = process.cwd();
  for (;;) {
    if (fs.existsSync(path.join(dir, 'film.json'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  if (required) die('no film.json here or above. Run `studio init <name>` first, or cd into the project.');
  return null;
}

export const loadFilm = (dir) => readJSON(path.join(dir, 'film.json'));
export const saveFilm = (dir, film) => writeJSON(path.join(dir, 'film.json'), film);

/** Formats of a film as [{ratio, w, h, slug}]; `only` filters by a comma list of ratios. */
export function formats(film, only) {
  const list = (film.formats?.length ? film.formats : [{ ratio: '16:9' }]).map((f) => {
    const [dw, dh] = RATIOS[f.ratio] || [1920, 1080];
    return { ratio: f.ratio, w: f.w || dw, h: f.h || dh, slug: String(f.ratio).replace(/[:.]/g, 'x') };
  });
  if (!only || only === true) return list;
  const want = String(only).split(',').map((s) => s.trim());
  const picked = list.filter((f) => want.includes(f.ratio));
  for (const r of want) {
    if (!picked.some((f) => f.ratio === r)) {
      const [w, h] = RATIOS[r] || die(`unknown ratio ${r}; use ${Object.keys(RATIOS).join(', ')}`);
      picked.push({ ratio: r, w, h, slug: r.replace(/[:.]/g, 'x') });
    }
  }
  return picked;
}

export const outDir = (dir, fmt) => path.join(dir, 'out', fmt.slug);
export const tc = (t, fps = 30) => {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const f = Math.floor((t - Math.floor(t)) * fps + 1e-6);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
};
export const safeName = (s) => String(s).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'file';

export async function ffprobeDuration(file) {
  const out = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  return Number(out.trim());
}

/** Decode any audio file to mono float32 PCM at `rate` Hz through ffmpeg. */
export async function decodeAudio(file, rate = 22050) {
  const buf = await run('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(rate), '-f', 'f32le', '-'], { buffer: true });
  return new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
}

/** Write 16-bit PCM WAV from Float32 channels (each channel same length). */
export function writeWav(file, channels, rate) {
  const n = channels[0].length;
  const ch = channels.length;
  const data = Buffer.alloc(n * ch * 2);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, channels[c][i]));
      data.writeInt16LE(Math.round(v * 32767), (i * ch + c) * 2);
    }
  }
  const head = Buffer.alloc(44);
  head.write('RIFF', 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write('WAVE', 8);
  head.write('fmt ', 12);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(ch, 22);
  head.writeUInt32LE(rate, 24);
  head.writeUInt32LE(rate * ch * 2, 28);
  head.writeUInt16LE(ch * 2, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36);
  head.writeUInt32LE(data.length, 40);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([head, data]));
}
