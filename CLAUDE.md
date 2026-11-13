# Deno — project guide for Claude

Deno (GTM) validates startup ideas against real public evidence, then helps the founder launch them:
content plans and posts that don't read as AI, and marketing videos/stills made by the founder's own Claude
through Deno's MCP and the `deno-studio` Claude Code plugin (Creation Studio, shipped 2026-11-13).
Owner: Atul (non-native English speaker; prefers plain, direct, step-by-step answers with exact click-paths).

**Start every session by reading `docs/17_HANDOFF.md`** (current state, pending user actions, next steps,
gotchas). Then the doc for the task at hand (map below). Re-check live state before acting (`gh pr list`,
`git log origin/main`, `npx --yes vercel@65.14.0 env ls production`): docs can lag by a few hours.

## Hard rules (decided by the user, don't re-litigate)
- **Infra: Vercel + Supabase + Upstash only.** No GCP, no Docker, no self-hosted services (docs/15).
  Vercel is on the **Hobby (free) plan** until launch: every function ≤ 300 s, crons once a day.
- **A validation run must finish in under 5 minutes** (measured 207–257 s; budget logic in
  `deno_graphs/validation/nodes.py` + `deno_worker/queue.py` hand-off). Re-measure after changes that touch runs.
- **Auth = hosted Supabase Auth.** Never propose local Supabase containers.
- **Agents = LangChain + LangGraph** (StateGraph, structured output, Postgres checkpointer). No ad-hoc agents.
- **Web = Next.js, pixel-perfect** to the existing design system (`web/styles/*.css`); new screens reuse existing classes.
- **Payments = Dodo Payments** (replacing Stripe code in `apps/api/src/deno_api/v1/billing.py`; not started).
- **Video rendering happens on the user's machine** (hosted rendering deferred). **MP4s never go to Supabase
  Storage by default**: a version stores poster + contact-sheet JPEGs (~250 KB) and film.json (docs/18 §14).
- **Media must work with zero API keys** (Commons, Internet Archive, Openverse, yt-dlp, synthesized SFX); keys only
  add choice. Never put NC/ND-licensed media in a final; `unknown` licences are draft-only.
- **Every graph run goes through the fair run line** (`deno_core/runqueue.py`, via `enqueue`) because all runs share
  the NIM budget. New job types that call the LLM must use it too (docs/19).
- **Pricing is flexible**; don't over-plan it.

## Working with this user / environment
- The Claude Code auto-mode classifier **blocks**: merging my own PRs, production deploys, and production env-var
  changes on Vercel. Open PRs and give the user exact click-paths/commands; they merge and change prod env.
  Supabase/Google dashboard settings are also the user's to change.
- Merging to `main` auto-deploys BOTH Vercel projects (`deno-web` from `web/`, `deno-api` from repo root).
- **Open PRs against `main`.** A PR based on another feature branch doesn't reach `main` when merged (it happened with
  #30); the repo doesn't delete branches on merge, so GitHub won't retarget.
- **Dev and prod share ONE Supabase database** (no separate prod project yet). Test runs land in live data;
  migrations hit prod. Additive migrations only, and say so. Never write test keys into prod Redis without a
  throwaway prefix (e.g. `rqtest:*`) and delete them after.
- A contributor (GitHub `945040ad`) opens PRs; review them carefully (run checks, test live) before recommending merge.
- Run `uv run ruff check . --exclude launch-video && uv run ruff format --check . --exclude launch-video && uv run mypy && uv run pytest tests/unit`
  plus `uv run python scripts/build_plugin.py --check`, `node --test plugin/kit/test/*.test.mjs` and
  `cd web && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/eslint .` before any PR, then wait for CI.
  Integration tests need Postgres (CI provides it; none locally). Redis tests use `fakeredis[lua]` (dev dependency).
- Studio content (playbooks, styles, recipes, skills) is edited in `packages/studio/src/deno_studio/content/` only;
  then `uv run python scripts/build_plugin.py` regenerates `plugin/skills/`. Founders get kit/plugin changes after
  merge with `/plugin marketplace update deno`.
- Private, never commit (gitignored): `docs/reference/` (third-party prompt text), `launch-video/`, `docs/OJT_DEMO_PREP.md`.
- **End of a work session:** update `docs/17_HANDOFF.md` (state, pending user actions, next steps), the relevant
  plan doc section, and this file if a rule or map changed; ship docs in a PR like code.

## Live system
| Piece | Where |
|---|---|
| Web | https://deno-web-eight.vercel.app (Vercel `deno-web`, root `web/`); Studio at `/app/studio` |
| API | https://deno-api-swart.vercel.app (Vercel `deno-api`, repo root, region hnd1) — `/readyz`, `/api/v1/*` |
| Graph runs | `enqueue` joins the run line → Vercel Queues topic `graph-runs` → subscriber `deno_worker/queue.py` (entry shim `server/queues.py`); 2 runs per NIM key execute, the rest wait with their place shown |
| MCP server | https://deno-api-swart.vercel.app/mcp (19 tools + 5 prompts; OAuth via Supabase OAuth server; consent page `web/app/(auth)/oauth/consent`) |
| Studio plugin | `plugin/` in this public repo: `/plugin marketplace add Atul-Chahar/DENO`, `/plugin install deno-studio@deno`; local CLI `studio` (`plugin/kit/cli.mjs`) |
| DB / Auth | Supabase project `bfinvyflanpjfzlisspq` (ap-northeast-1); transaction pooler :6543 for the API; migration head 0006; Storage bucket `studio` |
| Redis | Upstash (SSE events, run leases, **run line `rq:*`**, rate limits, source + media cache) |
| LLM | NVIDIA NIM, 40 req/min cap per key (we use 36): `nvidia/nemotron-3.5-super-vl-120b-a12b`, fallback `nvidia/nemotron-3.5-lightning-30b-a3b`; optional `NVIDIA_NIM_EXTRA_API_KEYS` pool |
| Web search | Exa (`WEB_SEARCH_PROVIDER=exa`; `EXA_API_KEY` → documented API, unset = keyless) for X / LinkedIn posts / Product Hunt |
| Media | Server `search_media`: Pexels/Pixabay/Freesound if keyed, else Wikimedia Commons + Internet Archive. Kit: + Openverse, YouTube via yt-dlp, synthesized SFX |

Vercel CLI: `npx --yes vercel@65.14.0 …` (team `chaharatul92-7596s-projects`). Cron secret is in Vercel env `CRON_SECRET`.

## Repo map
```
apps/api      deno_api     FastAPI app (app.py), v1 routers, mcp_server.py, studio_service.py, cron.py, auth.py
apps/worker   deno_worker  graph handlers, Vercel Queues subscriber (queue.py: run line, hand-offs), local taskiq
packages/core deno_core    settings, DB models/repositories (RLS-scoped UserScope), jobs.py (enqueue), runs,
                           runqueue.py (fair run line), events (Redis streams), ratelimit
packages/graphs            validation graph (nodes.py, verdict.py) + content graph
packages/sources           source clients (reddit, hn, x, linkedin, producthunt, github, website, Exa/Brave search)
packages/gates             anti-slop gates, quality scoring    packages/llm  NIM router, limiter, key pool (factory.py)
packages/rag               ingest, hybrid retrieval, rerank
packages/studio deno_studio  Studio content (playbooks/styles/recipes/skills), film.json manifest + checks,
                           media.py (keyed + keyless search), licences.py, brand kit, Rulebook
plugin/                    Claude Code plugin `deno-studio` (skills generated by scripts/build_plugin.py, agents, .mcp.json)
plugin/kit                 `studio` CLI: init/place/fill, render, sheet, verify, beats, captions, voice, mix, matte,
                           search/fetch/download (sources.mjs: Openverse, yt-dlp, synth sfx), upload (api.mjs, project.mjs)
server/                    Vercel entry shims (app.py, queues.py)   vercel.json  API project config
web/                       Next.js app (own vercel.json pins nextjs); Studio UI in components/studio/
migrations/                Alembic (head: 0006)   scripts/  run_validation.py, probe_sources.py, build_plugin.py
```

## Doc map
- `docs/17_HANDOFF.md` — **current state + next steps (read first)**
- `docs/20_BACKLOG.md` — **agreed fixes not started yet** (setup, BYO validation, validation/video/post quality); `/backlog` shows them
- `docs/18_CREATION_STUDIO_PLAN.md` — Studio: MCP tools, plugin, kit, media sources, review (§13 director upgrade,
  §14 zero keys + no MP4 storage, §15 Openverse)
- `docs/19_DEMO_DAY.md` — many users at once: fair run line, NIM key pool, Supabase Auth settings for one shared Wi-Fi
- `docs/16_BYO_AI_MCP.md` — bring-your-own-AI MCP plan (phase 1 shipped; phase 2 next)
- `docs/09_FREE_DEPLOYMENT.md` — deploy runbook (Vercel)   ·  `docs/10_CONFIGURATION.md` — every env var
- `docs/15_SERVERLESS_MIGRATION.md` — why/how GCP was replaced
- `docs/12_STUDIO_MCP_PLAN.md`, `docs/13_VIDEO_RESEARCH.md` — Studio background research
- `docs/14_MONETIZATION.md` — pricing model benchmarked on Pocket CD
- `docs/11_TECH_STACK.md`, `docs/02_ARCHITECTURE.md`, `docs/01_PRD.md` — background

## Useful commands
```bash
uv run python scripts/run_validation.py "idea text https://github.com/o/r" --no-review   # one run, prints node timings
uv run python scripts/probe_sources.py --query "…" --search exa                          # source health
uv run alembic upgrade head                                                               # migrations (shared DB!)
uv run python scripts/build_plugin.py [--check]                                           # regenerate plugin skills
node plugin/kit/cli.mjs --help                                                            # the studio kit
curl https://deno-api-swart.vercel.app/readyz
npx --yes vercel@65.14.0 logs --deployment deno-api-swart.vercel.app --since 30m --json   # function logs (grep queue_run)
```
