# 16 — Bring your own AI: validate and create through Claude or ChatGPT, see it all in Deno

Status: **validated plan, 2026-11-12.** Builds on docs/12 (Studio MCP) and docs/15 (Vercel).

## 1. The idea, checked

> A cheaper Deno plan for people who connect their own Claude or ChatGPT subscription to Deno's MCP. Their AI
> does the thinking; Deno does the parts only Deno can do. Whatever they make there (validations, content
> calendars, posts, videos rendered on their own machine) shows up on the Deno dashboard.

**Verdict: sound, and cheap for us to serve.** Measured on 2026-11-12 (docs/15), a validation run makes
**28 LLM calls**: intake, 2 planners, 7 analysts, 12 citation-judge batches, critic, refiner, rationale. All
of those are "thinking" the user's own AI can do. What only Deno can do:

| Step | Who does it in BYO mode | Our cost |
|---|---|---|
| Brief, perspectives, search queries | user's AI (we give the schema + rules) | 0 |
| Collect evidence: Reddit, HN, GitHub, websites, (X/LinkedIn/PH via search) | **Deno** (sources, policies, caps, cache) | network + 1 function run |
| Ingest: dedupe, chunk, embed, store | **Deno** | a few embedding calls |
| Retrieve + rerank evidence per analyst | **Deno** | a few rerank calls |
| Write claims from evidence | user's AI | 0 |
| Check every claim's quote against its source | **Deno**, deterministic (no LLM) | 0 |
| Signals + verdict band | **Deno**, already pure Python | 0 |
| Rationale text | user's AI | 0 |
| Store + show on dashboard | **Deno** | DB rows |

So a BYO validation costs us about **one collection run plus ~5 embedding/rerank calls**, against ~28 LLM
calls plus that today. Pricing it lower is justified. It also takes load off our 40 req/min NIM cap.

Why it isn't just "Claude with web search": the user's AI can't run our source clients (Reddit archive,
HN Algolia, robots-aware fetchers, daily caps), our retrieval index, our citation check, or our verdict rules.
**The verdict stays computed by Deno's code**, so a validation made through ChatGPT is held to the same bar as
one made in the web app. That's the product.

(The "cheaper if you bring your own model" pattern exists elsewhere; we haven't verified any specific
competitor's pricing, so this plan doesn't rely on one.)

## 2. One database, one dashboard

Every MCP tool acts as the signed-in founder and writes to the **same tables** the web app reads (RLS-scoped,
as today). Nothing lives "in the chat":

- `validation_runs.executor`: `server` (today) | `client` (made through MCP), plus `client_name` (e.g.
  "Claude", "ChatGPT", from the OAuth client). The dashboard shows a small badge: *"via Claude"*.
- Content plans, briefs and drafts made through MCP land in the same calendar. Drafts still go through
  `deno_gates` (anti-slop, number checks), whoever wrote them.
- Videos (docs/12) are rendered on the user's machine; MCP uploads the timeline JSON plus a preview MP4 (≤ 50 MB)
  or just a poster and a link, and they appear in a **Studio** tab.

The founder never has to copy anything between chats: open Deno, and everything is there, grouped by idea.

## 3. MCP surface (v1)

Hosted on the existing API: `https://deno-api-…/mcp` (Streamable HTTP, a FastAPI route, the official Python
MCP SDK). Same Vercel function, no new service.

**Read (both plans):** `list_ideas`, `get_report(run_id)` (verdict, signals, cited claims), `get_founder_context(idea_id)`
(ICP, pains with citations, voice, story bank).

**Validate (BYO):**
1. `start_validation(idea, brief, queries)`: the user's AI writes the brief and queries to our schema (the tool
   description carries the rules). We store them and queue **collection + ingest only** (no LLM; about 2 minutes).
2. `get_validation(run_id)`: status; when `evidence_ready`, the 7 analyst focuses.
3. `get_evidence(run_id, analyst)`: top evidence chunks (id, url, source, date, text) from our hybrid retrieval + rerank.
4. `submit_claims(run_id, analyst, claims[])`: each claim = text, stance, cited chunk ids, verbatim quote.
   Deno keeps a claim only if its quote is found in a cited chunk (normalised, fuzzy-tolerant), and answers with
   what was kept and why the rest was dropped.
5. `finish_validation(run_id, rationale)`: Deno computes signals and the verdict band, stores the report and
   returns it. It's on the dashboard at that moment.

**Create (BYO):** `create_content_plan(idea_id, briefs[])`, `save_draft(brief_id, text)` (returns the gate
report; failing drafts are saved as "needs work"), `save_video(idea_id, title, timeline, media?)`.

**Guardrails:** quotas per plan on `start_validation` (it's the one tool that costs us a collection run), rate
limits, payload size limits, and every write is attributable to the user and the OAuth client.

## 4. Auth

OAuth 2.1 with dynamic client registration is what Claude's custom connectors and ChatGPT's connectors
expect. **Supabase Auth's OAuth 2.1 server** issues the tokens. We host the consent screen (`/oauth/consent`
on deno-web), and the API verifies the same Supabase JWTs it already verifies.
- **You need to:** enable *Authentication → OAuth Server* (and dynamic client registration) in the Supabase
  dashboard. It's a beta feature; there's no code-side switch.
- Spike first (docs/12 S1): connect from Claude Desktop, claude.ai and ChatGPT before building every tool.

## 5. Plans

| | Web (our AI) | Connect (your AI) |
|---|---|---|
| Who thinks | Deno (NIM) | your Claude/ChatGPT plan |
| Validations | quota A | larger quota B at a lower price (only collection costs us) |
| Content and posts | in-app generation | via MCP, gated by Deno |
| Video | n/a | via MCP; rendered on your machine; shown in Studio |
| Dashboard | ✓ | ✓, same one |

Prices are set later, as demand shows. Payments go through Dodo Payments (docs/15 §7).

## 6. Build order

1. **Auth spike + read tools** (`list_ideas`, `get_report`, `get_founder_context`): proves connectors work in
   Claude and ChatGPT. Needs the Supabase OAuth switch.
2. **BYO validation**: an `executor` column (migration), a collection-only job on the existing queue, the
   evidence/claims/finish tools, the deterministic quote check, and the dashboard badge.
3. **Content tools**: plan, drafts through the gates, calendar.
4. **Video tools**: `save_video` + Studio tab (docs/12).
5. **Connect plan + quotas** with Dodo Payments.

## 7. Risks

| Risk | Mitigation |
|---|---|
| Weaker client models write weaker claims | Claims must quote evidence verbatim (deterministic check); verdict computed by Deno; the report shows which model wrote it |
| Supabase OAuth server is beta / connector quirks | Spike first; fallback: a small OAuth facade in the API issuing our own tokens after Supabase login |
| ChatGPT connector support for write actions depends on the user's ChatGPT plan/mode | Read tools work everywhere; document which plans can write; Claude is the primary client |
| Abuse (free collection runs) | Per-plan quotas, rate limits, daily source caps (already in `deno_sources`) |
