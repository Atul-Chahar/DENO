---
name: review
description: Review a studio render the way a motion designer would: deterministic checks, contact sheets, strips, partial re-renders, and the founder's frame-pinned notes from the local review page (`studio review`). Use before showing any render and when the founder leaves notes.
---
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
