---
title: The build loop
summary: Place every shot as a labelled placeholder first, fill one at a time, look after each, and never call it done without a clean verify and a contact sheet.
tags: [core, workflow, placeholders, review]
---
# The build loop: place, fill, look

## 1. Place before you fill
- Before building anything heavy, put the whole film's shape into `film.json` as placeholders:
  `studio place <id> --start a --end b --label "what the viewer sees" --kind title|graphic|screen|footage|voice|music|sfx`
  (`--as-chapter` for chapters). Name each one after what it shows, not after how it's made.
- Placeholders draw as labelled striped blocks in the preview and in `studio render --draft`. The founder sees the
  structure and timing at once, before voice, footage or graphics exist. Show them that draft early.
- A full render refuses while any placeholder is pending, and `studio verify` blocks on them, so none can slip
  into a final.

## 2. Fill one at a time
- Build one placeholder's content (code, footage, voice), then `studio fill <id>`. One element per step, so each
  change is visible on its own and easy to undo.
- `studio timeline` reads the film back: shape, what is still pending, unlicensed assets, the last verify result.
  Read it before and after a batch of work. Leave nothing pending.
- Small, targeted edits. Never rewrite a scene you were asked to trim.

## 3. Look after every change
- You can't watch the video: look at frames and numbers. `studio sheet --live --at <times>` for the moments
  you touched; `studio strip --at <t>` for motion; `studio sheet --stats` for exposure and colour.

## 4. The done gate (never skip)
- You may not say a film, a fix or a version is finished until all of these are true on the current code:
  `studio verify` has no blocking findings, the film was rendered and mixed, and you read `studio sheet` of the
  mixed file (plus `studio sheet --phone`).
- `studio upload` enforces it: it refuses when verify is missing, stale or blocking, when a placeholder is
  pending, or when no sheet of the mixed file exists. A work-in-progress upload can pass `--unchecked`; say so
  to the founder. A final can't.
- "It rendered" proves nothing. Only the sheet you read does.
