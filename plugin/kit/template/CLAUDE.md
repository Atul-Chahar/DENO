# House rules for this film (Deno Studio)

Read these before touching index.html. Full playbooks: `get_playbook(<topic>)` through the Deno MCP.

## Render contract (never break)
- `window.seek(t)` paints frame `t` and nothing else decides what's on screen. It may return a promise (images).
- No `Math.random`, `Date.now`, `performance.now`, `setTimeout`, `setInterval`, `requestAnimationFrame`, CSS
  transitions or animations, `<video>`, `<audio>`, `<iframe>`. Use `lib/motion.js` (`spring`, `track`, `rand`, `boil`).
- Fonts and images local in `assets/`. Footage: `studio frames` + `lib/footage.js`. Sound: `window.CUES` + `studio mix`.
- `studio verify` must be clean before anyone looks at a render.

## Look
- Colours, fonts: `brand.css` (from the founder's Deno brand kit). One accent, owned by one thing per shot.
- One named style (film.json `style`). Avoid: particle bursts, lens flares, glow, glitch on text, bouncy easing
  everywhere, decorative gradients, "AI" purple/cyan, centred title on a gradient as the opener.
- Real product UI only (`studio capture <url>`). Never invent features, screens, numbers or quotes.

## Timing
- Hook in the first second; open on the result or the pain. Something new every 1–4 s.
- One read at a time; ~0.3 s per word on screen, at least 1 s; ≤ 8 words per screen.
- Cuts on downbeats (`studio beats`), hits on hits; hold the last read 0.8–1.2 s.

## Build: place, fill, look
- Place the whole film first: `studio place <id> --start a --end b --label "what the viewer sees"` per shot and
  chapter. Placeholders draw as striped blocks in previews and drafts; a full render refuses while any are pending.
- Fill one at a time, `studio fill <id>`, look at `studio sheet --live --at <its times>`. `studio timeline` reads it back.
- Captions: `drawCaption(el, t, { preset })` from `lib/captions.js`. Text behind a person: `studio matte` + `subject()`
  from `lib/footage.js` (front layer is a `<canvas>`).

## Talking to the founder
Warm, brief, plain; about the story, never the machinery (no commands, paths, ids, JSON or render times). One or
two sentences after each change.

## Loop before showing
1. `studio verify` → fix all. 2. `studio sheet` and `studio sheet --phone` → read them. 3. Score 1–10: hook,
phone readability, motion, variety, composition, brand, sound sync. 4. Fix the 3 worst; re-render only those
seconds (`studio render --from a --to b`). Repeat until all ≥ 8. 5. `studio render`, `studio mix`, `studio verify`, `studio sheet` (read it), `studio upload`.

Never call it finished until `studio verify` is clean on the current code and you have read the sheet of the
mixed file; `studio upload` refuses otherwise.

Keep `film.json` current: chapters, clips (with reads and on-screen text), captions, cues, assets.
