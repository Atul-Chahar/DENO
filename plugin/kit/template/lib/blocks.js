// Blocks: ready-made shots driven by data. A recipe film is a list of scenes in film.json
// (`scenes: [{ id, block, start, end, props }]`); each block paints its scene as a pure function of local time.
// Change the words, pictures and timing in film.json; write your own code only for a shot no block can do
// (block "custom", see `mountScenes`).
import { clamp, ease, ramp, spring, track, TYPE, UI, CAM } from './motion.js';
import { FORMAT } from './stage.js';

const u = () => Math.min(FORMAT.w, FORMAT.h);
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

/** `one *two words* three` → text nodes, with the starred part wrapped in <b> (the accent). */
function accented(parent, text) {
  String(text ?? '').split(/(\*[^*]+\*)/).forEach((part) => {
    if (!part) return;
    if (part.startsWith('*') && part.endsWith('*')) parent.appendChild(el('b', '', part.slice(1, -1)));
    else parent.appendChild(document.createTextNode(part));
  });
  return parent;
}

/** Shrink a one-line element's type until it fits `share` of its box's width (a long product name in 9:16). */
function fit(node, box, share = 0.84) {
  node.style.whiteSpace = 'nowrap';
  const max = box.clientWidth * share;
  const size = parseFloat(getComputedStyle(node).fontSize);
  if (node.scrollWidth > max) node.style.fontSize = `${Math.floor((size * max) / node.scrollWidth)}px`;
}

/** Rise into place: element i of a staggered group. `first` stays readable from frame 0 (open on the hook). */
function rise(node, lt, delay, { first = false, dist = 0.04 } = {}) {
  const p = spring(lt - delay, ...TYPE);
  node.style.transform = `translateY(${(1 - p) * dist * u()}px)`;
  node.style.opacity = String(first ? Math.min(1, 0.55 + p) : clamp(p * 1.4));
}

const CSS = `
.bk { position: absolute; inset: 0; display: none; box-sizing: border-box; padding: 9% 8%; color: var(--ink); font-family: var(--body); }
.bk b { font-weight: inherit; background: var(--accent); padding: 0 .12em; }
.bk-hook { display: flex; flex-direction: column; justify-content: center; gap: .08em; font-family: var(--display); font-size: calc(var(--u) * .165); line-height: 1.02; letter-spacing: -.02em; }
.bk-kicker { font-family: var(--mono); font-size: calc(var(--u) * .034); letter-spacing: .08em; text-transform: uppercase; margin-bottom: 1.2em; }
.bk-stat { display: flex; flex-direction: column; justify-content: center; gap: calc(var(--u) * .02); }
.bk-stat__n { font-family: var(--display); font-size: calc(var(--u) * .3); line-height: .95; letter-spacing: -.03em; font-variant-numeric: tabular-nums; }
.bk-stat__l { font-size: calc(var(--u) * .07); line-height: 1.2; max-width: 16em; }
.bk-src { font-family: var(--mono); font-size: calc(var(--u) * .04); opacity: .7; }
.bk-points { display: flex; flex-direction: column; justify-content: center; gap: calc(var(--u) * .045); }
.bk-points__t { font-family: var(--display); font-size: calc(var(--u) * .1); line-height: 1.05; }
.bk-points__g { display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); gap: calc(var(--u) * .025); }
.bk-point { border: calc(var(--u) * .004) solid var(--ink); background: var(--paper); padding: calc(var(--u) * .04); font-size: calc(var(--u) * .056); line-height: 1.15; box-shadow: calc(var(--u) * .01) calc(var(--u) * .01) 0 var(--ink); }
.bk-quote { display: flex; flex-direction: column; justify-content: center; gap: calc(var(--u) * .04); }
.bk-quote__t { font-family: var(--display); font-size: calc(var(--u) * .1); line-height: 1.12; }
.bk-quote__by { font-family: var(--mono); font-size: calc(var(--u) * .036); }
.bk-screen { padding: 0; background: var(--ink); }
.bk-screen b { color: var(--ink); }
.bk-screen__win { position: absolute; left: 6%; right: 6%; top: 7%; bottom: 23%; border: calc(var(--u) * .004) solid var(--paper); background: var(--paper); overflow: hidden; }
.bk-screen__img { position: absolute; left: 0; top: 0; width: 100%; height: 100%; object-fit: cover; object-position: top center; transform-origin: 0 0; }
.bk-screen__none { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; padding: 8%; font-family: var(--mono); font-size: calc(var(--u) * .042); color: var(--ink); background: repeating-linear-gradient(135deg, #E9E4D8 0 28px, #F6F2E8 28px 56px); }
.bk-screen__cap { position: absolute; left: 6%; right: 6%; bottom: 8%; color: var(--paper); font-size: calc(var(--u) * .07); line-height: 1.12; }
.bk-vertical .bk-screen__win { top: 12%; bottom: 36%; }
.bk-vertical .bk-screen__cap { bottom: 19%; }
.bk-vertical .bk { padding-top: 14%; padding-bottom: 18%; }
.bk-vertical .bk-screen { padding: 0; }
.bk-screen__cur { position: absolute; width: calc(var(--u) * .03); height: calc(var(--u) * .03); margin: calc(var(--u) * -.015) 0 0 calc(var(--u) * -.015); border-radius: 50%; background: var(--accent); border: calc(var(--u) * .004) solid var(--ink); }
.bk-end { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: calc(var(--u) * .03); }
.bk-end__logo { height: calc(var(--u) * .16); }
.bk-end__n { font-family: var(--display); font-size: calc(var(--u) * .2); line-height: 1; letter-spacing: -.02em; }
.bk-end__t { font-size: calc(var(--u) * .06); max-width: 18em; }
.bk-end__u { font-family: var(--mono); font-size: calc(var(--u) * .042); border: calc(var(--u) * .004) solid var(--ink); padding: .35em .7em; background: var(--accent); }
`;

export const BLOCKS = {
  /** A headline. props: { kicker?, lines: ["Your PRs wait", "*three days*", "for a review."] } */
  hook: {
    mount(box, p) {
      box.classList.add('bk-hook');
      const kicker = p.kicker ? box.appendChild(el('div', 'bk-kicker', p.kicker)) : null;
      const lines = (p.lines || []).map((line) => box.appendChild(accented(el('div'), line)));
      return { kicker, lines };
    },
    paint(s, lt) {
      if (s.kicker) rise(s.kicker, lt, 0, { first: true, dist: 0.02 });
      s.lines.forEach((node, i) => rise(node, lt, i * 0.12, { first: i === 0 }));
    },
  },

  /** A number that counts up. props: { value: 72, prefix?, suffix?: "%", label, source? } */
  stat: {
    mount(box, p) {
      box.classList.add('bk-stat');
      const n = box.appendChild(el('div', 'bk-stat__n'));
      n.dataset.studioCounter = '1'; // a number that counts up: verify must not time each value as a read
      return { n, label: box.appendChild(accented(el('div', 'bk-stat__l'), p.label)), src: p.source ? box.appendChild(el('div', 'bk-src', p.source)) : null };
    },
    paint(s, lt, dur, p) {
      const value = Number(p.value) || 0;
      const places = String(p.value).includes('.') ? String(p.value).split('.')[1].length : 0;
      const shown = value * ease(ramp(lt, 0.15, Math.min(1.3, dur * 0.5)));
      s.n.textContent = `${p.prefix || ''}${shown.toLocaleString('en-US', { minimumFractionDigits: places, maximumFractionDigits: places })}${p.suffix || ''}`;
      rise(s.n, lt, 0, { first: true });
      rise(s.label, lt, 0.25);
      if (s.src) rise(s.src, lt, 0.45, { dist: 0.015 });
    },
  },

  /** Short points that arrive one by one. props: { title?, items: ["…", "…"], columns? } */
  points: {
    mount(box, p) {
      box.classList.add('bk-points');
      const title = p.title ? box.appendChild(accented(el('div', 'bk-points__t'), p.title)) : null;
      const grid = box.appendChild(el('div', 'bk-points__g'));
      const n = (p.items || []).length;
      grid.style.setProperty('--cols', String(p.columns || (FORMAT.vertical ? 1 : n > 4 ? 3 : 2)));
      return { title, items: (p.items || []).map((text) => grid.appendChild(accented(el('div', 'bk-point'), text))) };
    },
    paint(s, lt, dur) {
      if (s.title) rise(s.title, lt, 0, { first: true });
      const gap = clamp((dur - 1.4) / Math.max(1, s.items.length), 0.25, 1);
      s.items.forEach((node, i) => rise(node, lt, 0.35 + i * gap));
    },
  },

  /** A real quote. props: { text, by } */
  quote: {
    mount(box, p) {
      box.classList.add('bk-quote');
      return { text: box.appendChild(accented(el('div', 'bk-quote__t'), `“${p.text || ''}”`)), by: box.appendChild(el('div', 'bk-quote__by', p.by || '')) };
    },
    paint(s, lt) {
      rise(s.text, lt, 0, { first: true });
      rise(s.by, lt, 0.4, { dist: 0.015 });
    },
  },

  /**
   * A product screen with a moving camera. props: { src: "assets/shots/home.png", caption?,
   * zoom?: [{ at: 0, x: .5, y: .3, scale: 1 }, { at: 1.2, x: .7, y: .4, scale: 1.6 }], cursor?: [{ at, x, y }] }
   * x and y are 0..1 inside the picture: the camera centres on that point.
   */
  screen: {
    mount(box, p) {
      box.classList.add('bk-screen');
      const win = box.appendChild(el('div', 'bk-screen__win'));
      let img = null;
      if (p.src) {
        img = win.appendChild(el('img', 'bk-screen__img'));
        img.src = p.src;
        img.alt = '';
      } else win.appendChild(el('div', 'bk-screen__none', 'Product screen goes here: studio capture <url>, then set "src" in film.json'));
      const cur = p.cursor?.length ? win.appendChild(el('div', 'bk-screen__cur')) : null;
      const cap = p.caption ? box.appendChild(accented(el('div', 'bk-screen__cap'), p.caption)) : null;
      return { win, img, cur, cap };
    },
    paint(s, lt, dur, p) {
      const keys = p.zoom?.length ? p.zoom : [{ at: 0, x: 0.5, y: 0.5, scale: 1 }];
      const of = (k) => track(lt, keys.map((z) => [z.at, z[k] ?? (k === 'scale' ? 1 : 0.5)]), ...CAM);
      const scale = Math.max(1, of('scale'));
      const W = s.win.clientWidth;
      const H = s.win.clientHeight;
      // Centre the camera on (x, y), without showing anything outside the picture.
      const tx = clamp(W / 2 - of('x') * W * scale, W - W * scale, 0);
      const ty = clamp(H / 2 - of('y') * H * scale, H - H * scale, 0);
      if (s.img) s.img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
      if (s.cur) {
        const cx = track(lt, p.cursor.map((c) => [c.at, c.x]), ...UI);
        const cy = track(lt, p.cursor.map((c) => [c.at, c.y]), ...UI);
        s.cur.style.left = `${tx + cx * W * scale}px`;
        s.cur.style.top = `${ty + cy * H * scale}px`;
      }
      if (s.cap) rise(s.cap, lt, 0.2, { first: true, dist: 0.02 });
    },
  },

  /** The name and where to go. props: { name, url?, tagline?, logo?: "assets/logo.svg" } */
  endcard: {
    mount(box, p) {
      box.classList.add('bk-end');
      let logo = null;
      if (p.logo) {
        logo = box.appendChild(el('img', 'bk-end__logo'));
        logo.src = p.logo;
        logo.alt = '';
      }
      return { logo, name: box.appendChild(el('div', 'bk-end__n', p.name || '')), tag: p.tagline ? box.appendChild(accented(el('div', 'bk-end__t'), p.tagline)) : null, url: p.url ? box.appendChild(el('div', 'bk-end__u', p.url)) : null };
    },
    paint(s, lt) {
      if (!s.fitted) {
        fit(s.name, s.name.parentElement);
        s.fitted = true;
      }
      const p = spring(lt, ...TYPE);
      s.name.style.transform = `scale(${0.92 + 0.08 * p})`;
      s.name.style.opacity = String(Math.min(1, 0.55 + p));
      if (s.logo) rise(s.logo, lt, 0, { first: true, dist: 0.02 });
      if (s.tag) rise(s.tag, lt, 0.25, { dist: 0.02 });
      if (s.url) rise(s.url, lt, 0.45, { dist: 0.02 });
    },
  },
};

/**
 * Build every scene inside the stage and return `{ seek, duration, chapters, assets }` for `film()`.
 * `custom` maps a scene id to your own `{ mount(box, props), paint(state, lt, dur, props) }` for a shot written
 * by hand: `mountScenes(stage, scenes, { hero: myHeroShot })` with a scene `{ id: "hero", block: "custom" }`.
 */
export function mountScenes(stageEl, scenes, custom = {}) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  stageEl.style.setProperty('--u', `${u()}px`);
  stageEl.classList.toggle('bk-vertical', FORMAT.vertical); // keep text out of the phone apps' own buttons
  const live = scenes.map((scene) => {
    const block = scene.block === 'custom' ? custom[scene.id] : BLOCKS[scene.block];
    if (!block) throw new Error(`scene "${scene.id}": no block "${scene.block}"${scene.block === 'custom' ? ' passed to mountScenes' : ''}`);
    const box = el('div', 'bk');
    box.dataset.clip = scene.id;
    if (scene.background) box.style.background = scene.background;
    if (scene.color) box.style.color = scene.color;
    stageEl.appendChild(box);
    const props = scene.props || {};
    return { scene, block, box, props, state: block.mount(box, props) };
  });
  const seek = (t) => {
    for (const s of live) {
      const on = t >= s.scene.start && t < s.scene.end;
      s.box.style.display = on ? (s.box.classList.contains('bk-screen') ? 'block' : 'flex') : 'none';
      if (!on) continue;
      s.block.paint(s.state, t - s.scene.start, s.scene.end - s.scene.start, s.props);
    }
  };
  return {
    seek,
    duration: Math.max(0, ...scenes.map((s) => s.end)),
    chapters: scenes.map((s) => ({ id: s.id, start: s.start, end: s.end, title: s.label || s.id })),
    assets: scenes.flatMap((s) => [s.props?.src, s.props?.logo]).filter(Boolean),
  };
}
