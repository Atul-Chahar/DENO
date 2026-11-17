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
as GitHub issues or emails from `/videos/submit`; a person checks each one. Only list a video with its maker's
permission; remove it when they ask.

## 4. Not built

- **Self-serve publishing.** A founder cannot press "Publish to gallery" in the dashboard yet. That needs an
  additive migration (a public slug, a status and the prompt on `studio_items`), a public read endpoint and an
  approval step. Worth doing once there are enough submissions that PRs become a chore.
- **Search, filters and sorting** on `/videos`. Not needed below a few dozen entries.
- **Listing other people's public videos from X** the way the reference sites do. It is the fastest way to fill
  the gallery, but it lists people's work without asking first. Atul's decision; the data model supports it
  (`madeWithDeno: false`, shown as "Community").
- **A custom domain.** Search engines index whatever `NEXT_PUBLIC_SITE_URL` says; today that is the
  `vercel.app` address.
- `/llms.txt` does not mention the gallery yet.

## 5. Checked

`tsc`, `eslint`, `build_plugin.py --check`. In the browser at 1280 px and 375 px (no sideways scroll): the
gallery, a format page, the publish page, and both kinds of video page using two temporary entries (a YouTube
link that plays in place, an X link that opens the post), which were removed afterwards. `/robots.txt` and
`/sitemap.xml` (39 addresses) respond. Unknown slugs return 404.
