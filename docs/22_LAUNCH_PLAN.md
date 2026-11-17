# 22 — Launch plan: fast films, a review page people can find, any AI tool (10 days)

Written 2026-11-16 from a read of the code and docs. Goal: first paying founders within 10 days, with no new
spend (no subscriptions, hardware, paid APIs or servers). Payments are out of scope here except §6.

**Built so far: day 1 (§8), the local review page (§9), runnable recipes (§10), kit speed S2/S5/S6 (§11).** Times marked "estimate" were worked
out from the code, not measured. §8 has the first measured numbers.

---

## 1. What is still pending in the docs

| Where | Pending |
|---|---|
| docs/17 §3 | Supabase Auth rate limits + SMTP + Google consent "In production"; re-measure a validation (< 5 min rule); separate production Supabase project; shut down GCP; LinkedIn policy; Dependabot PRs #1 #3 #5 #6 #7 #9 #10 #15 still open |
| docs/17 §4 | Openverse in the server's `search_media`; BYO-AI validation (docs/16 phase 2); content calendar via MCP; Razorpay; Reddit fallback (Reddit returns 0 posts today) |
| docs/18 §12 | MCP App review inside claude.ai; `LICENSE` file (needed for Anthropic's plugin directory); first real `studio login` against live Supabase |
| docs/18 §16.3 | 12 of 13 gap items not built. #1 (motion-blur shutter) is fixed (§11) |
| docs/21 §6 | The pricing page promises things the product does not enforce: paid plan limits, "1 Studio project, 3 versions" on Free, the Deno mark on Free videos, all Agency features, Cursor/ChatGPT setup steps untested |
| Stale text | docs/16 §5–6 and docs/18 §7, §9 still say Dodo Payments; docs/17 §2 calls #38 a branch (it is merged) |

---

## 2. Why a 1-minute film takes hours

The render is not the main cost. The loop around it is.

### 2.1 The instructions ask for an open-ended loop
- `video` skill §6 and the template `CLAUDE.md`: after **every placeholder**, run a sheet and often a strip. A
  60 s film has about 15 shots, so about 30 image reads and 30 tool calls before any review starts.
- `review` skill step 4 and template `CLAUDE.md`: "Loop until all scores are at least 8" on 7 dimensions. A
  model scoring its own work has no reason to stop. This is the largest time and token sink.
- The `reviewer` agent (Opus) re-runs verify, sheet, phone sheet, stats and strips itself, each round.
- The done gate needs a full render + mix + verify + sheet + phone sheet. Any code edit makes `verify.json`
  stale, so one small fix repeats all of it.
- Films over ~30 s go to a `director` (Opus) plus `scene-builder` agents. Each one starts cold and re-reads the
  playbooks, `CLAUDE.md` and `GUIDE.md`.

### 2.2 Claude writes every film from an empty page
`plugin/kit/template/index.html` is 3 KB and the 14 recipes are ~600-byte text notes. So each film is a few
thousand lines of new HTML/JS. Output tokens are the slowest and most expensive part of the session.

### 2.3 Every look starts a new browser
- `sheet`, `strip`, `crop` and `verify` each launch Chromium, start a file server and load the page
  (`Film.open`, `plugin/kit/lib/browser.mjs:52`). `tile()` then launches a **second** Chromium and runs one
  ffmpeg process per frame for thumbnails (`look.mjs:14-22`).
- `verify` runs the text scan at 10 samples per second for the whole film, per format (`verify.mjs:140`):
  600 seeks for 60 s, times each format.

### 2.4 The render itself
- 60 s × 30 fps × 2 sub-frames = 3,600 full-size screenshots per format; three formats = 10,800.
- Drafts still use PNG screenshots (`render.mjs:76`), the slow path.
- GPU flags are set for Linux and macOS only (`browser.mjs:57-58`); Windows gets none.
- `GUIDE.md` tells scene authors the budget is "≤ 1.5 s per frame" (`plugin/agents/director.md:22`). At that
  budget a 60 s film is ~15 min per format on 6 workers (estimate). pdoom used 25 ms.

---

## 3. Speed plan (target: first cut of a 60 s film in ≤ 15 min, a fix round in ≤ 3 min)

| # | Change | Where | Effort |
|---|---|---|---|
| S1 | **Bounded loop.** One self-check per chapter, not per placeholder. One review round, then the founder reviews. Remove "repeat until all ≥ 8". Reviewer agent only before a final. Scene-builders only above 60 s. Full-quality render and extra formats only after the founder approves the draft. | `content/skills/video.md`, `review.md`, playbooks `build-loop`, `review`, `multi-agent`; `plugin/agents/*`; `template/CLAUDE.md` | ½ day |
| S2 | **`studio check`**: verify + sheet + phone sheet + stats in one run, one browser, one short text report and one image. Replaces 4–5 tool calls and image reads. | new `lib/check.mjs`, reuse `verify`, `sheet` | 1 day |
| S3 | **Warm browser.** A background `studio serve` keeps Chromium and the page open; `sheet`/`strip`/`crop`/`check` reuse it and tile in the same browser (no ffmpeg thumbnails). Falls back to today's path if it is not running. | `lib/browser.mjs`, `lib/look.mjs` | 1–1.5 days |
| S4 | **Runnable recipes + blocks.** `lib/blocks.js`: hook title, product-screen pan/zoom, stat counter, quote, caption track, logo end card, all driven by data in `film.json`. `studio init --recipe saas-launch-32` gives a film that already renders; Claude changes copy, screens and timing, and writes code only for the one hero shot. | `plugin/kit/template/lib/`, `content/recipes/`, `lib/project.mjs` | 2–3 days |
| S5 | **Render.** JPEG frames and 15 fps in `--draft`; re-render only chunks whose chapter file changed (hash per chapter); frame budget in `GUIDE.md` 1.5 s → 50 ms with `verify` warning on slow seeks; test GPU flags on Windows; fix the shutter (docs/18 §16.3 #1). | `lib/render.mjs`, `lib/verify.mjs`, `lib/browser.mjs` | 1 day |
| S6 | **Lighter verify.** Text scan at 4 samples/s, and once per layout family rather than every format. | `lib/verify.mjs` | ¼ day |
| S7 | **Timings.** Every command appends its duration to `out/timings.json`; `studio timeline` prints the total. This gives the real numbers this doc lacks. | `lib/util.mjs` | ¼ day |

Order: S1 and S7 first (cheap, and S7 tells us what S2–S6 really save), then S4, S2, S5, S3, S6.
S4 changes the docs/18 §9 decision ("Claude writes its own HTML") to "blocks by default, own code for the hero".

---

## 4. The review page ("cut notes")

**It exists.** `/app/studio/<item id>` (`web/components/studio/StudioReview.tsx`): frame keys, type-to-pin,
range notes, spot pins, tags, rounds, compare, approve, copy notes.

**Why Atul has not seen it:**
1. It only opens from a Studio item, and an item only exists after `studio upload`. This machine has never
   uploaded (kit not installed, not signed in). An empty library has no way in.
2. By default it is **not frame by frame**. MP4s are not uploaded (docs/18 §14), so the page scrubs the contact
   sheet: at most 36 tiles for a whole film. True frame stepping needs `--with-video` or `--video-url`.

**Fix (no storage cost):**

| # | Change | Effort |
|---|---|---|
| R1 | **`studio review`**: the kit serves a local review page that plays the film from disk (`out/.../review.mp4`, or the live page through `seek(t)`), every frame. Notes save to Deno when signed in, otherwise to `notes.json` in the project. `studio notes` reads either. `studio check` and `studio upload` print the link. | 2 days |
| R2 | **A sample item in every new account** (our own launch film, one open note), so the review page is one click from an empty library. | ½ day |
| R3 | Link "Review" from the dashboard home and the Studio library header, not only from a card. | ¼ day |

R1 is also the token fix for quality: the human finds the problems, the AI reads short text notes with
time, frame, clip and x/y. That replaces most reviewer-agent rounds.

---

## 5. Other AI tools (Antigravity, Cursor, Codex, Gemini CLI, …)

What is Claude-only today: the plugin wrapper (`.claude-plugin`, `plugin/agents`, `${CLAUDE_PLUGIN_ROOT}` in every
skill preamble), the template's `CLAUDE.md`, and "Claude" in UI text. The kit is plain Node and the MCP server is
standard, so the gap is packaging.

| # | Change | Effort |
|---|---|---|
| A1 | Publish the kit to npm (free) so `npx deno-studio …` works anywhere. Today `package.json` is `private: true` and the kit only arrives with the Claude plugin. | ½ day |
| A2 | `studio init` writes `AGENTS.md` (the house rules) and a one-line `CLAUDE.md` that points to it; copies the skills into the project as plain Markdown the agent can read. `build_plugin.py` emits a tool-neutral preamble (no `${CLAUDE_PLUGIN_ROOT}`). | 1 day |
| A3 | `studio connect <tool>` prints or writes the MCP config for that tool. Config paths per tool must be checked against each tool's current docs before we ship them. | ½ day |
| A4 | Test the live MCP + OAuth in Cursor, ChatGPT, Codex CLI, Gemini CLI and Antigravity; fix what breaks; one docs page per tool that passed (`web/lib/docs/content.ts`). Only list tools we tested. | 1–2 days |
| A5 | UI wording: "your AI", not "Claude" (`StudioReview.tsx` "Copy notes for Claude", toasts). | ¼ day |

Sub-agents (`director`, `scene-builder`, `reviewer`) stay Claude Code only. With S1 and S4 a 60 s film no longer
needs them.

---

## 6. Other things that block paid users

1. **Install.** `studio doctor` on Windows fails on ffmpeg and tells the founder to use winget. Ship ffmpeg
   through an npm package in the `core` dependency group so `studio doctor --install` is the only step. ½ day.
2. **Free must have a limit, or nobody upgrades.** Enforce "1 Studio project, 3 versions" on Free in
   `studio_service.py` (the `Quota` table already exists). Drop the watermark promise or build it. ½–1 day.
3. **Pricing page honesty** (docs/21 §6). Make Agency "Talk to us" and remove features that do not exist.
4. **Proof on the landing page.** One real film made with the product, plus the time it took (from S7).
5. **Separate production database.** A second free Supabase project. Atul's action.
6. **Supabase Auth settings** for many sign-ups (docs/19 §2). Atul's action.
7. **`LICENSE`** in the repo.
8. **Taking money.** No checkout means no paid users. If the Razorpay integration is not ready by day 8, use
   Razorpay Payment Links (no code) and set the plan by hand for the first founders.

**Leave for after launch:** BYO-AI validation, content calendar, WebGL layer, richer audio analysis, MCP App
review, Agency features, Openverse on the server, Reddit fallback.

---

## 7. Ten days

| Day | Work | Done when |
|---|---|---|
| 1 | S1, S7, A5, ffmpeg in `doctor --install`; install the kit on Windows and time one 60 s film as the baseline | baseline numbers written here |
| 2–4 | S4 blocks + 3 runnable recipes (SaaS launch, explainer, vertical captions) | `studio init --recipe` renders a draft with no code written |
| 5 | S2 `studio check`, S5 render | fix round ≤ 3 min measured |
| 6–7 | R1 `studio review`, R2 sample item, R3 links | notes written on a local frame reach the AI |
| 8 | A1, A2, A3; Free limits (§6.2); pricing page clean-up | `npx` install works in a non-Claude tool |
| 9 | A4 tests + docs pages; S3 warm browser if time allows | each listed tool tested end to end |
| 10 | Make the landing film with the product, re-measure, update docs/17, launch | film on the site with its real build time |

Each row is one PR against `main`. Kit and content changes need `scripts/build_plugin.py`, the kit tests and
`web/lib/docs/tools.ts` if an MCP tool changes.

---

## 8. Day 1: what was built (2026-11-16, branch `feat/studio-fast-loop`)

| Item | What changed |
|---|---|
| S1 bounded loop | Skills `video`, `review`; playbooks `build-loop`, `review`, `multi-agent`; the three agents; the template `CLAUDE.md`. Look once per chapter, one fix pass, then the founder. "Repeat until all ≥ 8" is gone. The reviewer agent runs once, before a final. Agents only above ~60 s. Frame budget 1.5 s → 50 ms. |
| Draft first | New `studio upload --draft`: needs a clean, current verify and a sheet of the draft render (no full render, no mix). `--final` is unchanged. `studio sheet` now reads the newest encoded file, so a fresh draft is not hidden by an old master. |
| S7 timings | Every command appends to `out/timings.json`; `studio timeline` prints the total and the three most expensive commands. |
| ffmpeg | `studio doctor --install` downloads the kit's own ffmpeg + ffprobe (`ffmpeg-static`, `ffprobe-static`) into `~/.deno-studio/deps` when the system has none, and every command puts it on PATH. |
| A5 wording | Studio review, library and Rulebook say "your AI", not "your Claude". |

**Three Windows bugs found by running the kit here, all fixed:**
1. `studio doctor --install` died with `spawn EINVAL`: Node will not start `npm.cmd` without a shell
   (`lib/util.mjs` `run`). The kit could never install on Windows.
2. `studio verify` failed the **untouched template** with a blocking purity error. Chromium keeps a moving
   element's raster from its first paint, so the same `t` differed by sub-pixels depending on the frames before
   it. `Film.grab` now drops the layout tree before each seek, and `verify` re-checks a suspect frame alone on
   a fresh page before blocking. After the fix: 10 runs in a row clean (one stray frame in 3 runs before the
   re-check was added). Full render time did not change (17 s → 18 s).
3. `scripts/build_plugin.py` wrote CRLF files on Windows, so every generated skill showed as changed.

**Measured on this machine (Windows 11, system Chrome, the 6 s template film, 9:16, 30 fps):**

| Command | Time |
|---|---|
| `verify` | 8.7 s |
| `sheet --live` | 19.5 s |
| `sheet` (from the encoded file) | 4.8 s |
| `strip --at 5` | 7.4 s |
| `render --draft` | 7.4 s |
| `render` (2 sub-frames) | 17.4 s |

What this says: a look at the live page (19.5 s) costs more than a draft render plus a sheet of it
(7.4 + 4.8 s), so S3 (warm browser) matters more than S5 (render). Scaled by length, a 60 s full render would be
about 3 min per format on this template; a real film with heavier frames will be slower.

**Not done on day 1:** timing a real 60 s film end to end. The template ignores `--duration` (its `DURATION` is
a constant 6), and a real film needs `studio login` and a validated idea. `studio upload --draft` was tested up
to the sign-in step only. Kit tests: 22 pass; the one failure is the known chmod test on Windows.

---

## 9. R1 built: the local review page (2026-11-17, same branch)

Atul's own Cut Notes page (a single HTML file he used with a Claude artifact: video in the artifact's assets,
notes in its database) is now part of the kit, rebuilt so it needs no artifact, no upload and no Claude-only
feature. **The founder's video never leaves their machine.**

| Piece | Where |
|---|---|
| Server | `plugin/kit/lib/review.mjs`: `studio review` serves the page on `127.0.0.1:4747` (another port if busy), streams the newest render of the first format with range requests, and keeps the state in `review/notes.json`. Local only: it rejects other hosts, other origins and non-JSON writes. |
| Page | `plugin/kit/review/index.html`: one file, system fonts, no network. Frame keys, type-to-pin, click the picture for a spot, `[` `]` range notes, tags, chapters on the timeline, speed, rounds, "I'm done reviewing", Copy (for pasting into any chat). It polls the kit, so the AI's replies and the next render appear on their own. |
| AI side | `studio notes --wait` blocks until the founder presses done, then prints one line per open note (time, frame, chapter/clip, spot, tags). `studio reply <id> fixed|open "…"` answers a note. `studio review --next` opens the next round. |
| Rules | Skills `video` and `review`, playbooks `review` and `build-loop`, the template `CLAUDE.md` and the director agent now run review rounds on this page. `studio upload` is for saving a version to the Deno library. |
| Public docs | `web/lib/docs/content.ts`: the review page and the kit command table. |

Why it also saves tokens: the person finds the problems; the AI reads a few lines of text instead of looking at
sheets and scoring itself.

Tested here in the app's browser pane on the template film: the picture fits the stage in 9:16, 40 frame steps
land on F40, a spot pin + tag + note saved and mapped to chapter `hook`, "done" released `studio notes --wait`,
the reply showed under the note, and `studio review --next` after a partial re-render loaded round 2 on the open
page. Kit tests: 23 pass (+ the known chmod failure).

**Not done:** notes from the local page do not reach the Deno dashboard or taste memory (they stay in the film
folder); the page was not tested in Safari or Firefox, or at phone width; R2 (sample item) and R3 (links) are
still open, and the dashboard review page is unchanged.

---

## 10. S4, first part: blocks and two runnable recipes (2026-11-17, branch `feat/studio-recipes`)

`studio init <name> --recipe <slug>` now creates a film that **already renders**. The film is data: `film.json`
has `scenes: [{ id, block, start, end, props }]` and `plugin/kit/template/lib/blocks.js` draws each scene. The AI
changes words, pictures and timing in `film.json`; it writes code only for a shot no block can do
(`"block": "custom"`). This changes the docs/18 §9 decision "Claude writes its own HTML" to "blocks by default,
own code for the hero shot".

| Piece | Where |
|---|---|
| Blocks | `hook` (headline, `*word*` gets the accent), `screen` (a product screenshot with a moving camera, a cursor and a caption), `stat` (a number that counts up), `points`, `quote`, `endcard` (the name shrinks to fit) |
| Recipe page | `plugin/kit/template/recipe.html` (becomes `index.html`); it imports `film.json` directly |
| Runnable recipes | `plugin/kit/template/recipes/saas-launch-32.json` (16:9, 6 scenes), `vertical-feature-15.json` (9:16, 4 scenes). The other 12 formats still start from the blank template |
| Sample copy can't ship | Each scene starts with `todo: true`. `verify` blocks and a full render refuses until `studio fill <scene id>`; `studio timeline` shows `[sample copy]` |
| Rules | Skill `video` §3b, playbook `build-loop` §0, the template `CLAUDE.md`, the two recipe docs |
| Gallery | `formats.json` carries `runnable`; the format page says so and the prompt names the recipe |

**Measured here (Windows 11, 6 workers), `saas-launch-32` with one real screenshot in its three screen scenes:**
`init` to a first draft with no code written: draft render 31–35 s, sheet 5–7 s, verify 14 s. Full-quality
render of all 32 s: 86 s. `vertical-feature-15` (15 s): full render 46 s.

**Three more fixes found on the way:**
1. The day-1 purity fix hid the page while `seek(t)` ran, so film code that measures layout got zero sizes (the
   camera in `screen` and the name fit in `endcard` did nothing). The page is now shown again before `seek`;
   purity is still clean (5 runs in a row on the template).
2. `verify` counted each value of a counting number as a line shown too briefly, and counted the pieces of one
   wrapped sentence as overlapping text. Counters carry `data-studio-counter`; text in the same block is no
   longer compared.
3. `studio capture` wrote Windows backslashes into asset paths.

**Not done:** the other 12 recipes; captions and voice inside a recipe film; transitions between scenes (they
cut); a real founder's film made this way end to end (so no measured "time to first cut" with an AI in the loop
yet); `studio check` (S2), the warm browser (S3) and the render work (S5).

---

## 11. Kit speed: `studio check`, faster drafts, the shutter fix (2026-11-17, branch `claude/launch-plan-rest-e0999a`)

| # | What changed | Where |
|---|---|---|
| S2 | **`studio check`**: verify + one contact sheet with every frame at phone width (360 px) + the colour numbers, in one Chromium, one short text report and one image (`out/<format>/contact.png`). The sheet comes from the current render when there is one (one ffmpeg decode pass for all frames), otherwise from the frames verify already grabbed. It writes `verify.json` and `sheet.json` exactly as `verify` and `sheet` do, so `upload --draft` and `upload --final` accept it. Skills `video` and `review`, playbooks `build-loop`, `review`, `multi-agent`, the `reviewer` agent and the template `CLAUDE.md` now say `studio check` instead of verify + sheet + sheet --phone + sheet --stats. | `lib/check.mjs` (new), `lib/verify.mjs` (split into `verifyFormat`), `lib/look.mjs` (`tile` can reuse an open browser) |
| S5 | **Draft render**: 15 fps, JPEG frames, faster x264 preset. **Only changed chunks are rendered again**: each 2-second chunk has a fingerprint of the shared code (page, styles, `lib/`, assets, `film.json` without scenes/chapters) plus only the `film.json` scenes and chapters (and `chapters/<id>.*` files) that overlap it (`chunkKeys` in `lib/timeline.mjs`, saved in `chunks/chunks.json`). `--from/--to` still forces seconds; `--all` forces everything. `render.json` records which code a render shows, so `check` knows a current render from an old one. | `lib/render.mjs`, `lib/timeline.mjs` |
| S5 | **Motion-blur shutter fixed** (docs/18 §16.3 #1): sub-frames are centred on the frame time over a 0.5 shutter (180°) and averaged in linear light (16-bit, 2.2 gamma). Before, they trailed the frame by (n−1)/n of a frame and were averaged in gamma space (white over black came out 128 instead of 186). | `lib/render.mjs` (`subFrameTimes`) |
| S5 | **Slow-seek warning**: every text-scan seek is timed; `verify`/`check` warn when `seek(t)` takes over 50 ms (the first seek, which decodes images, is not counted), and `check` prints the median and slowest seek. | `lib/verify.mjs`, `lib/browser.mjs` (`timedSeek`) |
| S6 | Text scan at **4 samples per second** (was 10). | `lib/verify.mjs` |
| S3 | **Not built, by the rule in the brief**: after S2 and S5, Chromium starts in 0.53 s and the page loads in 0.29 s, out of ~11 s for `check`. Browser start-up is not the largest cost. | — |

**Measured on this machine (Windows 11, 8 cores, 6 render workers), `saas-launch-32` with one real screenshot in its
three screen scenes. A fix round = change one scene's caption (`screen-2`, 9–15 s), draft-render, check.**

| Fix round | Before (main, 2 runs) | After (this branch, final code, 2 runs) |
|---|---|---|
| `render --draft` | 44.0 s / 42.1 s (all 16 chunks, 30 fps, PNG) | 5.1 s / 5.8 s (4 of 16 chunks, 15 fps, JPEG) |
| `verify` | 15.4 s / 14.5 s | — |
| `sheet --stats` | 17.1 s / 38.3 s | — |
| `sheet --phone` | 8.4 s / 10.4 s | — |
| `check` | — | 10.5 s / 11.5 s |
| **Total** | **84.9 s / 105.3 s** (4 commands, 2 images + a stats table) | **15.6 s / 17.3 s** (2 commands, 1 image) |

An earlier version of `check` (one ffmpeg call per frame) took 14.0–15.7 s (fix round 19.8–21.5 s); one decode pass
saved ~4 s. Where `check`'s time goes now: verify's checks on the page 6.7 s (purity on 3 pages, 129 text-scan
seeks), the sheet ~3 s, Node + Chromium start ~1 s.

Other numbers from the same session:
- Draft render of all 32 s from nothing: **12 s** (was 42–44 s).
- `vertical-feature-15` (9:16): draft render of all 8 chunks 8 s; `check` read the sheet from `draft.mp4`.
- Full-quality render (30 fps, 2 sub-frames, now linear-light): 94 s. §10 measured 86 s for the old shutter on
  another run; not compared back to back, so the cost of the linear-light average is somewhere between 0 and ~9%.
- A film whose `seek(t)` busy-loops: `check` warned `slow_seek` (median 54 ms, slowest 62 ms).
- Kit tests: 26 pass (new: shutter timing, chunk fingerprints); the known Windows chmod test fails as before.

**Not done:** the AI-in-the-loop "time to first cut" (still needs a real founder's film); GPU flags on Windows; text
scan once per layout family rather than per format (only the 4/s part of S6). On the local review page a 15 fps
draft shows each picture for two frame steps (frames are counted at the film's 30 fps; note times stay exact).
