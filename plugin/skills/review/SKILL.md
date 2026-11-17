---
name: review
description: Review a studio render the way a motion designer would: deterministic checks, contact sheets, strips, partial re-renders, and the founder's frame-pinned notes from the local review page (`studio review`). Use before showing any render and when the founder leaves notes.
---

> **Deno Studio plugin.** `studio` is this plugin's command (on your PATH while the plugin is enabled; if the
> shell can't find it, use `node "${CLAUDE_PLUGIN_ROOT}/kit/cli.mjs"`). Deno's MCP tools (get_founder_context,
> get_playbook, search_media, check_copy, save_video, get_review_notes, …) come from the `deno` server this plugin
> adds; approve the sign-in when Claude Code asks. Prefer `get_playbook` (it leaves out rules the founder switched
> off); offline copies are in `${CLAUDE_PLUGIN_ROOT}/skills/video/reference/`.
>
> **Talking to the founder:** you are their creative director. Warm, brief, plain words about the story and the
> viewer. Keep the machinery out of chat (no command or tool names, ids, paths, JSON or render times unless they
> asked for a file or must act on one). One or two sentences after each change. Playbook: `conversation`.

# Review a render
1. `get_playbook("review")`.
2. `studio check`: verify (fix everything it blocks on, pending placeholders included), one contact sheet at
   phone width from the current render, and the colour numbers (exposure, crushed or blown pixels, casts). Read
   its one image. `studio strip --at <t>` around the fastest moment only; with footage or a look to match,
   `studio sheet --stats --reference <image>`.
3. Fix the three worst things you saw; `studio render --draft` redoes only the chunks you changed. One pass,
   then show the founder: their notes are the second opinion. Before a **final** only, you may ask the
   `reviewer` agent once for scores (hook, phone readability, motion, variety, composition, brand, sound) and fix
   anything under 6. Never loop on your own scores.
4. Founder notes: `studio review` (start it in the background and leave it running): a review page on this machine. The film
  plays from the founder's own disk, every frame, and is never uploaded. Give the founder the link; if you have
  a built-in browser or preview, open it there for them.
   `studio notes --wait` returns when they press "I'm done reviewing" and prints each open note with its time,
   frame, chapter/clip, the spot they pointed at and tags. Fix one note at a time, keep everything else identical,
   then `studio reply <id> fixed "<one line>"` or `studio reply <id> open "<why not>"`. Write replies for the
   founder: what changed on screen, not what you ran. Re-render the seconds you touched and `studio review --next`
   for the next round. (Notes left on the Deno dashboard instead: `get_review_notes`, `reply_note`.)
5. The done gate: never say a final is finished until `studio check` is clean on the current code and you've
   read its sheet of the mixed file. `studio upload` refuses otherwise. Drafts are reviewed locally and need no upload; to
   save one to the dashboard anyway, `studio upload --draft` (clean verify + a sheet of the draft render).
