---
name: voice
description: Write and generate a voiceover for a studio video with word timings and cue words that fire visuals. Use when the founder wants narration.
---
# Voiceover
1. `get_playbook("voice")`. Write the script in the founder's voice (`get_founder_context` → voice), numbers only
   from their facts, `{cue}` around words that trigger visuals.
2. `check_copy(kind="voiceover", text=...)`; fix flags.
3. `studio voice script.md` (Kokoro, local, free) or `--engine elevenlabs|sarvam` with the founder's key set via
   `studio config set elevenlabs_key` (never paste keys in chat). Output: `assets/voice.wav`, `voice.json`
   (word times) and cue times in `film.json.cues`.
4. Run the `captions` skill on `assets/voice.wav` with `--text script.md` for captions.
