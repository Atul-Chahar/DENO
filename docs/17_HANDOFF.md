# 17 — Handoff: where we are and what's next

Last updated **2026-11-13** (after PR #33). Read this first in a new chat, after `CLAUDE.md`.
Before acting on anything below, re-check it live (`gh pr list`, `git log origin/main`, `vercel env ls`):
this file can be a few hours stale.

## 1. The product (one paragraph)
Deno validates startup ideas with real public evidence (Reddit, HN, GitHub, the founder's website, X, LinkedIn
posts, Product Hunt) and helps launch them. **Deno is also an MCP server**: a founder connects their own Claude
or ChatGPT; their AI does the creative thinking, Deno supplies what only Deno has (evidence, verdict rules,
founder context, anti-slop gates, licensed media, a review loop). The **Creation Studio** makes marketing videos
and stills: the founder's Claude Code writes the film as HTML/JS, the local `studio` kit (Claude Code plugin
`deno-studio`) renders it on their machine, and Deno's dashboard reviews it. Docs: 16 (BYO AI), 18 (Studio),
14 (money), 19 (many users at once).

## 2. State of `main` (all merged, CI green, deployed)
| PR | What | Docs |
|---|---|---|
| #22–#28 | Vercel-only infra (no GCP), MCP server + OAuth consent, Exa web search, CLAUDE.md | 09, 15, 16 |
| #29 (+#31) | Creation Studio: MCP grew to 19 tools + 5 prompts; `packages/studio`; migration **0006** (applied); Studio library / review / Rulebook pages; `deno-studio` plugin + local `studio` kit | 18 §1–12 |
| #30 (via #31) | Director upgrade: persona, place-before-fill placeholders, upload done-gate, sheet stats, mattes, caption presets, yt-dlp, ElevenLabs SFX, transcribe/silence/loudness. **Zero-key media** (Wikimedia Commons + Internet Archive fallbacks, `archive-pd` licence). **No MP4s on Supabase** (poster + contact-sheet JPEGs, ~250 KB/version; sheet scrubbing; `external_url`/`stream_url` embeds) | 18 §13–14 |
| #32 | Openverse in the kit (CC0 / CC BY / CC BY-SA images + audio, keyless; `studio openverse register` optional) | 18 §15 |
| #33 | **Burst readiness**: fair run line (`deno_core/runqueue.py`), polite 503 when the line is full, `queue_position` in MCP, optional NIM key pool (`NVIDIA_NIM_EXTRA_API_KEYS`), friendly Supabase Auth errors | 19 |

Live checks on 2026-11-13: `/readyz` 200, web 200, DB at migration head **0006**.

Production env (`deno-api`) has: `NVIDIA_NIM_API_KEY`, `WEB_SEARCH_PROVIDER`, `TASK_RUNNER`, `VALKEY_URL`,
`DATABASE_URL`, `SUPABASE_*`, `CRON_SECRET`, `APP_URL`, `API_URL`, `WEB_ORIGINS`. **Not set (all optional):**
`EXA_API_KEY`, `PEXELS_API_KEY`, `PIXABAY_API_KEY`, `FREESOUND_API_KEY`, `NVIDIA_NIM_EXTRA_API_KEYS`,
`RUN_QUEUE_*` (defaults: 2 runs per key, 60 waiting max).

## 3. Waiting on the user (ask before assuming)
1. **Before a demo with many people on one Wi-Fi** (docs/19 §2), all dashboard-only, not verified by us:
   Supabase Auth → Rate Limits (per-IP sign-in/refresh limits up), custom SMTP (or everyone uses Google; the
   built-in sender only mails a few addresses an hour), Google OAuth consent screen **In production**.
2. **Re-measure a validation** on an idle system after #33 (hard rule: < 5 min; last measured 207–257 s).
3. Optional throughput: `NVIDIA_NIM_EXTRA_API_KEYS` (each key ≈ +15 validations/hour). Unknown whether NIM's
   40/min cap is per key or per account.
4. **Create a separate production Supabase project** (dev and prod share one DB: the biggest risk).
5. **Shut down the GCP project `deno-gtm`** (unused).
6. **Decide LinkedIn policy:** posts come from Exa's extracted text, bypassing the robots.txt opt-in gate.
7. Housekeeping: delete merged branches on GitHub (`feat/studio*`, `feat/burst-ready`, `docs/*`, `infra/vercel`,
   `feat/mcp-connect`, `feat/exa-web-search`, `fix/exa-*`, `integrate/contributor-prs`); triage Dependabot PRs
   (#1, #3, #5, #6, #7, #9, #10, #15; #5/#6/#10 touch Docker and are obsolete; #9 bumps Stripe, which Dodo replaces).
8. For billing later: Dodo Payments product IDs, API key, webhook secret.

## 4. Next steps (suggested order)
1. **Openverse in the server's `search_media`** (MCP-only clients don't get it yet; the kit does). Small.
2. **BYO-AI validation (docs/16 phase 2)**: the founder's AI writes brief + queries → Deno collects + ingests
   (no LLM) → `get_evidence` → AI `submit_claims` with verbatim quotes → Deno checks quotes, computes signals +
   verdict. Also the real fix for NIM throughput: the founder's AI pays for the thinking. Needs an `executor`
   column (additive migration) and a collection-only job on the existing queue (it must also use the run line).
3. **Content via MCP**: create plan, `save_draft` through `deno_gates`, calendar on the dashboard.
4. **Billing with Dodo Payments** (replace Stripe code in `apps/api/src/deno_api/v1/billing.py`) + Connect plan quotas.
5. Reddit fallback (Arctic Shift times out; see §5).

## 5. Known issues and gotchas
- **NIM throughput**: one key ≈ 15 validations/hour no matter what; the run line makes bursts wait fairly
  instead of failing (docs/19). Content plans share the same line.
- **Reddit returned 0 posts** in recent tests: Arctic Shift (its upstream) times out.
- **Stacked PRs:** merging a PR whose base is another feature branch does NOT reach `main` (this happened with
  #30; #31 fixed it). Retarget the base to `main` first, or open PRs against `main`. The repo does not delete
  branches on merge, so GitHub doesn't auto-retarget.
- **MCP tool errors:** raise `ToolError` (resources: `ResourceError`), never `ValueError`. MCP SDK 2.x hides any
  other exception's text and the model sees only "Error executing tool <name>" (a founder over the 5/month quota
  got no reason until the fix on 2026-11-14).
- Schemathesis can flag random fuzz edge cases on PRs; check whether a failure is the PR's fault.
- `vercel.json` (root) is the API only; `web/vercel.json` must keep `"framework": "nextjs"`. The root
  `.vercelignore` applies to BOTH projects: never ignore `web/`.
- Vercel entrypoints must be files under the repo root (`server/app.py`, `server/queues.py`); don't build
  `Settings()` at import time (Vercel imports the subscriber during the build).
- NIM can stall a request ~60 s; LLM timeout is 20 s with retry + fallback. If NIM retires models, probe
  `https://integrate.api.nvidia.com/v1/models` and test with a real call (listed ≠ callable).
- Web CSP (`web/lib/csp.ts`): `media-src` allows `https:` (founders' own video links); `frame-src` only
  youtube-nocookie.com + player.vimeo.com.
- Private, never commit: `docs/reference/` (third-party prompt text), `launch-video/`, `docs/OJT_DEMO_PREP.md`
  (all in `.gitignore`).

## 6. Key measurements (for regression checks)
- Validation on Vercel: queued → running in 3 s, finished in 207 s (PIVOT 0.37); with Exa 257 s.
- A run makes ~28 chat calls (intake, 2 planners, 7 analysts, ~12 citation-judge batches, critic, refiner,
  rationale) plus embeddings/rerank, all under the shared 36/min limiter.
- Studio upload: contact sheet JPEG ~90–150 KB, poster ~30–80 KB (test sheet: 92 KB).
- Openverse anonymous: 20 requests/min, 200/day.
- Tests on 2026-11-13: 406 unit (Python), 23 kit (Node); integration tests run in CI (Postgres).
