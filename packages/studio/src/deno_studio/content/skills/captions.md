---
name: captions
description: Create captions for a studio video from its voiceover, footage or track (word timing), in a house preset (beast-mode, billboard, sideline, butter-serif), optionally behind the speaker, burned in for vertical formats, with SRT/VTT sidecars. Use when a video has speech or lyrics, or will be watched muted.
---
# Captions
1. `get_playbook("captions")`; for text behind a person also `get_playbook("behind-subject")`.
2. Choose a preset by the film's energy and say it in one line to the founder ("bold, word-by-word captions
   for a fast reel"): `beast-mode` (loud reels), `billboard` (huge, behind the speaker, for the hook or key
   lines), `sideline` (talking heads, explainers), `butter-serif` (calm founder stories).
3. `studio captions <audio or footage> --preset <name>` transcribes with word timings (local Whisper). With a
   known script or lyrics add `--text script.md` to align the exact words. `--words n` overrides words per caption.
   It writes `captions.json`, `captions.srt`, `captions.vtt` and fills `film.json.captions`.
4. Burned-in: `await loadCaptions()` from `lib/captions.js` before `film(...)`, then in `seek(t)`:
   `drawCaption(el, t, { preset })` into an empty element inside `#stage`.
5. Behind the speaker: `studio frames` + `studio matte <name>` on the footage, layers back image → caption element →
   front canvas, and `await subject({ back, front, text: el }, name, lt)` before `drawCaption`. Look at a sheet at
   the moments the head crosses the words.
6. Read the transcript for names and homophones and fix them in `captions.json`. Then
   `check_copy(kind="captions", text=<all caption lines>)` and fix what it flags.
7. `studio verify`, then `studio sheet --live --at <a few caption moments>` and read it before telling the
   founder captions are in.
