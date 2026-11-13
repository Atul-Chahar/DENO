---
title: Text behind the speaker
summary: Huge titles or captions that sit between the background and the person, from local person mattes.
tags: [captions, typography, footage, compositing]
---
# Text behind the speaker

A title the speaker stands in front of feels shot, not pasted. It works on talking heads and on any footage with
one clear person and room above or beside them.

## Make it
1. Footage as frames: `studio frames assets/footage/talk.mp4 --name talk`.
2. Person mattes, made on this machine: `studio matte talk` (about a third of a second per frame on a laptop;
   `--every 2` halves it for slow-moving shots).
3. Three layers in `#stage`, in this order: the footage `<img id="back">`, your text or graphic, then a
   `<canvas id="front">` styled exactly like the footage (same size, `object-fit`, `object-position`).
4. In `seek(t)`: `await subject({ back, front, text }, 'talk', lt)` from `lib/footage.js`, then draw the text.
   With captions: `drawCaption(el, t, { preset: 'billboard' })` from `lib/captions.js`.
5. Until mattes exist the text falls back to sitting in front (`fallback: 'front'`); `fallback: 'hide'` hides it
   instead. `studio verify` warns while a matte is missing.

## Make it read
- Put the words where the head moves through them: top third for a centred speaker, the open side for an
  off-centre one. Some letters should be covered, never the key word.
- Big and heavy: the `billboard` preset, or a display face at 15–20% of the frame's short side.
- Light text on a busy background needs contrast: a darker grade, a soft vignette, or the brand colour.
- Look at a sheet at the moments the head crosses the words (`studio sheet --live --at ...`) and at a strip
  around fast moves; matte edges show there first.
- Keep it to the moments that earn it (the hook, a reveal). Behind-subject on every line stops being special.
