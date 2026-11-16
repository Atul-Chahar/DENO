# 21 — Website redesign: "your AI edits your marketing"

Status: **built 2026-11-16** (branch `feat/site-mcp-studio-redesign`). The site now sells what the product became
after the MCP server (docs/16) and the Creation Studio (docs/18): the founder's own AI writes and edits their
marketing content through Deno.

Design canvas (Claude Design, private to Atul): https://claude.ai/artifact/DZP7Bn92PC87JRfXCMi5DB
(four artboards: landing, pricing, dashboard home, docs quickstart). Atul approved it on 2026-11-16 and asked for
one addition: a single prompt a founder can paste into any AI agent so the agent does the setup.

## 1. Why
The old landing page said "Know if it's worth building" and "Free while in beta". It never mentioned the MCP
server, Studio or Claude, there was no pricing ladder, and there were no public docs. A founder could not learn
how to connect their AI without reading the repository.

## 2. Goals, non-goals, anti-goals
- **Goals:** lead with editing marketing content inside the founder's AI; make setup a one-paste job; show a
  price ladder that moves free users to Studio; ship docs that both people and AI tools can read.
- **Non-goals:** checkout (Razorpay comes next, see §7); enforcing the new plan limits; changing the API.
- **Anti-goals:** gradients, emoji, fake logos, invented stats or testimonials, anything that reads as AI-made.

## 3. Approaches considered
1. **Patch the old landing page** (add an MCP section). Cheapest, but the headline would still sell validation,
   which is no longer the main feature.
2. **New visual identity.** Rejected: the existing system (paper, ink, lime, hard edges, 1.5px rules) already
   looks hand-designed, and CLAUDE.md makes it a hard rule.
3. **Rewrite the pages on the existing design system (chosen).** New story, same tokens and primitives
   (`.btn`, `.tag`, `.display`, `.panel`, `.brand`), new section classes in `web/styles/site.css`.

## 4. What was built
| Piece | Where |
|---|---|
| Landing page | `web/app/(marketing)/page.tsx`: hero ("Edit your marketing by talking to your AI"), chat + review mock, how it works, formats, "your AI alone vs + Deno", validation as "where the proof comes from", "we don't sell AI credits", setup, pricing teaser, FAQ |
| Pricing page | `web/app/(marketing)/pricing/page.tsx`, `web/components/landing/PricingPlans.tsx`, data in `web/lib/plans.ts` |
| Docs | `/docs` and `/docs/<slug>` (21 pages) from `web/lib/docs/content.ts`; renderer `web/components/docs/DocBlocks.tsx` |
| For AI tools | `/llms.txt`, `/llms-full.txt`, `/md/<slug>` (one page as Markdown), `/setup-prompt.txt`; renderer `web/lib/docs/markdown.ts` |
| Setup prompt | `SETUP_PROMPT` in `web/lib/site.ts`; shown on the landing page, the quickstart and the dashboard home with a copy button |
| Dashboard home | `/app/home` (`web/components/workspace/Home.tsx`, `web/styles/home.css`): AI apps in use, the Deno address, the setup prompt, what waits for review, prompts to copy, plan usage, "what your AI did". It is now where sign-in lands (`safeNext` fallback). The old workspace stays at `/app`. |
| Styles | `web/styles/site.css` (marketing + docs), `web/styles/home.css`. Flat colour only. |

**One source for the docs.** `content.ts` holds every page as typed blocks. The same data renders the web pages,
the Markdown routes and the two llms files, so they cannot drift apart. `web/lib/docs/tools.ts` mirrors the 19
tools and 5 prompts in `apps/api/src/deno_api/mcp_server.py`: **update it when a tool changes.**

**The dashboard home uses data that already exists.** "In use" for an AI app means a validation run or a Studio
item carries that `client_name`. There is no list of OAuth grants yet, so an app that connected but saved nothing
shows as "Not used yet".

## 5. Pricing (proposal, shown on the site)
| Plan | Monthly | Yearly, per month | For |
|---|---|---|---|
| Free | $0 | $0 | Trying the whole loop once |
| Launch | $29 | $24 | Posts only |
| **Studio** (most popular) | $49 | $39 | Posts, videos, carousels |
| Agency | $149 | $119 | 5 brands, 5 seats |

Reasoning:
- **Launch is the decoy.** For $15 more, Studio adds every video feature, so Studio is the obvious pick.
- **Agency is the anchor.** $39 reads as small next to $119.
- **Yearly is preselected**, shown per month, with the saving in dollars ("2 months free").
- **"We don't sell AI credits"** is the positioning from docs/14: the founder's AI plan thinks and their machine
  renders, so our marginal cost per video is close to zero and a flat price is honest.
- **Founding price** for the first 200 paying founders. No seat counter is shown until checkout exists and the
  count is real (docs/14: no fake scarcity).
- **Launch Kit** (done with you) is a mailto for now: no price on the page.

## 6. What the site promises that the product does not do yet
Be careful: these are on the pricing page as plan features.
1. **Plan limits other than Free's.** Free shows today's real quotas (5 validations, 1 content plan, 200 copy
   checks). Launch, Studio and Agency limits are not in the `Quota` table.
2. **"1 Studio project, up to 3 versions" on Free** and **the Deno mark on Free videos**: not enforced.
3. **Agency:** 5 brands, 5 seats, client review links, front of the run line. None exist.
4. **"14-day money back", "cancel in two clicks":** policy promises that checkout must honour.
5. **Cursor and ChatGPT setup steps** are the standard remote-MCP steps; not tested against our server.

## 7. Next
1. **Razorpay checkout** (Atul will send the details; this replaces the Dodo Payments plan). Wire the plan
   buttons (`planHref` in `web/lib/plans.ts` already passes `?plan=`), add the plans to the `Quota` table, and
   replace the Stripe code in `apps/api/src/deno_api/v1/billing.py`.
2. Enforce or drop the items in §6.
3. A real "connected apps" list from the OAuth grants.
4. Remove the old landing sections' CSS that nothing uses now (`web/styles/landing.css`: hero-strip, walls,
   deepdive, riskband, receipts, mega-menu).
