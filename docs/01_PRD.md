# Deno — Product Requirements Document (PRD)

**Version:** 1.0 (2026 Edition)  
**Workspace:** Deno Founder GTM Workspace  
**Status:** In Progress (Backend Backbone Phase)

---

## 1. Product Goal

Create a founder go-to-market workspace that converts a raw startup idea into a grounded, sourced viability verdict and a publish-ready, voice-matched, platform-safe content plan for acquiring first users through free channels.

---

## 2. Core Value Proposition

> **"Deno tells you if your idea is worth building — then gives you everything you need to get your first users, for free channels, in your own voice, without getting banned."**

Building has never been cheaper; distribution on free channels (Reddit, X, LinkedIn) is the only viable path for unfunded builders. However, 2026 platform moderation (specifically Reddit's LLM spam detection blocking ~25k spam posts daily and LinkedIn's AI-slop reporting filter) aggressively punishes generic AI writing. Deno solves this by providing:
1. Grounded multi-agent idea validation with clickable sources (Free Tier).
2. Anti-slop, stylometrically matched, platform-safe distribution engine with Ban Risk Scoring (Paid Tier ~$20/mo).
3. Strict human-send publishing model (Deno never auto-posts).

---

## 3. Feature Priorities

| Feature | Priority | Phase |
|---|---|---|
| Idea intake (Text or URL) | Must | Phase 1 |
| Multi-agent validation pipeline (8-15 agents) | Must | Phase 1 |
| Grounded evidence and source ledger | Must | Phase 1 |
| Build / Pivot / Kill verdict + confidence | Must | Phase 1 |
| Community discovery and rules mapping (30+ subreddits) | Must | Phase 1 |
| Voice fingerprint capture & stylometry | Must | Phase 2 |
| Founder Story Bank (receipts, scars, metrics) | Must | Phase 2 |
| Anti-Slop Scrubber (Peter Yang 18 patterns) | Must | Phase 2 |
| 2026 Vocabulary & Tell Scorer (Serge Bulaev heuristics) | Must | Phase 2 |
| Ban Risk Score (0–100) with itemized deductions | Must | Phase 2 |
| 30-Day Content calendar generation | Must | Phase 2 |
| Text post generation (Reddit, X, LinkedIn) | Must | Phase 2 |
| Human-send-only publishing flow | Must | Phase 2 |
| Hook library (20 proven 2026 formulas) | Should | Phase 3 |
| Post image & card layout specs | Should | Phase 3 |
| Short-form video scripts (Reels/Shorts/TikTok) | Should | Phase 3 |
| Reply and comment drafts | Should | Phase 3 |
| Traction dashboard & attribution | Could | Phase 4 |
| Engagement learning loop (Thompson sampling) | Could | Phase 4 |
| Team workspaces & API | Won't (v1) | Later |

---

## 4. User Stories & Acceptance Criteria

### US-001: Idea Intake
* As a founder, I want to submit my idea in one input so that I can get a verdict without filling tedious forms.
* **Criteria:** Unique project ID generated; accepts raw text or product URL; starts in `DRAFT` status; zero typing beyond the idea.

### US-002: Multi-Agent Validation Pipeline
* As a founder, I want a multi-agent analysis so the verdict reflects multiple independent perspectives.
* **Criteria:** Intake, Market, Sizing, and Risk agents run concurrently; Critic agent operates independently and adversarially; bounded Critic ↔ Refiner loop (max 3 iterations); partial agent failure degrades gracefully without crashing the pipeline.

### US-003: Grounded Evidence & Source Ledger
* As a founder, I want every claim linked to its source so I know the analysis isn't hallucinated.
* **Criteria:** Competitor claims, market figures, and pain points carry clickable URLs with retrieval timestamps; claims without retrievable sources are omitted, never guessed.

### US-004: Build / Pivot / Kill Verdict
* As a founder, I want an unambiguous Build, Pivot, or Kill verdict with calibrated confidence.
* **Criteria:** Verdict is one of `BUILD`, `PIVOT`, `KILL`; displays 0-100% confidence; lists top 3 supporting arguments.

### US-005: Community Discovery & Rules Mapping
* As a founder, I want to know the exact communities where my users gather.
* **Criteria:** 5–10 specific subreddits and X/LinkedIn communities returned with size, AI policy, promo ratio, karma/age gates, and rule refresh dates.

### US-006: Voice Fingerprint & Story Bank
* As a founder, I want the system to learn my voice and authentic background effortlessly.
* **Criteria:** Built from public social handle or tap-only style presets; extracts numeric stylometric fingerprint (Burrows' Delta, function words, variance); populates Story Bank with founder metrics, turning points, and scars.

### US-007: 30-Day Content Calendar
* As a founder, I want a full 30-day content calendar pre-planned for my target communities.
* **Criteria:** Platform-specific post archetypes (breakdown, teardown, build-in-public, AMA); irregular cadence respecting frequency caps; 9:1 value-to-promo ratio.

### US-008: Voice-Matched Generation
* As a founder, I want posts to sound like me, not generic ChatGPT.
* **Criteria:** Measurable stylometric distance score; content regenerated if exceeding distance threshold up to bounded cap.

### US-009: Ban Risk Score & Anti-Slop Audit
* As a founder, I want a risk score before posting so my account is never banned.
* **Criteria:** Ban Risk Score (0–100); itemized deductions covering the 18 anti-slop patterns, 2026 density markers, and community rule conflicts; actionable suggested fixes for every deduction.

### US-010: Human-Send-Only Publishing
* As a founder, I want full compliance with platform terms of service.
* **Criteria:** Zero automated posting; one-click copy and deep links to platforms; platform compliance statement displayed.

---

## 5. Lifecycles & State Transitions

* **Project Lifecycle:**
  `DRAFT → VALIDATING → VALIDATED → VOICE_READY → CONTENT_READY → PUBLISHING → TRACKED`  
  *(Failure states: `VALIDATION_FAILED`, `VOICE_CAPTURE_FAILED`, `GENERATION_FAILED`)*
* **Asset Lifecycle:**
  `GENERATED → SCORED → NEEDS_REVISION → APPROVED → PUBLISHED`  
  *(Failure state: `BLOCKED` on hard community rule violation)*
