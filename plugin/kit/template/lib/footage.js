// Draw stock footage from extracted frames (`studio frames assets/footage/clip.mp4`): deterministic and exact.
const meta = new Map();
export async function loadFootage(name) {
  const m = await (await fetch(`assets/frames/${name}/frames.json`)).json();
  meta.set(name, m);
  return m;
}
/** Set img.src to the frame of `name` at local time lt (looping or holding the last frame); resolves when decoded. */
export function footage(img, name, lt, { loop = false, rate = 1 } = {}) {
  const m = meta.get(name);
  if (!m) throw new Error(`call loadFootage('${name}') before rendering`);
  let f = Math.floor(Math.max(0, lt) * rate * m.fps);
  f = loop ? f % m.count : Math.min(f, m.count - 1);
  const src = `assets/frames/${name}/${String(f + 1).padStart(6, '0')}.jpg`;
  if (img.getAttribute('src') === src) return Promise.resolve();
  img.src = src;
  return img.decode().catch(() => undefined);
}
