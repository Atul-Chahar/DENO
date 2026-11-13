---
title: The review loop
summary: Deterministic checks, contact sheets, strips and crops, a separate reviewer scoring 7 dimensions, partial re-renders.
tags: [core, review, quality]
core: true
---
# The review loop (the habit of looking)

1. **Deterministic checks:** `studio verify` (seek purity, console errors, blank or blown frames, text in unsafe
   areas, reading time). Fix everything it reports first.
2. **Contact sheet:** `studio sheet` (one frame per beat or per second) and `studio sheet --phone` (360 px wide:
   is it readable on a phone?).
3. **Strips:** `studio strip --at 4.2` (12 frames around a fast action, contact or transition).
4. **Crops:** `studio crop --at 7 --box x,y,w,h` for faces, hands and small text.
5. **A separate reviewer** (the `reviewer` agent, or a fresh look) scores 1–10 against the treatment line:
   **hook** (first 2 s), **phone readability**, **motion quality**, **variety**, **composition**, **brand
   accuracy**, **sound sync**. Name the two weakest moments with timestamps.
6. Fix the three worst problems, re-render only the affected seconds (`studio render --from 6 --to 9`), repeat
   until every dimension is at least 8. Expect three rounds.
7. Watch and listen to the whole encoded file before you call it done. Stills can't show stutter.

## The founder's notes
`studio upload` saves the version to Deno and prints a review link. The founder pins notes to frames there. Call
`get_review_notes`, fix one note at a time, keep everything else exactly as it is, and answer each with
`reply_note` (fixed, or won't fix with a reason). Notes describe feelings ("I lost interest here"); the founder's
feeling about a moment is usually right, the fix is your job.
