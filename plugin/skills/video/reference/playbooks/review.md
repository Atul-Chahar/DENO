# The review loop

_Deterministic checks, contact sheets, strips and crops, one fix pass, then the founder; a separate reviewer once before a final._

# The review loop (the habit of looking)

1. **Deterministic checks:** `studio verify` (seek purity, console errors, blank or blown frames, text in unsafe
   areas, reading time). Fix everything it reports first.
2. **Contact sheet:** `studio sheet` (one frame per beat or per second) and `studio sheet --phone` (360 px wide:
   is it readable on a phone?).
3. **Strips:** `studio strip --at 4.2` (12 frames around a fast action, contact or transition).
4. **Crops:** `studio crop --at 7 --box x,y,w,h` for faces, hands and small text.
   **Numbers for the look:** `studio sheet --stats` prints exposure, blacks and whites, contrast, crushed and
   blown pixels, saturation and colour cast per frame. `--reference ref.jpg` adds the distance to a reference
   look (under 0.05 is close). Measure; don't judge colour from a thumbnail.
5. Fix the three worst problems you saw and re-render only the affected seconds
   (`studio render --from 6 --to 9`). **One pass.** Then the founder looks: a person's notes beat another round
   of your own scoring, and cost far less time.
6. **Before a final only, once:** a separate reviewer (the `reviewer` agent, or a fresh look) scores 1–10 against
   the treatment line: **hook** (first 2 s), **phone readability**, **motion quality**, **variety**,
   **composition**, **brand accuracy**, **sound sync**, and names the two weakest moments. Fix anything under 6.
   Do not repeat the scoring.
7. Watch and listen to the whole encoded file before you call it done. Stills can't show stutter.
8. **The done gate:** nothing is finished until `studio verify` is clean on the current code and you have read
   `studio sheet` of the mixed file. `studio upload` refuses otherwise (playbook `build-loop`).

## The founder's notes
`studio review` serves a review page from this machine: the film plays from the founder's disk, frame by frame,
and is never uploaded. They pause, type, and the note pins to that frame (or a range, or a spot they click).
When they press "I'm done reviewing", `studio notes --wait` returns with the notes. Fix one note at a time, keep
everything else exactly as it is, and answer each with `studio reply <id> fixed "…"` (or `open "why not"`); the
answer shows under their note. Re-render the seconds you touched and `studio review --next` opens the next round.
Notes describe feelings ("I lost interest here"); the founder's feeling about a moment is usually right, the fix
is your job. A note that names a rule for the whole film ("no outlined type") goes into `TREATMENT.md` as a rule.
