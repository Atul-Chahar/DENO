# 09 — Deployment (Vercel + Supabase + Upstash)

Status: **live, 2026-11-12.** Replaces the Google Cloud Run deployment (removed; history in git).
Why and how we moved: docs/15. No GCP, no Docker, nothing to keep running.

| Piece | Where | Name / URL |
|---|---|---|
| Web (Next.js) | Vercel project `deno-web` (root directory `web/`) | https://deno-web-eight.vercel.app |
| API (FastAPI) | Vercel project `deno-api` (repo root), Python function, region `hnd1` (Tokyo) | https://deno-api-swart.vercel.app |
| Graph runs | Vercel Queues topic `graph-runs` → push subscriber function `_py_subscribers/server-queues` | same project |
| Crons | Vercel Cron Jobs in `vercel.json` (`/internal/cron/purge`, `/internal/cron/requeue`) | same project |
| Postgres + Auth | Supabase, `ap-northeast-1` | transaction pooler `:6543` for the API |
| Redis | Upstash | SSE events, run leases, rate limits, source cache |
| Web search | Exa hosted search (no key needed), or the Brave Search API | `WEB_SEARCH_PROVIDER=exa`, or `brave` + `BRAVE_SEARCH_API_KEY` |

## 1. How a validation run executes

```
browser ─► web (Vercel) ─rewrite /api/*─► API function (FastAPI)
                                            │ POST /v1/projects/{id}/runs → row in Postgres
                                            │ vercel.queue.send("graph-runs", {task, kwargs})
                                            ▼
                         Vercel Queues ──push──► subscriber function (deno_worker.queue.run_graph)
                                                   │ execute_run → LangGraph validation graph
                                                   │ checkpoints every node to Postgres
                                                   │ progress events → Upstash → SSE to the browser
```

- A run gets `RUN_TIME_BUDGET_S` (270 s) per invocation. Measured runs finish in **3.5–4 minutes**,
  inside one 300 s Hobby function. A run that doesn't finish hands off with `RetryAfter(0)`: Vercel
  redelivers it and the graph resumes from its checkpoint (status stays `running`).
- Transient upstream failures (NIM rate limit or outage) back off for 30 s and retry. A message that
  can't run (bad payload) is acknowledged and logged.
- The `requeue` cron re-sends runs whose enqueue was lost (still `queued` after 2 minutes).

## 2. Releasing an update

Both projects deploy from `main` through Vercel's Git integration:

- `web/` changes → `deno-web` builds.
- `apps/`, `packages/`, `server/`, `pyproject.toml`, `uv.lock` → `deno-api` builds.

Migrations are **not** run by the build. Apply them before merging code that needs them:

```bash
uv run alembic upgrade head      # uses DATABASE_URL from .env
```

Manual deploy, if ever needed: `npx vercel@latest deploy --prod` from the repo root (API) or `web/` (web).

## 3. Environment variables (`deno-api`, production + preview)

| Variable | Value |
|---|---|
| `ENVIRONMENT` | `production` |
| `LOG_JSON` | `true` |
| `TASK_RUNNER` | `vercel_queue` |
| `DATABASE_URL` | Supabase **transaction pooler** URL, port `6543` (the session pooler allows only 15 clients) |
| `VALKEY_URL` | Upstash `rediss://…` |
| `NVIDIA_NIM_API_KEY`, `NVIDIA_NIM_BASE_URL` | NIM |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Supabase |
| `CRON_SECRET` | random; Vercel Cron sends it as `Authorization: Bearer …` |
| `WEB_ORIGINS`, `APP_URL` | `https://deno-web-eight.vercel.app` |
| `WEB_SEARCH_PROVIDER` | `exa` (the default): LinkedIn posts, Product Hunt and some X discovery with no key. `brave` for full X discovery |
| `EXA_API_KEY` | optional but recommended; keyless Exa is rate limited per IP, and Vercel's IPs are shared. A free Exa account needs no card |
| `BRAVE_SEARCH_API_KEY` | only with `brave`; the one backend with a real X index |
| `GITHUB_TOKEN` | optional; raises GitHub's limit for repo links in ideas (60/h per IP without it) |

`deno-web` keeps `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and
`BACKEND_URL=https://deno-api-swart.vercel.app`.

## 4. Free-plan (Hobby) limits that matter

- Functions: 300 s max. The run budget is 270 s, so a run fits one invocation, with a hand-off if not.
- Crons: once a day each (purge 03:17 UTC, requeue 03:40 UTC). Queue redelivery covers retries in between.
- Queues: 1,000,000 operations a month included.
- **Hobby is for non-commercial use.** Move to Pro before charging customers (docs/14, docs/15 §5).

## 5. Checking it

```bash
curl https://deno-api-swart.vercel.app/readyz                     # {"status":"ok","checks":{"database":"ok","valkey":"ok"}}
curl -H "Authorization: Bearer $CRON_SECRET" https://deno-api-swart.vercel.app/internal/cron/requeue
npx vercel@latest logs --deployment deno-api-swart.vercel.app --since 30m --json   # function logs
```

The Vercel dashboard shows each queue delivery as a request to `/_py_subscribers/server-queues`.

## 6. Local development

```bash
uv sync && uv run uvicorn deno_api.main:app --reload     # API on :8000 (TASK_RUNNER=taskiq by default)
uv run taskiq worker deno_worker.tasks:broker            # executes runs locally
cd web && npm run dev                                    # web on :3000
uv run python scripts/run_validation.py "an idea"        # one run end to end, printing every node
```

Local development uses the hosted Supabase and Upstash from `.env`. No containers.
