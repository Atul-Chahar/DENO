# 13 — How Claude makes good video: research for Deno Studio

Status: **research, 2026-11-12**. Input to docs/12 (Studio MCP plan).
Scope: the 10 links supplied by the founder, the example "Claude Pop" brief, and ~25 primary sources they
lead to (repos with source code, the authors' own guides, a dev.to post-mortem, licence files). Every claim is
tagged with its source in §13. Creator-reported numbers (time, cost, quota) are marked *reported*; none were
independently verified.

Raw corpus (guides, prompts, READMEs) was downloaded for analysis to the session scratchpad and is **not
committed**: most of it is third-party content (see §10).

---

## 0. The short version

Opus 5.5 has no video model. Every good "Claude video" is **code that draws a frame for a given time `t`**,
rendered by a headless browser and encoded by ffmpeg. The quality gap between viral pieces and "AI slop"
is not the model. It is five things the good creators added around it:

1. **A render contract.** Every frame is a pure function of time (`seek(t)` / `renderAt(t)` / `draw(f)`).
   Without that rule nothing else works: no parallel rendering, no frame review, no surgical fixes.
2. **Pre-production before code.** A storyboard or treatment with timed shots, and *"reads"*: what the viewer
   must understand, and when.
3. **A house style written down.** One named style with explicit rules and an explicit avoid-list, kept in an
   `ANIMATION_GUIDE.md` / `SKILL.md` that every agent reads.
4. **A habit of looking.** Contact sheets, frame strips and 1:1 crops, a determinism check, and a reviewer that
   scores and sends work back. Only 7% of public prompts asked for self-review, yet nearly every top result did
   it.
5. **Sound and timing as data.** A beat grid, word-level lyric/voice timestamps and SFX cues on the same
   timeline the picture reads.

The best public pieces add a sixth: **multi-agent production**. A director agent writes the storyboard and a
contract, parallel subagents build one chapter each, and the director reviews contact sheets and sends work back.

**For Deno this confirms the docs/12 thesis and sharpens it.** The MCP's value is (1)–(5) packaged: the
contract (renderer + timeline schema), the style guides, the playbooks, the review tools, the audio analysis,
plus the founder's own context. It also corrects one plan item: **most "free" SFX/music cannot legally be
redistributed through a product** (§10), so the asset library must be built mostly from CC0 + our own
synthesis + a sublicensable music API.

---

## 1. Source-by-source analysis (the 10 supplied links)

### 1.1 skillry.dev/ai-videos/opus-5-5 — showcase + remakes
- **What:** 418 Opus 5.5 videos (40 shown), each with creator, length, category, tech tags and a prompt card;
  Skillry rebuilds some as "remakes" from the shared prompt. Lists video Skills (Plush Crew Launch Video, Paper
  Cutout Story Video, CreatorMotion, Velocity-Matched UI Sting).
- **Notable pieces:** Golden Gate Bridge in one Three.js file; interactive explainers (camera lens, turbofan,
  heart, watch) with orbit/zoom/**Explode** buttons; 1857 cannon built procedurally in WebGPU/TSL with *no
  assets*; a one-shot 30-year camera flight; a 58 s piece with generated score and synced SFX; JP+EN versions
  from one Remotion codebase via props; an SEO-tool release video where Claude **logged into the product,
  captured 38 screenshots, wrote spec → storyboard → script, used TTS, split narration into 32 phrases for sync
  and ducked the BGM under voice**.
- **Takeaways:**
  - Specify format and interactivity.
  - Ask for audio in code with explicit sync points.
  - Give one reference video for style.
  - Request a self-check of rendered stills.
  - "Procedural over assets" works for 3D.
  - Phrase-level sync for narration and character-level sync for lyrics.
- **Failure notes:** "Opus 5.5 feels a little nerfed… used to one-shot" (needed pushback); clipped/overlapping
  text caught only by self-review; 11–40 min generation times.
- **Reliability:** an aggregator; many prompts truncated; remakes ≠ originals.

### 1.2 revid.ai/claude-motion-graphics — the 64 most-liked launch-week videos
- **What:** a ranked gallery (≥100 likes on X, 23–27 Sep 2026) with a "Use as prompt" funnel into Revid's
  generator (a *motion director* running on Opus 5.5 that studies a reference frame by frame and remakes it
  "with a new script and same energy").
- **Data worth keeping (from 64 videos):**
  - Formats: launch films 17, product demos 13, ads/edits 11, showreels 10, explainers 9, tutorials 4.
  - **59% open on the finished result**, with no logo intro.
  - **77% use fast to rapid-cut pacing.**
  - **Median length 29 s**; 24 of 64 are ≤ 20 s; the **15-second showreel** was the breakout format.
  - Top: "The showreel that started it" (16k likes, 1.7M views, 0:15); an illustrated AI timeline, one
    prompt / 12 hours (9.9k likes, 3.4M views, 2:22).
  - 43 of 64 were made with Claude. The rest came from agent editors and gen tools (Tesseract, Pexo, Seedance,
    Higgsfield, HyperFrames, SuperX).
- **Takeaways:** the market already pays for "remake this reference with my product". Short, fast, result-first
  wins. Revid is a direct competitor to Studio's reference-driven flow, and it runs on Claude too.
- **Reliability:** vendor page (funnel); ranking method stated; good descriptive data.

### 1.3 awesomeclaude.ai/opus-video-prompts — prompt builder + 14 templates
- **The anatomy of a good prompt (their builder):**
  - format line
  - subject
  - beats (hook → product → 3 features, one per beat → proof → name/URL/CTA)
  - specs (1920×1080, 60 fps, 5% safe margin, one HTML file)
  - **render contract** ("every frame must be a pure function of time", `window.renderAt(t)`)
  - audio: a supplied licensed 120 BPM track, cuts on the beat grid, muxed by ffmpeg
  - process: storyboard → wait for approval → contact sheet → Playwright + ffmpeg export
- **14 templates:**
  - SaaS launch 15 s
  - showreel one-liner
  - how-it-works explainer 45 s
  - logo sting 6 s
  - data story 20 s (1:1)
  - vertical feature 15 s (9:16)
  - lyric video 60 s
  - app walkthrough 30 s
  - 3D flythrough
  - hand-drawn character short (p5.brush, 24 fps)
  - research paper in 60 s
  - GitHub repo promo
  - seamless loop (sin/cos of 2πt/T)
  - changelog video
- **Stats from 496 prompts:** duration stated in 44%; sound 33%; camera language 23%; avoid-list 19%; style
  reference 19%; export instructions 17%; scene beats 14%; fps 13%; **aspect ratio only 8%**; **self-review 7%**;
  a named library in 38%; median prompt ~35 words.
- **Rules:**
  - "One named style beats five adjectives."
  - Storyboard first.
  - Give BPM and first-beat offset.
  - Draft at half resolution.
  - One change per message, and say what to keep.
  - Contact sheet before the full render.
- **Common mistakes:**
  - Missing aspect ratio ("the most skipped spec with the biggest effect").
  - No export instructions ("a page to watch, not a file").
  - Generic effects (particle bursts, glow, lens flare, bouncy easing).
  - Screenshots instead of rebuilt UI.
  - A rushed middle and dead time.
  - Several changes at once.
  - Invented numbers.

### 1.4 awesomeclaude.ai/claude-video — the workflow guide
- **Pipeline:** HTML/JS → headless browser steps time → ffmpeg. Five steps: brief → storyboard → scene → stills →
  MP4.
- **Stack shares (703 prompts):** Canvas 2D 38%, SVG+GSAP 26%, Three.js/WebGL 19%, GLSL 13%; also p5.js +
  p5.brush; Remotion/HyperFrames "worth it past about one minute".
- **Six render rules:**
  - Read time; don't count frames.
  - Seed randomness.
  - No step-by-step physics.
  - Wait for fonts.
  - ffmpeg adds the audio.
  - Tag colour BT.709.
- **Where to work:** claude.ai artifacts suit previews only (screen recording drops frames). Claude Code does real
  MP4s and can burn a large share of the weekly allowance.
- **Reported costs:**
  - 15 s launch spot: ~1 min, ~$2 API.
  - 5-min explainer with TTS: 26 min.
  - 3-min history film (~7,400 lines): ~1 h, 7% of the weekly quota.
  - 156 s hand-painted music video: 10% of a Max 5x week.
  - Lyric music video at xhigh: 45 min first cut, ~$200 API.
  - Full-song 4K60 render: ~57 min on an M5 Pro.
- **Model notes:**
  - Sonnet comes close on charts, cards and simple 3D at ~¼–½ the cost, but is weaker on hand-drawn work; Opus
    for the final.
  - Higher effort gives more detail.
  - "One-shot" usually meant 2+ rounds.
- **Limits:** weak at photoreal people and places (pair with a video model). Flicker comes from state between
  frames or `Math.random()`, and some players apply the wrong colour matrix.
- **Example repos named:** mexicat/pdoom-video, JohnHeibel/ClaudeAnimationBase, lemomo-ai/lemo-opuscar.

### 1.5 awesomeclaude.ai/code-cheatsheet — Claude Code reference
- Not video-specific. Useful for **our MCP/plugin design:**
  - Media MCPs exist: Cloudinary, invideo, Canva, Figma.
  - `MAX_MCP_OUTPUT_TOKENS` (default 25k cap): our tools must return compact text and put images/frames behind
    URLs.
  - `MCP_TIMEOUT`, and `BASH_DEFAULT_TIMEOUT_MS` (renders are long).
  - Async hooks for slow jobs.
  - Subagent frontmatter (`background`, `isolation: worktree`, `skills`, `mcpServers`).
  - `claude -p --output-format json` for headless runs.
  - Skills with `${CLAUDE_SKILL_DIR}` scripts and `` !`cmd` `` inlining.
  - Keep `CLAUDE.md` under ~200 lines; use path-scoped `.claude/rules/`.
- Its Video section links the 17-style skill (§2.1) and the render script (§2.2).

### 1.6 ofox.ai/blog/opus-5-5-video-prompts-mp4-guide — the sober tutorial
- **Three routes:** code animation, editing existing assets, or calling a video model. "A social-media video does
  not prove a native Opus video API exists."
- **Remotion starter:**
  - `npm ci`, `npm start`
  - `npx remotion render src/index.tsx Promo out/promo.mp4 --codec=h264 --pixel-format=yuv420p --muted`
  - `npx remotion still … --frame=225`
  - `ffprobe` to verify the output
- **Frame math:** recompute scene boundaries whenever fps or duration changes.
- **Pre-prompt prep:**
  - An asset inventory: purpose, source, permission, credit.
  - Copy written first (problem sentence, two substantiated benefits, one CTA).
  - An **acceptance sheet**: claims vs fact sheet, approved screenshots, scene-change frames, final card
    readable, export spec, audio status.
- **Three templates (launch 15 s, explainer 30 s, data chart 20 s):**
  - Use only supplied facts and screenshots.
  - Don't invent stats or rescale charts to dramatize.
  - "Do not report success if no MP4 was created."
- **Failure table:**
  - HTML ≠ MP4.
  - Composition ID mismatch.
  - Preview moves but export is static (wall-clock timers).
  - Assets vanish in render.
  - No sound (a prompt saying "with voiceover" doesn't create audio).
  - Cropped labels.
  - A new composition named in the prompt but never registered.
  - Export stalls on a remote font.
  - Frames vary between renders.
- **Also:** "Watch the full MP4; stills can't show stutter." Check Remotion licensing for commercial use.

### 1.7 github.com/yihui-dev/awesome-opus5-5-videos — the biggest prompt index
- **What:** MIT, 15k★. 703 prompts and 418 remakes in total; 130 shown, in motion graphics (58), explainers (16),
  3D (14), games (12) and latest (285).
- Each entry has a prompt file, tech tags and the X post. Prompts belong to their creators.
- **Most useful verbatim prompts (pulled from the raw files):**
  - **@verbove UI loop.** `<inputs>/<rules>/<structure>/<motion>/<export>`:
    - "One HTML file. One canvas. One draw(t) function. No CSS transitions. No timers. No state carried between
      frames. One shape, never cut."
    - Closed-form springs; "if a value changes target multiple times, sum one spring per change"; content
      enters after its container starts morphing.
    - "Never fade black directly into the accent colour."
    - Tab indicators stretch by putting each edge on a different spring.
    - Last frame = first frame.
    - Export: contact sheet one frame per beat → fix → 60 fps with **6 subframes averaged for motion blur** → all
      aspect ratios in parallel.
  - **@brainextends Spotify film (18 s).** `<deliverables>/<art_direction>/<artwork>/<timeline>` with a cue
    every ~0.6–0.9 s and exact copy. "Build, render, inspect, and refine… Do not stop at a storyboard."
  - **@0xKarmi deterministic rendering.** Stage → render `draw(f)` → encode → **check: three passes, a smoke test
    with six yes/no defect gates, and a seam check (frame 0 vs frame N: one changed pixel = non-periodic
    motion).**
  - **@fleyta88.** A GSAP timeline with a Playwright frame-stepping verification loop that "patches until it
    passes without rewriting everything".
  - **Permission one-liners that went viral:**
    - "make a dynamic 15-second motion graphics video that shows what an incredible motion designer you are for
      <url>" (@melvynx)
    - "…like it's your showreel – Go all out." (@ajith_io)
    - "build me an incredible video for my app. make it emotional." (@marklaunches)
    - "make a modern slick and punchy video for a modern startup that works on inference" (@deedydas)
  - **@moritzkremb** (the most copied SaaS-launch prompt): "find some SaaS… get actual assets… the typical
    professionally edited motion-graphics launch videos you see on Twitter".
  - **@screeendev:** "Using Remotion… Use the repo for information… zooms, cursor, typing, interaction".
  - **@daniel_mac8:** "act as a world-class animator", plus a **reference MP4 path** for style.

### 1.8 youmind.com/opus-5-5-prompts — 755 prompts (15 visible)
- **Prompt shapes:**
  - one-sentence scenes ("a glowing portal on a sky deck at sunset…")
  - edit/transform prompts against a reference sprite
  - interactive briefs with `<inputs>` that ask the user questions first (topic, length, captions, SFX
    synthesized in numpy)
  - system-instruction style prompts ("start working when the request is clear + keep moving when you're away")
  - hard-constraint prompts ("do not use image gen or any plugin or skill, it should be pure js code no
    cheating")
- **Takeaway:** prompts that interview the user first, and prompts with hard medium constraints, are a recurring
  pattern. Output is browser animation; MP4 needs a renderer.

### 1.9 iart.ai/blog/opus-5-5-product-launch-videos — 6 launch-video patterns (282 prompts analysed)
- **Brief anatomy (300–450 words):** format line, IDEA (one subject/device), beat timeline (exact text), LOOK
  (hex, type, texture, composition), MOTION (where fast, where held, transitions), SOUND (tempo, instruments, a
  sound per action, or "No narration").
- **Findings:**
  - **Permission framing** ("go all out") produces bolder films.
  - **One emotional word** is enough for a story with a twist.
  - A detailed shot list gives control (one scripts every 0.6 s).
  - **15–20 s with something new every second** works best (cites Meta: the message in ≤ 15 s).
  - In a blind AI-judged test, the full brief beat the opening line alone on 5 of 6 films.
- **Six patterns** (each with best-for / avoid-for):
  1. "Go all out" showreel: ~122 BPM, morphing states, command menu, metric cards, logo plus sub-bass. Best for
     dev tools; avoid for explaining.
  2. Narrated explainer: problem → what → 3 steps → proof → name. Best for new audiences.
  3. Shot-by-shot brief: one hero item threads the film; no bounce, no particles; outgoing text leaves before
     incoming text arrives.
  4. Classic SaaS launch: cards collapse into the logo, a cursor tours real screens, pull out to a grid, CTA.
     The *most copied*, so it doesn't stand out.
  5. One-shape UI loop: the last frame equals the first. Best for flows (checkout, onboarding).
  6. Emotional story: a personal object, a montage, a payoff. B2C only; reads as parody for B2B.
- **Mistakes:** narration on an emotional story, emotion for B2B, a showreel when people need to understand,
  too long, copying the common prompt, expecting identical results.

### 1.10 github.com/X-RayLuan/awesome-opus-5-5-video-prompts — "verbatim prompts only" index
- **What:** MIT. 84 examples in 6 categories, EN/ZH. It marks "not shared" when the creator didn't publish a
  prompt, and has a RIGHTS.md and a scrape method. It is the source of the best long-form material:
  - **kimmonismus, 3-min AI history film:** "You are a motion designer and creative director…" Remotion 1920×1080
    30 fps exactly 5400 frames; STORYBOARD.md first; "after each scene render 3–4 stills and look at them
    critically"; one recurring protagonist ("the token 'the'"); **accuracy: "if you're unsure about a specific
    fact, leave it out… list uncertain claims in NOTES.md"**; "max ~8 words on screen, ≥ 2.5 s"; "transitions
    that grow out of the content, not generic fades"; "alternate dense and calm moments"; "work autonomously…
    give me the MP4 path, a summary of creative decisions, and NOTES.md".
  - **P(doom) music video** (@other__reality): "pasted the lyrics and the audio file and told it to make a
    cutesy animation… bumped reasoning to xhigh and told it to use p5 brushstrokes and more interesting scenes,
    and 45 minutes later I got this." 7 chapter subagents.
  - **Functional Emotions** (@eudaemonea): the three direction messages ("go all out, and do you to the fullest";
    "not a fancy lyric video"; "I'll push you on timing… not letting the scene sit too still").
  - **Opus as director for AI video models** (the closest match to the founder's example prompt):
    - **Seedance road trip:** Opus writes the character sheet, start frames, camera moves, dialogue timing and
      sound. Prompt blocks: `=== REFERENCES ===` (start frame "must match pixel for pixel", **IDENTITY LOCK** with
      exhaustive wardrobe and jewelry) and `=== CAMERA LOCK (MOST IMPORTANT) ===` ("Zero cuts, zero camera
      switches, zero time jumps"; who holds the camera, where they sit, how they move).
    - **Infinite-zoom collage via Magnific MCP:** "List the generations + credit cost and wait for my OK first";
      depth-layer parallax (`scale = camera^Z`); exponential zoom with segment length ∝ log(zoom); "verify the
      cuts frame by frame"; generate on pure green `#00B140` and key out; cutouts at 15 fps on twos; deliver an
      **interactive artifact with an AE-style timeline** plus the MP4; "show me screenshots before each expensive
      step". About 1,500 credits *reported*.
    - **Blender blockout → Seedance:** Opus pulls reference frames at 15 fps, rebuilds each shot as a blockout,
      exports it as the motion reference, and writes prompts so Seedance doesn't copy the rough render.
    - **OpenEdit talking-head edit:** ~1 h 51 m, $23 tokens + $49 fal *reported*.
    - **video-use:** 13 takes compared by transcript and frame, the best picked and edited.
    - **Runway MCP documentary;** **Remotion + fal.ai** for music and VO.
  - **Explainers with TTS:** save the vendor's docs as `TTS.md`, keep the key in `.env`, and add
    `"deny": ["Read(./.env)"]` so Claude can't read it. A 5-min geography lesson took 26 min; a 2:38 history
    film used 3% of the 5-hour limit *reported*.
  - **3D:** Alex Albert's Market Street 1906 (sourced: Sanborn maps, the Miles Brothers film, a per-building
    confidence ledger; "No downloaded meshes, textures or HDRIs"). Meng To has Opus score scene parts until
    each is ≥ 8/10. Castle via Blender MCP: 35 min, ~$13 *reported*.
  - **Tools & starter kits list** (followed up in §2).

---

## 2. Follow-up primary sources (where the real engineering is)

### 2.1 The 17-style motion-graphics skill (awesomeclaude.ai/claude-motion-graphics)
Each style is rules + avoid-list + tech:
- Swiss grid / kinetic type
- flat vector explainer
- shape morph / liquid
- single line / live drawing
- data story
- isometric miniature
- dark tech keynote
- living UI screencast
- HUD / terminal
- watercolour / ink
- risograph / halftone
- paper cut-out / collage
- hand-drawn line boil
- pixel art
- VHS / film / CRT
- toy / material 3D
- vertical social captions

Example rules: keynote = `cubic-bezier(.16,1,.3,1)`, 30–45 frames per move, **one giant number at 30% of frame
height**, one accent colour. Living UI = rebuild the real UI, the cursor pauses 8 frames before each click, zoom
1.6×, one action every 3–4 s. Vertical captions = 1–4 words per caption, popping on the spoken beat with a
6-frame overshoot, nothing in the bottom 15%.

The bundled SKILL.md workflow:
1. **Ask once, then work.** Takeaway, duration and ratio, real facts and assets, audio and BPM, one style.
2. Storyboard: hook in the first second, a 0.8–1.2 s final hold.
3. The `renderAt(t)` build rules and a **default avoid-list**: particle bursts, lens flares, neon glow, RGB split,
   glitch, bouncy easing, decorative gradients, redundant text.
4. **Review.** Overlap/clip, ~0.3 s per word (min 1 s), dead time, fallback fonts, black frames.
5. Render with a virtual clock.
6. **Report the two weakest moments.**

**Licence: none stated, so it can't be redistributed.** We can learn from it, not copy it.

### 2.2 claude-video-render.mjs (the reference renderer)
`addInitScript` patches `Date.now`, `performance.now` and `requestAnimationFrame`. `__advance(ms)` runs queued rAF
callbacks, then pauses and seeks every `document.getAnimations()` (which covers CSS/WAAPI). It **does not patch
setTimeout/setInterval**. Capture is Playwright PNG per frame → `ffmpeg -f image2pipe -c:v libx264 -pix_fmt yuv420p
-crf 18 -movflags +faststart`. No licence stated.

### 2.3 JohnHeibel/PDoomVideo (P(doom), 156.6 s, p5.js + p5.brush) — **no licence: study only**
- **Structure:** 9 chapter files (`src/ch/`), a shared cast/props/timeline, `STORYBOARD.md` and
  `ANIMATION_GUIDE.md` (both written by Opus *for its subagents*), and `render.mjs` (resumable frames, parallel
  workers, then encode with the song).
- **The guide's subagent contract:**
  - "Only edit your own chapter file… if you find a bug in a shared file, report it."
  - Every shot is a pure function of `t`.
  - The karaoke band is reserved (keep faces above y 960).
  - Each chapter has its own palette.
  - Performance budget ≤ 2.5 s/frame.
  - Check with `--sheet` at listed times and `--stills`.
- **Storyboard craft:**
  - A stage show that rhymes start and end (same curtain).
  - "Sets, not cards."
  - Motivated transitions (a chomp to black, a zoom through an eye, a door slam).
  - Emotion morphs instead of snaps.
  - A camera move in every shot.
  - **A palette arc across the film.**
  - An escalating recurring prop (the P(doom) meter: 8 → 34 → 61 → 86 → 99.9).
  - Lead character at ~40% of frame height in dance shots.
  - Text-light: a handful of big SFX words (FOOM, CHOMP).

### 2.4 JohnHeibel/ClaudeAnimationBase (MIT) — the distilled lessons
This is the most valuable single document in the corpus: the author analysed what the model did well and badly
in P(doom), then wrote it down.
- **Three goals:** *Handmade* (brush, boil, flat 2D, no lettering), *Alive* (something always moving and
  happening), *One piece* (plan first; link scenes).
- **Rule 4, timing ("the rule models get wrong most often"):**
  - "You know what happens because you wrote the code. The viewer doesn't."
  - Write the **reads** per shot. Each read needs time to be found, understood and registered. **One read at a
    time.**
  - **Fast actions, slow meanings.** Lead the eye before an important read. Let the reads set the length.
  - Worked example: the first version packed an ending into 1.3 s "and nobody could tell what had happened";
    the fix spreads it over 4 s with each read timed.
- **No text:** "A sign that repeats the story is the classic failure."
- **Every shot needs an event.** Cause, then reaction. Pay off every setup.
- **Transitions at every seam:** brush wipe, iris, whip pan with smear, match cut, cut on action, a carried
  camera move. **Rhyme the ending with the opening.** Keep screen direction consistent and carry props over.
- **Animation principles applied to code:** anticipation, squash and stretch, slow in/out, weight, arcs,
  overlapping action and follow-through, **"avoid twinning"** (code copies values: both arms the same, a crowd
  in unison), exaggeration, strong key poses, show the thought, secondary action.
- **Storyboard format:** logline ("X wants ___, but ___, so ___"), world and palette arc, motif, character arc,
  and per-shot `start–end [transition] seen · EVENT · reaction · camera` plus a timed **reads** list.
- **Review loop:**
  - A contact sheet (first/middle/last frame of every shot).
  - A strip of every frame of a key moment.
  - A full-resolution crop, and a crop that follows a world point.
  - Checklist: read, timing (count frames per read at 24 fps), motion (anticipation, pops, constant speed,
    mirroring), boil seeds, contacts (feet on the ground, props in hands), transitions, rules, colour.
  - Budget: ≥ 1 sheet per shot, a strip per key motion, a crop per story face.
- **Engine detail:** seeded boil 12×/s and per-element `boilSeed(key)`, otherwise one moving thing re-jitters
  everything drawn after it. The p5.brush pigment-mixing quirk (yellow over blue = green): use additive
  `glow()`. A cost budget (≤ 1.5 s/frame). GPU flags for headless Linux (`--gpu-angle`, `--soft-gl`).
- **Usage:** "Read ANIMATION_GUIDE.md, then make a 15-second video of …". Ask for the storyboard first, start
  broad, request subagents. Tested at xhigh: "higher reasoning produced more extravagant scenes".

### 2.5 mexicat/pdoom-video (MIT, 3.9k★) — the same song done as a three.js "illustrated treatise"
- **Audio analysis pipeline:**
  - Demucs `htdemucs_ft` stems.
  - A mel-band-roformer karaoke model for lead-vocal isolation.
  - **CTC forced alignment cross-checked with Whisper** for word- and syllable-level timings.
  - `audio.json`: BPM 132.007, beats, downbeats, sections, drum and vocal onsets, loudness envelopes.
  - Scene windows anchored to lyric lines and **snapped to the beat grid**.
- **Treatment / style bible (`TREATMENT.md`):**
  - **Tone:** "Dynamic: big changes land on the beat… holds, then snaps"; "Impressive, not cute"; deadpan humour.
  - **The explicit anti-slop list:** no purple/cyan neon, glowing brains, Matrix rain, lens-flare soup, particle
    nebulae or stock "AI" imagery.
  - **Originality rules:** don't copy meme drawings; draw our own shoggoth; no anime characters.
  - **Palette:** 7 named colours + one rare accent "owned by one moment" (~2 s); light/dark plate rhythm; only
    the signal colour may bloom.
  - **Typography:** a variable grotesk animated on its width/weight axes, plus mono for the machine voice and a
    serif for the sacred register. Real kerning applied glyph by glyph, and typographic punctuation.
  - **Karaoke rules:** per-word sync; highlight never runs ahead of the voice; each plate integrates the lyric
    *differently* (text on a curve, tokens, a stamped form, masks); title-safe ≥ 96 px; HUD corners reserved.
  - **Motifs:** 6 recurring ones; P(doom) staged *in-world*, not as a corner readout. The hook is "one recurring
    typographic slam whose look escalates each time".
  - **Revisions** recorded: "the client found it uncanny", so the realistic eye was retired.
- **Engine (`ENGINE.md`):**
  - **Adaptive motion blur**: per 32×32 tile, 12 → 324 sub-frames until the change < tol.
  - Stateful scenes are allowed but flagged.
  - Noise is seeded by frame index.
- **Render figures:** 2 workers, chunks of 8 frames, a memory buffer then spill to disk. 1080p60 CRF 16; a native
  4K render ~57 min on an M5 Pro, ~23 GB peak *reported*.
- **Preview keys:** space, ←/→, `,`/`.` frame step, `[`/`]` scene, `l` loop scene, `?t=23`. These are exactly the
  controls our review player needs.

### 2.6 ledbetterljoshua/functional-emotions-video (MIT) — 6-min painted music video
- **Direction history:**
  1. The first attempt (a lyric video) was **rejected**.
  2. "Real music video, p5 brushstrokes, story, not a lyric video."
  3. "Timing, not letting scenes sit still" (PDoomVideo given as the pacing reference). Claude derived **short
     shots, one action each, camera always moving, hits on the beat, motivated cuts**, wrote a 168-shot
     storyboard and re-cut chapter I as the reference.
- **Production:** 7 parallel subagents; the director reviewed every chapter on contact sheets, **sent agents back
  with notes**, and fixed shared-renderer bugs they reported.
- **Renderer:** Canvas2D underpainting + an additive light layer. A **WebGL2 pass repaints with ~60k instanced
  brushstrokes** that sample colour from the underpainting, align to edges and follow a flow field; they
  re-roll a few times a second, and whip pans smear the strokes. Then bloom, canvas weave, grain, vignette.
- **Timing:** Demucs → Whisper in chunks → **Needleman–Wunsch alignment** of the real lyrics.
- A full render takes ~10 min on an M5 Pro with 6 pages *reported*. Headless Chrome on software GL is ~20× slower.

### 2.7 klsoen/opus-js-animations (MIT) — a "director" skill (closest to a product)
- **Five conversations before a frame:**
  1. Brief (reflect it back; measure the reference clip).
  2. **Sound route:** own file / yt-dlp link / generated in Web Audio / TTS from the user's ElevenLabs or OpenAI
     key.
  3. **Listening:** `analyze_audio.py` (length, loudness, pauses, sections, onsets, tempo, a spectrogram image
     that it reads); `align_audio.py` (Whisper word alignment). It verifies quoted lyrics against the canonical
     text and then tells the user **"what I hear"**.
  4. Direction questions (look from a style list, pacing, 2D/3D, the points a *muted* viewer must get, formats,
     text).
  5. **Treatment** `FILM.md`, which is the build contract. Nothing is built until "go".
- **Build rules:**
  - Data drives picture and sound.
  - No full-frame canvas filters per element (blur a small canvas).
  - Physics replays deterministically from seeded state at a fixed dt.
  - Hardest shot first.
  - Text in the safe zone, with a watermark that becomes the end card.
- **Inspect:** `verify.mjs` (seek purity), stills `--every 1 --sheet`, ranges, crops.
- **Delivery:** master + upload copy per format, built to survive the platform re-encode (lossless frames,
  correct HD colour, **no animated grain**), plus an upload checklist. Notes are treated as design changes and
  "a record of what you taught it" is kept.

### 2.8 buildwithhanif/claude-animation-skill (MIT) — "a vocabulary of detail and a habit of looking"
- **Detail bible:** every surface gets **base → texture → edge** (soil = hatch + strata + pebbles; chitin =
  gradient + form hatch + specular + rim + setae). Line weight falls off with depth.
- **Rigs with anatomy** (ant with a tripod gait, chibi person, critter, beetle boss). Game feel in `fx.mjs`:
  hit-stop, shake, sparks, combo, damage numbers.
- **Harness:**
  - `sheet`, `strip` (12 frames around a fast action), `verify` (frame identical in or out of order).
  - A staged render that never overwrites a good file with a failed encode.
- **Hard rules:** beats before code; stable named seeds; **"A render that exits 0 proves nothing"**; **sound from
  the picture's timeline, ~0.03 s before each contact**; the continuous scratch bed was tested and rejected;
  loudnorm; "show the world, not a slide" (sky, far, mid, ground, foreground).
- **Pure Node canvas** (`@napi-rs/canvas`): no browser or GPU. The 32 s ant film renders in ~27 s *reported*.
  Proof that a non-browser renderer is viable for 2D.

### 2.9 Other kits
- **francozanardi/papermotion (MIT):** a paper-cutout engine "built for AI agents". Engine vs content: bone rigs
  with springs, deterministic physics, parallax cameras, weather, sound. **Agents extend the engine** when a film
  needs a new behaviour. Several films were made at *medium* effort, near one-shot.
- **makevoid/motion-graphics-music-video-skill (MIT):**
  - Songs → MV using fal.ai (GPT Image for characters, MiniMax H3 for green-screen animation, audio isolation
    for lip-sync, SFX) plus p5 compositing.
  - Its own MCP server holds the fal key so the Claude session never sees it.
  - **Sub-agent waves of 2 → 3–4 → 4–8 → 6–10** so Opus calibrates on early results before scaling.
  - ~$30 fal + ~3M Opus tokens for a ~3-min song *reported*.
  - It also has a no-image variant.
- **browser-use/video-use (MIT, 31k★):**
  - Raw footage → `final.mp4`: cuts filler words and dead space, auto colour grade, **30 ms audio fades at every
    cut**, burned subtitles (2-word uppercase chunks by default).
  - Animation overlays come from HyperFrames/Remotion/Manim, with **one parallel subagent per animation**.
  - **Self-evaluates the render at every cut boundary**; session memory lives in `project.md`.
  - It proposes a strategy and waits for OK.
- **Ucmp0001/video-production-skills (MIT):** 11 composable skills (workflow, source index, evidence script, shot
  planner, explainer motion, generated b-roll with budget, voice/subtitle sync, cover art direction, **independent
  cover review**, release QA, reference study). Every step hands over a concrete artifact. Checks distinguish
  "script passed / tech check / looked at / played / listened".
- **diggerhq/shipvideo / launchvideo.io (no licence):** **a live product with our exact mechanism.**
  - URL/prompt → 20–40 s launch video. Opus writes one HTML film, and a serverless agent renders it in headless
    Chromium under a virtual clock (rAF, timers, Date, CSS/WAAPI all driven by `__seek(t)`) → ffmpeg → signed
    download.
  - `web_fetch` extracts the title, headings, **most-used hex colours and Google Fonts** from the founder's
    site.
  - `check_scene` reports JS errors and **visible text at several timestamps** before rendering.
  - Tools reject `<video>/<audio>/<iframe>`.
  - Renders at ~real time (30 s film in 30–40 s) *reported*.
  - **Competitor and proof of demand.**
- **lemomo-ai/lemo-opuscar (15k★):** 99 styles in 15 categories, with a director guide, technique guide and
  per-style instructions. **Docs are CC BY-NC 4.0 with no product use without a commercial licence.** Code is
  MIT. A reference to study, or a partnership candidate.
- **heygen-com/hyperframes (Apache-2.0, 83k★):**
  - HTML compositions with `data-start/duration/track-index`. Paused GSAP timelines registered on
    `window.__timelines`.
  - Adapters for GSAP, CSS, Lottie, Three, Anime.js and WAAPI.
  - CLI `init/preview/render/lint/add/catalog`. **~450 registry blocks** (transitions, kinetic type, captions,
    charts, maps, camera moves). `@hyperframes/aws-lambda`.
  - Skills: `/hyperframes`, `/media-use` (music, SFX, VO, transcripts), `/reverse-any-video` (Pro),
    `/remotion-to-hyperframes`.
  - **frame.md** turns a web DESIGN.md into a video-oriented design system.
- **remotion-dev/skills:** best-practices, create, markup (timing, audio, fonts), render, captions, maps, saas
  (architecture for Remotion-powered apps), license.
- **dev.to "This video is about how this video was made":**
  - ElevenLabs **with-timestamps** gives per-character times → words → **cue words in braces** in `script.md`
    fire visuals on the frame the word is spoken.
  - For songs: Suno exports contain **hidden timestamped subtitle tracks** (extract with ffmpeg) + Whisper
    large-v3-turbo + difflib alignment + a **comb search over the onset envelope** for the beat grid.
  - A **reviewer subagent graded draft 1 at 4/10** (a placeholder frame where the real thing was promised; a HUD
    off by 25 ms).
  - When the model couldn't view images, **pixel metrics** caught blank, blown-out and misplaced frames.
  - ffmpeg `-shortest` hung with a subtitle stream (fixed by an explicit `-t`).
  - A commenter's improvement: deterministic gates first, then a semantic review tied to the exact storyboard
    line.
- **athemeroy/awesome-opus-5-5-videos (CC BY 4.0 writing):** a research index (424 posts; a 1,119-file study).
  - **70% of game files are 3D; 72% of ad/launch files are motion graphics/UI.**
  - Motion-graphics files split 198 dark-neutral / 152 light-neutral.
  - Music videos have a 45.5% colourful-pixel share vs 17.6% for ads.
  - Production findings: one human prompt can hide many internal revisions; compare **whole-task cost**
    (*reported*: an F1 team spent $96 in total, of which the Haiku executor was 64%); planner/reviewer Opus +
    executor Haiku/Sonnet teams; a nine-day human-directed product film.
  - Three acceptance stages: (1) brief + keyframes; (2) the **hardest 2–4 s as a motion sample**, inspecting
    12–24 neighbouring frames; (3) the full sequence plus a reproducible handoff (MP4, project, command, asset
    list, unverified claims).
- **Anthropic's Opus 5.5 announcement:** no video guidance. Relevant: OSWorld 81.8%, chart recognition 89%, "checks
  its own work in creative ways", default effort medium, xhigh/max available, $4/$20 per MTok, fast mode.

---

## 3. The example brief ("Claude Pop") — what it teaches

The founder's sample prompt is a strong *director's brief* for the **hybrid route** (video-gen base + code
overlay). What makes it good, mapped to the research:

| Move in the brief | Why it works | Where else it shows up |
|---|---|---|
| Fixed audio track, "think deeply about how to visually represent all the lyrics" | Audio-first: the song is the clock | P(doom), Functional Emotions, opus-js-animations |
| "You do not need to anchor to the current style… push the aesthetics" + "let you cook" | **Permission framing** gives bolder output | iArt finding 1, "go all out" prompts |
| Named anti-styles: "not GPT slop", "Pixar is kind of slop" | An explicit avoid-list | mexicat TREATMENT anti-slop list, 17-style avoid lists |
| Points to a skill compendium (`skill mesh`, `skill video scoring`) and a prior-work folder | A reference library + scoring rubric as tools | **Exactly what Deno Studio MCP is** |
| Character sheets via fal image models, then backup dancers/sets, then **Seedance 2.5** scenes | Identity lock → start frames → generation | Seedance road-trip prompt structure |
| "Cut up the song and pass it as a reference… build the right verification loops… confirm the audio is properly synced" | Sync as a verifiable gate | dev.to timestamps, mexicat alignment |
| **Rotoscope idea:** use the Seedance output as a hidden base and redraw it in JS as an overlay | Gen video for physics and character consistency, code for the look | Blender-blockout→Seedance, talking-head→line-art |
| Text-on-screen plan: big lyrics in the hook, subtitles elsewhere; compose calm backgrounds where text lands; characters right / lyrics left | Attention design and layout planning | kimmonismus (≤ 8 words, ≥ 2.5 s), vertical-captions style |
| Zeitgeist: memes, the "internet brutalism" insert style, the SF tech-Twitter audience | Audience-specific references | Revid data: result-first, fast |
| "Rigorous planning of composition and timing… revisit… watch the entire video multiple times, take screenshots" | The review loop | ClaudeAnimationBase rule 4 + review loop |
| Budget statement (Max plan, ~$2k fal, "economical") | Cost gate | Magnific "list generations + credit cost, wait for OK" |

**What it lacks, which Studio should add as structure:** a deliverable spec (ratio, fps, length, formats), an
acceptance rubric with a pass threshold, the storyboard/treatment approval gate, a per-step cost approval for
paid generations, a rights note for the meme/brutalism inserts, and a file layout for the subagent contract.
("Foul" in the transcript is **fal.ai**. The `/asic` folder, `skill mesh` and `skill video scoring` were the
original author's private setup; they are not public.)

---

## 4. The craft playbook (synthesis)

This is what the MCP's `get_playbook` should serve, grouped by topic. Each rule cites the sources it came from.

### 4.1 Render contract
- A frame is a pure function of `t`: no `Math.random`, no wall clock, no counters, no stepped physics, no timer-
  driven CSS. *[all]*
- Randomness comes from `hash(i)` / named seeds. "Boil" re-seeds at 10–12 Hz on purpose, with per-element seeds.
  *[CAB, hanif]*
- Await fonts, and bake fonts and assets locally (remote fonts stall exports). *[ofox, render.mjs]*
- The `seek(t)` purity check renders frames in and out of order and compares them. *[ojs verify, hanif verify,
  0xKarmi]*
- Loop seam check: frame 0 vs frame N. *[0xKarmi, verbove]*
- If simulation is needed, replay from seeded state at a fixed dt up to `t`, and flag the scene as stateful.
  *[ojs, mexicat]*

### 4.2 Pre-production
- **Ask once, then work.** Takeaway, duration, **aspect ratio**, real facts and assets, audio and BPM, one named
  style. *[17-style skill, ojs]*
- **Listen first:** analyse the audio and tell the user "what I hear". *[ojs]*
- **Treatment / storyboard** with logline, central image/motif, palette arc, character arc, and shots with
  **reads**, transitions, camera and sound. The approval gate comes before code. *[CAB, ojs, kimmonismus, iArt]*
- Copy is written before animation. Every claim maps to a fact sheet or supplied asset; uncertain claims go to
  NOTES.md. *[ofox, kimmonismus]*
- **Hardest shot first** (or the hardest 2–4 s as a motion sample). *[ojs, athemeroy]*

### 4.3 Timing and attention
- Hook in the first second; **open on the result** (59% of top videos). *[revid, skill]*
- **15–20 s** for launches; median top video 29 s; something new every 1–4 s. *[iArt, revid, launch-video
  CLAUDE.md]*
- **Reads:** one at a time; fast actions, slow meanings; lead the eye; reads set shot length; the last read gets
  time to land (0.8–1.2 s final hold). *[CAB, skill]*
- Reading time is ~0.3 s per word, min 1 s; ≤ 8 words on screen, held ≥ 2.5 s for essays. *[skill,
  kimmonismus]*
- Alternate dense and calm; no dead time; no scene sitting still. *[kimmonismus, FE]*
- Cuts on downbeats, hits on beats, big changes on bar lines. *[CAB, mexicat, launch-video]*

### 4.4 Motion
- Springs/eases, never linear (except lines being drawn). Closed-form springs; sum one spring per target change;
  put each edge of a stretching element on its own spring. *[verbove]*
- Classic principles: anticipation, squash/stretch, slow in/out, weight, arcs, overlap/follow-through, **avoid
  twinning**, exaggeration, strong key poses, secondary action. *[CAB]*
- Content enters after its container starts moving and leaves before the next move; outgoing text leaves before
  incoming text arrives. *[verbove, iArt]*
- Motivated transitions that grow out of content (match cut, cut on action, whip with smear, iris, carried camera
  move); no generic crossfades. *[CAB, kimmonismus, 17-style]*
- The camera is never dead (drift, push, pan). *[CAB, P(doom)]*
- Motion blur by averaging sub-frames (6 fixed, or adaptive per tile). *[verbove, mexicat]*

### 4.5 Typography and text on screen
- In character/music films: **show, don't write**; no signs that repeat the story. *[CAB, P(doom)]*
- In lyric/karaoke work: per-word sync, never ahead of the voice; integrate text into the image differently per
  section. *[mexicat]*
- One display family + one mono "machine voice" (+ optional serif); variable axes animated for expression; real
  kerning; typographic punctuation. *[mexicat, kimmonismus]*
- Safe areas: 5% margin; vertical = middle 80%, nothing in the bottom 15%; reserve HUD/caption bands. *[skill,
  P(doom), mexicat]*
- Vary text scale: big and present at the hook, subtitle-like elsewhere; compose calm areas where text lands.
  *[Claude Pop brief, vertical style]*

### 4.6 Style
- **One named style beats five adjectives.** Each style = rules + avoid-list + tech. *[awesomeclaude]*
- A small palette with **one accent owned by one thing or moment**; avoid pure black and white; colour arcs
  across the film. *[17-style, mexicat, CAB]*
- **Default avoid-list (anti-slop for video):** particle bursts, lens flares, neon glow, RGB split, glitch tearing
  over text, bouncy easing everywhere, decorative gradients, redundant text, purple/cyan cyberpunk, glowing
  brains, Matrix rain, generic nebulae, stock "AI" imagery, centred-everything layouts, logo-on-gradient openers.
  *[skill, mexicat, iArt, launch-video CLAUDE.md]*
- Detail: base → texture → edge for every surface; layered worlds (sky/far/mid/ground/foreground). *[hanif]*
- Rebuild the UI in HTML for "living UI" (zoomable, actable), *or* use real screenshots unchanged. Never invent
  features. *[17-style, iArt, launch-video]*

### 4.7 Sound
- Prefer a **supplied/licensed track + BPM + first-beat offset**; generated music draws the most complaints.
  *[awesomeclaude]*
- SFX come from the picture's timeline, ~0.03 s before each contact; one sound per action (click, whoosh, chime,
  pop, slam). *[hanif, iArt]*
- No continuous texture beds that fight everything; duck music under voice; 30 ms fades at cuts. *[hanif,
  skillry, video-use]*
- Master to ~-14 LUFS, true peak -1 dB; mux with ffmpeg (AAC 192k). Never record audio from the browser.
  *[launch-video, skill]*

### 4.8 Sync pipeline (voice, lyrics, beats)
- **Voiceover:** TTS with timestamps (ElevenLabs with-timestamps) → word times → **cue words** in the script fire
  visuals. Per-phrase generation makes retiming easy. *[dev.to, skillry #32]*
- **Songs:**
  - Stems with Demucs; lead-vocal isolation with a karaoke model.
  - Transcribe with Whisper in chunks.
  - Align the real lyrics with CTC forced alignment, WhisperX, Needleman–Wunsch or difflib.
  - Suno exports carry timestamped subtitle tracks.
  - Beats/downbeats from a dedicated tracker (e.g. Beat This!) or a comb search over onsets.
  *[mexicat, FE, dev.to]*
- Scene windows are derived from aligned lyrics and snapped to beats, never hard-coded inside scenes. *[mexicat]*

### 4.9 Review loop (the habit of looking)
1. **Deterministic gates:** purity/seek check, seam check, JS console errors, visible text per timestamp, pixel
   metrics (blank frames, blown flashes, bounding boxes). *[ojs, hanif, shipvideo, dev.to]*
2. **Contact sheet:** one frame per beat/second, or first/middle/last per shot. *[all]*
3. **Strips:** every frame around fast actions, contacts and transitions (12–24 frames). *[CAB, hanif, athemeroy]*
4. **Crops:** 1:1 faces, hands, text. *[CAB, ojs]*
5. **Semantic review by a separate reviewer** against the storyboard line, scoring 1–10 per dimension; loop until
   every dimension is ≥ 8; report the two weakest moments. *[dev.to, Meng To, launch-video, skill]*
6. Watch the whole MP4 (stills can't show stutter) and listen to it. *[ofox, athemeroy]*
7. Contact sheet of the **encoded master** before delivery: "a render that exits 0 proves nothing". *[hanif]*

### 4.10 Multi-agent production
- The director writes `STORYBOARD.md` + `ANIMATION_GUIDE.md` (the contract: API, rules, palette per chapter,
  reserved bands, perf budget, "only edit your own file").
- Builds chapter 1 as the reference, fans out one subagent per chapter, reviews each on contact sheets, sends it
  back with notes, and fixes shared bugs centrally. *[P(doom), FE, dev.to]*
- Scale in waves (2 → 4 → 8) so early results calibrate the rest. *[makevoid]*
- Opus plans and reviews; cheaper models (Sonnet/Haiku) can execute scenes. *[athemeroy, awesomeclaude]*

### 4.11 Rendering and delivery
- Virtual clock (rAF, Date, performance.now, timers, WAAPI) or an explicit `seek(t)`. *[render.mjs, shipvideo]*
- Parallel workers on frame chunks, resumable frames, then a single encode. *[P(doom), mexicat, FE]*
- Real GPU flags (`--use-angle=metal`, `--gpu-angle=gl-egl`/`vulkan`); software GL is ~20× slower. *[CAB, FE]*
- H.264 yuv420p, BT.709 tags, `+faststart`; CRF 16–18 master + upload copy; **no animated grain** (it destroys
  platform re-encodes); a half-resolution draft before the final. *[ojs, skill, awesomeclaude]*
- Deliver the MP4 + source + storyboard-as-built + asset list + unverified claims. *[athemeroy, kimmonismus]*

### 4.12 Hybrid: Opus directing generative models
- **Identity lock** (an exhaustive character spec + sheet) and **start frame** ("frame one must match it"); a
  **camera lock** (who holds it, where, how it moves; zero cuts within a take). *[abxxai]*
- Generate on pure green and key out; animate cutouts on twos; depth layers for parallax. *[koldo2k]*
- Blockout first (Blender/three.js) as the motion reference, with prompts that stop the model copying the rough
  render. *[OriSilver]*
- **Cost gate:** list generations + credits and wait for OK; show screenshots before each expensive step.
  *[koldo2k]*
- Rotoscope/overlay: gen video as a hidden base, redrawn in code. *[Claude Pop brief, talking-head→line-art]*
- Keep keys out of Claude's context: an MCP server holds them, or deny `Read(./.env)`. *[makevoid, @akokoi1]*

---

## 5. Prompt pattern library

Patterns seen across ~1,500 indexed prompts, with the best exemplar of each:

| Pattern | Shape | Exemplar | When it wins |
|---|---|---|---|
| **Permission one-liner** | "make a dynamic N-second… show what an incredible motion designer you are for <url>" | @melvynx, @ajith_io, @marklaunches | Showreels, brand energy; virality. Weak for explaining. |
| **Role + structured brief** | "You are a motion designer and creative director…" + tech setup + storyboard-first + per-scene stills + craft rules + deliverables | @kimmonismus | Long films, essays, explainers |
| **XML-sectioned spec** | `<deliverables><art_direction><artwork><timeline>` with cues every ~0.6 s | @brainextends | Exact brand films; low creative surprise |
| **Interview-first** | `<inputs> Ask me for: …</inputs>` then rules | @verbove, youmind calisthenics | Product films that need real data |
| **Rules-as-code** | "One HTML file. One canvas. One draw(t)… No timers… One shape, never cut" | @verbove, @0xKarmi | Loops, UI films, determinism |
| **Reference-driven** | a reference MP4/path + "in this style" + story | @daniel_mac8, Revid "use as prompt" | Matching a proven format |
| **Constraint-medium** | "pure js, no image gen, no plugins"; "no downloaded meshes" | @小梦梦, Alex Albert | Showing off the craft |
| **Kit-activated** | "Read ANIMATION_GUIDE.md, then make a 15-second video of …" | ClaudeAnimationBase | Consistent quality from short prompts: **the Studio model** |
| **Director-of-models** | references with identity/camera locks; cost gate | @abxxai, @koldo2k | Photoreal and characters |
| **Iterative pushback** | "lyrics are not the main thing…", "I'll push you on timing…" | Functional Emotions | Rescuing a generic first cut |

**Key stats** (awesomeclaude, n = 496): the median prompt is ~35 words; only 8% state an aspect ratio and only 7%
ask for self-review. The difference between viral and generic is mostly *what the kit or skill supplies*, not
prompt length. That is the product opportunity.

---

## 6. Costs and time (creator-reported; not benchmarks)

| Piece | Time | Cost / quota |
|---|---|---|
| 15 s launch spot, one-liner | ~1 min | ~$2 API |
| 2:38 line-art history (SVG) | n/a | 3% of 5-h limit, 1% weekly (Max 5x) |
| 5-min geography lesson + TTS | 26 min | n/a |
| 3-min AI history film (~7.4k lines) | ~1 h | 7% weekly quota |
| P(doom) 156 s painted MV | 45 min (xhigh) | 10% of a Max 5x week |
| Lyric MV, xhigh | 45 min first cut | ~$200 API |
| "Humanity to Opus 5.5" | ~3 h | ~$60 API |
| Session → 3D video (Blender) | 1 h 32 m | $81 API |
| Castle/fireworks (Blender MCP) | 35 min | ~$13 |
| Talking-head edit (OpenEdit) | 1 h 51 m | $23 tokens + $49 fal |
| Infinite-zoom collage | n/a | ~1,500 Magnific credits |
| ~3-min MV with gen assets (makevoid) | n/a | ~$30 fal + ~3M tokens |
| F1 pit-stop team (Opus + Haiku) | n/a | $96 total |
| Render: 4K60 full song | ~57 min (M5 Pro) | local |
| Render: 30 s launch film (cloud microVM) | 30–40 s | n/a |

**Implication for pricing (docs/12 §3.5):** the user's Claude plan carries the thinking cost, which ranges from a
few dollars to $200 per film. Our render cost is minutes of CPU/GPU per film. Metering render-seconds is right;
previews must be cheap and fast.

---

## 7. Failure modes catalogue

| Category | Failure | Prevention (tool or rule) |
|---|---|---|
| Determinism | Flicker/jumps from carried state, `Math.random`, timers; "preview moves, export static" | Contract + purity verify + virtual clock |
| Determinism | Re-boil jitter (random stream shifted by a moving element) | Per-element seeds |
| Timing | Everything at one brisk speed; events stacked; moments over before understood | Reads in the storyboard; strip review counting frames per read |
| Timing | Dead time / scenes sitting still / rushed middle | Contact-sheet review; "something new every 2–4 s" |
| Text | Clipped/overlapping text; unreadable small type; text in unsafe zones | Visible-text-per-timestamp check; safe-area lint; ≥ 0.3 s per word |
| Text | Signs that repeat the story; redundant captions | Style rule + reviewer rubric |
| Look | Generic AI effects (particles, flares, glow, bouncy) | Avoid-list in every style |
| Look | Muddy colours (pigment mixing), pure black/white | Engine `glow()`; palette lint |
| Look | Same-looking films (everyone uses the common prompt) | Reference library + named styles + brand kit |
| Animation | Mechanical motion, twinning, timid poses, floating props | Principles + crop/strip review of contacts |
| Facts | Invented features, stats or quotes; rescaled charts | Fact sheet; "leave it out"; NOTES.md; number gate (our `deno_gates` already does this for text) |
| Audio | No audio despite "with voiceover"; generated music disliked; late SFX | Explicit audio route; licensed track + BPM; SFX from timeline cues |
| Audio | ffmpeg `-shortest` hang with subtitle streams | Explicit `-t` |
| Render | Windows-only/GPU flags; software GL 20× slower; remote fonts stall | Render service with a known GPU config; local fonts |
| Render | Frames dropped by screen recording; HTML delivered instead of MP4 | Server-side renderer only |
| Delivery | Animated grain/colour matrix ruined by the platform re-encode | Master + upload copy; BT.709; no animated grain |
| Process | "One-shot" myth; several changes per message break working scenes | One change per note; versioned timelines; patch ops |
| Process | Model can't see images (screenshots rejected) | Pixel-metric gate + reviewer subagent |
| Cost | Runaway gen-model credits | Cost gate: list + approve before spending |
| Security | API keys read by the model | Keys held by the MCP server; deny `.env` reads |

---

## 8. Tool landscape

| Tool | Role | Licence | Notes for Deno |
|---|---|---|---|
| HTML + `seek(t)` + Playwright + ffmpeg | Core render path | n/a | Our launch-video engine; keep it |
| **HyperFrames** | HTML→MP4 framework, adapters, 450-block registry, Lambda | **Apache-2.0** | Compatible target; registry blocks reusable; frame.md ≈ our brand-kit idea |
| Remotion (+ skills) | React→MP4; strong for long multi-scene films | Source-available; company licence for 4+ people | Not as our server engine without a licence |
| p5.js + p5.brush | Painted/brush look | LGPL/MIT (verify) | Style pack candidate |
| Custom WebGL2 brushstrokes | Painterly at scale (~60k strokes) | MIT (FE repo) | Study; heavy GPU |
| `@napi-rs/canvas` | Browserless 2D render | MIT | Cheap CPU render path for 2D styles |
| Three.js / GLSL / WebGPU-TSL | 3D, shaders | MIT | Needs GPU workers |
| Manim | Math explainers | MIT | Optional style |
| Blender (+ Blender MCP) | 3D, blockouts | GPL (app) | Out of scope v1 |
| Demucs, WhisperX/Whisper, CTC aligners, Beat This!/librosa | Audio analysis | MIT/BSD/ISC (verify each) | Our `analyze_audio` / `align_lyrics` tools |
| ElevenLabs (TTS with timestamps, SFX) | Voice, SFX | Commercial on paid plans; **cannot resell SFX as a library** | User-key route or our paid account per render |
| fal.ai (Seedance 2.5, GPT Image, MiniMax, Kling) | Gen images/video | Per-provider terms | Optional "director" add-on, cost-gated |
| Magnific / Runway / MaxFusion MCPs | Gen-model orchestration | Vendor | Integration references |
| video-use | Footage editing by agent | MIT | Pattern for "edit my takes" feature |
| shipvideo / launchvideo.io, Revid, iArt, EasyVeo, invideo MCP | Competitors | n/a | Same mechanism; we differ by founder context + review loop + Claude-native MCP |

---

## 9. Reference library seed (what to ingest first)

From this research, the first library entries (recipes, not rehosted video):

1. **Our own launch video** (full timeline, rules, sound): the only reference we fully own.
2. **Format recipes** (written by us from the patterns above, our own words):
   - 15 s permission showreel
   - 18 s shot-by-shot brand film
   - 30 s narrated explainer
   - 32 s classic SaaS launch
   - 30 s one-shape UI loop
   - 44 s emotional B2C story
   - 6 s logo sting
   - 20 s data story
   - 15 s vertical feature
   - 30 s changelog
   - 20 s GitHub repo promo
   - 60 s lyric/kinetic type
   - 3-min essay film
   - music video with chapters
3. **Style guides** (our own wording, inspired by public taxonomies, never copied): start with 8. Dark keynote,
   living UI, Swiss kinetic, flat vector explainer, paper cut-out, watercolour/ink, risograph, vertical captions.
   Each has rules, an avoid-list, tech and a component mapping.
4. **Analysed external references:** metadata + our breakdown + link for the top ~50 from Revid/X indexes,
   tagged by format, length, ratio, pacing, palette mode (dark/light), hook type and "opens on result".
5. **Playbooks** = §4 as rules files: contract, pre-production, timing/reads, motion, type, style, sound,
   sync, review, multi-agent, render/delivery, hybrid. Plus platform specs.
6. **Prompt patterns** (§5) as MCP prompts: `/permission-showreel`, `/launch-film`, `/explainer`, `/ui-loop`,
   `/music-video`, `/director-of-models`.

---

## 10. Licensing and rights (critical: Deno sells this)

| Source | Licence | What we may do |
|---|---|---|
| ClaudeAnimationBase, mexicat/pdoom-video, functional-emotions, opus-js-animations, claude-animation-skill, papermotion, makevoid MV skill, video-use, video-production-skills | **MIT** | Adapt code and ideas with attribution (THIRD_PARTY_NOTICES.md, as PR #18 did for no-ai-slop). The songs/lyrics in those repos are **not** MIT. |
| JohnHeibel/PDoomVideo, shipvideo, remotion-dev/skills, awesomeclaude skill + render script | **No licence** | Read and learn; **do not copy code or text** |
| HyperFrames | Apache-2.0 | Use, including the registry, with NOTICE |
| Lemo-Opuscar docs/styles | **CC BY-NC 4.0** + film-making grant | **Not inside our product** without a commercial licence (contact them, or write our own styles) |
| athemeroy research | CC BY 4.0 (writing) | Quote/adapt with credit |
| Prompt indexes (yihui, X-RayLuan) | MIT repo; **prompts belong to their creators** | Analyse and cite; don't ship creators' prompts as our product content; write our own templates |
| Videos on X / galleries | Creators' copyright | Analysis + link + our own contact sheet *only if fair use holds*; prefer the creator's permission for featured recipes |
| Sonniss GDC bundles | Royalty-free use inside your work; **no standalone redistribution** | Can't be served as raw files through our MCP; fine *baked into* renders we produce, if the licence covers the renderer-as-a-service (verify) |
| Freesound | Per-file (CC0 / CC-BY / CC-BY-NC) | **CC0 only** for the library; keep per-file licence records |
| ElevenLabs SFX | Commercial use on paid plans; **no selling SFX as libraries** | Generate per render (cost) or on the user's key; never build our library from it |
| Epidemic Sound API | Sublicensing through partner platforms, no end-user account needed | **The best music route** for a product; paid tier to go live |
| Our own synthesized SFX (`synth.py`) | Ours | The core SFX pack |

**Rule for the library:** every asset row carries `license`, `source_url` and `attribution`; the validator
refuses final renders with assets whose licence doesn't allow it.

---

## 11. Changes this makes to docs/12

1. **The asset strategy changes:** the core SFX library is **self-synthesized + CC0**, music comes via the
   **Epidemic Sound API** (or the user's own track), and ElevenLabs/fal run per-render as cost-gated add-ons.
   Sonniss and ElevenLabs outputs can't be resold as a library.
2. **New MCP tools** (beyond docs/12 §3.3):
   - `analyze_audio(asset)`: tempo, beats/downbeats, sections, onsets, loudness, spectrogram image, plus a
     "what I hear" summary.
   - `align_lyrics(asset, text)` and `voiceover(script)`: word times; `{cue}` words.
   - `contact_sheet(render, times|every)`, `strip(range)` and `crop(t, box)`: images for Claude to look at.
   - `verify_timeline(id)`: purity, seam, visible text per timestamp, pixel metrics, safe areas, reading time.
   - `review(render_id, rubric)`: a separate reviewer pass scoring the 6 dimensions; the "two weakest moments".
   - `estimate_cost(plan)` + an approval gate for paid generations (hybrid route).
3. **Workflow encoded as MCP prompts:** brief → listen → direction questions → treatment (approval) → hardest
   shot → build → gates → review loop (≥ 8/10) → final → upload copies. This matches opus-js-animations' "five
   conversations" and our launch-video house rules.
4. **Timeline schema additions:**
   - `reads[]` per clip (start, end, what the viewer must understand), checked for overlap.
   - `cues[]` tied to words.
   - `beatGrid` + `offset`.
   - `palette.accentOwner`.
   - `safeArea` per format.
   - `exposure` (ones/twos).
   - `motionBlur.samples`.
5. **Multi-agent support:** a "chapter" concept in the timeline so Claude can fan out subagents per chapter,
   each validated independently, under a generated `ANIMATION_GUIDE`-style contract resource
   (`deno://guide/{timeline}`).
6. **Competition note:** launchvideo.io (Opus → HTML → render, URL in), Revid (Opus motion director),
   iArt (Animation mode) and EasyVeo already sell "prompt → launch video". Deno's edge must be: (a) **inside the
   founder's own Claude**, so no extra AI bill; (b) **validated-market context** (ICP pains, voice, story bank);
   (c) a **frame-pinned review loop**; (d) **anti-slop gates on copy**; (e) a curated, licensed library.

---

## 12. Gaps and next research

- Fetch and analyse the top 50 Revid/X videos frame by frame (contact sheets) to tag pacing, hook type and
  palette. That needs the creators' permission for anything beyond analysis.
- Read the licences of HyperFrames registry blocks individually; check the p5.brush licence; check the
  Epidemic API pricing and the scope of its UGC terms.
- Benchmark Sonnet 5.5 vs Opus 5.5 on our timeline format (cost per accepted film), as athemeroy suggests:
  same brief, same acceptance criteria.
- Verify the official ElevenLabs SFX terms §2 and the Sonniss licence text for "renderer-as-a-service" use.
- Platform specs (current safe areas, max lengths, caption rules) from TikTok/Meta/YouTube/LinkedIn
  documentation. The hook-retention figures found online are vendor claims without methods; we should measure
  our own.

---

## 14. Addendum (2026-11-12): Cut Notes + the Motion Design Studio guide

These are the two sources our own `launch-video/` pipeline was built from. The downloaded `cut-notes.html` is
byte-identical to `launch-video/cut-notes.html`. So this section is a **gap analysis**: what they do that the
Deno system doesn't yet do.

### 14.1 Cut Notes (Shaan Johari, @viashaan): the frame-pinned review loop

**How it works:** one ~540-line HTML file published as a claude.ai artifact with `db`, `user` and `assets`
capabilities. Two modes: (a) local, where the video plays from disk, notes go to localStorage, and "Copy for
Claude" exports them as text; (b) in-session, where notes sync through the artifact database.

**Protocol (data model):**
- `review/current` = `{src, name, fps, round}`, written by Claude.
- `notes/*` = `{t, tc "HH:MM:SS:FF", frame, fps, text, status open|fixed|resolved, round, created, reply}`.
- `review/status` = `{state:"done", round, open, at}`, written by the "I'm done reviewing" button.

Claude reads the open notes for the round, applies them, "keeps everything else exactly as it is", and marks
each note `fixed` + a one-line reply (or keeps it `open` with a reason). It then renders the next round into the
same link.

**The UX ideas that make it work:**
- **Typing pins the note.** The first keystroke pauses the video and pins the note to the current frame, so the
  reviewer never writes a timecode.
- **Frame-exact transport:** ←/→ one frame, Shift ±1 s, Space, N. Note marks on the scrub bar (gold = open,
  green = fixed). Click a timecode to jump to it.
- **Rounds:** the same link for every version; Claude's replies appear under each note; resolved notes are
  struck through.
- **Review copy:** H.264 720p < 15 MB, bitrate lowered for long cuts, with a fallback to "drop the file in
  yourself".
- **Note-writing guidance:** describe the feeling, not the fix. ("I lost interest here", "We say the same thing
  twice from here to the next note.") "Your feeling about a moment is usually right. Your fix usually isn't."
- **"Copy for Claude" fallback:** works without artifacts, in any chat.

**Licence:** none stated in the file. Our private use for the launch video is fine, but **we cannot ship it
inside Deno**. We build our own player (MCP App `ui://deno/review` + deno web page) with the same protocol ideas.

**Where Deno can go beyond it.** Each of these is possible because our renders are deterministic `seek(t)`
timelines, not opaque MP4s:

| Cut Notes today | Deno Studio review |
|---|---|
| Note = time + text | Note = time + text + **clip id + timeline version** (resolved server-side), so Claude patches the clip, not "the video" |
| Claude must imagine the frame | `get_review_notes` returns the **exact frame PNG** re-rendered from that version, plus a 12-frame strip around it |
| Point-in-time only | **Range notes** (drag on the scrubber: "from here to here it drags") and **spatial pins** (click on the frame: "this logo"), sent as `x,y` in frame coordinates |
| Round N only | **Compare rounds**: the previous round at the same frame, side by side or A/B flicker; scrubber marks where the timeline changed between versions |
| Reply text | Reply + **before/after thumbnails** per fixed note |
| Free text | Optional quick tags (pacing, text, motion, sound, brand, "lost interest"), so notes aggregate into **reviewer taste data** per founder that future videos use |
| Separate "done" step | "Approve this cut" → `render_final` for all formats |
| No checks | Automated gate results (overlapping text, reading time, safe areas) shown as **system notes** on the scrubber before the human watches |

### 14.2 The Motion Design Studio guide (Ray Fu, raycfu.com): the house-rules pipeline

**Thesis:** "The prompt is ~10% of the result; the setup is the rest". Rules, references, a render engine and a
self-critique loop. That is the Studio MCP's thesis too.

**What `launch-video/` already implements:**
- the `seek(t)` render contract
- CLAUDE.md house rules (contract, banned list, one display/UI font, one accent, something new every 2–4 s)
- closed-form `spring`/`track` in `lib/motion.js`, with UI/TYPE/CAM presets
- sub-frame motion blur via `tmix`
- parallel workers
- synthesized score + SFX on a 120 BPM grid with cues from `window.CUES`
- -14 LUFS / -1 dBTP master
- contact sheets + stills
- the 720p review copy
- real UI captured from the product (never redrawn)

**Gaps: what the guide has that we don't (yet).** Each is a candidate for the Studio core *and* a quick win for
`launch-video/`.

| # | Guide practice | Status in Deno | What to build |
|---|---|---|---|
| G1 | **`beats.py`**: librosa beat/tempo/onset detection → `{bpm, beats, downbeats, hits}` for a *supplied* track; changes on beats, big moments on downbeats, SFX on hits | We only synthesize our own track | `analyze_audio` tool (librosa or Beat This!) feeding the timeline `beatGrid` |
| G2 | **Phone test**: `fps=1`, 360 px wide, 5×3 tile; is it readable on a phone? | Missing | `contact_sheet(mode:"phone")`; also a lint for minimum text height at 360 px |
| G3 | **Loop check**: `-stream_loop 1` to inspect the seam; last frame = first (cursor position *and velocity*) | Missing | `verify_timeline` seam check (frame 0 vs N pixel diff) + a loop_check.mp4 deliverable |
| G4 | **Strip**: 12 frames around a fast moment | Done by hand once (`out/strip1.png`) | `strip(t, n=12)` tool |
| G5 | **Critique rubric with 7 dimensions**: hook (first 2 s), phone readability, motion quality, variety, **composition**, brand accuracy, sound sync. Top 3 problems with timestamps; fix; **re-render only the affected seconds**; ≥ 3 rounds; all ≥ 8 | Our CLAUDE.md has 6 (no *composition*); no partial re-render | Adopt the 7-dimension rubric in `review`; use `render.mjs --from/--to` segments + concat for partial re-renders |
| G6 | **Workflow gates**: plan → stills → low-res rough cut → full animation → polish → sound → final render, "no skipping" | Implicit | Encode as timeline `stage` + MCP prompt steps; `render_preview` refuses full-res before the stills gate |
| G7 | **Reference → `docs/style_guide.md` + `docs/shotlist.md`**: extract frames every 0.5 s, study pacing; "take the grammar, never the content"; wait for approval | We wrote `docs/shotlist.md` by hand | `study_reference(video_url)` → frames@2 fps + cut detection + a style-guide draft; this *is* the library's recipe extraction |
| G8 | **State list, not a vibe**: `<inputs>/<direction>/<structure>/<build>/<gotchas>/<start>`, 8–12 UI states on a 120 BPM × 8-bar grid | Not templated | MCP prompt `/ui-loop` + a timeline generator from a state list |
| G9 | **One timeline → 9:16, 1:1, 16:9** | Render is fixed at 1920×1080 | Format-aware layout in components (safe areas per ratio) + `render_final(formats[])` |
| G10 | **Asset capture first**: Playwright pulls real screenshots, logo, colours and fonts into `./assets` and *lists them before animating* | We capture app screens, but colours/fonts are manual | `capture_product(url)` also extracts the palette and fonts (shipvideo does this) → BrandKit |
| G11 | **Effort guidance**: medium for fixes, xhigh for new videos, max when the first 3 s must carry a launch | Not documented | Put it in the playbook + onboarding copy |
| G12 | **Deliverables**: `final.mp4`, `loop_check.mp4`, `poster.png`, `contact.png`, README | We deliver the MP4 + review copy | `render_final` returns the bundle: master, upload copies per format, poster frame, contact sheet, notes |
| G13 | **Package as a skill** (`.claude/skills/motion-reel/SKILL.md`): inputs, pipeline, hard rules | Rules live in `launch-video/CLAUDE.md` | The Studio MCP ships prompts + a companion skill; for Claude Code users, a plugin that bundles both |
| G14 | **Troubleshooting map**: looks generic → banned list/reference missing; floaty → springs + xhigh; blurry text → render at full size; drift → re-run beats | Partial | Becomes the validator's error hints |
| G15 | **"Sell it as a service"**: a 20–45 s product video, real UI, all formats, 3 edit rounds, priced by client value | n/a | A possible **done-for-you tier** on top of Pro (human-reviewed renders) |

**Verdict:** no new technique here contradicts docs/12. The biggest quality levers to add are G1 (beats from
supplied music), G5 (the 7-dimension rubric with partial re-renders), G7 (reference study → style guide) and
G9 (multi-format), plus the review-player upgrades in §14.1 (exact frame + clip id returned with every note;
range and spatial notes; round compare).

---

## 13. Sources

Supplied: [skillry.dev](https://skillry.dev/ai-videos/opus-5-5) ·
[revid.ai](https://www.revid.ai/claude-motion-graphics) ·
[awesomeclaude prompts](https://awesomeclaude.ai/opus-video-prompts) ·
[awesomeclaude video](https://awesomeclaude.ai/claude-video) ·
[awesomeclaude cheatsheet](https://awesomeclaude.ai/code-cheatsheet) ·
[ofox.ai guide](https://ofox.ai/blog/opus-5-5-video-prompts-mp4-guide/) ·
[yihui-dev/awesome-opus5-5-videos](https://github.com/yihui-dev/awesome-opus5-5-videos) ·
[youmind](https://youmind.com/opus-5-5-prompts) ·
[iart.ai](https://www.iart.ai/blog/opus-5-5-product-launch-videos) ·
[X-RayLuan/awesome-opus-5-5-video-prompts](https://github.com/X-RayLuan/awesome-opus-5-5-video-prompts)

Followed: [17 styles + skill](https://awesomeclaude.ai/claude-motion-graphics) ·
[claude-video-render.mjs](https://awesomeclaude.ai/claude-video-render.mjs) ·
[JohnHeibel/PDoomVideo](https://github.com/JohnHeibel/PDoomVideo) ·
[JohnHeibel/ClaudeAnimationBase](https://github.com/JohnHeibel/ClaudeAnimationBase) ·
[mexicat/pdoom-video](https://github.com/mexicat/pdoom-video) ·
[functional-emotions-video](https://github.com/ledbetterljoshua/functional-emotions-video) ·
[klsoen/opus-js-animations](https://github.com/klsoen/opus-js-animations) ·
[buildwithhanif/claude-animation-skill](https://github.com/buildwithhanif/claude-animation-skill) ·
[francozanardi/papermotion](https://github.com/francozanardi/papermotion) ·
[makevoid/motion-graphics-music-video-skill](https://github.com/makevoid/motion-graphics-music-video-skill) ·
[browser-use/video-use](https://github.com/browser-use/video-use) ·
[Ucmp0001/video-production-skills](https://github.com/Ucmp0001/video-production-skills) ·
[diggerhq/shipvideo](https://github.com/diggerhq/shipvideo) ·
[lemomo-ai/lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar) ·
[heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) ·
[remotion-dev/skills](https://github.com/remotion-dev/skills) ·
[athemeroy/awesome-opus-5-5-videos](https://github.com/athemeroy/awesome-opus-5-5-videos) ·
[dev.to deep dive](https://dev.to/peter/this-video-is-about-how-this-video-was-made-42hl) ·
[Anthropic: Claude Opus 5.5](https://www.anthropic.com/claude-opus-5-5)

Addendum: Cut Notes by Shaan Johari (@viashaan), file supplied by the founder ·
[Motion Design Studio with Opus 5.5 (Ray Fu)](https://www.raycfu.com/guides/motion-design-studio-opus-5-5)

Licensing and tooling: [Epidemic Sound API](https://www.epidemicsound.com/blog/epidemic-sound-api/) ·
[Epidemic developer docs](https://developers.epidemicsound.com/docs/) ·
[Soundstripe music API](https://www.soundstripe.com/blogs/music-api-for-video-editing-platforms) ·
[Artlist Music API](https://artlist.io/blog/your-fast-track-to-better-app-audio-with-the-artlist-music-api/) ·
[Sonniss licence guide](https://licenseorg.com/guide/music-audio/sonniss) ·
[Freesound legal forum](https://freesound.org/forum/legal-help-and-attribution-questions/42190) ·
[ElevenLabs SFX terms](https://elevenlabs.io/sound-effects-terms) ·
[WhisperX paper](https://arxiv.org/abs/2303.00747) ·
[Beat This!](https://pypi.org/project/beat-this/) ·
Hook-retention claims (vendor, unverified): [dev.to hook engineering](https://dev.to/bulkdl/hook-engineering-the-science-of-the-first-3-seconds-in-short-form-video-2026-2jp9),
[autoclip.dev](https://autoclip.dev/blog/viral-clip-anatomy-3-second-hook-data)
