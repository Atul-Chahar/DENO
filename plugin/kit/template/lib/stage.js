// Stage: sizes the film for the requested format, exposes the render contract, and (preview only) plays it.
// Render contract: window.seek(t) paints frame t (may return a promise), window.DURATION, window.ready.
const q = new URLSearchParams(location.search);
export const RENDER = q.get('render') === '1';
export const FORMAT = {
  ratio: q.get('ratio') || '16:9',
  w: Number(q.get('w')) || 1920,
  h: Number(q.get('h')) || 1080,
};
FORMAT.vertical = FORMAT.h > FORMAT.w;
window.FORMAT = FORMAT;

/** Size #stage to the format; returns it. In preview the stage is scaled to fit the window. */
export function stage() {
  const el = document.getElementById('stage');
  el.style.width = `${FORMAT.w}px`;
  el.style.height = `${FORMAT.h}px`;
  document.documentElement.style.setProperty('--w', `${FORMAT.w}px`);
  document.documentElement.style.setProperty('--h', `${FORMAT.h}px`);
  document.documentElement.dataset.ratio = FORMAT.ratio;
  if (!RENDER) {
    const fit = () => {
      const s = Math.min(innerWidth / FORMAT.w, (innerHeight - 40) / FORMAT.h);
      el.style.transform = `scale(${s})`;
      el.style.transformOrigin = 'top left';
    };
    fit();
    addEventListener('resize', fit);
  }
  return el;
}

// Place before you fill: chapters and clips marked `pending` in film.json (`studio place`) are drawn as labelled
// striped blocks, so the shape of the film shows in previews and draft renders before their content exists.
// A full render refuses while any are pending, so they never reach a final.
let placeholders = [];
async function loadPlaceholders() {
  try {
    const f = await (await fetch('film.json', { cache: 'no-store' })).json();
    placeholders = [...(f.chapters || []), ...(f.clips || [])].filter((c) => c.pending);
  } catch {
    placeholders = [];
  }
}
function paintPlaceholders(t) {
  let layer = document.getElementById('studio-placeholders');
  const live = placeholders.filter((p) => t >= p.start && t < p.end);
  if (!live.length) {
    if (layer) layer.style.display = 'none';
    return;
  }
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'studio-placeholders';
    layer.dataset.studioPlaceholder = '1';
    layer.style.cssText = 'position:absolute;inset:0;z-index:99;display:flex;flex-direction:column;gap:2%;padding:6%;box-sizing:border-box;pointer-events:none';
    document.getElementById('stage').appendChild(layer);
  }
  layer.style.display = 'flex';
  const u = Math.min(FORMAT.w, FORMAT.h);
  const shift = (t * 60) % 56; // a slow shimmer, still a pure function of t
  layer.innerHTML = live
    .map((p) => `<div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;border:${u * 0.004}px dashed #101613;background:repeating-linear-gradient(135deg,#E9E4D8 ${shift}px,#E9E4D8 ${shift + 28}px,#F6F2E8 ${shift + 28}px,#F6F2E8 ${shift + 56}px);color:#101613;font:600 ${u * 0.045}px ui-monospace,monospace;text-align:center"><div>${String(p.label || p.id).replace(/[<&]/g, '')}</div><div style="opacity:.6;font-size:${u * 0.03}px">${p.kind || 'chapter'} · ${p.start}–${p.end} s · placeholder</div></div>`)
    .join('');
}

/** Wire the contract and, outside render mode, a preview player with frame keys. */
export function film({ duration, seek: paint, cues = [], chapters = [], fps = 30, assets = [] }) {
  const seek = async (t) => {
    await paint(t);
    paintPlaceholders(t);
  };
  window.DURATION = duration;
  window.CUES = cues;
  window.CHAPTERS = chapters;
  window.seek = seek;
  window.ready = (async () => {
    await loadPlaceholders();
    await document.fonts.ready;
    await Promise.all(assets.map((src) => new Promise((ok) => {
      const img = new Image();
      img.onload = img.onerror = ok;
      img.src = src;
    })));
    await seek(Number(q.get('t')) || 0);
  })();
  if (RENDER) return;
  // ---- preview only (studio-allow: the renderer never runs this branch) ----
  let t = Number(q.get('t')) || 0;
  let playing = false;
  let loop = null;
  let last = 0;
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:40px;background:#101613;color:#C6F24E;font:600 12px ui-monospace,monospace;display:flex;align-items:center;gap:14px;padding:0 12px;z-index:9';
  document.body.appendChild(bar);
  const show = () => {
    const f = Math.round(t * fps);
    const ch = chapters.find((c) => t >= c.start && t < c.end);
    bar.textContent = `${t.toFixed(2)} s · F${f} / ${Math.round(duration * fps)}${ch ? ` · ${ch.id}` : ''}${loop ? ' · LOOP' : ''} — space play · ←/→ frame · ,/. frame · [/] chapter · l loop`;
  };
  const go = async (x) => {
    const lo = loop ? loop.start : 0;
    const hi = loop ? loop.end : duration;
    t = x >= hi ? lo + ((x - lo) % (hi - lo)) : Math.max(lo, x);
    await seek(t);
    show();
  };
  const tick = (now) => { // studio-allow
    if (playing) {
      go(t + (now - last) / 1000);
      last = now;
      requestAnimationFrame(tick); // studio-allow
    }
  };
  addEventListener('keydown', (e) => {
    const chIdx = chapters.findIndex((c) => t >= c.start && t < c.end);
    if (e.key === ' ') {
      e.preventDefault();
      playing = !playing;
      last = performance.now(); // studio-allow
      if (playing) requestAnimationFrame(tick); // studio-allow
    } else if (e.key === 'ArrowRight' || e.key === '.') go(Math.round(t * fps + 1) / fps);
    else if (e.key === 'ArrowLeft' || e.key === ',') go(Math.max(0, Math.round(t * fps - 1) / fps));
    else if (e.key === ']' && chapters.length) go(chapters[Math.min(chapters.length - 1, chIdx + 1)].start);
    else if (e.key === '[' && chapters.length) go(chapters[Math.max(0, chIdx - 1)].start);
    else if (e.key === 'l' && chIdx >= 0) {
      loop = loop ? null : chapters[chIdx];
      show();
    }
  });
  show();
}
