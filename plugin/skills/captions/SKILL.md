---
name: captions
description: Create captions for a studio video from its voiceover or track (word timing), burn them in for vertical formats, and write SRT/VTT sidecars. Use when a video has speech or lyrics, or will be watched muted.
---

> **Deno Studio plugin.** `studio` is this plugin's command (on your PATH while the plugin is enabled; if the
> shell can't find it, use `node "${CLAUDE_PLUGIN_ROOT}/kit/cli.mjs"`). Deno's MCP tools (get_founder_context,
> get_playbook, search_media, check_copy, save_video, get_review_notes, …) come from the `deno` server this plugin
> adds; approve the sign-in when Claude Code asks. Prefer `get_playbook` (it leaves out rules the founder switched
> off); offline copies are in `${CLAUDE_PLUGIN_ROOT}/skills/video/reference/`.

# Captions
1. `get_playbook("captions")`.
2. `studio captions assets/voice.wav` transcribes with word timings (local Whisper). If you know the exact words
   (a script or lyrics), add `--text script.md` to align them instead of trusting the transcript.
3. It writes `captions.json` (words with times), `captions.srt`, `captions.vtt`, and fills `film.json.captions`.
4. Burned-in: `await loadCaptions()` from `lib/captions.js` before `film(...)`, then in `seek(t)` draw
   `captionAt(t)` (the current group of 1–4 words and the index of the word being spoken).
5. `check_copy(kind="captions", text=<all caption lines>)` and fix what it flags.
