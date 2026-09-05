# Deno — Platform Rules & Community Knowledge Graph

## 1. Multi-Platform Compliance Architecture

To guarantee that Deno users are never banned, the system maintains strict deterministic rule compliance across target platforms:

### A. Reddit
* **LLM Spam Classifier (July 2026 update):** Flags repetitive syntactic cadence, uniform sentence lengths, and cross-account phrasing.
* **ToS Rule:** Automated posting is strictly banned; human-send only.
* **Self-Promotion Ratio:** Strict 9:1 value-to-promo rule (at least 9 value/teardown/resource posts per 1 promotional mention).
* **Karma & Account Age Gates:** Verified before recommending a subreddit.
* **Flair Enforcement:** Auto-assigns required flairs (`Case Study`, `Discussion`, `Critique`).

### B. LinkedIn
* **Slop Reporting Button (July 2026):** Viewer report flags reduce organic distribution by ~40%.
* **Link in First Comment:** Outbound links in the post body trigger a severe algorithmic reach penalty (up to 60% drop). Deno automatically moves destination URLs to the designated "First Comment" field.
* **Post Length:** Optimized for 900–1,300 characters to maximize "see more" dwell time without triggering scroll abandonment.
* **Threaded Comment Flattening:** Generates replies compatible with LinkedIn's 2-level comment depth.

### C. X (Twitter)
* **Outbound Link Suppression:** Links reduce impression velocity unless paired with engaging media or long-form value threads.
* **Hook Line Fold:** First 2 lines must trigger tap-through before the 280-char / fold break.

---

## 2. Seed Community Knowledge Graph (Initial 30 Communities)

| Platform | Community | Niche / Audience | Karma Gate | Self-Promo Rule | AI Content Stance | Max Frequency |
|---|---|---|---|---|---|---|
| Reddit | `r/SaaS` | B2B SaaS Founders | 50 karma, 14 days | Sundays only / 9:1 value | Zero tolerance for raw AI | 1 post / 4 days |
| Reddit | `r/SideProject` | Indie Hackers & Builders | 10 karma, 7 days | Direct demo allowed with story | No low-effort synthetic | 1 post / 7 days |
| Reddit | `r/startups` | Growth & Venture Startups | 100 comment karma | Strict: Feedback thread only | Instant permanent ban | 1 post / 14 days |
| Reddit | `r/Entrepreneur` | Small Business & Solopreneurs | 10 karma | Case studies allowed (no links in post) | Heavily flagged | 1 post / 5 days |
| Reddit | `r/webdev` | Technical Builders | 30 karma, 30 days | Showoff Saturday only | Technical substance required | 1 post / 7 days |
| Reddit | `r/microSaaS` | Micro & Solo SaaS | 10 karma | Open with verified metrics | Authentic discussions only | 1 post / 3 days |
| Reddit | `r/ProductHunters` | Launch Audiences | 5 karma | Launch announcements allowed | Allowed with real author | 1 post / 2 days |
| Reddit | `r/indiehackers` | Bootstrapped Founders | 20 karma | Open build-in-public | AI flagged by community | 1 post / 3 days |
| LinkedIn | `B2B Founders Network` | B2B Executives & Angels | N/A | Link in 1st comment; 1,100 chars | High sensitivity to buzzwords | 3 posts / week |
| LinkedIn | `SaaS Growth & Marketing` | VPs of Marketing & Product | N/A | High-density case studies | Slop-filter active | 2 posts / week |
| X | `#buildinpublic` | Early tech adopters | N/A | Value threads; odd numbers | High velocity | 1-2 posts / day |
| X | `#indiehackers` | Solopreneurs | N/A | Transparent revenue / metrics | Prefers concise bullets | 1 post / day |
