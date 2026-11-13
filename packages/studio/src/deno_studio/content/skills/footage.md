---
name: footage
description: Bring real footage into a studio video, from the founder's files, stock or a YouTube/X/Instagram/TikTok/Vimeo link (yt-dlp), with rights recorded; transcribe talking footage with word times, cut on words and silences, and matte the speaker for text behind them. Use when the founder shares a video, a link, or wants a talking-head or interview cut.
---
# Footage
1. `get_playbook("sources")`.
2. Get it in:
   - A file the founder has: copy it into `assets/footage/`.
   - Stock: `search_media kind=video`, then `studio fetch <id>` (no keys needed: Wikimedia Commons and the
     Internet Archive answer when the server has no Pexels/Pixabay key).
   - Web footage with no Google key: `studio search youtube <query>`, then `studio download "<url>"` (or
     `studio download "ytsearch3:<query>"`).
   - A link: `studio download "<link>"` (quote it; `--browser chrome` for posts that need a sign-in,
     `--audio-only` for sound). It's recorded as licence `unknown`. Ask the founder once, plainly: "Is this your
     video, or do you have the rights to use it?" If yes, download again with `--license own` or `licensed`. If not,
     it can shape a draft but not a final.
3. Talking footage:
   - `studio transcribe <file>` for word times; pick soundbites by their words. A cut goes in at a word's start
     and out at the next word's start.
   - `studio silence <file>` for dead air; `studio loudness <file>` to check levels.
   - Prefer cuts where a sentence ends near a downbeat (`studio beats` on the music).
4. Draw it: `studio frames <file> --name <name>`, then `footage(img, name, lt)` from `lib/footage.js` in `seek(t)`.
5. Text behind the speaker: `studio matte <name>`, then `subject(...)` (playbook `behind-subject`).
6. Place each cut as a placeholder first (`studio place`), fill it, `studio fill`, look at a sheet. Tell the founder
   what the cut does for the story in one sentence, not which timestamps you used.
