---
name: review
description: Review a studio render the way a motion designer would: deterministic checks, contact sheets, strips, the 7-dimension rubric, partial re-renders, and the founder's frame-pinned notes from Deno. Use before showing any render and when the founder leaves notes.
---
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
