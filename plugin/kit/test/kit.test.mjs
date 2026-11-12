// Pure-logic tests for the Deno Studio kit. Run: node --test plugin/kit/test
import assert from 'node:assert/strict';
import test from 'node:test';
import { analyse } from '../lib/beats.mjs';
import { align, group, scriptWords, srt, vtt } from '../lib/captions.mjs';
import { bed, sfx, SFX_KINDS, SR } from '../lib/synth.mjs';
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
