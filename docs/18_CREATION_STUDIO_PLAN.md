# 18 — Creation Studio: the MCP, the plugin and the media kit

Status: **built, 2026-11-13** (phases A–G; see §12 for what shipped and what's left). Next step after docs/17. Builds on docs/12 (Studio idea), docs/13 (video research),
docs/14 (pricing), docs/16 (BYO AI). Where this doc and docs/12 disagree, **this doc wins** (docs/12 was written
before the move to Vercel and local rendering; see §9).

---

## 0. In one paragraph

The founder's own Claude makes the content. Deno gives it what it can't get anywhere else, through **two pieces
that ship together**:

1. **The hosted Deno MCP** (already live at `/mcp`): founder context, brand kit, playbooks and styles, a
   **licensed media search** (stock footage, images, sound effects, music), copy gates, and saving everything to
   the dashboard with a review link. Light and fast: it fits Vercel Hobby (every call well under 300 s).
2. **The Deno Studio plugin for Claude Code**: skills (how to direct a video, sound, captions, voice), subagents
   (director, scene builder, reviewer) and a **local kit** (`studio` CLI) that renders, analyses audio, writes
   captions, makes voiceover and contact sheets **on the founder's machine**. Heavy work never touches our servers.

Text posts, carousels/posters and videos all come out of the same loop:
**context → plan → make → gates → review → save to Deno.**

---

## 1. What we already have (start point)

| Piece | State |
|---|---|
| MCP server, OAuth via Supabase, 5 tools (`list_ideas`, `validate_idea`, `get_validation`, `get_report`, `get_founder_context`) | live, Claude connected and working |
| Anti-slop gates (`deno_gates`), quality scoring, voice profile, Story Bank | live in the web app |
| Content plans, briefs, drafts, approve/reject (`v1/content.py`) | live in the web app, **not** in the MCP |
| `launch-video/` pipeline: `seek(t)` engine, `motion.js` springs, Playwright `render.mjs`, `synth.py` SFX + music, contact sheets, Cut Notes review | works, untracked local folder |
| Research: playbook (docs/13 §4), prompt patterns (§5), failure catalogue (§7), licences (§10), gaps G1–G15 (§14.2) | written |
| File storage, brand kit, video tables, media providers | **none yet** |

---

## 2. Architecture

```
 Founder's machine (Claude Code)                          Deno (Vercel + Supabase + Upstash)
 ─────────────────────────────────                        ───────────────────────────────────
 Deno Studio plugin                                       deno-api  /mcp   (hosted MCP, OAuth)
 ├─ skills/   video, sound, captions, voice,  ──tools──►  ├─ context: founder, brand kit, taste
 │            posts, stills, review                       ├─ playbooks + styles + recipes (resources)
 ├─ agents/   director, scene-builder, reviewer           ├─ search_media → Pexels / Pixabay / Freesound
 ├─ .mcp.json → hosted Deno MCP                           │      (our API keys, 24 h cache in Upstash,
 └─ kit: `studio` CLI (Node + Playwright + ffmpeg)        │       licence + credit on every result)
      init · preview · render · still · sheet · strip     ├─ check_copy → deno_gates (captions, titles, posts)
      verify · beats · captions · voice · fetch · mix     ├─ save_draft / save_video / save_still
      upload ─────── signed upload URL ───────────────►   └─ review notes ◄── deno-web /studio/review/:id
                                                          Supabase Storage: review copy, poster, sheet
                                                          Postgres: videos, versions, notes, asset ledger
```

Rules this keeps (CLAUDE.md hard rules): Vercel + Supabase + Upstash only; rendering on the user's machine;
Supabase Auth; Next.js pages built from the existing design system; any server-side agent work stays LangGraph
(this plan adds none: the thinking is the founder's Claude).

**Uploads never pass through a Vercel function** (4.5 MB body limit). The MCP hands out a Supabase Storage
signed upload URL; the kit uploads straight to Storage; the MCP then records the row.

---

## 3. The hosted MCP: final tool list

Kept to ~22 tools (clients get worse at picking tools past ~25). Every tool returns compact text plus structured
content, stays under Claude Code's 25k-token output cap, and puts images behind URLs.

| Group | Tool | What it does | Phase |
|---|---|---|---|
| Ideas | `list_ideas`, `validate_idea`, `get_validation`, `get_report` | as today | live |
| Context | `get_founder_context(idea_id)` | + **brand kit**, **taste** (past review notes, struck rules), voice summary | A |
| | `set_brand_kit(idea_id, url?, colors?, fonts?, logo?)` | from the founder's site: colours, Google Fonts, logo (plain HTTP fetch + CSS parse, no browser) | C |
| Know-how | `get_playbook(topic)` | rules from docs/13 §4: contract, timing/reads, motion, type, sound, captions, review, platform specs | C |
| | `list_styles()` / `get_style(name)` | 8 named styles (rules + avoid-list + tech), our own words | C |
| | `search_recipes(query, format?, ratio?)` | format recipes (15 s showreel, 30 s explainer, UI loop, changelog…) | G |
| Copy | `check_copy(text, kind, platform?)` | gates only, nothing saved: post, caption track, on-screen text (+ reading-speed rule) | B |
| Posts | `create_content_plan(idea_id, briefs[])` | founder's AI writes the plan; lands in the calendar | B |
| | `list_briefs(idea_id)` | what's planned, what's drafted | B |
| | `save_draft(brief_id, text)` | runs the gates; failing drafts saved as "needs work" with the report | B |
| Media | `search_media(kind, query, …)` | `kind` = video, image, sfx, music, icon. Normalised results with licence + credit | D |
| Saving | `create_upload(kind, bytes, sha256)` | signed upload URL (review copy ≤ 50 MB, poster, contact sheet, source zip) | C |
| | `save_video(idea_id, brief_id?, manifest, uploads, assets_used[])` | new video or new version; returns the review link | C |
| | `save_still(idea_id, brief_id?, kind, uploads, assets_used[])` | posters, carousels, thumbnails | E |
| Review | `get_review_notes(video_id, round?)` | open notes with frame, time, chapter/clip id, x/y pin, tags | F |
| | `reply_note(note_id, status, reply)` | fixed / won't fix + one line | F |

Resources: `deno://playbooks/{topic}`, `deno://styles/{name}`, `deno://founder/{idea}`.
Prompts (for claude.ai, where there's no plugin): `/launch-video`, `/reel`, `/explainer`, `/carousel`,
`/content-week`. They carry the same text as the plugin skills (one source, §4.4).

---

## 4. The plugin (Claude Code)

### 4.1 Layout (a public repo, so `/plugin marketplace add` works)
```
deno-studio/
  .claude-plugin/plugin.json, marketplace.json
  .mcp.json                      → https://deno-api…/mcp (OAuth)
  skills/
    video/SKILL.md               the director: ask once → listen → treatment (approval) → hardest shot
                                 → build → gates → review loop (all ≥ 8/10) → final → upload copies
    sound/SKILL.md               audio route (own track / library / synth), beats, SFX from cues, mix to -14 LUFS
    captions/SKILL.md            transcribe/align, caption styles, SRT/VTT, burned-in rules
    voice/SKILL.md               voiceover with word times, {cue} words in the script
    stills/SKILL.md              posters, carousels, thumbnails, OG images from the same engine
    posts/SKILL.md               content week: plan → drafts → check_copy → save_draft
    review/SKILL.md              contact sheet, strips, crops, phone test, the 7-dimension rubric
  agents/
    director.md                  writes STORYBOARD + guide, splits chapters, reviews sheets, sends work back
    scene-builder.md             builds one chapter, edits only its own file (cheaper model is fine)
    reviewer.md                  separate eyes: scores against the storyboard line, two weakest moments
  kit/                           the `studio` CLI (§5)
```

### 4.2 How a founder uses it
```
/plugin marketplace add <org>/deno-studio
/plugin install deno-studio
> make a 20 s vertical reel about the pain my last validation found
```
Claude: `get_founder_context` → `get_style` → asks the 5 questions once → `studio init` → treatment for
approval → `search_media` / `studio fetch` → build → `studio verify` + `studio sheet` → reviewer agent →
`studio render` → `check_copy` on captions → `studio upload` + `save_video` → prints the review link.

### 4.3 Who gets what
| Client | Gets |
|---|---|
| **Claude Code** (CLI or desktop Code tab) | everything: plugin + local render |
| Claude Desktop / claude.ai chat | MCP tools + prompts: context, posts, copy checks, media search, storyboards, playbooks. **No rendering** (no local machine access); the answer ends with "finish this in Claude Code" and the project spec saved to Deno |
| ChatGPT | read tools + posts (write support depends on their plan, docs/16 §7) |

### 4.4 One source of truth
Skill and playbook text lives once in the repo (`studio/content/*.md`). The plugin build copies it into
`skills/`; the API serves the same files as MCP resources and prompts. No drift between Claude Code and claude.ai.

---

## 5. The local kit (`studio` CLI)

Node 22+, Playwright Chromium, ffmpeg (checked by `studio doctor`, with install hints). Built from
`launch-video/` (render.mjs, motion.js, sheet.sh, synth.py) hardened, **plus** whatever spike S2 says we take
from HyperFrames (§8).

| Command | Does | Research it comes from |
|---|---|---|
| `studio init --ratio 9:16 --style keynote` | project folder: `film.json`, `index.html`, `CLAUDE.md` house rules, `assets/`, `CREDITS.json` | launch-video, G13 |
| `studio preview` | local page with frame-step keys (← → , . [ ] space, `?t=`) | mexicat preview keys |
| `studio verify` | seek purity (in/out of order), seam check, console errors, visible text per timestamp, safe areas, reading time, blank/blown frames | docs/13 §4.9, G3 |
| `studio sheet` / `strip` / `crop` / `sheet --phone` | images Claude reads before it renders | CAB, G2, G4 |
| `studio render [--from --to] [--formats 9:16,1:1,16:9]` | frames → ffmpeg H.264 yuv420p BT.709, motion blur, partial re-render + concat; master + upload copy + 720p review copy + poster + contact | G5, G9, G12 |
| `studio still --frame / --pages` | PNG posters, PDF/PNG carousels | new (images) |
| `studio beats track.mp3` | bpm, beats, downbeats, onsets, sections → `film.json.beatGrid` | G1 |
| `studio captions audio.wav [--lyrics file]` | word-level timestamps → caption track + SRT/VTT | docs/13 §4.8 |
| `studio voice script.md --engine kokoro\|elevenlabs\|sarvam` | voiceover + word times; `{cue}` words fire visuals | dev.to, skillry |
| `studio fetch <media-id>` | downloads a `search_media` result into `assets/`, writes licence + credit to `CREDITS.json` | §6 |
| `studio mix` | music + SFX from cues + voice, ducking, 30 ms fades at cuts, -14 LUFS / -1 dBTP | launch-video, hanif, video-use |
| `studio upload` | `create_upload` → PUT to Storage → `save_video` | §3 |
| `studio login` | uses the MCP's OAuth token (no separate account) | |

`film.json` (the manifest Deno stores) = format(s), fps, duration, style, chapters, clips with `reads[]`,
`cues[]`, `beatGrid`, captions, `assets_used[]`, stage (plan → stills → rough → final). It is **not** a full
scene description: the picture is Claude's own HTML (the research shows freely written code makes the best
films). The manifest is what lets a frame note map to a chapter and clip.

Voice engines: **Kokoro** (Apache-2.0, runs locally, free) by default; ElevenLabs or Sarvam on the founder's own
key (kept in the kit's config, `Read(.env)` denied in the project's settings). Deno never pays per generation in v1.

Captions and beats runtime is a spike (S3): Node-only (whisper.cpp binding, a JS onset detector) vs `uvx` +
faster-whisper/librosa. Pick whatever installs cleanly on macOS, Linux and Windows.

---

## 6. Media sources (stock footage, images, sound, music)

The MCP searches with **our** API keys (they never reach the founder's machine), caches results 24 h in Upstash,
and returns one shape:
`{id:"pexels:v:123", kind, preview_url, width, height, duration, license, credit, source_url}`.
`studio fetch` downloads the file and records the credit; `save_video` stores `assets_used[]` in a licence ledger,
and the dashboard shows the credits list for each video.

| Kind | v1 source | Terms that matter (checked 2026-11-12) | Later |
|---|---|---|---|
| Stock video + images | **Pexels API** | free; link to Pexels and credit the creator; 200 req/h, 20k/month default, unlimited on request once attribution is shown; no "Pexels clone" apps | |
| Stock video + images | **Pixabay API** | free; show the source when results are shown; 100 req/min; **cache 24 h**; no permanent hotlinking (download first, which `studio fetch` does); full-res needs approval | |
| Sound effects | **Freesound API, CC0 only** | token search + HQ previews; originals need OAuth2 per user; 60 req/min, 2,000/day | |
| Sound effects | **our synth pack** (`synth.py`: whoosh, pop, tick, thump, riser…) | ours | grow it |
| Music | **founder's own track** or **our synth beds**; Freesound CC0 loops | | **Epidemic Sound API** (sublicensable, paid; when there's revenue) |
| Icons / fonts | Lucide (ISC), Google Fonts (OFL), bundled in the kit | | |
| Product shots | `studio capture <url>` (launch-video `capture-app.mjs` generalised), local | founder's own product | |
| Generated images/clips | none in v1 | | fal.ai on the founder's key, behind a cost gate ("list generations + cost, wait for OK") |

**Not in v1:** Unsplash (requires hotlinking and a download ping, which doesn't fit baking into a rendered
file; revisit), Openverse (its terms reserve fees for commercial or heavy use), Sonniss and ElevenLabs SFX
(can't be redistributed as a library, docs/13 §10), Pixabay music (no API).

Gate: `save_video` refuses a **final** whose ledger has an asset without a licence that allows commercial use,
and warns when a required credit is missing from the description/end card.

---

## 7. Phases (each ends in something you can try; each is 1–3 PRs)

**A. MCP hardening** (from docs/17 §4.1)
- Per-user rate limits per tool group (Upstash): reads 120/min, writes 30/min, `search_media` 60/h.
- Record the calling app: `client_name` on runs/drafts/videos (additive migration 0006), "via Claude" badge.
- "Connected apps" on the account page (list + revoke).
- Extract `FounderContext` (docs/12 R2) so the web app and MCP build context the same way; add taste stub.
- Exit: Claude still works; a burst of calls gets a polite 429 text; dashboard shows "via Claude".

**B. Posts through the MCP**
- `check_copy`, `create_content_plan`, `list_briefs`, `save_draft` (reuse `_gate_context`, `run_gates`).
- `posts` skill + `/content-week` prompt.
- Exit: in Claude, "plan my week and write Monday's LinkedIn post" → it's in the calendar with a gate report.

**C. Studio foundation** (the first video end-to-end)
- Storage abstraction (Supabase Storage, signed URLs, private bucket), `create_upload`, `save_video`.
- Migration 0007 (additive): `brand_kits`, `videos`, `video_versions`, `asset_uses`.
- `set_brand_kit`, `get_playbook`, `list_styles`/`get_style` (4 styles first: dark keynote, living UI,
  Swiss kinetic, vertical captions).
- Plugin repo + kit v0: `init`, `preview`, `verify`, `sheet`, `render`, `upload`, `doctor`.
- `video` and `review` skills; director/reviewer agents.
- Studio tab on deno-web: list of videos with poster, review copy player, versions.
- Commit `launch-video/` as the first reference + kit test fixture (it's untracked today).
- Exit: in Claude Code, "make a 20 s 9:16 reel for idea X" → MP4 on disk and the video in the Studio tab.

**D. Media**
- `search_media` (Pexels, Pixabay, Freesound CC0), Upstash cache, `studio fetch`, licence ledger, credits list.
- Apply for Pexels unlimited / Pixabay full access once attribution is live.
- Exit: a reel using a stock clip and a CC0 SFX, with credits shown on the dashboard.

**E. Sound, captions, voice, stills**
- `studio beats`, `captions`, `voice` (Kokoro default), `mix`; sound/captions/voice skills.
- `check_copy(kind="captions")` adds reading speed (≥ 0.3 s/word, ≤ 8 words on screen) and safe areas.
- `studio still` + `save_still` + `stills` skill: poster, LinkedIn carousel (PDF), YouTube thumbnail.
- Multi-format render (9:16, 1:1, 16:9 from one film).
- Exit: a narrated 30 s explainer with burned-in captions + SRT, and a 6-slide carousel, both in Deno.

**F. Review loop** (Cut Notes ideas, our own code; docs/13 §14.1)
- `/studio/review/:id` on deno-web: frame-exact player, typing pins a note, range notes, x/y pins, quick tags,
  rounds, "approve this cut". Migration 0008: `review_notes`.
- `get_review_notes` (resolves frame → chapter/clip from the version's manifest), `reply_note`.
- Gate findings shown as system notes before the human watches.
- Later: the same player as an MCP App (`ui://deno/review`) inside claude.ai/Claude Desktop.
- Exit: three rounds of notes on one video without leaving the review page + Claude Code.

**G. Library and taste**
- 14 format recipes (docs/13 §9) + our launch film as the first full recipe; `search_recipes`.
- Taste memory: tags and notes per founder fed back through `get_founder_context`; "Rulebook" with strikeable
  rules (docs/14).
- Exit: blind test of 10 videos with vs. without library (docs/12 phase 3 rubric).

**Then:** BYO validation (docs/16 phase 2) and billing (Dodo Payments, Connect plan quotas). If you'd rather
have BYO validation before the Studio, it slots in after B with no change to the rest.

---

## 8. Spikes before phase C (one day each, a one-page note each)

| # | Question | Pass if |
|---|---|---|
| S1 | **Plugin install** from a public marketplace repo, with the remote MCP + OAuth inside the plugin's `.mcp.json` | fresh machine: install → login → a tool call works |
| S2 | **Engine**: our `render.mjs` vs HyperFrames CLI (Apache-2.0) as the kit's renderer; check each registry block's licence | same launch film, speed + quality + install pain compared; pick one |
| S3 | **Captions/beats runtime**: Node-only vs `uvx` Python | works on macOS, Linux, Windows with one install step |
| S4 | **Storage**: Supabase Storage signed upload from the kit, 50 MB file, private bucket + signed read in the review page | upload + playback work; note the free-plan 1 GB total limit |

---

## 9. What changes from docs/12

| docs/12 said | Now |
|---|---|
| Separate `apps/mcp` on Cloud Run | The MCP stays inside `deno-api` on Vercel (already live) |
| Hosted render service (Cloud Run Jobs), metered render-seconds | **Rendering on the founder's machine** (local kit). No render metering; plans meter saves/storage/media searches |
| Claude writes a strict Timeline JSON; we compile it | Claude writes its own HTML (best quality per research); `film.json` is a **manifest** for chapters, reads, cues, assets and notes |
| Reference videos / trend index first | Format recipes + playbooks first (phase G); trend index later |
| Stripe Pro plan | Dodo Payments (CLAUDE.md) |

---

## 10. Risks

| Risk | Plan |
|---|---|
| **Supabase free Storage is 1 GB** | Store only review copies (≤ 15 MB 720p), posters and sheets; finals stay on the founder's disk; delete old versions after 30 days; Supabase Pro at launch |
| Shared dev/prod DB (docs/17) | Migrations 0006–0008 are additive only; say so in each PR |
| Provider rate limits (Pexels 200/h) | 24 h cache, per-user limits, apply for higher limits once attribution is shown |
| Install pain (Chromium + ffmpeg + whisper on Windows) | `studio doctor`; spike S3; Claude Code users are technical |
| claude.ai users can't render | Clear message + storyboard saved to Deno; MCP App preview later |
| Tool sprawl confuses the model | ≤ 22 tools; know-how as resources/skills, not tools |
| Licence mistakes | Ledger on every asset; final refused without a commercial licence; credits shown; playbooks in our own words (docs/13 §10) |
| "Deno" name collides with the Deno runtime in plugin/MCP listings | Decide the public plugin name before S1 |

---

## 11. Decisions for Atul

1. **Order:** Studio first (A → B → C…), BYO validation after? (Recommended: yes, it's what you asked for.)
2. **Plugin repo:** a new **public** repo for the plugin + kit (the main repo can stay private). Name?
3. **Engine:** let spike S2 decide between our engine and HyperFrames, or keep ours regardless?
4. **Paid providers later:** Epidemic Sound (music) and fal.ai (generated media): when, and on whose key?
5. **Free plan limits** for MCP creation (e.g. 3 saved videos, 20 media searches/day) until Dodo billing ships.

---

## Sources (new in this doc; the rest are in docs/13 §13)

- Pexels API guidelines and limits: https://www.pexels.com/api/documentation/
- Pixabay API (caching, hotlinking, limits): https://pixabay.com/api/docs/
- Freesound API (auth, limits): https://freesound.org/docs/api/overview.html
- Unsplash API guidelines (hotlinking, download endpoint): https://help.unsplash.com/en/articles/2511245
- Openverse terms (archived): https://webcf.waybackmachine.org/web/20240518175049/https://docs.openverse.org/terms_of_service.html

---

## 12. What was built (2026-11-13)

Decisions taken while building (the §11 questions, answered with the recommended defaults):
- Studio first, BYO validation after. **Engine: ours** (`seek(t)` + Playwright + ffmpeg); HyperFrames stays a
  possible swap because the page contract is the same. **Captions and beats are Node-only**: beats in plain JS,
  Whisper and Kokoro through transformers.js (Apache-2.0), installed on first use. **Plugin lives in this public
  repo** (`plugin/`, marketplace at `.claude-plugin/marketplace.json`). No paid providers; no licence chosen.

| Phase | Shipped |
|---|---|
| A | MCP rate limits per founder (reads 120/min, writes 30/min); calling app recorded on runs, plans, drafts, studio items ("via Claude" on the workspace); Connected apps tab on Account (Supabase `listGrants`/`revokeGrant`); `FounderContext` service (`deno_api/studio_service.py`) used by MCP and kit |
| B | MCP `check_copy` (posts + on-screen/captions/voiceover), `create_content_plan`, `list_briefs`, `save_draft` (full gates + quality score) |
| C | Migration **0006** (additive): `brand_kits`, `studio_items`, `studio_versions`, `studio_assets`, `review_notes`, `client_name` columns, `profiles.studio_prefs`, private `studio` bucket. Supabase Storage client with signed uploads. MCP `set_brand_kit`, `get_playbook`, `list_styles`, `search_recipes`, `create_upload`, `save_video`, `list_studio`. Studio library page `/app/studio` with brand kit editor. Plugin + `studio` kit: init, preview, verify, sheet, strip, crop, render (chunked, partial re-render, motion blur, multi-format), upload, login (OAuth + PKCE), doctor |
| D | `search_media` (Pexels, Pixabay, Freesound CC0, Lucide/Tabler icons), 24 h Valkey cache, `studio fetch` + `CREDITS.json`, licence ledger, credits on the review page, finals refused without a commercial licence or credit |
| E | `studio beats` (tempo, beats, downbeats, hits, sections), `studio voice` (Kokoro local; ElevenLabs/Sarvam on the founder's key; `{cue}` words), `studio captions` (Whisper word times, script alignment, SRT/VTT), `studio mix` (synth SFX + bed, ducking, −14 LUFS / −1.5 dBTP, upload + 720p review copies, BT.709 tags), `studio still` (PNG pages + PDF carousel), `studio frames`, `studio capture` |
| F | Review page `/app/studio/[id]`: frame-exact transport, typing pins a note to the frame, range notes, spot pins, quick tags, rounds, side-by-side compare, automated checks as notes, approve, "copy notes for Claude"; MCP `get_review_notes`, `reply_note` |
| G | 8 styles, 15 playbooks, 14 recipes, 7 skills, 3 agents (director, scene-builder, reviewer); Rulebook page with strikeable rules (core rules locked) applied to `get_playbook`; taste (tag counts + recent notes) in `get_founder_context` |

Measured locally: a 6 s film renders in two formats in 28 s; verify (purity, text, safe areas, reading time) runs
in seconds; beats land within 9 ms of the kick on a synthetic track; mixed masters measure −13.9 to −14.6 LUFS with
peaks ≤ −1.6 dBFS. Login → upload tested against a mock OAuth server (DCR, PKCE, refresh).

**Not done / needs you:** run migration 0006 (shared DB, additive); add `PEXELS_API_KEY`, `PIXABAY_API_KEY`,
`FREESOUND_API_KEY` on `deno-api`; first real `studio login` registers a "Deno Studio kit" OAuth client in Supabase
(dynamic registration must stay on); MCP App (`ui://deno/review` inside claude.ai) is still later; a `LICENSE` file
is needed before submitting the plugin to Anthropic's directory; Supabase free storage is 1 GB total.

## 13. Director upgrade (2026-11-13, branch `feat/studio-director-upgrade`)
Benchmarked against Cardboard's public agent patterns (private notes in `docs/reference/cardboard/`, **not
committed**: they hold Cardboard's own prompt text). Our wording is our own.

| Pattern | What we built |
|---|---|
| Creative-director voice, no machinery in chat | playbook `conversation`; persona in every plugin skill's preamble, the `video` skill, the agents and the template CLAUDE.md |
| Place before you fill | `studio place` / `fill` / `timeline`; `pending` chapters and clips draw as striped labelled blocks in preview and `--draft`; full render refuses, `verify` blocks; server: `pending_findings` (warn in drafts, block finals); playbook `build-loop` |
| No "done" without checks | `verify.json` carries a fingerprint of the page code; `studio upload` refuses unless verify is clean and current, nothing is pending, and a sheet of the mixed `master.mp4` exists (`--unchecked` for WIP only, never `--final`) |
| Measure the look | `studio sheet --at a,b,c`, `--range a,b --every s`, `--stats` (exposure, blacks/whites, contrast, crushed/blown %, saturation, casts), `--reference` (distance to a look) |
| Text behind the speaker | `studio matte <name>`: MODNet (Apache-2.0) via transformers.js on the CPU, ~0.36 s/frame; `subject()` in `lib/footage.js` composites the person on a `<canvas>`; playbook `behind-subject` |
| Caption presets | `beast-mode`, `billboard`, `sideline`, `butter-serif` in `lib/captions.js` (`drawCaption`); `studio captions --preset/--words/--behind` |
| Asset acquisition | `studio download "<link>"` (system yt-dlp; licence `unknown` until the founder declares rights), `studio sfx` (ElevenLabs on the founder's key), `studio transcribe` (cached word times), `silence`, `loudness`; playbook `sources`, skill `footage` |

Purity notes found while testing: CSS masks load after `seek()` resolves (use canvas compositing), and reusing
caption spans whose `transform` changed made the same `t` rasterise differently; spans are rebuilt every frame.
Not adopted: generated video/images (Veo, Kling, etc.), a declarative TSX timeline (our film is code + `film.json`).

## 14. Zero keys, zero video storage (2026-11-13, same branch)

**Keyless media.** `search_media` no longer needs Pexels/Pixabay/Freesound keys. When a kind has no keyed
provider, or the keyed ones find nothing, `deno_studio.media` falls back to Wikimedia Commons (images + video;
CC0 / public domain / CC BY / CC BY-SA, read per file; NC/ND dropped) and the Internet Archive (`advancedsearch.php`
filtered to `licenseurl:*publicdomain*`; the file is picked from `/metadata/<id>` at `studio fetch` time). Archive
licences are the uploader's claim, so they are recorded as a new licence `archive-pd` (warns, never blocks). On the
founder's machine: `studio search youtube <q>` and `studio download "ytsearch3:<q>"` (yt-dlp; YouTube's Creative
Commons flag becomes `cc-by`, everything else stays `unknown` = drafts only), and `studio sfx` synthesizes a free
sound (licence `synth`) when no ElevenLabs key is set (`--synth` forces it).

**No MP4s on Supabase.** A version no longer needs a `review` file. `studio upload` sends a JPEG poster (≤ 300 KB)
and a JPEG contact sheet (≤ 500 KB; typically ~100 KB) plus `film.json` in the request body: about 250 KB a
version, so the free 1 GB holds 4,000+ versions instead of ~20. `create_upload` caps poster 400 KB, sheet 600 KB,
captions 200 KB. `studio sheet` now records each tile's box and time (`sheet.json.index`), sent as
`film.json.sheet_index`; the review page crops the current frame out of the sheet and scrubs it like a timeline
(← → step tiles). `film.json.external_url` (YouTube/Vimeo, embedded via youtube-nocookie / player.vimeo) or
`stream_url` (direct https MP4/WebM, played in the frame-exact player) give a playable copy without storing bytes:
`studio upload --video-url https://…`. `--with-video` keeps the old behaviour. A video version with no sheet and no
link gets a `review.nothing_to_watch` warning. CSP: `media-src` allows `https:`; `frame-src` the two embed hosts.

## 15. Openverse in the kit (2026-11-13, branch `feat/studio-openverse`)

`plugin/kit/lib/sources.mjs` searches Openverse (`api.openverse.org/v1/images/` and `/audio/`) from the founder's
machine, so it needs no key and not even a Deno sign-in. `studio search image|sfx|music` shows Openverse results
after Deno's (`--source deno|openverse` picks one); `studio fetch openverse:<uuid>` downloads into
`assets/images|sfx|music/` and records the credit in `film.json` and `CREDITS.json`.

- Licence gate: searches send `license_type=commercial,modification`. `commercial` alone still returned a BY-ND
  file in a live check, and ND can't be edited into a video. Mapped licences: `cc0`/`pdm` → `cc0`, `by` →
  `cc-by`, `by-sa` → `cc-by-sa` (Deno's own ids, so the server's licence checks understand them); everything
  else is dropped. Credit: `<creator> via Openverse (<licence> <version>)`.
- Audio length: Openverse leaves `category` empty, so SFX use `length=shortest` (< 30 s) and music
  `length=short,medium` (30 s–10 min).
- Limits: anonymous 20 requests/min, 200/day (response headers). `studio openverse register <email>` calls
  `/v1/auth_tokens/register/`, stores client id + secret in `~/.deno-studio/config.json` (0600); after the
  founder clicks Openverse's verification link, searches use a client-credentials bearer token (cached; a
  failed token call falls back to anonymous).
- Not done: Openverse in the server's `search_media` (the MCP). The kit covers Claude Code users; MCP-only
  clients (claude.ai, ChatGPT) still get Commons + Internet Archive.


## 16. Gap analysis: mexicat/pdoom-video vs our Studio (2026-11-13)

[mexicat/pdoom-video](https://github.com/mexicat/pdoom-video) is a 2 min 37 s music video ("I'm Upping My
P(doom)") that Claude (Opus 5.5) built in Claude Code: concept, lyric alignment, audio analysis, renderer, 17
scenes and the renders. MIT code; read at commit `fa164b7` (Revision 6, 2026-10-05). Paths below are in that repo.

### 16.1 How it was made

**No special tooling.** The repo has no `CLAUDE.md`, `.claude/`, skills, plugins, agents or `.mcp.json`. What it
does have is two documents written *for Claude*, and a strict engine. Our read of the process (from the docs and
commit messages; skills used privately can't be ruled out):

| Technique | Where | What it does for quality |
|---|---|---|
| **Style bible + plate-by-plate treatment** | `docs/TREATMENT.md` | One-paragraph idea; tone (incl. "funny the way a straight-faced scientist is funny"); a 7-colour palette with one rare accent "owned by one moment" (~2 s); 3 type families + a single-stroke font, each with a role; karaoke rules; 6 recurring motifs that *transform* across the film (the spark becomes loss curve → stock chart → paperclip → fuse → detonation); a long "not slop" list; then each scene described beat by beat. |
| **Revision log inside the treatment** | `docs/TREATMENT.md` ("Revision 2…5"), commit `fa164b7` | Client notes become permanent rules: "the client found it uncanny" → the realistic eye is retired everywhere; "no outlined or haloed type". Six revision rounds in 11 days. |
| **Engine guide for scene authors** | `docs/ENGINE.md` | Written for parallel sub-agents: "Don't edit files outside your scene… ask the lead", ownership table A1–A8 / B1 / lead in TREATMENT. Exact API, budgets (< 25 ms/frame, ≤ 3 Canvas2D layers), and the loop: "Stills (the main way to check your work — then LOOK at the PNGs with the Read tool)". `--only <scene>` isolates an author from others' broken scenes. |
| **Deterministic renderer** | `app/src/engine/engine.ts`, `scene.ts` | Every frame is a pure function of song time; seeded noise; `frameIdx(t)` for per-frame jitter; stateful scenes flagged. Preview = export. |
| **Custom GPU stack** | `app/src/engine/gl.ts`, `post.ts`, `lines.ts`, `glsl/common.ts` | three.js + GLSL: linear HDR targets, bloom only above 0.85 (only the orange signal glows; type never blooms), halation, chromatic aberration, tone shoulder, grain, vignette; GPU capsule line batches (10k–200k hairlines); `hatch()`/`engrave()` shaders for an engraving look; raymarched 3D rooms. |
| **Typography craft** | `app/src/engine/type.ts`, `stroke.ts`, commit `cc0e84d` | Variable Archivo (width 62–125, weight 300–900) animated for expression; per-glyph kerned `layout()`/`glyphX()` so pieces keep their kerns; curly punctuation; glyphs missing from the families are drawn; single-stroke plotter fonts with optical kerning for "written by the spark" text. |
| **Edit derived from data, not hard-coded** | `app/src/timeline.ts` | Scene windows are `cut('line text')`: the last beat before the line's first word. Scenes look words up by content (`lyrics.get('sudden drop').words[3].start`), never by time. Re-time the audio and the whole edit follows. |
| **Deep audio analysis** | `analysis/align.py`, `analyze.py`, `data/audio.json` | Demucs stems; CTC forced alignment from two acoustic models cross-checked with Whisper; manual anchors chosen by *looking at QA spectrogram plots* (`qa_plot.py`, `zoom.py`); beat grid, downbeats, sections; 100 fps envelopes (rms/low/mid/high + per stem); kick/snare/hat onsets. Scenes get `f.a.kick`, `hit('snare', t, halfLife)`, `env('vocal', t)`. |
| **Motion blur done properly** | `app/scripts/render.ts`, `docs/ENGINE.md` "Motion blur and sampling" | Shutter 0.2 of a frame, **centred** on the frame time, averaged in linear light before post; adaptive sub-frame count per 32×32 tile (12 still … 324 for whips). |
| **Delivery** | `render.ts` | 1080p60 or true 4K60, x264 CRF 16 `-tune grain`, BT.709 tagged; two headless Chromes feed one ffmpeg in order. |
| **Contact sheets at every cut** | `render.ts sheet --cuts` | Frames at each scene boundary, to judge transitions. |

**Scale of the effort:** ~19,800 lines of scene code + ~2,700 lines of engine for 157 s, six revision rounds over
11 days, a 57-minute 4K render on an M5 Pro. The quality comes mostly from that time and the treatment's
specificity; the tooling makes the time productive.

### 16.2 What our Studio already does as well

Our process is already the same shape (§12–13 were built on the same ideas):

- **Render contract:** `window.seek(t)` pure function of `t`, seeded `rand`/`boil`, no clocks (template `CLAUDE.md`,
  `lib/motion.js`), and `studio verify` *checks* purity, which pdoom does not.
- **Treatment before code** (`TREATMENT.md` template, playbook `preproduction`), one named style, one accent owned
  by one thing, an avoid-list (playbook `style`) close to pdoom's "not slop" list.
- **Lead + parallel authors:** `director` / `scene-builder` agents, "edit only your chapter file, report shared
  bugs", waves, `--chapter` isolation = pdoom's `--only` (playbook `multi-agent`).
- **Look, don't trust:** `studio sheet --live --at`, `strip`, `crop`, `--phone`, `--stats`, `--reference`, and an
  independent `reviewer` agent with a 7-score rubric. pdoom has no rubric and no automated checks.
- **Preview keys** (space, ←/→, `,`/`.`, `[`/`]`, `l`) match pdoom's.
- **Beat grid** (`studio beats`), word times (`studio voice`, `studio captions`), BT.709-tagged H.264 at CRF 16.
- **Things pdoom lacks:** partial re-render by chunk, place-before-fill placeholders, the done gate in
  `studio upload`, licences and credits, a sound mix to −14 LUFS, a review page with frame notes.

### 16.3 Gaps, prioritised

Effort: S ≤ ½ day, M 1–2 days, L 3–5 days. "Needed?" is about 15–60 s marketing films, our actual output.

| # | Change | Where | Effort | Needed? |
|---|---|---|---|---|
| 1 | **Fix motion-blur shutter.** `render.mjs` places sub-frames *before* the frame time (a trailing shutter of (n−1)/n of a frame: ½ at 2 samples, ¾ at 4), so the blurred image lags the frame (and the sound) and the shutter changes with the sample count; it averages JPEG sub-frames in gamma space with `tmix`. Centre the sub-frames on the frame time with a 0.5 shutter (180°, film look) and average PNGs; default `samples` 4 for fast moves. | `plugin/kit/lib/render.mjs` | S | **Yes**: every film with motion. |
| 2 | **Deeper treatment template.** Add: idea in one paragraph; tone, including the humour and what the film is *not*; each colour's job and the rare accent's one moment; type families with a role each; a motif that *transforms* across shots; per shot, how the words are integrated graphically (not subtitles on top); a **Revisions** section where each founder note becomes a rule. | `plugin/kit/template/TREATMENT.md`, playbook `preproduction` | S | **Yes**: biggest quality lever for least work. |
| 3 | **Revision rounds as rules.** Playbook `review` + director: after each founder round, write the note into TREATMENT "Revisions" as a rule that applies to the whole film (e.g. "no realistic faces"), not just the one timestamp. | playbooks `review`, `multi-agent`; `plugin/agents/director.md` | S | Yes. |
| 4 | **Typography craft rules.** Kerning when type is drawn in pieces (sung/unsung, wipes): draw the whole word and clip, never offset by measured slices; no outlined or haloed type; draw glyphs the font lacks; variable-font width/weight as expression; one role per family. | playbook `typography`, style `swiss-kinetic` | S | Yes. |
| 5 | **Default `GUIDE.md` for scene authors.** Ship pdoom-style engine notes in the template (API, per-frame budget, layers, `rand(frameIdx)` vs continuous noise, how to check your chapter and read the PNGs), so the director edits it instead of writing it from scratch. | `plugin/kit/template/GUIDE.md`, agents | S | Yes for multi-chapter films. |
| 6 | **Anchor the edit to words and beats.** Template helpers: `word('text', n)` → `{start,end}` from `voice.json`/captions, `wordProgress(w, t)`, `cutBefore('text')` = last beat before that word, `beatAt(t)`, `hit(t, halfLife)`; `studio place --at-word "…"`. A re-recorded voiceover then re-times the film. | `plugin/kit/template/lib/`, `lib/timeline.mjs` | M | Yes when there is voiceover or lyrics. |
| 7 | **Richer audio data.** `studio beats` adds 100 fps envelopes (rms, low, mid, high) and kick/snare/hat onsets by band, so motion can react to the track (`env('low', t)`). | `plugin/kit/lib/beats.mjs` | M | Nice-to-have; music-led reels. |
| 8 | **`studio sheet --cuts`.** Frames just before and after every chapter/clip boundary. | `plugin/kit/lib/look.mjs` | S | Yes; cheap transition review. |
| 9 | **Optional WebGL layer.** `lib/gl.js`: a fullscreen shader pass on a `<canvas>`, `hatch`/`engrave`/noise/SDF helpers, a hairline batch, and a post pass (bloom on the accent only, halation, vignette). Plus one style that uses it (an engraving/plate look). DOM screenshots already capture WebGL canvases. | `plugin/kit/template/lib/`, a new style in `content/styles/` | L | **Optional.** Only for looks DOM/CSS can't do. Most launch films don't need it. |
| 10 | **Scene-builder on Opus for hero chapters.** `scene-builder` is `model: sonnet`; pdoom was Opus throughout. Let the director pick Opus for the hook and the hardest chapter. | `plugin/agents/scene-builder.md`, playbook `multi-agent` | S | Optional (cost). |
| 11 | Per-tile adaptive sampling, 4K60, two-Chrome pipeline | — | L | **No.** Platforms re-encode to 1080p; our films are 15–60 s. |
| 12 | Demucs + CTC forced alignment, QA spectrograms | — | L | **No.** We generate the voice from known text; Whisper + script alignment is enough. Kinetic-lyric over a sung track is rare for founders. |
| 13 | Animated film grain, `-tune grain` | — | — | **No.** Our avoid-list bans it on purpose: it breaks platform re-encodes. pdoom targets a 4K YouTube master. |

Suggested order: 1, 2, 3, 4, 8 (one PR, ~2 days), then 5 and 6 (one PR, ~2 days). 9 only if a founder wants a
look that needs it. All content edits go in `packages/studio/src/deno_studio/content/` and are regenerated with
`uv run python scripts/build_plugin.py`.

### 16.4 Can we reach that standard?

- **The process: no changes needed.** Treatment → place → build → look at stills → independent review → revise
  is already our loop, with more checks than pdoom has.
- **The craft of a 15–60 s marketing film: small changes.** Items 1–6 and 8 (about 4 days) close the gaps
  that show in every film: blur, treatment specificity, revisions, type, words-on-beats.
- **pdoom's specific look** (engraving shaders, raymarched 3D, HDR bloom): **a big change** (item 9) *and* days
  of work per film. It is not a default for launch films.
- **The honest limit is time per film, not tools.** pdoom is ~22,000 lines and six revision rounds over 11 days
  for 2.5 minutes. A founder's Claude making a 30 s film in one sitting won't match that whatever we ship. What
  we can do is make each hour count (items 1–8) and tell founders that a hero film needs several review rounds.

Nothing is implemented yet: Atul picks from 16.3.
