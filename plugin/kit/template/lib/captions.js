// Burned-in captions from captions.json (written by `studio captions`). Pure functions of t.
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
