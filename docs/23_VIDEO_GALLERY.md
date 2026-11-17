# 23 — Public video gallery (`/videos`)

Built 2026-11-17 on branch `feat/video-gallery`. Idea from Atul: a place where AI-made videos are shown with
their prompts, like claudevideo.org and skillry.dev/ai-videos, so people find Deno through search and can tell
their AI "make me one like this".

## 1. Is it a good idea?

Yes, with one caveat.

- **Why it fits us:** both reference sites are lists of other people's X posts with the prompt next to them. They
  stop at "here is a prompt". We can go one step further: every entry names a Deno **format** (recipe) and
  **style**, so "make one like this" is a prompt that really works once Deno is connected.
- **The caveat:** those sites rank because they list 400 to 1,200 videos. We start with none. So the gallery is
  built to be useful and indexable **before** the first video: 14 format pages, each with its shot plan and a
  copyable prompt. Videos add to that when they exist.

## 2. What was built

| Piece | Where |
|---|---|
| Gallery home | `/videos` (`web/app/(marketing)/videos/page.tsx`): videos, 14 formats, 8 styles |
| Format page | `/videos/formats/<slug>`: what each second is for, frame, length, style, the prompt with a copy button, what the AI needs first, videos made with it |
| Video page | `/videos/<slug>`: player, maker credit, the maker's prompt, a "make one like this" prompt, schema.org data |
| Publish page | `/videos/submit`: three steps, a form that opens pre-filled as a GitHub issue or an email, the rules |
| Data | `web/lib/gallery/formats.json` (**generated** by `scripts/build_plugin.py` from the Studio recipes and styles; `--check` covers it), `web/lib/gallery/videos.ts` (the list of videos; empty today) |
| Search basics | `web/app/sitemap.ts` and `web/app/robots.ts`. The site had neither. The sitemap lists the landing page, pricing, docs, formats and videos; robots keeps the dashboard and sign-in out. |
| Navigation | "Videos" in the header, "Video gallery" in the footer |
| CSP | `img-src` allows `https://i.ytimg.com` (YouTube thumbnails) |

**Deno never hosts a video.** An entry is a link. YouTube and Vimeo links play on the page (the CSP already
allowed those two players); X and LinkedIn links open the original post.

## 3. How to publish a video (today)

Add an entry to `web/lib/gallery/videos.ts` (the type documents every field) and open a PR. Submissions arrive
as GitHub issues or emails from `/videos/submit`; a person checks each one.

**Community entries** (decided by Atul, 2026-11-17): the gallery also lists public posts of AI-made videos, the
way claudevideo.org and skillry.dev do. Rules:
- `madeWithDeno: false` (shown as "Community"); credit the maker by their display name and profile; `url` is
  their original post. Every community video page and the gallery heading say how to ask for removal (`/takedown`).
  Remove an entry as soon as its maker asks.
- `title` and `summary` are our own words, never the maker's post text.
- `prompt` (shown in full with a copy button) only when the maker invited reuse: an open licence, or a post that
  says "use this prompt". Otherwise set `promptUrl` to where they posted it; the page shows "Read the maker's
  prompt ↗". The PROMPT tag on a card means either field is set.
- `model` and `app` are what the maker's post says. `app` is optional; leave it out when the post names no tool.
- Skip anything unsafe for a marketing site, anything using media the maker plainly does not own, anything
  behind a login.

**First batch (2026-11-17): 28 entries**, all from the claudevideo.org index (which links each video to its X
post), taken from the index at Atul's instruction rather than re-opened one by one. Two posts (Deedy, JetBrains)
were also opened on X and matched the index. 6 have a prompt link; 1 (AjustaCV) shows the prompt in full because
the post is a tutorial telling readers to use it. Mix: 23 launch videos and product promos, 5 explainers;
18 × 16:9, 7 × 9:16, 2 × 1:1, 1 × 4:3 (length and frame checked against each MP4).

**Thumbnails and playback (Atul, 2026-11-17: "play videos on our website, don't redirect").**
- Thumbnail: `poster` is X's own preview image for the post's video (`pbs.twimg.com`, read from each post).
- Playback: `stream` is the direct MP4 at `cdn.claudevideo.org/video/<post id>.mp4`, played with the browser's own
  player (`components/gallery/StreamPlayer.tsx`). The page says "Playback copy from claudevideo.org". The
  "Original post on X" button stays.
- Risk, accepted by Atul: those files are claudevideo.org's copies on their CDN, at their cost; they can block
  other sites or remove a file at any time. So if an MP4 fails to load, the page falls back to X's official
  embedded post (`XPlayer.tsx`, `platform.twitter.com`), where the video still plays. The embed's height is set
  by frame shape, because X only reports its size to its own script (`widgets.js`), which we do not load.
- CSP: `img-src` adds `https://pbs.twimg.com`; `frame-src` adds `https://platform.twitter.com`; `media-src`
  already allowed any https.

## 4. Not built

- **Self-serve publishing.** A founder cannot press "Publish to gallery" in the dashboard yet. That needs an
  additive migration (a public slug, a status and the prompt on `studio_items`), a public read endpoint and an
  approval step. Worth doing once there are enough submissions that PRs become a chore.
- **Search, filters and sorting** on `/videos`. Not needed below a few dozen entries.
- **Our own playback copies.** Videos play from claudevideo.org's CDN (above). Not hosting them is a rule (Deno
  never hosts a video); if their CDN goes away, the X embed is the fallback.
- **YouTube or Vimeo entries.** None in the first batch; the reference indexes list X posts only.
- **A regular refresh.** The batch is a one-time copy; new videos need another PR.
- **A custom domain.** Search engines index whatever `NEXT_PUBLIC_SITE_URL` says; today that is the
  `vercel.app` address.
- `/llms.txt` does not mention the gallery yet.

## 5. Checked

`tsc`, `eslint`, `build_plugin.py --check`. In the browser at 1280 px and 375 px (no sideways scroll): the
gallery, a format page, the publish page, and both kinds of video page using two temporary entries (a YouTube
link that plays in place, an X link that opens the post), which were removed afterwards. `/robots.txt` and
`/sitemap.xml` (39 addresses) respond. Unknown slugs return 404.
