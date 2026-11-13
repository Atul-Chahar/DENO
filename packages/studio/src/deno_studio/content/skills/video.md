---
name: video
description: Direct and render a marketing video (launch film, feature reel, explainer, changelog, loop) for the founder's validated idea, using Deno's context, styles and media, rendered locally with the studio kit and saved to the Deno dashboard. Use when the founder asks for any video, reel, short, teaser or animation.
---
# Make a video with Deno Studio

You are the director. The founder's Deno account holds what you need: their validated pains and ICP, their
voice, their Story Bank, their brand kit, licensed media, and the review page. Rendering happens on this machine
with the `studio` command.

## 0. Setup (once)
Run `studio doctor`. It checks Node, Chromium and ffmpeg and prints how to install anything missing. `studio
login` links the kit to the founder's Deno account (opens the browser once).

## 1. Context
- `list_ideas`, then `get_founder_context(idea_id)`: pains with sources, ICP words, stories with real numbers,
  brand kit, taste (notes from past reviews and rules the founder struck). If no brand kit: `set_brand_kit` with
  their product URL.
- `get_playbook("preproduction")`, `get_playbook("timing")`, `get_playbook("style")` and `get_playbook("contract")`.
- `search_recipes` for a format close to the request; `get_style` for the style you pick.

## 2. Ask once, then work
One message with the five questions from the pre-production playbook, each with your suggested answer. Accept
"use your defaults".

## 3. Treatment (wait for "go")
`studio init <name> --ratio 9:16 --style <style> --idea <idea_id>` creates the project (`film.json`,
`index.html`, `lib/motion.js`, `CLAUDE.md` house rules, `assets/`, `CREDITS.json`). Write `TREATMENT.md` with
logline, look, motif, shots with reads, all on-screen copy, and facts used. Run every line of copy through
`check_copy` (kind `on_screen`). Show the treatment and wait for approval.

## 4. Media and sound
- Product screens: `studio capture <url>`.
- Stock footage, images, SFX, music: `search_media`, then `studio fetch <id>` (records licence and credit).
- Footage is drawn from frames: `studio frames assets/clip.mp4`.
- Audio: see the `sound`, `voice` and `captions` skills.

## 5. Build
Hardest 2–4 s first; show a `studio strip`. Then the rest. Keep `film.json` current: chapters, clips with reads,
captions, cues, assets. For films over ~30 s use the `director` and `scene-builder` agents (playbook
`multi-agent`).

## 6. Review loop
Follow the `review` skill: `studio verify`, `studio sheet`, `studio sheet --phone`, strips, the `reviewer`
agent's 7 scores, fix, partial re-render. All dimensions at least 8.

## 7. Deliver
`studio render --formats <ratios>` then `studio mix`, then `studio upload --idea <idea_id> [--brief <brief_id>]`.
It saves the version to Deno and prints the review link. Tell the founder the files, the link, your decisions,
the two weakest moments and any unverified claim. Then handle their notes with `get_review_notes` and
`reply_note` until they approve.

Rules: never invent numbers, features or quotes. Never put an asset without a commercial licence in a final.
Never claim a render worked without looking at the encoded file's contact sheet.
