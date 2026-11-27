/**
 * Quiet UI sounds for the marketing site, synthesized with Web Audio (no files to download).
 * Played only in answer to a click, never on load. Visitors can turn them off; the choice is kept in localStorage.
 */

export type Sound = 'copy' | 'tick' | 'open';

const KEY = 'deno:sound';
const EVENT = 'deno:sound';
let ctx: AudioContext | null = null;

export function soundOn(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean) {
  try {
    window.localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    // Private mode: the choice lasts for this page only.
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: on }));
}

/** Calls `fn` whenever the sound setting changes (in any component). Returns the unsubscribe. */
export function onSoundChange(fn: (on: boolean) => void): () => void {
  const handler = (e: Event) => fn(Boolean((e as CustomEvent<boolean>).detail));
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

function note(ac: AudioContext, freq: number, at: number, length: number, gain: number, type: OscillatorType = 'sine') {
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  amp.gain.setValueAtTime(0.0001, at);
  amp.gain.exponentialRampToValueAtTime(gain, at + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(amp).connect(ac.destination);
  osc.start(at);
  osc.stop(at + length + 0.02);
}

export function play(sound: Sound) {
  if (typeof window === 'undefined' || !soundOn()) return;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  try {
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    const t = ctx.currentTime + 0.005;
    if (sound === 'copy') {
      // Two soft rising notes: "got it".
      note(ctx, 880, t, 0.12, 0.05);
      note(ctx, 1318.5, t + 0.07, 0.18, 0.045);
    } else if (sound === 'open') {
      note(ctx, 523.25, t, 0.1, 0.03, 'triangle');
      note(ctx, 783.99, t + 0.05, 0.12, 0.025, 'triangle');
    } else {
      note(ctx, 1760, t, 0.035, 0.025, 'triangle');
    }
  } catch {
    // Audio blocked by the browser: stay silent.
  }
}
