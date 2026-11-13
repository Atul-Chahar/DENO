---
title: Captions
summary: Word-level timing from the audio, 1–4 words per caption for vertical, never ahead of the voice, SRT/VTT for upload.
tags: [captions, subtitles, accessibility]
---
# Captions

Most social video is watched muted, so captions carry the message.

- **Timing from the audio:** `studio captions voice.wav` (or `--text script.md` to align a known script) writes
  word timings to `captions.json` plus `captions.srt` and `captions.vtt`.
- **Burned-in (vertical):** 1–4 words per caption, popping on the spoken word with a short overshoot; one
  highlight colour for the current word; never ahead of the voice; inside the safe area (out of the bottom 15%).
- **Sidecar (16:9, LinkedIn, YouTube):** sentence-sized lines, at most 2 lines of ~42 characters, at least 1 s
  each. Upload the `.srt` with the video.
## Presets (lib/captions.js)
Pick one per film with `studio captions <audio> --preset <name>` (it sets words per caption) and draw it with
`drawCaption(el, t, { preset })`. Pick by the film's energy, then look at a sheet.
- **beast-mode**: heavy caps, thick outline, the spoken word pops in the accent colour. High-energy reels, 1–3 words.
- **billboard**: huge stacked caps across the top third. Made to sit behind the speaker (playbook
  `behind-subject`). Use for the hook or a few key lines, not a whole talk.
- **sideline**: small, left-aligned, accent rule. Talking heads, interviews, explainers; up to 6 words.
- **butter-serif**: soft italic serif that eases in. Founder stories and calm product films; up to 7 words.
- `--words n` overrides words per caption. Colours come from the brand kit (`--accent`, `--caption-ink`).
- Caption timing follows speech, so `studio verify` doesn't apply its reading-time rule to caption words.

- Put caption lines into `film.json.captions` so `check_copy` and the dashboard can read them.
- Captions go through `check_copy(kind="captions")` like any other copy: no AI-sounding phrasing, no invented
  numbers, readable speed.
