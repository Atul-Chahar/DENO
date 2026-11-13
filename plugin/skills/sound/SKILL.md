---
name: sound
description: Add music, sound effects and a proper mix to a studio video: beat analysis of a track, SFX placed from the picture's cues, ducking, -14 LUFS master. Use when a video needs audio or the founder supplies a track.
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

# Sound for a studio video
1. `get_playbook("sound")`.
2. Choose the route and say it: the founder's track (ask for the file and confirm they hold the rights), a library
   track (`search_media kind=music`, then `studio fetch`), the kit's synthesized bed, or silent with captions.
3. With a track: `studio beats assets/track.mp3`. It writes bpm, beats, downbeats and sections into
   `film.json.beatGrid` and `beats.json`. Snap cuts to downbeats.
4. Cues: push `{t, kind}` into `window.CUES` for every visual hit (`click`, `whoosh`, `pop`, `thump`, `tick`,
   `riser`, `chime`, `slam`). For library SFX, `studio search sfx <query>` (Openverse
   included, no key) and `studio fetch <id> --as <kind>` maps it to that kind in `film.json.sfx`.
   `studio sfx "<the sound>" --as <kind> --at <t>`: free synthesized sound by default (no key); with the
   founder's ElevenLabs key it generates a custom one instead (tell them it uses their credits). Talking clips: `studio silence` for dead air, `studio loudness` for levels.
5. `studio mix` builds the mix (track, SFX from cues, voice if present), ducks, fades at cuts, normalises to
   -14 LUFS / -1 dBTP, and muxes it onto each rendered format.
6. Look at the sound: `studio sheet --audio` also writes `waveform.png`; hits should line up with the cuts on the sheet.
7. Tell the founder in a sentence what the sound does ("a low thump on the logo, music drops under the voice"), not how it was made.
