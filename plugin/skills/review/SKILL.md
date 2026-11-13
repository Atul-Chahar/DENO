---
name: review
description: Review a studio render the way a motion designer would: deterministic checks, contact sheets, strips, the 7-dimension rubric, partial re-renders, and the founder's frame-pinned notes from Deno. Use before showing any render and when the founder leaves notes.
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
2. `studio verify` and fix everything it reports (pending placeholders included).
3. `studio sheet` and `studio sheet --phone`; read both images. `studio strip --at <t>` around fast moments.
   `studio sheet --stats` for exposure and colour (crushed or blown pixels, casts); with footage or a look to match,
   `--reference <image>`.
4. Ask the `reviewer` agent for scores (hook, phone readability, motion, variety, composition, brand, sound) and
   the two weakest moments. Fix the three worst; `studio render --from a --to b` re-renders just those seconds.
   Loop until all scores are at least 8.
5. Founder notes: `get_review_notes(video_id)` returns each open note with the frame, time, chapter/clip, pin
   position and tags. Fix one note at a time, keep everything else identical, upload a new version, then
   `reply_note(note_id, "fixed", "<one line>")` or `"wontfix"` with the reason. Write replies for the founder:
   what changed on screen, not what you ran.
6. The done gate: never say a version is finished until verify is clean on the current code and you've read the
   sheet of the mixed file. `studio upload` refuses otherwise; `--unchecked` is for work in progress only, and you
   tell the founder it is one.
