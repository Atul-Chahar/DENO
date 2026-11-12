# 14 — How Pocket CD makes money on $49/month, and Deno's pricing plan

Status: **proposal, 2026-11-12**. Companion to docs/12 (Studio MCP plan) and docs/13 (video research).
Source: pocketcd.com, read on 2026-11-12 from its own page copy, pricing config and Terms. The site is a
client-side app, so the numbers below come from the shipped JavaScript bundle (`door.config`, `Product`,
`Packages`, `Terms` chunks), not from marketing summaries. The founder is Johannes Forseth.

---

## 1. What Pocket CD is

> "The Pocket Creative Director… Studio-quality videos at the speed of a conversation… right inside the apps
> you already use."

- **A system, not a hosted service.** In the Terms' words: "a folder of files, skills, laws and styles that teach
  Claude Code how to edit inside the applications you already own. There is no hosted editing service and nothing
  renders on my machines."
- **Plus a Mac app** that sits on top of the editor:
  - Chat that drives **Premiere Pro, DaVinci Resolve Studio, After Effects, Blender** (and Remotion).
  - **"Notes on the frame":** pause, draw a ring, write a note; Claude answers under it, and the next version
    plays with the fix.
  - **"Draw over anything":** an overlay on top of Resolve; say "add a notification here" and draw an arrow.
  - **A Board:** a canvas of references, clips and notes ("boards inside boards"); "Recreate these" turns dropped
    references into Blender/AE recreations.
  - **Script in my voice:** it first asks what you tell your editors, then writes.
  - **Taste memory:** "What you taught it, per craft, in your words. Every chat is linked to what it made."
  - **"The laws, readable":** every editing rule in plain words. "Strike out the ones you disagree with and they
    stop binding, all but the few at its core."
  - **A library:** "Every look and move is saved automatically"; **38 styles**.
- **Requirements, stated honestly:** a Mac with Apple silicon, **your own Claude or ChatGPT plan** ("token heavy
  by design, so a basic plan will frustrate you"), a paid editor (free Resolve can't be scripted), and an
  optional ElevenLabs key for word timing.
- **Positioning lines:**
  - "Most AI video tools sell you credits. Pocket CD doesn't sell AI."
  - "One set price for the app, the system and the instructions. The AI runs on the plan you already have."
  - "Everyone will have the same AI. Nobody has your taste."
  - "Pocket CD doesn't make the video for you. It helps you make yours."
  - "You record. It edits. You give the notes."

## 2. The price ladder (from the live config)

| Rung | Price | What you get | Purpose |
|---|---|---|---|
| Free | $0 | Weekly YouTube tutorials ("every week I show how I make mine"), Instagram, the manifesto | Top of funnel; founder-led content |
| Lead magnet | $0, **5 per week** | "Send me your last video. I tell you what I would change first." | Qualifies and warms leads |
| **Pocket CD app** | **$49/month or $490/year** ("2 months free"); the yearly plan includes a **30-min onboarding call** | App + system + styles + updates; BYO AI plan | Main self-serve product |
| Self-serve system licence (earlier door) | **$249 setup + $75/month** (or $750/year); first month free; founding price locked; 38 styles; a 30-min call | Files + skills + styles + updates + community vault | Higher-ticket self-serve; an older page shows a "$799 + $75" founding variant |
| Course "Signature Edit" | **$500**, 6-week cohort, includes 3 months of the system | "Find your look. Write it down. Use it on every video." | Teaches the taste the system then encodes |
| "Work with me" install | **$3,000 founding (5 seats), then $5,000**; 2 per month; 90 days of the system | A custom system built with you: 10 taste videos, Loom reviews, 48-h replies | High-ticket, done-with-you |
| Coming later | "The Season", custom system builds | n/a | Further upsell |

**Sales mechanics:**
- **Scarcity is real and hand-updated** ("Seat counts on this page are real and updated by hand").
- **A qualifying application** for the install: post weekly? Who edits today and what does it cost you? What do
  you sell and what does it bring in? 3 h/week for 30 days? Able to invest now? People who don't post weekly are
  turned away to the free videos.
- **No refunds** on the digital licence (EU/UK withdrawal waived at checkout); "the monthly can be stopped any
  time, which is the real safety net".
- The course price **counts toward** the install, so each rung upsells the next.
- Lifecycle: the app locks when the membership lapses, with 14 days of grace on a failed payment.

## 3. Why $49/month is profitable

**The core trick: he sells taste and process, not compute.**

| Cost line | Who pays |
|---|---|
| LLM tokens (the heavy part) | **The customer's** Claude/ChatGPT plan |
| Rendering | **The customer's** Mac + editing app |
| Voice/word timing | The customer's ElevenLabs key (optional) |
| Storage of footage, renders, styles | The customer's disk ("never uploaded to me") |
| Payments, VAT/sales tax worldwide | **Stripe Managed Payments as merchant of record**: Stripe is the seller and remits tax |
| Licence checks | Cloudflare Workers KV (licence record + a *hash* of the key) |
| Release downloads | Cloudflare R2 |
| Email | Resend (welcome, magic links, 2 onboarding follow-ups) |
| Analytics | None ("No analytics, no tracking") |

So the marginal cost per subscriber is roughly payment fees plus pennies of Cloudflare/Resend. Gross margin is
probably **≥ 90%** (an estimate: Stripe's processing + Managed Payments fees are the only meaningful variable
cost; check current rates). There is one employee. Revenue scales with subscribers; costs barely move.

**What is actually being sold:**
1. **Codified craft:** the "laws" (editing rules in plain words), 38 styles, skills, and the workflow gates
   ("you approve every gate").
2. **Personal taste capture:** a memory of what you taught it, per craft.
3. **A better review surface** than a chat box (draw on frame, overlay, board).
4. **Updates:** "the growing style vault". This is what the monthly fee pays for, and it's why cancelling hurts.
5. **Access to the founder:** calls, cohort, install. This is where the big tickets are.

## 4. What Deno should copy, adapt or avoid

### Copy
1. **"We don't sell AI."** The Studio MCP is already designed so the founder's Claude does the thinking
   (docs/12 §0). Say it the same way: *no credits for video thinking; one flat price.*
2. **Push compute to the customer where possible.** docs/12 put all rendering on our Cloud Run. Change:
   - **Claude Code / desktop users render locally** through our Studio plugin (renderer + checks run on their
     machine). This is the Pocket CD model, and it costs us nothing.
   - **claude.ai users** (no shell) get **hosted renders**, metered with a monthly allowance. That is the one
     compute line we pay for, so cap previews.
3. **Readable, editable rules.** Expose our playbooks and house rules (docs/13 §4) as a "Rulebook" page where the
   founder can strike rules they disagree with, except core ones (the determinism contract, licensing, honesty
   gates). This doubles as transparency and a moat.
4. **Taste memory.** Every review note, tag and struck rule becomes per-founder taste data that Claude reads
   (`get_founder_context` → `taste`). "Everyone will have the same AI; nobody has your taste" also fits Deno's
   voice/Story Bank pitch for text.
5. **Draw on the frame.** This is already in our review-player plan (spatial pins, docs/13 §14.1). Pocket CD shows
   it's a headline feature, not a nice-to-have.
6. **The price ladder + founder-led funnel:**
   - **Free:** one validation + Ban Risk audits + a Studio taste (1 watermarked preview). This is our lead magnet,
     equivalent to "send me your last video".
   - **Pro $49/month or $490/year** (yearly gets an onboarding call). Self-serve.
   - **Launch Kit (done-with-you), $1.5–3k founding, then higher; 2–4 per month.** We validate the idea, build
     the 14-day plan and make the launch video with the founder, using our own product. Application-gated.
   - Later: a cohort/course ("Validate and launch in 30 days") that counts toward the Launch Kit.
7. **Stripe Managed Payments (merchant of record)** so global VAT/GST is handled for us. Check that it's available
   to our business entity and country before relying on it; otherwise use Paddle/Lemon Squeezy as the MoR.
8. **Honest requirements copy:** "Studio needs a paid Claude plan; video work is token-heavy; Pro/Max
   recommended."
9. **Real scarcity, hand-updated,** for founding seats and Launch Kit slots. No fake timers.
10. **Dogfood as marketing:** weekly posts of videos made with Deno Studio, including our own launch video.

### Adapt
- Pocket CD is a **local product** (Mac app, files on disk). Deno is a **web product + MCP**. Our equivalent of
  "files on your disk" is the founder's project data in our DB, which we must protect (RLS already) and must let
  them export (we have `/me/export`).
- He licenses files (no-share terms). We license **access** (an MCP gated by OAuth + plan). That's easier to
  enforce, and the library stays server-side, which matters for the licensed assets in docs/13 §10.

### Avoid
- **No-refund terms** for a SaaS subscription with hosted parts. EU/UK and many markets expect cancellation
  rights; a first month free or cancel-any-time is the safety net instead.
- **Mac-only.** Our web + MCP route works everywhere Claude works.

## 5. Deno's unit economics (estimate, to be validated)

Assumptions are marked; replace them with measured numbers from spike S3 (docs/12 §5).

| Cost per Pro user / month | Driver | Estimate |
|---|---|---|
| Validation runs (our LLMs) | Today on NVIDIA NIM (free, 40 rpm); in production on Bedrock/Anthropic credits | **The biggest variable.** Measure tokens per run; cap runs per month in Pro |
| Content plans (our LLMs) | Briefs + drafts + judge (+ PR #14's quality loop) | Second biggest. Keep regeneration capped (see docs/12 §6 on #14) |
| Studio thinking | The founder's Claude plan | **$0 to us** |
| Hosted renders (claude.ai users only) | Cloud Run CPU: ~$0.000024/vCPU-s + ~$0.0000025/GiB-s (tier-1 list price; verify) | *Assume* 4 vCPU/8 GiB rendering at 1–3× real time: a 30 s 1080p film ≈ 30–90 s ≈ **$0.02–0.05 per render**. With ~10 previews per finished video, **~$0.25–0.50 per video** |
| Local renders (Claude Code users) | Their machine | $0 |
| Storage (renders, assets) | Supabase Storage/R2 | Pennies; expire previews after 30 days |
| Music (Epidemic API) | Partner pricing | Unknown; get a quote before promising licensed music in Pro |
| Payments + tax | MoR fees | A few % of revenue |

**Rule of thumb:** at $49/month, Studio's hosted video cost is small if previews are capped. **Text-side LLM
calls are what can eat the margin.** So:
- Pro quotas must be set from measured cost per validation run and per content plan.
- Studio adds hosted render-minutes as a fair-use allowance (e.g. 60 preview-minutes + 10 final-minutes/month),
  with top-up packs above it.

## 6. Changes to docs/12

1. **Pricing (§0, §3.7):** Pro = **$49/month / $490/year**, flat, "no AI credits". It includes the text studio
   within quotas, the Studio MCP, local rendering via the plugin, and a hosted render allowance for claude.ai
   users. Free tier as above. Launch Kit as a done-with-you service.
2. **Rendering (§3.5):** add a **local render path** (a Claude Code plugin/skill bundling renderer + checks) as
   the default for shell-capable clients; hosted rendering is the fallback and is metered.
3. **New features:** Rulebook (strikeable rules), taste memory, draw-on-frame (already planned).
4. **Payments:** Stripe in MoR mode (or Paddle) instead of plain Stripe Checkout; it handles tax.
5. **Go-to-market:** founder-led weekly content made with the product; real founding-seat scarcity;
   application-gated Launch Kit.

## 7. Open questions for Atul

1. Price point: $49 like Pocket CD, or lower ($29) for indie founders, with $49 as a "Studio" tier?
2. Will you run the done-with-you Launch Kit yourself (time cost), and at what price?
3. Is Stripe Managed Payments available to your business entity? If not: Paddle or Lemon Squeezy?
4. Production LLM provider and cost per validation run (needed before setting Pro quotas).
