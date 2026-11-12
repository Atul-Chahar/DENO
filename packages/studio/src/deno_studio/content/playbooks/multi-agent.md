---
title: Multi-agent production
summary: A director writes the contract and storyboard, scene builders own one chapter each, the director reviews sheets and sends work back.
tags: [agents, chapters, long-form]
---
# Multi-agent production (films over ~30 s)

- The **director** writes `TREATMENT.md` and `GUIDE.md`: the shared API (`seek`, `motion.js`), the palette per
  chapter, reserved bands (captions, logo), the performance budget (≤ 1.5 s per frame), and the rule "edit only
  your own chapter file; report bugs in shared files".
- Build chapter 1 yourself as the reference. Then fan out one **scene-builder** per chapter
  (`chapters/ch2.js`…), in waves: 2, then 4, then the rest, so early results calibrate the others.
- Each builder runs `studio verify --chapter chN` and `studio sheet --chapter chN` before reporting back.
- The director reviews every chapter on its contact sheet and sends it back with specific notes. Fix shared bugs
  centrally.
- Record chapters in `film.json.chapters` so review notes map to the right file.
