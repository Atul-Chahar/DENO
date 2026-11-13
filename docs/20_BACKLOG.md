# 20 — Backlog: fixes agreed with Atul (2026-11-13)

Found while testing the full founder flow (setup → validate Deno itself → first Studio film). Atul decided:
**finish the first Deno film first, then fix all of these.** Run `/backlog` in Claude Code to see this list.
Tick items here (and in `docs/17_HANDOFF.md`) as they ship.

## 1. One-step setup (the founder should never open a terminal)
What went wrong in the test: the founder had to type `/plugin` commands, `studio doctor --install` and
`studio login` themselves, and `studio` isn't on their own terminal's PATH ("command not found"; the plugin puts
it only on Claude's PATH).
- [ ] A one-line **setup prompt** the founder pastes into Claude Code ("Set up Deno Studio from
      github.com/Atul-Chahar/DENO"). Claude runs `claude plugin marketplace add Atul-Chahar/DENO` and
      `claude plugin install deno-studio@deno` itself (both exist as CLI commands), then asks for a new session.
- [ ] Skills' step 0 + plugin preamble: **Claude** runs `studio doctor --install` and `studio login`; the founder
      only clicks Allow in the browser. Never tell the founder to run a command.
- [ ] Kit installs the render engine automatically on first `render`/`sheet`/`verify` (captions, voice and matte
      already install on first use).
- [ ] `plugin/README.md`: remove "in a terminal: `studio …`"; show the setup prompt instead.
- [ ] A "Copy this prompt" box on the Studio page (`/app/studio`) and in onboarding.
- [ ] Two sign-ins today (the plugin's MCP OAuth and `studio login`): make the kit's login happen on first upload
      at the latest, and explain it in one line; look at sharing one sign-in.

## 2. Validation through the founder's own Claude (BYO, docs/16 phase 2)
Today `validate_idea` runs the whole pipeline on **our** server and NIM budget (~28 LLM calls). The plan: the
founder's AI does the thinking, Deno only collects evidence, checks quotes and computes the verdict.
- [ ] Tools: `start_validation(idea, brief, queries)`, `get_evidence(run_id, analyst)`,
      `submit_claims(run_id, analyst, claims[])`, `finish_validation(run_id, rationale)`.
- [ ] Collection + ingest-only job on the run line; deterministic quote check; verdict by Deno's code.
- [ ] Additive migration: `validation_runs.executor` (`server` | `client`) + `client_name`; "via Claude" badge.
- [ ] A plugin skill `validate` that drives it.

## 3. Validation engine quality
From validating Deno itself (run `01a1d416-67a8…`, verdict kill 0.78):
- [ ] **Duplicate claims:** the same competitor (Validationly, IdeaKiln, Starts Club) became several "refutes"
      claims across analysts; 14 refuting ≈ 6 competitors. Merge claims per competitor/source before counting.
- [ ] **Builders vs buyers:** most evidence was "Show HN" launch posts by makers, not people with the problem.
      Weight buyer pain and willingness-to-pay above maker launches.
- [ ] **Judge the whole idea:** it scored "validate from Reddit/HN" (crowded) and ignored the differentiator
      (launch content + videos by the founder's own Claude). Planner should cover every part of the idea.
- [ ] **Source concentration** (0.72 here, mostly HN): flag low diversity in the rationale.

## 4. Video output quality (docs/18 §16 + the captions-reel guide)
- [ ] §16.3 items 1–8: centred motion-blur shutter in `render.mjs`, deeper TREATMENT template, revisions as
      rules, typography craft rules, `studio sheet --cuts`, default GUIDE.md, word/beat anchoring, audio envelopes.
- [ ] Word timings: snap Whisper word starts to the audio onset (Whisper starts ~0.1 s early) in
      `studio captions` / `studio voice`.
- [ ] Sharper person cut-out: BiRefNet-portrait as an option for `studio matte` (hair and hood edges).
- [ ] Layered 2.5D camera across back / text-behind / person / text-in-front in `lib/footage.js`.
- [ ] Optional WebGL layer (§16.3 item 9) only if a founder needs that look.

## 5. Post creation quality
- [ ] Audit real outputs of `create_content_plan` / `save_draft` and the web generator against the gates; list
      what still reads as AI; tighten the content graph prompts and gates. (Details to be filled in when we
      start this.)

## 6. Small bugs found
- [ ] `set_brand_kit` from the website picked DM Serif Display as the **body** font; Deno's body is Schibsted
      Grotesk (`web/styles/base.css`).
- [ ] `npm warn install-scripts` lines during `studio doctor --install` look alarming; hide them or say they're
      harmless.
