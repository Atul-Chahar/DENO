// Pure-logic tests for the Deno Studio kit. Run: node --test plugin/kit/test
import assert from 'node:assert/strict';
import test from 'node:test';
import { analyse } from '../lib/beats.mjs';
import { align, group, scriptWords, srt, vtt } from '../lib/captions.mjs';
import { bed, sfx, SFX_KINDS, SR } from '../lib/synth.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseSilence } from '../lib/listen.mjs';
import { modelSize } from '../lib/matte.mjs';
import { formatSelector, generateSfx, licenceFromSite, pairDownloads, synthKindFor } from '../lib/sources.mjs';
import { distance, frameStats, notes, pool } from '../lib/stats.mjs';
import { pendingItems, readiness, sourceHash } from '../lib/timeline.mjs';
import { formats, parseArgs, safeName, tc } from '../lib/util.mjs';

function clickTrack(bpm, seconds, start = 0.3, rate = 22050) {
  const pcm = new Float32Array(Math.round(seconds * rate));
  const beat = 60 / bpm;
  for (let t = start; t < seconds; t += beat) {
    const i0 = Math.round(t * rate);
    for (let i = 0; i < 800 && i0 + i < pcm.length; i++) pcm[i0 + i] += Math.sin((2 * Math.PI * 80 * i) / rate) * Math.exp(-i / 300);
  }
  return pcm;
}

test('beats: tempo and phase of a click track', () => {
  const r = analyse(clickTrack(120, 20));
  assert.ok(Math.abs(r.bpm - 120) < 1, `bpm ${r.bpm}`);
  const err = r.beats.map((b) => Math.abs(((b - 0.3 + 0.25) % 0.5) - 0.25));
  assert.ok(Math.max(...err) < 0.03, `beat error ${Math.max(...err)}`);
  assert.ok(r.beats[0] >= 0.25, 'no beats in the leading silence');
  assert.equal(r.downbeats.length, Math.ceil(r.beats.length / 4) - (r.beats.length % 4 === 0 ? 0 : 0) || r.downbeats.length);
});

test('captions: script words keep cue markers', () => {
  const words = scriptWords('# Title\nWe cut it to {one} afternoon.');
  assert.deepEqual(words.map((w) => w.text), ['We', 'cut', 'it', 'to', 'one', 'afternoon.']);
  assert.equal(words.find((w) => w.text === 'one').cue, true);
});

test('captions: alignment transfers times and fills misheard words', () => {
  const script = scriptWords('Your PRs wait three days');
  const heard = [
    { text: 'Your', start: 0.1, end: 0.3 },
    { text: 'peers', start: 0.3, end: 0.6 },
    { text: 'wait', start: 0.6, end: 0.9 },
    { text: 'three', start: 0.9, end: 1.2 },
    { text: 'days', start: 1.2, end: 1.5 },
  ];
  const out = align(script, heard);
  assert.deepEqual(out.map((w) => w.text), ['Your', 'PRs', 'wait', 'three', 'days']);
  assert.equal(out[2].start, 0.6);
  assert.ok(out[1].start >= 0.3 && out[1].end <= 0.6);
});

test('captions: vertical groups are short and never end on a weak word', () => {
  const words = 'Your pull requests wait three days for a review.'.split(' ').map((text, i) => ({ text, start: i * 0.3, end: i * 0.3 + 0.25 }));
  const groups = group(words, { vertical: true });
  assert.ok(groups.every((g) => g.words.length <= 4));
  assert.ok(groups.slice(0, -1).every((g) => !['a', 'for', 'to', 'the'].includes(g.words.at(-1).text.toLowerCase())));
  assert.equal(groups.map((g) => g.text).join(' '), words.map((w) => w.text).join(' '));
});

test('captions: SRT and VTT formats', () => {
  const groups = [{ start: 0.5, end: 1.75, text: 'Hello there' }];
  assert.equal(srt(groups), '1\n00:00:00,500 --> 00:00:01,750\nHello there\n');
  assert.ok(vtt(groups).startsWith('WEBVTT\n\n00:00:00.500 --> 00:00:01.750\nHello there'));
});

test('synth: every SFX is finite, bounded and deterministic', () => {
  for (const k of SFX_KINDS) {
    const a = sfx(k);
    const b = sfx(k);
    assert.ok(a.length > 0 && a.every(Number.isFinite), k);
    assert.ok(Math.max(...a.map(Math.abs)) < 2, k);
    assert.deepEqual(a, b, `${k} is deterministic`);
  }
  const [L, R] = bed(2, 120);
  assert.equal(L.length, 2 * SR);
  assert.equal(R.length, 2 * SR);
});

test('util: formats, args, names, timecodes', () => {
  assert.deepEqual(formats({ formats: [{ ratio: '9:16' }] }).map((f) => [f.w, f.h, f.slug]), [[1080, 1920, '9x16']]);
  assert.deepEqual(formats({ formats: [{ ratio: '16:9' }] }, '1:1').map((f) => f.ratio), ['1:1']);
  assert.deepEqual(parseArgs(['render', '--from', '2', '--draft', '--formats=9:16']), { _: ['render'], from: '2', draft: true, formats: '9:16' });
  assert.equal(safeName('pexels:v:123'), 'pexels-v-123');
  assert.equal(tc(61.5, 30), '01:01:15');
});

const solid = (n, r, g, b) => Uint8Array.from({ length: n * 3 }, (_, i) => [r, g, b][i % 3]);

test('stats: exposure, clipping, contrast and casts', () => {
  const half = new Uint8Array([...solid(50, 0, 0, 0), ...solid(50, 255, 255, 255)]);
  const s = frameStats(half);
  assert.equal(s.crushed, 0.5);
  assert.equal(s.blown, 0.5);
  assert.ok(s.contrast > 0.95);
  assert.ok(notes(s).some((n) => n.includes('pure black')));
  const warm = frameStats(solid(100, 200, 120, 60));
  assert.ok(warm.cast.mids.warm > 0.4 && warm.saturation > 0.6);
  assert.ok(notes(warm).some((n) => n.includes('warm')));
  const grey = frameStats(solid(100, 128, 128, 128));
  assert.equal(distance(grey, grey), 0);
  assert.ok(distance(grey, warm) > 0.15);
  assert.deepEqual(pool([grey, grey]).median, grey.median);
});

test('listen: silence parsing closes an open stretch at the end', () => {
  const err = '[silencedetect] silence_start: 1.5\n[silencedetect] silence_end: 2.25 | silence_duration: 0.75\n[silencedetect] silence_start: 9.1\n';
  assert.deepEqual(parseSilence(err, 10), [{ start: 1.5, end: 2.25, length: 0.75 }, { start: 9.1, end: 10, length: 0.9 }]);
  assert.deepEqual(parseSilence('nothing here'), []);
});

test('matte: model size keeps aspect in multiples of 32', () => {
  assert.deepEqual(modelSize(1920, 1080), { mw: 672, mh: 384 });
  assert.deepEqual(modelSize(1080, 1920), { mw: 384, mh: 672 });
  const { mw, mh } = modelSize(1000, 1000, 500);
  assert.equal(mw % 32, 0);
  assert.equal(mw, mh);
});

test('download: format selector prefers H.264/AAC under the height cap', () => {
  assert.match(formatSelector(1080, false), /^bv\*\[vcodec\^=avc1\]\[height<=1080\]\+ba\[acodec\^=mp4a\]/);
  assert.equal(formatSelector(0, true), 'ba[acodec^=mp4a]/ba');
});

test('captions: a preset caps words per caption', () => {
  const words = 'one two three four five six seven'.split(' ').map((text, i) => ({ text, start: i * 0.3, end: i * 0.3 + 0.25 }));
  assert.ok(group(words, { vertical: false, max: 3 }).every((g) => g.words.length <= 3));
  assert.equal(group(words, { vertical: false, max: 7 }).length, 1);
});

test('timeline: placeholders, source fingerprint and the done gate', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-test-'));
  try {
    const film = { kind: 'video', clips: [{ id: 'a', start: 0, end: 1, pending: true }, { id: 'b', start: 1, end: 2 }], chapters: [{ id: 'c', start: 0, end: 2, pending: true }], deno: { item_id: 'x' } };
    fs.writeFileSync(path.join(dir, 'film.json'), JSON.stringify(film));
    fs.writeFileSync(path.join(dir, 'index.html'), '<p>hi</p>');
    assert.deepEqual(pendingItems(film).map((p) => p.id), ['c', 'a']);
    const h = sourceHash(dir);
    // Deno ids don't change what's drawn; the page code does.
    fs.writeFileSync(path.join(dir, 'film.json'), JSON.stringify({ ...film, deno: { item_id: 'y' } }));
    assert.equal(sourceHash(dir), h);
    fs.writeFileSync(path.join(dir, 'index.html'), '<p>changed</p>');
    assert.notEqual(sourceHash(dir), h);
    const out = path.join(dir, 'out', '9x16');
    const why = readiness(dir, film, out);
    assert.ok(why.some((w) => w.includes('pending')));
    assert.ok(why.some((w) => w.includes('verify')));
    assert.ok(why.some((w) => w.includes('sheet')));
    const done = { kind: 'video', clips: [{ id: 'b', start: 0, end: 2 }] };
    fs.writeFileSync(path.join(dir, 'film.json'), JSON.stringify(done));
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'master.mp4'), 'x');
    fs.writeFileSync(path.join(dir, 'out', 'verify.json'), JSON.stringify({ source: sourceHash(dir), findings: [] }));
    fs.writeFileSync(path.join(out, 'sheet.json'), JSON.stringify({ from: 'encoded', encoded: 'master.mp4', encodedMtimeMs: fs.statSync(path.join(out, 'master.mp4')).mtimeMs }));
    assert.deepEqual(readiness(dir, done, out), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('sfx: free text maps to a synthesized kind', () => {
  assert.equal(synthKindFor('soft paper whoosh'), 'whoosh');
  assert.equal(synthKindFor('UI button click'), 'click');
  assert.equal(synthKindFor('success chime'), 'chime');
  assert.equal(synthKindFor('heavy impact'), 'slam');
  assert.equal(synthKindFor('something odd'), 'pop');
  for (const t of ['whoosh', 'click', 'chime', 'slam', 'pop', 'riser', 'thump', 'tick', 'swoosh out']) assert.ok(SFX_KINDS.includes(synthKindFor(t)), t);
});

test('sfx: with no key (or --synth) the kit synthesizes a free WAV and places it on cues', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-sfx-'));
  try {
    fs.writeFileSync(path.join(dir, 'film.json'), JSON.stringify({ kind: 'video', assets: [], cues: [] }));
    await generateSfx(dir, { _: ['sfx', 'soft', 'paper', 'whoosh'], synth: true, at: '1.5,3' });
    const film = JSON.parse(fs.readFileSync(path.join(dir, 'film.json'), 'utf8'));
    assert.equal(film.sfx.whoosh, path.join('assets', 'sfx', 'synth-whoosh.wav'));
    assert.deepEqual(film.cues.map((c) => [c.t, c.kind]), [[1.5, 'whoosh'], [3, 'whoosh']]);
    const asset = film.assets.find((a) => a.id === 'gen:sfx:whoosh');
    assert.equal(asset.license, 'synth');
    const wav = fs.readFileSync(path.join(dir, film.sfx.whoosh));
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.readUInt32LE(24), SR);
    assert.ok(wav.length > 44 + 1000);
    const credits = JSON.parse(fs.readFileSync(path.join(dir, 'CREDITS.json'), 'utf8'));
    assert.equal(credits[0].license, 'synth');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('download: YouTube Creative Commons is read; several search results pair with their files', () => {
  assert.equal(licenceFromSite('Creative Commons Attribution license (reuse allowed)'), 'cc-by');
  assert.equal(licenceFromSite(''), 'unknown');
  assert.equal(licenceFromSite('NA'), 'unknown');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-dl-'));
  try {
    const a = path.join(dir, 'a.mp4');
    const b = path.join(dir, 'b.mp4');
    fs.writeFileSync(a, '');
    fs.writeFileSync(b, '');
    const out = [
      'Clip A\tAnn\t12\thttps://youtu.be/a\tYoutube\tCreative Commons Attribution license (reuse allowed)',
      '[download] noise',
      a,
      'Clip B\tBo\t9\thttps://youtu.be/b\tYoutube\tNA',
      b,
      '/does/not/exist.mp4',
    ].join('\n');
    const got = pairDownloads(out);
    assert.deepEqual(got.map((d) => [d.title, d.file, d.license]), [['Clip A', a, 'Creative Commons Attribution license (reuse allowed)'], ['Clip B', b, '']]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
