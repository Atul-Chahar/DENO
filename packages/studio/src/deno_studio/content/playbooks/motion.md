---
title: Motion
summary: Springs, not linear easing; motivated transitions; the camera is never dead; animation principles in code.
tags: [motion, animation]
---
# Motion

- **Springs.** Use closed-form springs (`spring(t, k, d)` and `track(t, keys)` from the kit's `motion.js`). Stiff
  for UI and cursors (a hint of overshoot), heavy for type (no overshoot). Linear only for lines being drawn.
- When a value changes target several times, add one spring per change. Put each edge of a stretching element on
  its own spring so it stretches, then settles.
- **Order.** Content enters after its container starts moving, and leaves before the next move. Outgoing text is
  gone before incoming text arrives.
- **Transitions grow out of the content:** match cut, cut on action, whip with smear, iris, a carried camera
  move. No generic crossfades.
- **The camera is never dead:** a slow push, drift or pan in every shot.
- **Principles:** anticipation, squash and stretch, slow in/out, weight, arcs, overlap and follow-through,
  exaggeration, strong key poses, secondary action. **Avoid twinning:** code copies values, so two arms move the
  same way and a crowd moves in unison. Offset them.
- **Motion blur:** render 2–6 sub-frames per frame (`studio render --sub 3`) for fast moves.
