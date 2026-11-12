---
name: review
description: Review a studio render the way a motion designer would: deterministic checks, contact sheets, strips, the 7-dimension rubric, partial re-renders, and the founder's frame-pinned notes from Deno. Use before showing any render and when the founder leaves notes.
---

> **Deno Studio plugin.** `studio` is this plugin's command (on your PATH while the plugin is enabled; if the
> shell can't find it, use `node "${CLAUDE_PLUGIN_ROOT}/kit/cli.mjs"`). Deno's MCP tools (get_founder_context,
> get_playbook, search_media, check_copy, save_video, get_review_notes, …) come from the `deno` server this plugin
> adds; approve the sign-in when Claude Code asks. Prefer `get_playbook` (it leaves out rules the founder switched
> off); offline copies are in `${CLAUDE_PLUGIN_ROOT}/skills/video/reference/`.

# Review a render
1. `get_playbook("review")`.
2. `studio verify` and fix everything it reports.
3. `studio sheet` and `studio sheet --phone`; read both images. `studio strip --at <t>` around fast moments.
4. Ask the `reviewer` agent for scores (hook, phone readability, motion, variety, composition, brand, sound) and
   the two weakest moments. Fix the three worst; `studio render --from a --to b` re-renders just those seconds.
   Loop until all scores are at least 8.
5. Founder notes: `get_review_notes(video_id)` returns each open note with the frame, time, chapter/clip, pin
   position and tags. Fix one note at a time, keep everything else identical, upload a new version, then
   `reply_note(note_id, "fixed", "<one line>")` or `"wontfix"` with the reason.
