# 19 — Many users at once (demo day, a classroom on one Wi-Fi)

What happens when 30–50 people sign up and press "Run validation" within a few minutes, all from the same
network (one public IP address), and what was built so nothing falls over.

## 1. Where it could break, and what handles it now
| Pressure point | Risk | Handled by |
|---|---|---|
| **NVIDIA NIM: one key, 40 calls/min** shared by every run | A run uses that budget for ~4 min alone. 30 at once → each gets ~1 call/min, all run out of hand-offs, **all fail** | **Fair run line** (`deno_core/runqueue.py`): `RUN_QUEUE_CAPACITY` (2) runs per key execute; the rest wait first-come, first-served, and see "2 ahead of you · about 4 min · you can close this tab". Web, MCP (`get_validation` → `queue_position`) and kit all see it |
| Line grows without bound | People wait hours with no idea | At `RUN_QUEUE_MAX_WAITING` (60) waiting, a new run gets a clear 503: "Deno is very busy: N waiting. Try again in about M min; your idea is saved". Pressing Run again reuses the saved idea |
| Throughput | ~15 validations/hour per NIM key, whatever the code does | `NVIDIA_NIM_EXTRA_API_KEYS`: each extra key adds its own 40/min budget and line capacity |
| A run crashes while holding a slot | Line stuck | Slots are leases (budget + 150 s); a dead run's slot frees itself. A run nobody asks about for 3 min drops out of line. Cancelling a waiting run removes it |
| Redis (Upstash) down | Line can't be read | Fails **open**: runs execute as before (same policy as the API limiters) |
| API rate limits | Shared IP blocks everyone | Our limits are **per user**, never per IP (API 60/min, MCP 120 reads + 30 writes/min, media 60/h) |
| One user hogging | Starts 10 runs | Free plan: 1 run at a time, 5 a month (`quotas` table) |
| **Supabase Auth per-IP limits** | 30 sign-ins / 5 min **per IP**: a room on one Wi-Fi hits it in seconds | **Dashboard setting** (§2). The sign-in page now says what happened and offers Google |
| **Supabase email sending** | Built-in SMTP sends only a few emails an hour (and only to team members' addresses), and email confirmation is on: email sign-ups fail | **Dashboard setting** (§2): custom SMTP, or everyone uses Continue with Google (sends no email) |
| Google sign-in in "Testing" mode | Only listed test users can sign in | **Google Cloud setting** (§2) |

## 2. Settings only the owner can change (before the demo)
1. **Supabase → Authentication → Rate Limits** (project `bfinvyflanpjfzlisspq`): raise per-IP limits for a room
   on one IP: *Sign-ups and sign-ins* → 300 per 5 min; *Token refreshes* → 1000 per 5 min; *Token
   verifications* → 300 per 5 min. Lower them again after the event.
2. **Email:** either
   - **Custom SMTP** (recommended, keeps email confirmation): Supabase → Authentication → Emails → SMTP
     Settings, with a free sender such as Resend (100 emails/day). Then raise *Emails sent* in Rate Limits; or
   - tell everyone to use **Continue with Google** (no email is sent).
   Don't switch off "Confirm email" for a public demo: anyone could sign up as any address.
3. **Google Cloud Console → APIs & Services → OAuth consent screen:** publishing status must be **In
   production**, not *Testing* (Testing allows only the test users you listed).
4. **Optional, more throughput:** add `NVIDIA_NIM_EXTRA_API_KEYS` in Vercel → `deno-api` → Settings →
   Environment Variables (production), then redeploy. Only keys you're allowed to use.

## 3. On the day
- 30 minutes before: run one validation yourself (warms the functions and checks NIM is up:
  `curl https://deno-api-swart.vercel.app/readyz`).
- Keep one finished validation open to show while people's runs wait their turn.
- Tell people: sign in with Google, press Run once, and the page shows their place in line; closing the tab is
  fine, the result appears on their dashboard.
- Watch: `npx --yes vercel@65.14.0 logs --deployment deno-api-swart.vercel.app --since 30m --json | grep queue_run`
  (`queue_run_waiting` with positions, `queue_run_handoff`, `queue_run_too_many_handoffs`).
