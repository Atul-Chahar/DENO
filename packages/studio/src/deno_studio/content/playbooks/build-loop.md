---
title: The build loop
summary: Place every shot as a labelled placeholder first, fill one at a time, look once per chapter, show the founder a draft early, and never call a final done without a clean verify and a contact sheet.
tags: [core, workflow, placeholders, review]
---
# The build loop: place, fill, look

## 0. Start from a recipe that already renders
- `studio init <name> --recipe <slug>` gives a working film made of blocks (`film.json` → `scenes`). Change the
  words, pictures and timing in `film.json`; `studio fill <scene id>` marks a scene as the founder's own. Write
  code only for the shot no block can do. Without a runnable recipe for the format, start at 1.

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

## 3. Look once per chapter
- You can't watch the video: look at frames and numbers. When a chapter is filled, one
  `studio sheet --live --chapter <id>` (or `--at <times>` for the moments you touched). `studio strip --at <t>`
  only for the fastest move; `studio sheet --stats` when colour matters. Every look costs time: don't look after
  each small edit.

## 4. Draft first
- The first cut and every fix round are drafts: `studio render --draft` (half size, no motion blur, seconds
  instead of minutes; only the chunks whose scene or chapter changed are rendered again), one format,
  `studio check`, then `studio review`: the founder watches it on their own
  machine and pins notes to frames (`studio notes --wait`, `studio reply`, `studio review --next`). Their notes
  decide what changes next. Full quality, the sound mix and the other formats wait until they approve.

## 5. The done gate (finals; never skip)
- You may not say a final is finished until all of these are true on the current code:
  the film was rendered and mixed, `studio check` has no blocking findings, and you read its sheet of the mixed
  file.
- `studio upload` enforces it: it refuses when verify is missing, stale or blocking, when a placeholder is
  pending, or when no sheet of the mixed file exists. `--draft` asks for less (a clean verify and a sheet of
  the draft render). `--unchecked` skips the checks for a work in progress; say so to the founder. A final can't.
- "It rendered" proves nothing. Only the sheet you read does.
