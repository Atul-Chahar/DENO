---
title: Rendering and delivery
summary: Half-resolution drafts, multi-format finals, a master plus upload copies, poster, contact sheet and credits.
tags: [render, export, formats]
---
# Rendering and delivery

- Draft at half resolution (`studio render --draft`), final at full size.
- One film, several formats: lay out for every ratio in `film.json.formats` (read `window.FORMAT` in `seek`).
  `studio render --formats 9:16,1:1,16:9`.
- Output per format: H.264 yuv420p, BT.709 tags, `+faststart`; a CRF 16 master, a platform upload copy, a 720p
  review copy under 15 MB, a poster frame and a contact sheet.
- No animated grain; it falls apart in platform re-encodes.
- `studio upload` sends the review copy, poster, sheet and `film.json` to Deno. The master stays on the founder's
  machine.
- Report: the file paths, what you decided and why, the two weakest moments, and any claim you couldn't verify.
