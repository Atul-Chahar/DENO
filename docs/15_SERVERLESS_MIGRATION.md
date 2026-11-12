# 15 — Leaving GCP: run everything on Vercel + Supabase + Upstash

Status: **done, 2026-11-12.** API, queue worker and crons run on Vercel Hobby; GCP removed. Runbook: docs/09.
Replaces the Cloud Run deployment in docs/09. Related decisions: rendering happens on the user's side only
(docs/12 hosted rendering is deferred); payments move to **Dodo Payments** (§7).

---

## 1. What runs on GCP today (and what replaces it)

| Today (GCP, asia-northeast1) | Job | Replacement | New infra to manage |
|---|---|---|---|
| Cloud Run service `deno-api` (FastAPI, Docker image via Cloud Build) | Public API, SSE progress | **Vercel Function, Python runtime (GA since Oct 2026)**: FastAPI deploys as-is, zero-config | none: a second Vercel project |
| Cloud Run Job `deno-run` (30 min timeout, 2 retries) | One validation run / content plan per execution | **Vercel Queues push subscriber** (Python SDK) running the same `GRAPH_HANDLERS` | none |
| Cloud Scheduler `deno-purge` (daily), `deno-requeue` (5 min), with OIDC | Retention purge, re-send lost runs | **Vercel Cron Jobs** in `vercel.json`, authenticated with `CRON_SECRET` | none |
| Cloud Run service `deno-searxng` (private) | Web search, used only for **X** (`site:x.com`) and **Product Hunt** queries | **A search API** behind the same client interface (Tavily or Brave free tier), or turn those 2 sources off | an API key |
| Artifact Registry, Cloud Build, Secret Manager, 2 service accounts, IAM, billing budget | Plumbing | **Vercel env vars** | none |
| Upstash Redis (already serverless) | SSE events, leases, rate limits | **stays** | (already there) |
| Supabase (Postgres + Auth) | DB, auth, LangGraph checkpoints | **stays** | (already there) |

After the move there's no GCP project, no Docker image, no gcloud and no service accounts. Deploying is
`git push`: Vercel builds both projects.

## 2. Why this works for our agents

- **Runs take 3–6 minutes.** Python functions on Vercel Fluid compute can run **300 s on Hobby and 800 s on Pro**,
  with an 1,800 s beta on Pro for Python 3.12+.
- **We're already crash-safe.**
  - The graph checkpoints to Postgres after every node.
  - `run_lease` stops two workers running the same run.
  - Cloud Run already relied on "exit 1 → retry → resume from checkpoint" (`deno_worker/run_once.py`).
  - Vercel Queues gives the same contract: the subscriber's lease is renewed while it runs, and if the handler
    raises or the function dies, **the message is redelivered and the graph resumes from its checkpoint**.
  - So a run longer than the function limit continues in the next delivery instead of failing.
- **LLM agents mostly wait.** Fluid compute bills *active CPU*, not wall time spent waiting on NVIDIA NIM or
  Postgres, so a 5-minute run costs a few seconds of CPU.
- **Bundle size.** Python functions may be up to **500 MB uncompressed**. Our full dev venv is 440 MB, including
  dev tools (mypy, pip, pytest), which won't ship. Production deps should be well under. Verify with
  `uv export --no-dev` in step 1.

### Why not Supabase Edge Functions?
They run **TypeScript on Deno only**: every agent (LangGraph, gates, sources, RAG; about 20k lines of Python)
would need a rewrite. They also cap wall-clock time at 150 s (free) / 400 s (paid), which is shorter than a
validation run. We keep Supabase for what it's good at (DB, Auth, optionally `pg_cron`).

### Why not Vercel Workflows?
The Python Workflow SDK (beta) would make each graph node a durable step. That's elegant, but LangGraph's
Postgres checkpointer already gives us durability, so it would be a second state machine on top of the first.
Queues is the smaller change. Revisit only if long content plans keep hitting the function limit.

## 3. Code changes (small, behind the existing switch)

1. **Runner:**
   - `settings.task_runner`: add `"vercel_queue"`.
   - `deno_core/jobs.py::enqueue()`: when `vercel_queue`, call
     `await vercel.queue.send("graph-runs", {"task": name, "kwargs": kwargs}, idempotency_key=run_id)`.
2. **Subscriber:** new module `apps/api/src/deno_api/queue_worker.py` (or `apps/worker`):
   ```python
   @subscribe(topic="graph-runs", max_attempts=3, retry_after=30)
   async def run_graph(message: Message[dict]) -> None:
       await GRAPH_HANDLERS[message.payload["task"]](redis, **message.payload["kwargs"])
   ```
   This reuses `run_once.run()` logic (redis + engine lifecycle). It's registered in `pyproject.toml` under
   `[[tool.vercel.subscribers]]`, with `maxDuration` 800 in `vercel.json`.
3. **API entrypoint:** Vercel's FastAPI zero-config (an `app` exported from an entry module), plus `vercel.json`:
   - region `hnd1` (Tokyo, next to Supabase `ap-northeast-1`)
   - `maxDuration` for the SSE route
   - crons
4. **Crons:** `deno_api/cron.py` verifies `Authorization: Bearer $CRON_SECRET` instead of a GCP OIDC token.
   `vercel.json` gets `"crons": [{"path": "/internal/cron/purge", "schedule": "17 3 * * *"},
   {"path": "/internal/cron/requeue", "schedule": "*/5 * * * *"}]`. With Queues retrying failed deliveries,
   requeue becomes a safety net and can run hourly.
5. **Search:** turn `SearxngClient` into a `WebSearch` interface with a `TavilySearch` (or `BraveSearch`)
   implementation. Keep SearXNG as an optional local-dev backend. Only X and Product Hunt use it, a handful of
   queries per run, which fits a free tier during beta.
6. **Delete:**
   - `deno_core/gcp.py`, the `cloudrun_job` runner
   - `deploy/deploy-free.sh`, `deploy/cloudbuild-api.yaml`, `deploy/searxng/`, `deploy/caddy/`
   - the `Dockerfile`s and `compose.*.yml`. Local dev is then `uv run uvicorn` + `npm run dev` against hosted
     Supabase/Upstash, which we already do.
   - the CI `images` job (trivy) → replaced by a dependency audit (`uv` + `npm audit`)
7. **Web:** `BACKEND_URL` points to the new Vercel API project URL; the Next.js rewrites stay unchanged.
8. **Docs:** rewrite docs/09 for the new deploy; update docs/10 (config) and docs/11 (stack).
9. **Tests:** queue path tested with Vercel's `embedded_queue_service` pytest fixture; cron auth tests; existing
   resume-from-checkpoint tests already cover redelivery.

## 4. Cutover plan (no downtime)

1. Deploy the API as a new Vercel project (`deno-api`) with `TASK_RUNNER=vercel_queue`, all env vars copied
   from Secret Manager, and the search API key.
2. Smoke test on its preview URL: `/readyz`, one validation run end to end, one content plan, SSE progress, crons
   (trigger them manually).
3. Point web's `BACKEND_URL` at it and redeploy web.
4. Watch for 48 h: Sentry, run success rate, the Queues dashboard.
5. Delete the GCP resources: Cloud Run service + job, the SearXNG service, the scheduler jobs, then **shut down the
   `deno-gtm` project**. You run the gcloud commands, as before.

## 5. Cost

| Item | Hobby (free) | Pro |
|---|---|---|
| Vercel | $0, **but non-commercial use only**; 300 s functions; crons limited to once a day | **$20/month per seat**; required the moment Deno charges customers (it hosts the web app too, so this is needed anyway); 800 s functions; any cron schedule |
| Functions usage | included allowance | included credit, then on-demand (Active CPU from ~$0.128/h, memory ~$0.0106/GB-h; check the pricing page) |
| Vercel Queues | usage-based per API operation; a beta | same |
| Upstash Redis | free | free |
| Supabase | free | $25/month when we outgrow free |
| Search API | free tier (Tavily 1,000 credits/month, or Brave's ~$5 monthly credit) | pay-as-you-go |
| GCP | **$0, and gone** | |

**Recommendation:** use Vercel **Pro**, one seat. It's the only fixed cost added, it's legally required once we
sell, and it replaces GCP's free tier *plus* all the operational work. Until launch, Hobby works for testing.
Then the requeue cron would run daily (or via Supabase `pg_cron` + `pg_net`, which is free), and long content
plans may span 2 deliveries.

## 6. Risks

| Risk | Mitigation |
|---|---|
| Vercel Queues' Python SDK is **beta** | Fallback runner: **Upstash QStash** (GA, same vendor as our Redis, free 1,000 messages/day) calling an `/internal/runs/execute` endpoint with signature verification. It's the same `enqueue()` switch, so changing is a config flag |
| Run exceeds the function limit | Checkpoint resume on redelivery (existing). For huge content plans: process briefs in batches per delivery |
| Queue region availability (Tokyo) | If `hnd1` queues aren't available, use the nearest region; the queue only carries a run id |
| Cold starts on the API | Fluid compute keeps instances warm under load; the first request after idle is ~1–2 s |
| SSE connections held open count against function time | EventSource reconnects automatically (we already resume from `Last-Event-ID`); set the SSE route `maxDuration` to 300 |

## 7. Payments: Dodo Payments (decided)

Replace the Stripe code in `apps/api/src/deno_api/v1/billing.py` with Dodo Payments. It's a merchant of record,
so global tax is handled for us.
- Checkout session / payment link per plan.
- A customer portal link.
- A webhook endpoint that verifies Dodo's signature and maps subscription events (active, renewed, on hold,
  cancelled, failed) onto our `Subscription`/`Profile.plan`. Keep the fixes from PR #17: cancel on account
  deletion, and re-fetch state rather than trusting event order.

This is a separate PR after the infra move. It needs Dodo account details (product IDs, API key, webhook
secret).

## 8. Order of work

1. Merge the open contributor PRs (#20 → #17 → #16 → #18 → #14) so the move happens on the final code.
2. Infra move (§3–4): one PR, about 1–2 days including the smoke test.
3. GCP shutdown (§4.5): you run it.
4. Dodo Payments PR (§7).
