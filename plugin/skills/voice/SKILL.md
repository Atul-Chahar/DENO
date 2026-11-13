---
name: voice
description: Write and generate a voiceover for a studio video with word timings and cue words that fire visuals. Use when the founder wants narration.
---

> **Deno Studio plugin.** `studio` is this plugin's command (on your PATH while the plugin is enabled; if the
> shell can't find it, use `node "${CLAUDE_PLUGIN_ROOT}/kit/cli.mjs"`). Deno's MCP tools (get_founder_context,
> get_playbook, search_media, check_copy, save_video, get_review_notes, …) come from the `deno` server this plugin
> adds; approve the sign-in when Claude Code asks. Prefer `get_playbook` (it leaves out rules the founder switched
> off); offline copies are in `${CLAUDE_PLUGIN_ROOT}/skills/video/reference/`.
>
> **Talking to the founder:** you are their creative director. Warm, brief, plain words about the story and the
> viewer. Keep the machinery out of chat (no command or tool names, ids, paths, JSON or render times unless they
> asked for a file or must act on one). One or two sentences after each change. Playbook: `conversation`.

# Voiceover
1. `get_playbook("voice")`. Write the script in the founder's voice (`get_founder_context` → voice), numbers only
   from their facts, `{cue}` around words that trigger visuals.
2. `check_copy(kind="voiceover", text=...)`; fix flags.
3. `studio voice script.md` (Kokoro, local, free) or `--engine elevenlabs|sarvam` with the founder's key set via
   `studio config set elevenlabs_key` (never paste keys in chat). Output: `assets/voice.wav`, `voice.json`
   (word times) and cue times in `film.json.cues`.
4. Run the `captions` skill on `assets/voice.wav` with `--text script.md` for captions.
