// `studio voice script.md`: voiceover with word times; `{word}` in the script becomes a cue at the spoken moment.
import fs from 'node:fs';
import path from 'node:path';
import { align, scriptWords, transcribe } from './captions.mjs';
import { config } from './api.mjs';
import { ensure, worker } from './deps.mjs';
import { decodeAudio, info, loadFilm, num, run, saveFilm, writeJSON, writeWav } from './util.mjs';

const RATE = 24000;

function phrasesOf(text) {
  const clean = text.replace(/```[\s\S]*?```/g, ' ').replace(/^#+\s.*$/gm, ' ').replace(/[*_>`]/g, '');
  return clean
    .split(/\n\s*\n|(?<=[.!?])\s+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => /\w/.test(p));
}

async function kokoro(phrases, dir, opts) {
  await ensure('voice');
  const tmp = path.join(dir, 'out', 'voice');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  const job = path.join(tmp, 'job.json');
  fs.writeFileSync(job, JSON.stringify({ phrases: phrases.map((p) => p.replace(/[{}]/g, '')), voice: opts['voice-id'] || 'af_heart', speed: num(opts.speed, 1), out_dir: tmp }));
  info(`Generating ${phrases.length} phrase(s) with Kokoro (local; first run downloads the model)…`);
  const out = JSON.parse(await run(process.execPath, [worker('kokoro.mjs'), job]));
  return Promise.all(out.map((o) => decodeAudio(o.file, RATE)));
}

async function elevenlabs(phrases, opts) {
  const key = process.env.ELEVENLABS_API_KEY || config().elevenlabs_key;
  if (!key) throw new Error('set your key first (in your terminal, not in chat): studio config set elevenlabs_key <key>');
  const voice = opts['voice-id'] || config().elevenlabs_voice || '21m00Tcm4TlvDq8ikWAM';
  const out = [];
  for (const p of phrases) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=pcm_24000`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: p.replace(/[{}]/g, ''), model_id: opts.model || 'eleven_multilingual_v2' }),
    });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const pcm = Buffer.from(await res.arrayBuffer());
    const f = new Float32Array(pcm.length / 2);
    for (let i = 0; i < f.length; i++) f[i] = pcm.readInt16LE(i * 2) / 32768;
    out.push(f);
  }
  return out;
}

async function sarvam(phrases, dir, opts) {
  const key = process.env.SARVAM_API_KEY || config().sarvam_key;
  if (!key) throw new Error('set your key first (in your terminal, not in chat): studio config set sarvam_key <key>');
  const out = [];
  const tmp = path.join(dir, 'out', 'voice');
  fs.mkdirSync(tmp, { recursive: true });
  for (const [i, p] of phrases.entries()) {
    const res = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: { 'api-subscription-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: p.replace(/[{}]/g, ''), target_language_code: opts.language || 'en-IN', speaker: opts['voice-id'] || 'anushka', model: opts.model || 'bulbul:v2' }),
    });
    if (!res.ok) throw new Error(`Sarvam ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = await res.json();
    const f = path.join(tmp, `sarvam-${i}.wav`);
    fs.writeFileSync(f, Buffer.from(body.audios?.[0] || '', 'base64'));
    out.push(await decodeAudio(f, RATE));
  }
  return out;
}

export async function voice(dir, opts) {
  const film = loadFilm(dir);
  const scriptFile = opts._[1];
  if (!scriptFile) throw new Error('usage: studio voice script.md [--engine kokoro|elevenlabs|sarvam] [--voice-id id] [--start 0.5]');
  const text = fs.readFileSync(path.resolve(dir, scriptFile), 'utf8');
  const phrases = phrasesOf(text);
  const engine = opts.engine || 'kokoro';
  const clips = engine === 'elevenlabs' ? await elevenlabs(phrases, opts) : engine === 'sarvam' ? await sarvam(phrases, dir, opts) : await kokoro(phrases, dir, opts);
  const gap = Math.round(num(opts.gap, 0.25) * RATE);
  const total = clips.reduce((s, c) => s + c.length + gap, 0);
  const pcm = new Float32Array(total);
  const spans = [];
  let at = 0;
  clips.forEach((c, i) => {
    pcm.set(c, at);
    spans.push({ phrase: phrases[i], start: at / RATE, end: (at + c.length) / RATE });
    at += c.length + gap;
  });
  const out = path.join(dir, 'assets', 'voice.wav');
  writeWav(out, [pcm], RATE);
  // Word times: align the script against what the voice actually said.
  const heard = await transcribe(out, { language: opts.language?.slice(0, 2) });
  const words = align(scriptWords(text), heard);
  const start = num(opts.start, 0.5);
  const cues = words.filter((w) => w.cue).map((w) => ({ t: Math.round((w.start + start) * 1000) / 1000, kind: opts['cue-sfx'] || 'pop', word: w.text, gain: -12 }));
  writeJSON(path.join(dir, 'voice.json'), { engine, start, phrases: spans, words: words.map((w) => ({ ...w, start: w.start + start, end: w.end + start })) });
  film.audio = { ...(film.audio || {}), voice: { file: 'assets/voice.wav', start, engine } };
  film.cues = [...(film.cues || []).filter((c) => !c.word), ...cues];
  film.assets = (film.assets || []).filter((a) => a.id !== 'voice');
  film.assets.push({ id: 'voice', kind: 'voice', file: 'assets/voice.wav', source: engine, license: engine === 'kokoro' ? 'apache-2.0' : 'generated', credit: engine === 'kokoro' ? 'Voice: Kokoro-82M (Apache-2.0)' : '' });
  saveFilm(dir, film);
  const secs = total / RATE;
  info(`assets/voice.wav · ${secs.toFixed(1)} s · ${phrases.length} phrase(s) · ${cues.length} cue word(s) → film.json cues (window.CUES can read them from film.json). Next: studio captions assets/voice.wav --text ${scriptFile}`);
}
