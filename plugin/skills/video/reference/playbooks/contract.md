# The render contract

_Every frame is a pure function of time. The rule that makes rendering, review and partial fixes possible._

# The render contract

The film is code that paints frame `t`. The kit renders it by calling `window.seek(t)` for every frame and
screenshotting the result, so anything that depends on real time breaks the export.

## Rules
- Expose `window.seek(t)` (seconds), `window.DURATION`, and `window.ready` (a promise that resolves when fonts and
  images are loaded). Optional: `window.CUES` (sound cues) and `window.CHAPTERS`.
- `seek(t)` must give the same picture for the same `t`, in any order. No `Math.random()`, `Date.now()`,
  `performance.now()`, `setTimeout`, `setInterval`, `requestAnimationFrame`, CSS transitions or CSS animations.
- Randomness comes from a seeded hash: `rand(i, seed)`. Give every element its own named seed, so one moving
  element doesn't re-roll everything drawn after it.
- No state carried between frames. If you need a simulation, replay it from a seeded start at a fixed step up to
  `t`, and mark the scene `stateful` in `film.json`.
- Await fonts (`document.fonts.ready`) and every image before resolving `window.ready`. Keep fonts and assets
  local, in `assets/`. A remote font can stall an export.
- No `<video>`, `<audio>` or `<iframe>` in the page. Footage is drawn from extracted frames (`studio frames`);
  sound is mixed by ffmpeg after the picture is rendered.
- A loop must end on its first frame (position and velocity).

## Checks
`studio verify` renders frames in order and shuffled and compares them, looks for console errors, blank and
blown-out frames, text outside the safe area, and on-screen text held too briefly. A render that exits 0 proves
nothing: look at the contact sheet of the encoded file.
