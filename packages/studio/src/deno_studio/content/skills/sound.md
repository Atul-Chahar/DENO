---
name: sound
description: Add music, sound effects and a proper mix to a studio video: beat analysis of a track, SFX placed from the picture's cues, ducking, -14 LUFS master. Use when a video needs audio or the founder supplies a track.
---
# Sound for a studio video
1. `get_playbook("sound")`.
2. Choose the route and say it: the founder's track (ask for the file and confirm they hold the rights), a library
   track (`search_media kind=music`, then `studio fetch`), the kit's synthesized bed, or silent with captions.
3. With a track: `studio beats assets/track.mp3`. It writes bpm, beats, downbeats and sections into
   `film.json.beatGrid` and `beats.json`. Snap cuts to downbeats.
4. Cues: push `{t, kind}` into `window.CUES` for every visual hit (`click`, `whoosh`, `pop`, `thump`, `tick`,
   `riser`, `chime`, `slam`). For library SFX, `search_media kind=sfx` and map a kind to a file in
   `film.json.sfx`.
5. `studio mix` builds the mix (track, SFX from cues, voice if present), ducks, fades at cuts, normalises to
   -14 LUFS / -1 dBTP, and muxes it onto each rendered format.
6. Look at the sound: `studio sheet --audio` also writes `waveform.png`; hits should line up with the cuts on the sheet. Then listen to the whole file.
