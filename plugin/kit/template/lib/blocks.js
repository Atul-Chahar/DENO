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
.bk-dark { background: var(--ink); color: var(--paper); }
.bk-dark b, .bk-dark .bk-end__u { color: var(--ink); }
.bk-dark .bk-point { background: var(--ink); border-color: var(--paper); box-shadow: calc(var(--u) * .01) calc(var(--u) * .01) 0 var(--paper); }
.bk-dark .bk-end__u { border-color: var(--paper); }
.bk-cmp__after { position: absolute; inset: 0; }
.bk-cmp__after > * { position: absolute; inset: 0; }
.bk-cmp__line { position: absolute; top: 0; bottom: 0; width: calc(var(--u) * .006); margin-left: calc(var(--u) * -.003); background: var(--accent); }
.bk-cmp__tag { position: absolute; top: 9%; font-family: var(--mono); font-size: calc(var(--u) * .036); padding: .3em .6em; background: var(--ink); color: var(--paper); }
.bk-cmp__tag--a { right: 8%; background: var(--accent); color: var(--ink); }
.bk-cmp__tag--b { left: 8%; }
.bk-term { display: flex; flex-direction: column; justify-content: center; gap: calc(var(--u) * .03); }
.bk-term__win { border: calc(var(--u) * .004) solid currentColor; background: #0B0F0D; color: #E8EDE9; font-family: var(--mono); font-size: calc(var(--u) * .058); line-height: 1.4; }
.bk-term__bar { padding: .45em .9em; font-size: calc(var(--u) * .032); opacity: .75; border-bottom: calc(var(--u) * .003) solid #2A322E; }
.bk-term__body { padding: .7em .9em; min-height: 7em; }
.bk-term__line { white-space: pre; }
.bk-term__line--cmd::before { content: '$ '; color: var(--accent); }
.bk-term__line--out { opacity: .72; }
.bk-term__line.is-typing::after { content: ''; display: inline-block; width: .55em; height: 1.05em; vertical-align: -.15em; background: var(--accent); }
.bk-term__cap { font-size: calc(var(--u) * .065); line-height: 1.15; }
.bk-chart > * { position: absolute; }
.bk-chart__t { left: 8%; right: 8%; top: 8%; font-family: var(--display); font-size: calc(var(--u) * .075); line-height: 1.08; }
.bk-chart svg { overflow: visible; }
.bk-chart__axis { stroke: currentColor; stroke-width: calc(var(--u) * .003); opacity: .55; fill: none; }
.bk-chart__grid { stroke: currentColor; stroke-width: calc(var(--u) * .0015); opacity: .2; stroke-dasharray: 6 8; }
.bk-chart__line { stroke: var(--ink); stroke-width: calc(var(--u) * .009); fill: none; stroke-linecap: round; stroke-linejoin: round; }
.bk-dark .bk-chart__line, .bk-dark .bk-chart__dot { stroke: var(--accent); }
.bk-chart__dot { fill: var(--accent); stroke: var(--ink); stroke-width: calc(var(--u) * .004); }
.bk-chart__lab { font-family: var(--mono); font-size: calc(var(--u) * .032); white-space: nowrap; }
.bk-chart__note { font-family: var(--body); font-size: calc(var(--u) * .052); line-height: 1.15; max-width: 9em; }
.bk-chart__src { left: 8%; bottom: 7%; font-family: var(--mono); font-size: calc(var(--u) * .032); opacity: .7; }
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

  /**
   * Before → after on real UI: the "after" picture wipes across the "before" one.
   * props: { before: "assets/shots/old.png", after: "assets/shots/new.png", caption: "Search is *instant*",
   * at?: 0.4 (when the wipe happens, as a share of the scene), labels?: ["Before", "After"] }
   */
  compare: {
    mount(box, p) {
      box.classList.add('bk-screen');
      const win = box.appendChild(el('div', 'bk-screen__win'));
      const picture = (parent, src, label) => {
        if (src) {
          const img = parent.appendChild(el('img', 'bk-screen__img'));
          img.src = src;
          img.alt = '';
          return img;
        }
        const none = parent.appendChild(el('div', 'bk-screen__none', `${label}: a real screen goes here (studio capture <url>, then set "${label.toLowerCase()}" in film.json)`));
        none.dataset.studioPlaceholder = '1'; // sample copy, already blocked by `todo`
        return none;
      };
      const [lb, la] = p.labels || ['Before', 'After'];
      picture(win, p.before, 'Before');
      const after = win.appendChild(el('div', 'bk-cmp__after'));
      picture(after, p.after, 'After');
      const line = win.appendChild(el('div', 'bk-cmp__line'));
      const tagB = win.appendChild(el('div', 'bk-cmp__tag bk-cmp__tag--b', lb));
      const tagA = win.appendChild(el('div', 'bk-cmp__tag bk-cmp__tag--a', la));
      const cap = p.caption ? box.appendChild(accented(el('div', 'bk-screen__cap'), p.caption)) : null;
      return { after, line, tagA, tagB, cap };
    },
    paint(s, lt, dur, p) {
      const at = dur * clamp(Number(p.at ?? 0.4), 0.1, 0.8);
      const w = spring(lt - at, ...UI); // 0: all before, 1: all after
      const edge = 100 * (1 - w);
      s.after.style.clipPath = `inset(0 0 0 ${edge}%)`;
      s.line.style.left = `${edge}%`;
      s.line.style.opacity = String(w > 0.001 && w < 0.999 ? 1 : 0);
      s.tagB.style.opacity = String(clamp(1 - w * 2));
      s.tagA.style.opacity = String(clamp(w * 2 - 1));
      if (s.cap) rise(s.cap, lt, 0.2, { first: true, dist: 0.02 });
    },
  },

  /**
   * A terminal: commands type in, their output appears, code shows line by line.
   * props: { title?: "~/my-app", caption?, speed?: 22 (characters a second),
   * lines: [{ cmd: "npm install x" }, { out: "added 1 package" }, { code: "const r = await x()" }] }
   */
  terminal: {
    mount(box, p) {
      box.classList.add('bk-term');
      const win = box.appendChild(el('div', 'bk-term__win'));
      if (p.title) win.appendChild(el('div', 'bk-term__bar', p.title));
      const body = win.appendChild(el('div', 'bk-term__body'));
      const speed = Number(p.speed) || 22;
      let t = 0.35;
      const lines = (p.lines || []).map((line) => {
        const kind = line.cmd !== undefined ? 'cmd' : line.code !== undefined ? 'code' : 'out';
        const text = String(line[kind] ?? '');
        const node = body.appendChild(el('div', `bk-term__line bk-term__line--${kind}`));
        // Commands type in; output and code appear whole. Each line waits for the one before.
        const start = t;
        const typing = kind === 'cmd' ? text.length / speed : 0;
        t = start + typing + (kind === 'cmd' ? 0.35 : kind === 'code' ? 0.18 : 0.3);
        return { node, kind, text, start, typing };
      });
      const cap = p.caption ? box.appendChild(accented(el('div', 'bk-term__cap'), p.caption)) : null;
      return { lines, cap };
    },
    paint(s, lt) {
      let current = null;
      for (const l of s.lines) {
        const shown = lt < l.start ? 0 : l.typing ? Math.min(l.text.length, Math.floor(((lt - l.start) / l.typing) * l.text.length)) : l.text.length;
        const visible = lt >= l.start;
        l.node.textContent = visible ? l.text.slice(0, shown) || ' ' : ' ';
        l.node.style.visibility = visible ? 'visible' : 'hidden';
        const partial = visible && shown < l.text.length;
        // A line that is still typing changes every frame: verify must not time each state as a read.
        if (partial) l.node.dataset.studioTyping = '1';
        else delete l.node.dataset.studioTyping;
        if (visible && l.kind === 'cmd' && (partial || !current)) current = l;
      }
      for (const l of s.lines) l.node.classList.toggle('is-typing', l === current && lt < l.start + l.typing + 0.3);
      if (s.cap) rise(s.cap, lt, 0.2, { first: true, dist: 0.02 });
    },
  },

  /**
   * One line chart that reveals itself, then marks the turn. Real data only; the axis starts at zero.
   * props: { title, values: [30, 28, 9, 5], labels?: ["W1", …], unit?: "h", mark?: { at: 2, text: "Bot *on*" }, source? }
   */
  chart: {
    mount(box, p) {
      box.classList.add('bk-chart');
      const W = FORMAT.w;
      const H = FORMAT.h;
      const values = (p.values || []).map(Number).filter(Number.isFinite);
      const n = Math.max(2, values.length);
      const top = Math.max(...values, 0);
      const bottom = Math.min(...values, 0);
      // A round top for the axis; never cut the axis above zero to make a change look bigger.
      const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1e-9, top - bottom))));
      const max = Math.ceil(top / mag / (top / mag > 5 ? 2 : 1)) * mag * (top / mag > 5 ? 2 : 1) || 1;
      const min = bottom < 0 ? Math.floor(bottom / mag) * mag : 0;
      const area = { x: W * 0.16, y: H * (FORMAT.vertical ? 0.3 : 0.27), w: W * 0.74, h: H * (FORMAT.vertical ? 0.4 : 0.5) };
      const px = (i) => area.x + (i / (n - 1)) * area.w;
      const py = (v) => area.y + area.h - ((v - min) / (max - min)) * area.h;
      const ns = 'http://www.w3.org/2000/svg';
      const svg = box.appendChild(document.createElementNS(ns, 'svg'));
      svg.setAttribute('width', W);
      svg.setAttribute('height', H);
      svg.style.left = '0';
      svg.style.top = '0';
      const add = (tag, attrs) => {
        const e = svg.appendChild(document.createElementNS(ns, tag));
        for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
        return e;
      };
      const label = (cls, text, x, y, align = 'left') => {
        const e = box.appendChild(el('div', cls, text));
        e.style.left = `${x}px`;
        e.style.top = `${y}px`;
        e.style.transform = align === 'right' ? 'translate(-100%, -50%)' : align === 'center' ? 'translate(-50%, 0)' : 'translate(0, -50%)';
        return e;
      };
      const unit = p.unit || '';
      const grid = [min, (min + max) / 2, max].map((v) => {
        const y = py(v);
        return { line: add('line', { class: v === 0 || v === min ? 'bk-chart__axis' : 'bk-chart__grid', x1: area.x, x2: area.x + area.w, y1: y, y2: y }), lab: label('bk-chart__lab', `${+v.toFixed(2)}${unit}`, area.x - W * 0.02, y, 'right') };
      });
      const xs = (p.labels || []).slice(0, n).map((text, i) => (n <= 8 || i % 2 === 0 || i === n - 1 ? label('bk-chart__lab', text, px(i), area.y + area.h + H * 0.025, 'center') : null)).filter(Boolean);
      const pts = values.map((v, i) => [px(i), py(v)]);
      const path = add('polyline', { class: 'bk-chart__line', points: pts.map((q) => q.join(',')).join(' ') });
      let length = 0;
      const seg = [0];
      for (let i = 1; i < pts.length; i++) seg.push((length += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])));
      path.setAttribute('stroke-dasharray', `${length} ${length}`);
      const head = add('circle', { class: 'bk-chart__dot', r: Math.min(W, H) * 0.012 });
      const mark = p.mark && Number.isInteger(Number(p.mark.at)) && pts[Number(p.mark.at)] ? Number(p.mark.at) : null;
      let note = null;
      let ring = null;
      let drop = null;
      if (mark !== null) {
        const [mx, my] = pts[mark];
        drop = add('line', { class: 'bk-chart__grid', x1: mx, x2: mx, y1: my, y2: area.y + area.h });
        ring = add('circle', { class: 'bk-chart__dot', cx: mx, cy: my, r: Math.min(W, H) * 0.018 });
        note = box.appendChild(accented(el('div', 'bk-chart__note'), p.mark.text || ''));
        // Put the note where the line is not: try above/below, right/left of the turn, and keep the first box
        // that no part of the line crosses (the size is estimated from the text; layout isn't ready in mount).
        const fs = Math.min(W, H) * 0.052;
        const chars = String(p.mark.text || '').replace(/\*/g, '').length;
        const nw = Math.min(9, Math.max(3, chars * 0.52)) * fs;
        const nh = Math.ceil((chars * 0.52) / 9) * 1.15 * fs;
        const gap = Math.min(W, H) * 0.035;
        const along = [];
        for (let i = 1; i < pts.length; i++) for (let k = 0; k <= 20; k++) along.push([pts[i - 1][0] + ((pts[i][0] - pts[i - 1][0]) * k) / 20, pts[i - 1][1] + ((pts[i][1] - pts[i - 1][1]) * k) / 20]);
        const spots = [[mx + gap, my - gap - nh], [mx - gap - nw, my - gap - nh], [mx + gap, my + gap], [mx - gap - nw, my + gap]]
          .map(([x, y]) => [clamp(x, area.x, area.x + area.w - nw), clamp(y, area.y, area.y + area.h - nh)]);
        const clear = ([x, y]) => !along.some(([ax, ay]) => ax > x - gap / 2 && ax < x + nw + gap / 2 && ay > y - gap / 2 && ay < y + nh + gap / 2);
        const [nx, ny] = spots.find(clear) || spots[0];
        note.style.left = `${nx}px`;
        note.style.top = `${ny}px`;
        note.style.width = `${nw}px`;
      }
      const title = p.title ? box.appendChild(accented(el('div', 'bk-chart__t'), p.title)) : null;
      const src = p.source ? box.appendChild(el('div', 'bk-chart__src', p.source)) : null;
      return { title, src, grid, xs, path, head, pts, seg, length, mark, note, ring, drop };
    },
    paint(s, lt, dur) {
      if (s.title) rise(s.title, lt, 0, { first: true });
      const axes = ease(ramp(lt, 0.1, 0.7));
      for (const g of s.grid) {
        g.line.style.opacity = String(axes);
        g.lab.style.opacity = String(axes);
      }
      for (const x of s.xs) x.style.opacity = String(axes);
      // The line draws in, at an even speed along its length.
      const draw = Math.min(3, Math.max(1.2, dur * 0.35));
      const p = ease(ramp(lt, 0.7, 0.7 + draw));
      const done = s.length * p;
      s.path.setAttribute('stroke-dashoffset', String(s.length - done));
      let i = 1;
      while (i < s.seg.length - 1 && s.seg[i] < done) i++;
      const a = s.pts[i - 1] || [0, 0];
      const b = s.pts[i] || a;
      const f = s.seg[i] > s.seg[i - 1] ? clamp((done - s.seg[i - 1]) / (s.seg[i] - s.seg[i - 1])) : 0;
      s.head.setAttribute('cx', String(a[0] + (b[0] - a[0]) * f));
      s.head.setAttribute('cy', String(a[1] + (b[1] - a[1]) * f));
      s.head.style.opacity = String(p > 0 && p < 1 ? 1 : 0);
      if (s.mark !== null) {
        // The turn is marked once the line has reached it, and held.
        const reached = 0.7 + draw * clamp(s.seg[s.mark] / Math.max(1, s.length));
        const m = spring(lt - reached - 0.15, ...UI);
        s.ring.style.opacity = String(clamp(m));
        s.ring.style.transformOrigin = `${s.pts[s.mark][0]}px ${s.pts[s.mark][1]}px`;
        s.ring.style.transform = `scale(${0.6 + 0.4 * m})`;
        s.drop.style.opacity = String(clamp(m));
        rise(s.note, lt, reached + 0.3, { dist: 0.015 });
      }
      if (s.src) rise(s.src, lt, 0.9, { dist: 0.01 });
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
    if (scene.theme === 'dark') box.classList.add('bk-dark'); // dark-keynote films: ink background, paper type
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
