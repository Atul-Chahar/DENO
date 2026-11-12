# Captions

_Word-level timing from the audio, 1–4 words per caption for vertical, never ahead of the voice, SRT/VTT for upload._

# Captions

Most social video is watched muted, so captions carry the message.

- **Timing from the audio:** `studio captions voice.wav` (or `--text script.md` to align a known script) writes
  word timings to `captions.json` plus `captions.srt` and `captions.vtt`.
- **Burned-in (vertical):** 1–4 words per caption, popping on the spoken word with a short overshoot; one
  highlight colour for the current word; never ahead of the voice; inside the safe area (out of the bottom 15%).
- **Sidecar (16:9, LinkedIn, YouTube):** sentence-sized lines, at most 2 lines of ~42 characters, at least 1 s
  each. Upload the `.srt` with the video.
- Put caption lines into `film.json.captions` so `check_copy` and the dashboard can read them.
- Captions go through `check_copy(kind="captions")` like any other copy: no AI-sounding phrasing, no invented
  numbers, readable speed.
