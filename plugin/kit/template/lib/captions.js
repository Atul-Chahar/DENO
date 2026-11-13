// Burned-in captions from captions.json (written by `studio captions`). Pure functions of t.
import { clamp, ramp, spring } from './motion.js';

let data = { words: [], groups: [] };
export async function loadCaptions(url = 'captions.json') {
  try {
    data = await (await fetch(url)).json();
  } catch {
    data = { words: [], groups: [] };
  }
  return data;
}
/** The caption group on screen at t and the index of the word being spoken (-1 between words). */
export function captionAt(t) {
  const g = data.groups.find((x) => t >= x.start && t < x.end + 0.15);
  if (!g) return null;
  const active = g.words.findIndex((w) => t >= w.start && t < w.end + 0.05);
  return { ...g, active };
}

// Four house presets. Each sets the box (where and how big) and how one word looks given its state:
// 'said' (spoken already), 'now' (being spoken; `age` = seconds since it started) or 'next' (not yet spoken).
// Sizes are fractions of the frame's shorter side, so a preset reads the same on 9:16 and 16:9.
export const PRESETS = {
  // Huge stacked words that fill the top of the frame; made to sit behind the speaker (see subject()).
  billboard: {
    words: 3,
    box: (u) => ({ left: '6%', right: '6%', top: '14%', textAlign: 'center', fontFamily: 'var(--display)', fontWeight: '900', textTransform: 'uppercase', fontSize: `${u * 0.165}px`, lineHeight: '0.86', letterSpacing: '-0.03em', color: 'var(--caption-ink, #fff)' }),
    word: (state, age) => (state === 'next' ? { opacity: '0' } : { opacity: '1', transform: `scale(${state === 'now' ? 1.1 - 0.1 * spring(age, 260, 22) : 1})` }),
  },
  // Quiet, left-aligned, with an accent rule: talking heads, interviews, explainers.
  sideline: {
    words: 6,
    box: (u) => ({ left: '7%', maxWidth: '62%', bottom: '22%', textAlign: 'left', fontFamily: 'var(--body)', fontWeight: '600', fontSize: `${u * 0.05}px`, lineHeight: '1.18', color: 'var(--caption-ink, #fff)', borderLeft: `${u * 0.008}px solid var(--accent)`, paddingLeft: `${u * 0.022}px`, textShadow: '0 1px 12px rgba(0,0,0,.45)' }),
    word: (state) => ({ opacity: state === 'next' ? '0.35' : '1', color: state === 'now' ? 'var(--accent)' : '' }),
  },
  // Loud: heavy caps, thick outline, the spoken word pops in the accent colour. High-energy reels.
  'beast-mode': {
    words: 3,
    box: (u) => ({ left: '8%', right: '8%', top: '60%', textAlign: 'center', fontFamily: 'var(--display)', fontWeight: '900', textTransform: 'uppercase', fontSize: `${u * 0.105}px`, lineHeight: '1', color: 'var(--caption-ink, #fff)', webkitTextStroke: `${u * 0.011}px #000`, paintOrder: 'stroke fill', textShadow: `0 ${u * 0.008}px 0 rgba(0,0,0,.65)` }),
    word: (state, age) => (state === 'next' ? { opacity: '0' } : { opacity: '1', color: state === 'now' ? 'var(--accent)' : '', transform: `scale(${state === 'now' ? 0.72 + 0.28 * spring(age, 420, 16) : 1})` }),
  },
  // Soft italic serif that eases in word by word: founder stories, calm product films.
  'butter-serif': {
    words: 7,
    box: (u) => ({ left: '10%', right: '10%', bottom: '20%', textAlign: 'center', fontFamily: 'var(--serif, Georgia, serif)', fontStyle: 'italic', fontWeight: '400', fontSize: `${u * 0.062}px`, lineHeight: '1.2', color: 'var(--caption-ink, #FFF6E8)', textShadow: '0 2px 18px rgba(0,0,0,.35)' }),
    word: (state, age) => {
      if (state === 'next') return { opacity: '0' };
      const p = state === 'now' ? ramp(age, 0, 0.22) : 1;
      return { opacity: String(p), transform: `translateY(${(1 - p) * 0.18}em)` };
    },
  },
};

const kebab = (k) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`).replace(/^webkit/, '-webkit');

/**
 * Paint the caption for time t into `el` (an empty, absolutely positioned element inside #stage) with a preset.
 * `el` keeps the attribute data-studio-caption so `studio verify` times captions by speech, not by reading speed.
 */
export function drawCaption(el, t, { preset = 'beast-mode' } = {}) {
  const p = PRESETS[preset] || PRESETS['beast-mode'];
  el.dataset.studioCaption = preset;
  const cap = captionAt(t);
  if (!cap) {
    el.style.visibility = 'hidden';
    return null;
  }
  const u = Math.min(window.FORMAT?.w || 1920, window.FORMAT?.h || 1080);
  el.style.cssText = 'position:absolute;visibility:visible';
  for (const [k, v] of Object.entries(p.box(u))) el.style.setProperty(kebab(k), v);
  // Fresh spans every frame: an element whose transform changed on earlier frames can rasterise differently,
  // which would make the same t paint different pixels depending on what was rendered before it.
  el.textContent = '';
  cap.words.forEach((w, i) => {
    const s = document.createElement('span');
    s.style.display = 'inline-block';
    s.style.whiteSpace = 'pre';
    s.textContent = `${w.text} `;
    const state = t < w.start ? 'next' : i === cap.active || (cap.active < 0 && i === cap.words.length - 1 && t < w.end + 0.15) ? 'now' : 'said';
    for (const [k, v] of Object.entries(p.word(state, clamp(t - w.start, 0, 10)))) s.style.setProperty(kebab(k), v);
    el.appendChild(s);
  });
  return cap;
}
