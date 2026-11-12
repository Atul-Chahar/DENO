# 12 — Deno Studio: marketing video through Claude + MCP

Status: **proposal, 2026-11-12**. Supersedes nothing yet; extends docs/07 (flagship) and docs/08 (dev plan).
Owner: Atul. Review with: contributor (PRs #14–#20), OJT reviewers.
Research behind this plan: **docs/13_VIDEO_RESEARCH.md** (how the best Opus 5.5 videos are made; licensing;
§11 there lists the changes it makes to this plan: extra MCP tools, timeline fields, asset strategy).

---

## 0. TL;DR

Deno today: **validate an idea → plan and write text posts that don't get you banned.**
Deno next: the same founder context also drives **video**. We don't generate the video. The founder's own
Claude does, through a **Deno Studio MCP server** that gives it four things it lacks:

1. **Taste**: a curated library of what works (reference films broken down into recipes, hook formats,
   trend data, platform specs), retrieved for *this* founder's product, ICP and voice.
2. **Ingredients**: sound effects, music beds, fonts, brand kit, product screenshots, transitions,
   all cleared for commercial use.
3. **A renderer**: a headless, deterministic "video as code" engine. Claude writes a timeline and we
   return an MP4.
4. **A review loop**: a frame-stepping player shown inside Claude (MCP App) and on deno web, where the
   founder pins a note to a frame and Claude patches just that part.

Why this works economically: **the founder's Claude subscription pays for the thinking (tokens). We pay
only for rendering (CPU minutes) and storage.** That is 1–2 orders of magnitude cheaper than pixel-generating
video models, and the output is editable, on-brand and reproducible.

What we sell: **Deno Pro** = text studio (today) + Studio MCP access + N render-minutes/month.
Pricing model and unit economics, benchmarked on Pocket CD ($49/month, sells taste, not AI): **docs/14**. It
adds a local-render path for Claude Code users, a strikeable Rulebook, taste memory, a done-with-you Launch Kit
and merchant-of-record payments.

---

## 1. The thesis, cleaned up

| Raw idea | What we actually build | Why the change |
|---|---|---|
| "MCP that stores AI-generated videos" | MCP that serves **reference recipes**: shot list, timing/beat grid, motion specs, a contact sheet (stills Claude *can* see), and the source code when it's a code-rendered film. | Claude can't usefully watch an MP4 through MCP, and raw video burns context. A recipe is what it needs to reproduce the *technique*. |
| "What content is booming / what people like" | A **trend & format index** built on our existing hook miner (`hook_patterns`, relative engagement), extended to short-form video formats, refreshed weekly. Metadata + our analysis + a link, never rehosted video. | We already measure "relative engagement vs. community median" for text. Same method, new medium. Rehosting other people's videos is a copyright problem. |
| "Lots of sound effects" | A licensed/CC0 SFX + music library, plus our **synthesized** SFX pack (`launch-video/audio/synth.py` already does this), tagged by use (whoosh, pop, slam, tick, riser) and tempo. | Claude's videos are silent because it has no audio assets and no sync model. We provide both: assets + a cue track in the timeline. |
| "Claude artifacts to view, forward/back per frame" | An **MCP App** (`ui://deno/review`) rendered *inside Claude* + the same player at `deno web /studio/review/:id`. | An Artifact can't call our MCP server or our API with the user's auth. MCP Apps (ratified Jan 2026, supported by Claude) is the built-in way to put our UI inside the conversation. |
| "Headless video editor with HeyGen or Remotion" | Our **seek(t) engine**, already proven by the launch video, kept **HyperFrames-compatible** (HeyGen's Apache-2.0 HTML-to-video framework). Remotion is not the default. HeyGen avatars become an optional add-on later. | Remotion needs a paid Company License for teams of 4+, plus an "Automators" plan for SaaS rendering. HyperFrames is Apache 2.0 with no per-render fee. HeyGen's avatar product is pixel generation: the cost model we're avoiding. |
| "Generate content according to the user's profile" | A **Founder Context** resource: validated idea, verdict, ICP, pains (with citations), voice profile, Story Bank, brand kit. Served read-only to Claude. | This is Deno's moat. Any MCP can ship SFX. Only Deno knows *this founder's* validated pain points and voice. |

**Positioning line:** *"Your Claude, plus Deno Studio, is a motion-design team that already knows your
market."*

**What we are not building:** a timeline editor UI, a diffusion video model, an avatar generator, or a
social scheduler. The editor is Claude; the UI is a review surface.

---

## 2. The founder's journey

```
deno web                                   Claude (desktop / claude.ai / Claude Code)
────────                                   ──────────────────────────────────────────
1. Validate idea  → verdict, ICP, pains
2. Content plan   → 14 days of text posts
3. "Make this a video" on any brief  ───►  4. Opens with Deno Studio connector (OAuth, Pro)
   (or: connect Studio in Claude                Claude: get_founder_context, search_references,
    and just ask)                               get_brand_kit, list_assets
                                           5. Claude writes a Timeline (JSON) → validate_timeline
                                           6. render_preview → MCP App player appears inline
                                           7. Founder steps frames, pins notes:
                                              "f142: logo too small", "0:07 SFX late"
                                           8. Claude: get_review_notes → patch_timeline → re-render
                                           9. Founder approves → render_final (1080p/4K, 9:16 + 16:9)
10. Video lands in Library, attached  ◄────
    to the brief; ban-risk gates run on
    captions/title; export
```

Text stays in deno web (our LLMs, our gates). Video happens in Claude (their tokens, our tools).
They meet on the **brief**: a video is just another rendition of a content brief.

---

## 3. Architecture

### 3.1 Components

```
                ┌──────────────────────── Claude (host) ───────────────────────┐
                │  model  ◄──tools/resources──►  MCP client   ◄──iframe──► MCP App │
                └───────────────────────────────┬─────────────────────────────┘
                                                │ Streamable HTTP + OAuth 2.1
┌───────────────────────────────────────────────▼──────────────────────────────────────┐
│ apps/mcp  (NEW, Python, official MCP SDK, Cloud Run)                                  │
│   tools · resources · ui://deno/review · auth = Supabase OAuth 2.1 server (DCR)       │
└───────┬──────────────────────┬──────────────────────────┬──────────────────────┬─────┘
        │                      │                          │                      │
┌───────▼────────┐   ┌─────────▼─────────┐   ┌────────────▼──────────┐  ┌────────▼────────┐
│packages/studio │   │packages/library   │   │ apps/render (NEW)     │  │ existing core   │
│ Timeline schema│   │ references,recipes│   │ Cloud Run Job:        │  │ profiles, voice,│
│ validator/lint │   │ trends, assets,   │   │ Chromium + seek(t) →  │  │ story bank,     │
│ JSON-Patch ops │   │ playbooks, search │   │ frames → ffmpeg → mp4 │  │ projects, runs, │
│ compiler→HTML  │   │ (pgvector+FTS via │   │ + audio mix, LUFS     │  │ briefs, billing │
└────────────────┘   │  deno_rag)        │   └──────────┬────────────┘  └─────────────────┘
                     └───────────────────┘              │
                                          Supabase Storage / R2 (assets, previews, finals)
apps/api (existing): /v1/studio/* for deno web (library, review player, notes, approvals)
apps/worker (existing taskiq): enqueue render jobs, library ingestion, trend refresh
web (existing): /studio, /studio/review/:id, /studio/library
```

All new server code follows the stack rules: Python 3.12 uv workspace; any LLM/agent work (reference
tagging, trend analysis) is LangGraph; Supabase Auth; no local Supabase containers.

### 3.2 The core decision: a Timeline is data, not code

Claude must not hand us an arbitrary HTML/JS blob: that's unreviewable, unpatchable, and a sandbox risk on
our render workers. Instead it writes a **Deno Timeline** (JSON, versioned schema). We compile it to a
seek(t) HTML page using our own components. Patch-by-frame edits then become small JSON-Patch ops
instead of a full rewrite.

```jsonc
{
  "schema": "deno.timeline/1",
  "format": { "w": 1080, "h": 1920, "fps": 30, "duration": 24.0 },  // 9:16 reel
  "brand": "brand://current",                                       // resolved server-side
  "tempo": { "bpm": 120 },                                          // beat grid for cuts + SFX
  "tracks": [
    { "id": "bg",   "kind": "visual", "clips": [
      { "id": "s1", "t": 0, "dur": 2, "component": "kinetic-type",
        "props": { "lines": ["Building got cheap.", "Being believed got expensive."], "emphasis": "expensive" },
        "enter": { "spring": "heavy" }, "exit": { "cut": true } },
      { "id": "s2", "t": 2, "dur": 6, "component": "app-window",
        "props": { "screenshot": "asset://shots/workspace-intake", "cursor": [[0,0.4,0.6],[1.2,0.52,0.7]] } }
    ]},
    { "id": "sfx",  "kind": "audio", "clips": [
      { "t": 0, "asset": "sfx://impact/thump-03", "gain": -6 },
      { "t": 2, "asset": "sfx://transition/whoosh-soft", "gain": -9 } ]},
    { "id": "music","kind": "audio", "clips": [ { "t": 0, "asset": "music://bed/minimal-120", "duck": "sfx" } ] },
    { "id": "cap",  "kind": "captions", "source": "auto", "style": "brand" }
  ]
}
```

- **Components** (`packages/studio/components/`): kinetic-type, app-window, cursor, metric-counter,
  chart, quote-card, logo-reveal, split-compare, lower-third, b-roll (licensed stock), caption styles.
  Each is a pure function `(props, t) → DOM`, the same contract as `launch-video/index.html` today.
- **Escape hatch:** a `custom` component that takes sandboxed HTML/CSS (no network, no JS timers,
  lint-checked for determinism) for when the library runs out. Pro-only, rendered in an isolated job.
- **Validator** (`validate_timeline`): schema, asset existence, overlaps, text-on-screen reading time,
  safe areas per platform, max on-screen words, loudness targets, plus the anti-slop gates run on all
  on-screen copy and captions. Same `deno_gates` pipeline as text.
- **Compatibility:** compile target is plain HTML + `window.seek(t)`, which is also what HyperFrames
  renders. If HyperFrames' producer outperforms our `render.mjs`, we swap the engine without touching the
  schema.

### 3.3 MCP surface (v1)

Tools (all scoped to the authenticated founder; all return text plus structured content):

| Tool | Purpose |
|---|---|
| `get_founder_context(project_id?)` | Idea, verdict, ICP, top cited pains, voice summary, Story Bank highlights, brand kit. |
| `list_projects()` / `list_briefs(project_id)` | Pick what to make a video for. |
| `search_references(query, format?, platform?, length?)` | Recipes ranked for this founder (hybrid search + rerank, `deno_rag`). |
| `get_reference(id)` | Full recipe: shot list, beat grid, motion notes, contact-sheet images. |
| `get_playbook(name)` | House rules (e.g. "hook in 2 s", "new thing every 2–4 s", platform specs), the `launch-video/CLAUDE.md` rules generalized. |
| `search_assets(kind, query)` | SFX, music, fonts, stock, transitions, screenshots, with license field. |
| `capture_product(url, steps?)` | Screenshot the founder's product (reuses `capture-app.mjs` approach) into their asset space. |
| `validate_timeline(timeline)` | Errors + warnings + gate findings, no render cost. |
| `render_preview(timeline, range?)` | Low-res fast render (or a single-frame still) → returns `ui://deno/review` + URL. Metered. |
| `get_review_notes(render_id)` | Frame-pinned notes from the player. |
| `patch_timeline(timeline_id, ops[])` | JSON-Patch edits; returns new version + diff. |
| `render_final(timeline_id, formats[])` | Full quality, multiple aspect ratios, loudness-normalized. Metered. |
| `get_trends(platform, niche?)` | What formats/hooks are over-performing now, with evidence links. |

Resources: `deno://founder/{project}`, `deno://brand`, `deno://playbooks/*`, `deno://timeline/{id}`.
Prompts: `/launch-video`, `/feature-teaser`, `/pain-point-reel`, `/testimonial-cut`, `/changelog-clip`.

### 3.4 Review loop (the "frame stepper")

- `ui://deno/review` is an MCP App: video element + scrubber + ← / → one frame + "pin note at frame".
  Notes are written to `POST /v1/studio/renders/{id}/notes` with the user's token. The founder can also
  just type in chat; the App is a convenience, not a requirement (hosts without MCP Apps get a link to
  the same player on deno web).
- Each render stores `timeline_version`, so a note on frame 142 of v3 is mapped to the clip that was on
  screen at `142 / fps` in v3, and `get_review_notes` returns it as `{clip_id, t, note, thumbnail}`.
  Claude patches the clip, not "the video".
- This is the Cut Notes artifact workflow from `launch-video/` turned into a product feature. Cut Notes has
  no licence, so we build our own player, keeping its protocol ideas: typing pins the note, rounds, replies,
  "done", and a copy-as-text fallback. We extend it with:
  - the exact re-rendered frame + 12-frame strip returned with each note
  - range notes and spatial (x,y) pins
  - round-vs-round compare
  - before/after thumbnails on fixed notes
  - automated gate findings shown as system notes
  - quick tags that build per-founder taste data
  Details in docs/13 §14.1.

### 3.5 Rendering service

- Cloud Run **Job** (`deno-render`), one task per render; Chromium + our compiled page; frames
  piped straight to ffmpeg (no PNGs on disk); H.264 yuv420p; audio mixed with ffmpeg filters
  (ducking, -14 LUFS, -1 dBTP). This is `render.mjs` + `synth.py` hardened.
- Previews: 540p, 15 fps, ≤ 20 s windows → seconds, not minutes. Finals: 1080p/30 (4K Pro+ later).
- Parallelism: split long renders into chunks by time range across tasks, then concat (seek(t) makes
  this trivial because there is no carried state).
- Metering unit: **render-second** of output at a given resolution. Cost check before we commit to plan
  pricing (spike S3).
- Isolation: render workers have no DB credentials, only a signed bundle (compiled HTML + signed asset
  URLs) and a signed upload URL.

### 3.6 Data model (new tables, migration 0006+)

```
studio_assets       id, owner(user|global), kind(sfx|music|font|image|video|lut|screenshot),
                    uri, license(cc0|licensed|own|synth), tags[], duration, bpm, embedding
references          id, title, source_url, platform, format, length_s, niche[], hook_type,
                    recipe(jsonb: shots, beats, motion, notes), contact_sheet_uri,
                    performance(jsonb), license_note, embedding, curated_by, created_at
trend_snapshots     id, platform, niche, window, formats(jsonb), evidence(jsonb), created_at
timelines           id, user_id, project_id, brief_id?, version, doc(jsonb), parent_version, created_at
renders             id, user_id, timeline_id, version, kind(preview|final), status, range,
                    seconds, output_uri, cost_ms, error, created_at
render_notes        id, render_id, user_id, frame, t, clip_id?, note, status(open|fixed|wontfix)
brand_kits          user_id/project_id, colors, fonts, logo_uri, voice_ref, do/don't rules
```
All tenant tables get RLS + `TenantMixin` like the rest of the schema. `UsageKind` gains
`RENDER_SECONDS` and `MCP_CALL`; `Quota` rows per plan.

### 3.7 Auth & entitlements

- Remote MCP over **Streamable HTTP** at `https://mcp.<domain>/mcp`.
- Authorization server = **Supabase Auth OAuth 2.1 server** with dynamic client registration (beta);
  we host the consent screen at `deno web /oauth/consent` and RFC 9728 protected-resource metadata on
  the MCP host. **Spike first** (S1): there's an open report of Claude custom connectors stalling with
  some external-AS setups. Fallback: a thin OAuth facade in `apps/api` that issues our own tokens
  after Supabase login.
- Every tool checks `plan in (PRO, INTERNAL)` and quota; Free users get `get_founder_context`,
  `search_references` (top 3) and one watermark preview as a taste.
- Custom connectors on claude.ai need a paid Claude plan, so our ICP must already pay for Claude.
  That's fine (it matches who wants this), but it belongs in onboarding copy.

### 3.8 The content library (the actual product)

The MCP is a pipe; the library is what people pay for. Curation is a weekly editorial job, not a crawler.

- **Reference recipes.** For each reference: why it works (hook, pacing, payoff), a shot list with
  timestamps, beat grid, motion vocabulary, typography, sound design notes, a 12–16-frame contact
  sheet, platform, length, niche, measured performance where available. Sources: (a) our own
  code-rendered films (launch video first), with full timelines, the best possible references; (b)
  the Opus-5.5 motion-graphics showcase site you referenced *(link needed, §8)*, used as **analysis +
  link**, rehosting only with permission; (c) public high-performing launch/feature videos, analysis
  + link only.
- **Recipe extraction** is a LangGraph job: ffmpeg scene detection → keyframes → vision model writes the
  shot list → human curator approves. Nothing reaches the library unreviewed.
- **Trends.** Extend `deno_sources` + hook miner to short-form video metadata (titles, durations,
  view/like ratios vs. channel median) from sources whose terms allow it. Output: "format X is
  over-performing in niche Y this month, here are 5 examples".
- **Assets.** Start with: our synthesized SFX pack (generated, so we own it), **CC0-only** packs, music
  through the **Epidemic Sound API** (built for sublicensing through platforms) or the founder's own track,
  Google Fonts, and our component library. **Not** Sonniss bundles, ElevenLabs SFX or CC-BY-NC Freesound
  files: their terms forbid redistributing them as a library (docs/13 §10). ElevenLabs/fal generations run
  per render, cost-gated, or on the user's own key. Every asset row carries a license; the validator
  refuses unlicensed assets in finals.
- **Playbooks.** Platform specs (safe areas, durations, caption rules per LinkedIn/X/Reels/Shorts/TikTok),
  motion rules, sound rules, the launch-video house rules, anti-slop rules for on-screen copy.

---

## 4. The refactor (existing codebase)

The "big refactor" is mostly *promotion and extraction*, not rewrites. The validation and text-content
pipelines are healthy (see PR review below) and stay.

| # | Change | Why |
|---|---|---|
| R1 | Merge the open contributor PRs (§6) and dependency bumps first. | Clean base; #20 carries Next.js RCE fixes. |
| R2 | **Extract `deno_core.context.FounderContext`**: one service that assembles idea, verdict, ICP, pains, voice, stories, brand for a project. Used by the content graph, the API and the MCP server. | Today this assembly is spread across `content/graph.py` (`brief_planner`, `draft`) and `v1/content.py` (`_gate_context`). The MCP needs the same thing. |
| R3 | **Introduce `BrandKit`** (table + `/v1/brand` + settings page). | Video needs colors/fonts/logo; text tone can use it too. |
| R4 | **Generalize briefs into "renditions"**: a brief can have a text draft *and* video timelines. | Video attaches to the existing plan instead of being a separate silo. |
| R5 | **Move `launch-video/` into the product**: `packages/studio` (schema, compiler, components, `motion.js`), `apps/render` (`render.mjs` + `synth.py` hardened), keep the launch film as the first library reference and test fixture. Commit it (it's untracked today). | The pipeline is proven; it's the foundation. |
| R6 | **Generalize gates to "copy on screen"**: `run_gates` takes a list of text spans with timing (captions, titles) and adds video rules (reading speed, words per screen). | Anti-slop is Deno's brand; it must cover video copy. |
| R7 | **Usage & quota refactor**: usage becomes `(kind, amount)` not "one event = one unit", so render-seconds meter correctly; quota checks become atomic (the check-then-record race in `_check_audit_quota`/`record_usage`). | Needed for metered rendering and billing correctness. |
| R8 | **Storage abstraction** `deno_core.storage` (Supabase Storage now, R2 later) with signed URLs. | Assets and renders are the first binary data we store. |
| R9 | **Jobs**: render + ingestion tasks on the existing taskiq worker, with the run-lease pattern PR #17 adds to content plans. | Re-delivered jobs must not double-render or double-bill. |
| R10 | **Web IA**: add a *Studio* tab (Library, Renders, Review). Keep the design system and pixel parity rules for existing screens. | |
| R11 | **LLM budget hygiene**: cap per-draft LLM calls (see PR #14 note) and move to a provider with higher limits for production (Bedrock credits request). | NIM's 40 req/min cap is already the bottleneck for text. |

Out of scope for the refactor: rewriting the validation graph, changing auth provider, changing the web
framework.

---

## 5. Roadmap

Each phase ends with something demoable. Durations assume two engineers.

**Phase 0: Base (week 1)**
- Merge PRs in the order in §6; apply migration 0005 to prod; rebase dependabot PRs.
- Spikes, each a throwaway branch with a one-page result:
  - **S1 Auth**: Supabase OAuth 2.1 + DCR with a hello-world remote MCP, connected from claude.ai *and*
    Claude Desktop *and* Claude Code.
  - **S2 MCP App**: minimal `ui://` player that steps frames of a hosted MP4 and posts a note back.
  - **S3 Render cost**: render the launch film on Cloud Run Jobs at 540p/1080p; record seconds and $.
  - **S4 Engine**: same film through HyperFrames' producer vs. our `render.mjs`; pick one.
- Exit: four spike notes + go/no-go on the auth path.

**Phase 1: Studio core, local (weeks 2–3)**
- `packages/studio`: schema v1, validator, compiler, 10 components, JSON-Patch, golden-frame tests
  (render frame N, pixel-diff against fixture, reusing `web/scripts/visual-diff.mjs` approach).
- Launch film re-expressed as a Timeline; renders identical (±tolerance).
- stdio MCP server for Claude Code with: context, validate, render_preview (local), assets.
- Exit: in Claude Code, "make a 20 s reel for my latest brief" yields an MP4 locally.

**Phase 2: Hosted studio (weeks 4–6)**
- `apps/mcp` (remote, OAuth), `apps/render` (Cloud Run Job), storage, renders/notes tables,
  `ui://deno/review` + deno web review page, `patch_timeline`, metering, Pro gating.
- Exit: on claude.ai, a Pro tester goes brief → preview → 3 rounds of frame notes → final MP4, no terminal.

**Phase 3: Library & trends (weeks 6–9, overlaps)**
- Library schema + curator admin page + recipe-extraction graph; seed 50 recipes, 300 SFX, 20 music beds,
  platform playbooks; `search_references` with rerank; `get_trends` v1 (2 platforms).
- Exit: blind test, 10 founders' videos with vs. without library. Score with the launch-video rubric
  (hook in 2 s, readability, motion, variety, brand, sound sync); library must win on ≥ 4 of 6.

**Phase 4: Launch (weeks 10–11)**
- Stripe Pro plan with render-minute quota + overage packs; onboarding ("connect Deno Studio to
  Claude" guide + one-click prompts); docs; rate limits; abuse limits on renders; status page.
- Our own launch made with the product (dogfood) is the marketing.

---

## 6. Contributor PR review (2026-11-12)

`main` has no new commits upstream. All outside work is in 5 open PRs from a fork (author
`Unintrestin_Coder`). I reviewed each diff and test-merged all five on top of `main`. Combined: ruff,
mypy (`--strict`), 311/312 unit tests, gates eval, `tsc` and `eslint` pass. Integration tests need
Postgres (CI runs them per PR).

| PR | Verdict | Notes |
|---|---|---|
| **#20** handle 500 + image scan + Next 16.4.1 | ✅ merge **first** | Fixes two critical Next.js RCE advisories, the broken trivy tag and a 500 that Schemathesis found. It also causes #17's red CI. |
| **#17** bug sweep (review lockout, Stripe after deletion, plan re-delivery…) | ✅ merge second | Good fixes: subscription cancelled before account deletion, run-lease on content plans, out-of-order Stripe webhooks, live check no longer spends audit quota. Conflicts with #20 in `me.py` imports only. Nit: `/drafts/{id}/check` has no rate limit (cheap, deterministic, but add `rate_limit`). |
| **#16** parallel evidence collection + one broadened retry | ✅ merge | Bounded (≤ 2 rounds), checkpoint-compatible (`NotRequired`), and tells the founder when *our* sources failed instead of blaming the idea. Adds `.python-version` 3.12 and iCloud-friendly `.gitignore` (contributor is on macOS). |
| **#18** no-ai-slop catalog sync + "Fix it for me" | ✅ merge | MIT attribution included in `THIRD_PARTY_NOTICES.md`. Number-invention guard on edits is good. Nit: `build_stack()` per request in `studio_edit`; hoist to app state. Test-file conflict with #17 (adjacent additions). |
| **#14** 1–10 quality scoring on 10 dimensions | ⚠️ merge **last, with changes** | Solid code and tests, but worst case adds ~10 LLM calls per draft (scorer + up to 3 × regenerate/judge/score) on top of ~5 today. Under NIM's 40 req/min cap, a 14-day plan can take several extra minutes or hit 429s. Ask for `MAX_REGEN_ATTEMPTS = 1` (or Pro-only) until we're off NIM. Needs migration 0005 on prod. After merging with #20, `tests/unit/api/test_handles.py` needs `quality_weights=None, quality_threshold=None` on its fake profile (fails otherwise). Small conflicts with #20 in `schemas.py` and `web/lib/api.ts`. |

Dependabot: merge the GitHub Actions bumps (#1 is superseded by #20's trivy fix; close it). Merge
#15 (web group) only after #20, re-running `next build` because it jumps TypeScript 5.9 → 7.0, ESLint 9 → 10
and pixelmatch 7 → 8 (visual-diff script). **Hold #19 (Python 3.15)**: ADR-014 pins containers to 3.12,
and wheels (asyncpg, psycopg, pgvector) must be confirmed first. #10 (Node 26) is fine but not urgent.
#9 (stripe 14 → 15) is a major bump: run the billing tests.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| Claude-side variability: output quality depends on the founder's model/plan. | Playbooks + validator + components constrain it; recommend Opus-class model in onboarding; `custom` escape hatch only for Pro. |
| MCP Apps not rendered by some hosts. | Every tool returns text + a deno web link; the App is an enhancement. |
| OAuth/connector friction (Supabase OAuth server is beta). | Spike S1 first; fallback facade in `apps/api`. |
| Copyright on references and trend data. | Analysis + link, not rehosting; license column on every asset; takedown flow (we already have `takedowns`). |
| Render cost runaway. | Metered render-seconds, preview caps, chunked jobs, per-user concurrency 1–2, kill switch. |
| Untrusted HTML in `custom` component. | Separate job, no network egress, no credentials, CSP, determinism lint. |
| Scope creep into a "real editor". | Rule: if a feature needs a timeline UI, it's a timeline-schema or tool change, not a UI. |
| Founders want avatars/voiceover. | Phase 5 add-ons: TTS (Sarvam / Smallest.ai credits) as an audio track; HeyGen avatar as optional paid provider. |

---

## 8. Decisions and inputs needed

1. **The reference site URL.** The message said a site of Opus-5.5-generated videos was tagged, but no
   link came through. Also: do we have permission to rehost, or is it analysis + link only?
2. **Engine:** our `seek(t)` engine vs. adopting HyperFrames (decided by spike S4). Remotion is ruled
   out unless we buy a Company + Automators license.
3. **Pricing:** how many render-minutes in Pro? (Set after S3 cost numbers.)
4. **Name:** "Deno Studio" (working name). Also note: "Deno" collides with the Deno JS runtime in search and in
   MCP registry listings; worth deciding before we publish a connector.
5. **PR #14:** ask the contributor to cut regeneration attempts, or merge as-is behind a flag?

---

## Sources (checked 2026-11-12)

- Remotion licensing: https://www.remotion.dev/docs/license/pricing, https://www.remotion.dev/docs/license/faq.md
- HyperFrames (Apache 2.0, HTML → MP4 for agents): https://github.com/heygen-com/hyperframes
- MCP Apps (SEP-1865, `ui://`, `text/html;profile=mcp-app`): https://modelcontextprotocol.io/seps/1865-mcp-apps-interactive-user-interfaces-for-mcp, https://blog.modelcontextprotocol.io/posts/2025-11-21-mcp-apps/
- Supabase Auth as MCP authorization server: https://makerkit.dev/blog/tutorials/build-mcp-server-oauth; known connector issue: https://github.com/anthropics/claude-ai-mcp/issues/212
