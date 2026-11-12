# 17 — Handoff: where we are and what's next

Last updated **2026-11-12** (end of a long session). Read this first in a new chat.

## 1. The product direction (one paragraph)
Deno validates startup ideas with real evidence (Reddit, HN, GitHub, the founder's website, X, LinkedIn
posts, Product Hunt) and helps launch them. The new strategy: **Deno is also an MCP server**. A founder
connects their own Claude or ChatGPT; their AI does the "thinking", while Deno supplies what only Deno has:
evidence collection, retrieval, citation checks, verdict rules, founder context, anti-slop gates, and (planned)
a video Studio kit (playbooks, assets, review loop; rendering on the user's machine). Everything made through
MCP lands on the same Deno dashboard. A cheaper "Connect" plan follows from that, because our AI cost drops.
Details: docs/16 (BYO AI), docs/12 + docs/13 (video), docs/14 (money).

## 2. Done in the last session
| What | Where |
|---|---|
| Merged contributor PRs #14, #16, #17, #18, #20 (via #21); `MAX_REGEN_ATTEMPTS` 3 → 1 | main |
| **GCP + Docker removed; API, graph runs, crons on Vercel Hobby** | PR #22, docs/09, docs/15 |
| NIM models swapped (old `nemotron-3-super-120b` returned 404, fallback 410) | `deno_core/settings.py` |
| Run time 524 s → 207–257 s (LLM timeout 20 s, short retry round, 1 critic round) | `validation/nodes.py` |
| Migration 0005 applied to the (shared) Supabase DB | |
| **MCP server live** at `/mcp`: list_ideas, validate_idea, get_validation, get_report, get_founder_context; Supabase OAuth + consent page | PR #24, `apps/api/src/deno_api/mcp_server.py`, `web/app/(auth)/oauth/consent` |
| User connected Claude to the MCP and confirmed it works | |
| Contributor PR #26: keyless **Exa** web search → X, LinkedIn posts, Product Hunt work again (verified live: X 20, LinkedIn 10, PH 10 in a 257 s run) | main |
| Follow-up PR #27: Exa's documented API when `EXA_API_KEY` is set; optional-text-field limit bug (Schemathesis) fixed | **open, CI green** |
| Research/strategy docs 12–16 | docs/ |

## 3. Waiting on the user (check these first)
1. **Merge PR #27** (CI green).
2. **Vercel → deno-api → Environment Variables:** set `WEB_SEARCH_PROVIDER=exa` (production + preview; it's
   still `none` from the migration, so X/LinkedIn/PH are OFF in prod), and add `EXA_API_KEY` (free Exa account).
   The next deploy (merging #27) picks them up.
3. **Decide LinkedIn policy:** posts now come from Exa's extracted text, bypassing the old "robots.txt opt-in
   after legal review" gate. Accept, or gate it behind `SOURCES_ROBOTS_OPT_IN`.
4. **Shut down the GCP project `deno-gtm`** (unused since the move).
5. **Create a separate production Supabase project** (dev and prod share one DB today: the biggest risk).
6. For billing later: Dodo Payments product IDs, API key, webhook secret.

## 4. Next steps (agreed order)
1. **MCP hardening** (small): per-user rate limits on MCP tools; record the calling app ("via Claude") on
   runs; "Connected apps" list on the account page.
2. **BYO-AI validation (docs/16 phase 2)**: the founder's AI writes brief + queries → Deno runs
   collection + ingest only (no LLM) → `get_evidence(run, analyst)` → AI `submit_claims` with verbatim quotes →
   Deno checks quotes deterministically, computes signals + verdict → dashboard shows "via Claude". Needs an
   `executor` column (migration, additive) and a collection-only job on the existing queue.
3. **Content via MCP**: create plan, `save_draft` through `deno_gates`, calendar on the dashboard.
4. **Video Studio via MCP** (docs/12, docs/13 §11 + §14): skill/plugin with playbooks, local renderer kit,
   `save_video`, Studio tab + frame-review page (Cut Notes-style, but our own code: Cut Notes has no licence).
5. **Billing with Dodo Payments** + Connect plan quotas.

## 5. Known issues
- **Reddit returned 0 posts** in the last two tests: Arctic Shift (its upstream) timing out. Investigate a fallback.
- Schemathesis can flag other fuzz edge cases at random on PRs; check whether a failure is the PR's fault.
- `vercel.json` (root) is for the API only; `web/vercel.json` must keep `"framework": "nextjs"`.
  The root `.vercelignore` applies to BOTH projects: never ignore `web/`.
- Vercel entrypoints must be files under the repo root (`server/app.py`, `server/queues.py`); don't build
  `Settings()` at import time (Vercel imports the subscriber during the build).
- NIM can stall a request ~60 s; LLM timeout is 20 s with retry + fallback. If NIM retires models again,
  probe `https://integrate.api.nvidia.com/v1/models` and test with a real call (listed ≠ callable).
- Open Dependabot PRs (#1, #3, #5, #6, #7, #9, #10, #15) are untriaged; #5/#6/#10 touch Docker and are now obsolete.

## 6. Key measurements (for regression checks)
- Validation on Vercel: queued → running in 3 s, finished in 207 s (PIVOT 0.37).
- With Exa: 257 s; sources X 20, LinkedIn 10, PH 10, HN 41, Reddit 0 (timed out).
- A run makes ~28 LLM calls (intake, 2 planners, 7 analysts, ~12 citation-judge batches, critic, refiner, rationale).
- API function bundle 50 MB (limit 500 MB).
