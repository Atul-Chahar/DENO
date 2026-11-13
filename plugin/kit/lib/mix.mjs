// `studio mix`: music + SFX from cues + voice → ducked, -14 LUFS / -1 dBTP master, muxed onto each rendered
// format, plus an upload copy, a 720p review copy and a poster (docs/13 §4.7, playbook "sound" + "delivery").
import fs from 'node:fs';
import path from 'node:path';
import { bed, sfx, SFX_KINDS, SR } from './synth.mjs';
import { decodeAudio, ffprobeDuration, formats, info, loadFilm, num, outDir, readJSON, run, warn, writeWav } from './util.mjs';

const LEAD = 0.03; // sound lands just before the contact

async function sfxTrack(dir, film, cues, duration) {
  const L = new Float32Array(Math.ceil((duration + 1) * SR));
  const R = new Float32Array(L.length);
  const library = film.sfx || {}; // kind -> file (licensed SFX fetched with `studio fetch`)
  const cache = new Map();
  const sample = async (kind) => {
    if (cache.has(kind)) return cache.get(kind);
    let s;
    if (library[kind] && fs.existsSync(path.resolve(dir, library[kind]))) s = await decodeAudio(path.resolve(dir, library[kind]), SR);
    else s = sfx(SFX_KINDS.includes(kind) ? kind : 'click');
    cache.set(kind, s);
    return s;
  };
  for (const c of cues) {
    const s = await sample(String(c.kind || 'click'));
    const gain = 10 ** (num(c.gain, -8) / 20);
    const pan = Math.max(-1, Math.min(1, num(c.pan, 0)));
    const at = Math.max(0, Math.round((num(c.t, 0) - LEAD) * SR));
    const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
    const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
    for (let i = 0; i < s.length && at + i < L.length; i++) {
      L[at + i] += s[i] * gl;
      R[at + i] += s[i] * gr;
    }
  }
  return [L, R];
}

export async function mix(dir, opts) {
  const film = loadFilm(dir);
  if (film.kind === 'still') return warn('stills have no sound.');
  const fmts = formats(film, opts.formats);
  const firstOut = outDir(dir, fmts[0]);
  const silent0 = path.join(firstOut, 'silent.mp4');
  if (!fs.existsSync(silent0)) throw new Error('render first: `studio render`');
  const duration = await ffprobeDuration(silent0);
  const audioDir = path.join(dir, 'out', 'audio');
  fs.mkdirSync(audioDir, { recursive: true });

  // Cues: the page's window.CUES (written by render) plus film.json cues and voice cue words.
  const cues = [...readJSON(path.join(firstOut, 'cues.json'), []), ...(film.cues || [])];
  const parts = [];
  if (!opts['no-sfx'] && cues.length) {
    const sfxFile = path.join(audioDir, 'sfx.wav');
    writeWav(sfxFile, await sfxTrack(dir, film, cues, duration), SR);
    parts.push({ file: sfxFile, role: 'sfx' });
  }
  const music = film.audio?.music;
  if (music?.file && fs.existsSync(path.resolve(dir, music.file)) && !opts['no-music']) {
    parts.push({ file: path.resolve(dir, music.file), role: 'music', gain: num(music.gain, -6), start: num(music.start, 0) });
  } else if (opts.bed || film.audio?.bed) {
    const bedFile = path.join(audioDir, 'bed.wav');
    writeWav(bedFile, bed(duration, film.beatGrid?.bpm || 120), SR);
    parts.push({ file: bedFile, role: 'music', gain: -4, start: 0 });
    film.assets = film.assets || [];
  }
  const voice = film.audio?.voice?.file || (fs.existsSync(path.join(dir, 'assets', 'voice.wav')) ? 'assets/voice.wav' : null);
  if (voice && fs.existsSync(path.resolve(dir, voice)) && !opts['no-voice']) parts.push({ file: path.resolve(dir, voice), role: 'voice', gain: 0, start: num(film.audio?.voice?.start, 0) });
  if (!parts.length) {
    warn('nothing to mix (no cues, music, bed or voice). Add window.CUES, `studio beats <track>`, `--bed`, or `studio voice`.');
    return;
  }

  // Build the filter graph: each input trimmed/padded to the film, music ducked under voice.
  const inputs = parts.flatMap((p) => ['-i', p.file]);
  const f = [];
  parts.forEach((p, i) => {
    const delay = Math.round((p.start || 0) * 1000);
    f.push(`[${i}:a]aformat=sample_rates=48000:channel_layouts=stereo,adelay=${delay}|${delay},apad,atrim=0:${duration.toFixed(3)},volume=${num(p.gain, 0)}dB[a${i}]`);
  });
  const vi = parts.findIndex((p) => p.role === 'voice');
  const mi = parts.findIndex((p) => p.role === 'music');
  const labels = parts.map((_, i) => `[a${i}]`);
  if (vi >= 0 && mi >= 0) {
    f.push(`[a${vi}]asplit=2[vkey][vmix]`);
    f.push(`[a${mi}][vkey]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=300[duck]`);
    labels[mi] = '[duck]';
    labels[vi] = '[vmix]';
  }
  const fadeOut = Math.max(0, duration - 0.6).toFixed(3);
  f.push(`${labels.join('')}amix=inputs=${parts.length}:normalize=0,afade=t=in:d=0.03,afade=t=out:st=${fadeOut}:d=0.6,loudnorm=I=-14:TP=-1.5:LRA=11,alimiter=limit=0.82:level=false:attack=1:release=50,aresample=48000[out]`);
  const master = path.join(audioDir, 'master.wav');
  await run('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', f.join(';'), '-map', '[out]', '-t', duration.toFixed(3), master]);
  info(`mixed ${parts.map((p) => p.role).join(' + ')} → out/audio/master.wav (-14 LUFS, -1 dBTP)`);

  for (const fmt of fmts) {
    const out = outDir(dir, fmt);
    const silent = path.join(out, 'silent.mp4');
    if (!fs.existsSync(silent)) {
      warn(`${fmt.ratio}: not rendered yet, skipped`);
      continue;
    }
    const masterMp4 = path.join(out, 'master.mp4');
    await run('ffmpeg', ['-v', 'error', '-y', '-i', silent, '-i', master, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', duration.toFixed(3), '-movflags', '+faststart', masterMp4]);
    await deliver(out, masterMp4, duration, fmt, film);
  }
}

/** Upload copy (platform-friendly bitrate), 720p review copy under ~13 MB, poster frame. */
export async function deliver(out, masterMp4, duration, fmt, film) {
  const upload = path.join(out, 'upload.mp4');
  await run('ffmpeg', ['-v', 'error', '-y', '-i', masterMp4, '-c:v', 'libx264', '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709', '-preset', 'slow', '-crf', '20', '-maxrate', '12M', '-bufsize', '24M', '-vf', 'scale=out_color_matrix=bt709:out_range=tv', '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', upload]);
  const vbr = Math.max(400, Math.min(2500, Math.floor((13 * 8 * 1024) / Math.max(1, duration) - 128)));
  const short = `${fmt.w >= fmt.h ? 'scale=-2:720' : 'scale=720:-2'}:out_color_matrix=bt709:out_range=tv`;
  const review = path.join(out, 'review.mp4');
  await run('ffmpeg', ['-v', 'error', '-y', '-i', masterMp4, '-vf', short, '-c:v', 'libx264', '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709', '-preset', 'slow', '-b:v', `${vbr}k`, '-maxrate', `${vbr * 2}k`, '-bufsize', `${vbr * 2}k`, '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', review]);
  const posterT = Math.min(Math.max(0, num(film.poster, 1)), Math.max(0, duration - 0.05));
  await run('ffmpeg', ['-v', 'error', '-y', '-ss', posterT.toFixed(3), '-i', masterMp4, '-frames:v', '1', path.join(out, 'poster.png')]);
  const mb = (f) => (fs.statSync(f).size / 1048576).toFixed(1);
  info(`${fmt.ratio}: master.mp4 ${mb(masterMp4)} MB · upload.mp4 ${mb(upload)} MB · review.mp4 ${mb(review)} MB · poster.png`);
}
