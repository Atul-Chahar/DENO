// Draw stock footage from extracted frames (`studio frames assets/footage/clip.mp4`): deterministic and exact.
const meta = new Map();
const pad = (n) => String(n).padStart(6, '0');

export async function loadFootage(name) {
  const m = await (await fetch(`assets/frames/${name}/frames.json`)).json();
  meta.set(name, m);
  return m;
}

function frameOf(name, lt, { loop = false, rate = 1 } = {}) {
  const m = meta.get(name);
  if (!m) throw new Error(`call loadFootage('${name}') before rendering`);
  const f = Math.floor(Math.max(0, lt) * rate * m.fps);
  return loop ? f % m.count : Math.min(f, m.count - 1);
}

function show(img, src) {
  if (img.getAttribute('src') === src) return Promise.resolve();
  img.src = src;
  return img.decode().catch(() => undefined);
}

/** Set img.src to the frame of `name` at local time lt (looping or holding the last frame); resolves when decoded. */
export function footage(img, name, lt, opts = {}) {
  return show(img, `assets/frames/${name}/${pad(frameOf(name, lt, opts) + 1)}.jpg`);
}

/**
 * Behind-subject: the person in footage `name` stands in front of your title or caption.
 * Stack three layers in this order: `back` (an <img>, the footage), your text or graphic, then `front` (a
 * <canvas> with the same size and object-fit as `back`). `front` gets the same frame cut out to the person, using
 * the mattes from `studio matte <name>`. Until those exist, `fallback: 'front'` (default) leaves the text in front
 * of everything, and `fallback: 'hide'` hides `text`. Returns true when the matte was used.
 */
const mattes = new Map();
async function matteImage(url) {
  if (!mattes.has(url)) {
    if (mattes.size > 8) mattes.delete(mattes.keys().next().value);
    const img = new Image();
    img.src = url;
    mattes.set(url, img.decode().then(() => img, () => null));
  }
  return mattes.get(url);
}

export async function subject({ back, front, text = null }, name, lt, { fallback = 'front', ...opts } = {}) {
  if (!(front instanceof HTMLCanvasElement)) throw new Error('subject(): `front` must be a <canvas> styled like `back`');
  const f = frameOf(name, lt, opts);
  await show(back, `assets/frames/${name}/${pad(f + 1)}.jpg`);
  const matte = meta.get(name).matte ? await matteImage(`assets/frames/${name}/matte/${pad(f + 1)}.png`) : null;
  if (!matte) {
    (window.__studioMatteMissing ||= new Set()).add(name);
    front.style.visibility = 'hidden';
    if (text) text.style.visibility = fallback === 'hide' ? 'hidden' : '';
    return false;
  }
  if (text) text.style.visibility = '';
  front.style.visibility = '';
  if (front.width !== back.naturalWidth || front.height !== back.naturalHeight) {
    front.width = back.naturalWidth;
    front.height = back.naturalHeight;
  }
  // A software canvas draws the same pixels every time; the GPU path can differ by a level between frames.
  const ctx = front.getContext('2d', { willReadFrequently: true });
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, front.width, front.height);
  ctx.drawImage(back, 0, 0);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(matte, 0, 0, front.width, front.height);
  ctx.globalCompositeOperation = 'source-over';
  return true;
}
