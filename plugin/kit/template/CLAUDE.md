# House rules for this film (Deno Studio)

Read these before touching index.html. Full playbooks: `get_playbook(<topic>)` through the Deno MCP.

## Render contract (never break)
- `window.seek(t)` paints frame `t` and nothing else decides what's on screen. It may return a promise (images).
- No `Math.random`, `Date.now`, `performance.now`, `setTimeout`, `setInterval`, `requestAnimationFrame`, CSS
  transitions or animations, `<video>`, `<audio>`, `<iframe>`. Use `lib/motion.js` (`spring`, `track`, `rand`, `boil`).
- Fonts and images local in `assets/`. Footage: `studio frames` + `lib/footage.js`. Sound: `window.CUES` + `studio mix`.
- `studio check` (it runs verify) must be clean before anyone looks at a render.

## Look
- Colours, fonts: `brand.css` (from the founder's Deno brand kit). One accent, owned by one thing per shot.
- One named style (film.json `style`). Avoid: particle bursts, lens flares, glow, glitch on text, bouncy easing
  everywhere, decorative gradients, "AI" purple/cyan, centred title on a gradient as the opener.
- Real product UI only (`studio capture <url>`). Never invent features, screens, numbers or quotes.

## Timing
- Hook in the first second; open on the result or the pain. Something new every 1–4 s.
- One read at a time; ~0.3 s per word on screen, at least 1 s; ≤ 8 words per screen.
- Cuts on downbeats (`studio beats`), hits on hits; hold the last read 0.8–1.2 s.

## Recipe films (index.html imports lib/blocks.js)
- The film is data: `film.json` → `scenes: [{ id, block, start, end, props }]`. Blocks: `hook`, `screen`, `compare`
  (before/after wipe), `terminal` (commands type in), `chart` (a line chart that draws in; the axis starts at zero),
  `stat`, `points`, `quote`, `endcard` (props are documented in `lib/blocks.js`). `*word*` in a text gets the
  accent. `"theme": "dark"` on a scene gives it the ink background.
- Change words, pictures and timing in `film.json`. `studio fill <scene id>` when a scene holds the founder's own
  content; a full render refuses while any scene still has the recipe's sample copy.
- A shot no block can do: write `{ mount(box, props), paint(state, lt, dur, props) }` in index.html and pass it to
  `mountScenes(stage(), data.scenes, { <scene id>: yourShot })` with `"block": "custom"` on that scene.

## Build: place, fill, look
- Place the whole film first: `studio place <id> --start a --end b --label "what the viewer sees"` per shot and
  chapter. Placeholders draw as striped blocks in previews and drafts; a full render refuses while any are pending.
- Fill one at a time, `studio fill <id>`; look once per chapter (`studio sheet --live --chapter <id>`), not
  after every edit. `studio timeline` reads it back. `seek(t)` should take ≤ 50 ms.
- Captions: `drawCaption(el, t, { preset })` from `lib/captions.js`. Text behind a person: `studio matte` + `subject()`
  from `lib/footage.js` (front layer is a `<canvas>`).

## Talking to the founder
Warm, brief, plain; about the story, never the machinery (no commands, paths, ids, JSON or render times). One or
two sentences after each change.

## Draft first, final last
1. First cut and every fix round: `studio render --draft` (only changed scenes and chapters are rendered again),
   then `studio check` (verify + one sheet at phone width + colour numbers) → fix what blocks, read its one image,
   fix the 3 worst things once. Don't score yourself in a loop; the founder's
   notes are the second opinion.
2. Review round: `studio review` (in the background; the film plays from this disk, never uploaded) → give the
   founder the link → `studio notes --wait` → fix one note at a time → `studio reply <id> fixed "what changed"`
   → `studio render --draft` → `studio review --next`. Until a round has no notes.
3. After the founder approves: `studio render`, `studio mix`, `studio check` (read its image),
   `studio upload --final`.

Never call a final finished until `studio check` is clean on the current code and you have read its sheet of
the mixed file; `studio upload` refuses otherwise.

Keep `film.json` current: chapters, clips (with reads and on-screen text), captions, cues, assets.
