// Synthesized sound effects and a music bed. Deterministic (seeded), owned by us: licence "synth".
export const SR = 48000;

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296) * 2 - 1;
  };
}

const env = (i, n, a, d) => {
  const t = i / SR;
  return Math.min(1, t / Math.max(a, 1e-4)) * Math.exp(-Math.max(0, t - a) / d);
};

function onePoleLP(x, fc) {
  const a = Math.exp((-2 * Math.PI * fc) / SR);
  let y = 0;
  return x.map((v) => (y = (1 - a) * v + a * y));
}
function onePoleHP(x, fc) {
  const lp = onePoleLP(x, fc);
  return x.map((v, i) => v - lp[i]);
}

/** One SFX as a mono Float32Array. kinds: click, tick, pop, whoosh, thump, slam, riser, chime, swoosh-out. */
export function sfx(kind, seed = 7) {
  const r = rng(seed);
  const make = (sec, fn) => Float32Array.from({ length: Math.round(sec * SR) }, (_, i) => fn(i, Math.round(sec * SR)));
  switch (kind) {
    case 'click':
      return onePoleHP(make(0.03, (i, n) => r() * env(i, n, 0.0005, 0.004)), 2500).map((v) => v * 0.9);
    case 'tick':
      return make(0.05, (i, n) => Math.sin((2 * Math.PI * 3200 * i) / SR) * env(i, n, 0.0005, 0.008) * 0.5);
    case 'pop': {
      let ph = 0;
      return make(0.12, (i, n) => {
        const f = 900 * Math.exp(-i / SR / 0.03) + 220;
        ph += (2 * Math.PI * f) / SR;
        return Math.sin(ph) * env(i, n, 0.001, 0.04) * 0.7;
      });
    }
    case 'whoosh':
    case 'swoosh-out': {
      const n = Math.round(0.45 * SR);
      const noise = Float32Array.from({ length: n }, () => r());
      let y = 0;
      return noise.map((v, i) => {
        const p = i / n;
        const shape = kind === 'whoosh' ? Math.sin(Math.PI * p) ** 2 : Math.sin(Math.PI * Math.min(1, p * 1.6)) ** 2 * (1 - p);
        const fc = 300 + 3500 * (kind === 'whoosh' ? p : 1 - p);
        const a = Math.exp((-2 * Math.PI * fc) / SR);
        y = (1 - a) * v + a * y;
        return y * shape * 1.6;
      });
    }
    case 'thump': {
      let ph = 0;
      return make(0.35, (i, n) => {
        const f = 120 * Math.exp(-i / SR / 0.05) + 45;
        ph += (2 * Math.PI * f) / SR;
        return Math.sin(ph) * env(i, n, 0.002, 0.12) * 0.95;
      });
    }
    case 'slam': {
      const body = sfx('thump', seed);
      const crack = onePoleHP(make(0.2, (i, n) => r() * env(i, n, 0.0005, 0.03)), 1200);
      return body.map((v, i) => v + (crack[i] || 0) * 0.6);
    }
    case 'riser': {
      let ph = 0;
      const n = Math.round(1.2 * SR);
      return make(1.2, (i) => {
        const p = i / n;
        ph += (2 * Math.PI * (200 + 900 * p * p)) / SR;
        return (Math.sin(ph) * 0.25 + r() * 0.12 * p) * p * p;
      });
    }
    case 'chime': {
      const freqs = [1046.5, 1568, 2093];
      return make(1.0, (i, n) => freqs.reduce((s, f, k) => s + Math.sin((2 * Math.PI * f * i) / SR) * (0.35 / (k + 1)), 0) * env(i, n, 0.002, 0.35));
    }
    default:
      return sfx('click', seed);
  }
}

export const SFX_KINDS = ['click', 'tick', 'pop', 'whoosh', 'swoosh-out', 'thump', 'slam', 'riser', 'chime'];

/** A minimal music bed: four-chord pad, soft kick on beats, hats on off-beats. Stereo [L, R]. */
export function bed(duration, bpm = 120, seed = 11) {
  const n = Math.round(duration * SR);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const r = rng(seed);
  const beat = 60 / bpm;
  const chords = [
    [220, 261.63, 329.63],
    [174.61, 220, 261.63],
    [196, 246.94, 293.66],
    [164.81, 196, 246.94],
  ];
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const bar = Math.floor(t / (beat * 4));
    const chord = chords[bar % 4];
    const fadeIn = Math.min(1, t / 1.5);
    const fadeOut = Math.min(1, (duration - t) / 1.5);
    let pad = 0;
    for (const f of chord) pad += Math.sin(2 * Math.PI * f * t) * 0.06 + Math.sin(2 * Math.PI * f * 1.003 * t) * 0.04;
    const bt = t % beat;
    const kick = Math.sin(2 * Math.PI * (55 + 80 * Math.exp(-bt / 0.03)) * bt) * Math.exp(-bt / 0.12) * 0.5;
    const ot = (t + beat / 2) % beat;
    const hat = r() * Math.exp(-ot / 0.015) * 0.06;
    const v = (pad + kick) * fadeIn * fadeOut;
    L[i] = v + hat * 0.8;
    R[i] = v + hat * 1.2;
  }
  return [onePoleLP(L, 6000), onePoleLP(R, 6000)];
}
