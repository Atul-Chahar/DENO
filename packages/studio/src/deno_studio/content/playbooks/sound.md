---
title: Sound
summary: A real track with a beat grid, one SFX per action from the timeline's cues, ducking, -14 LUFS.
tags: [sound, music, sfx]
---
# Sound

- **Routes, best first:** the founder's own licensed track · a library track (`search_media kind=music`) · the
  kit's synthesized bed (`studio mix --bed`) · silent with burned-in captions. Say which one you chose.
- Run `studio beats track.mp3` and put the result in `film.json.beatGrid`. Snap cuts to it.
- **SFX come from the picture.** Every cue in `window.CUES` (`{t, kind}`) gets one sound: click, whoosh, pop,
  thump, tick, riser, chime. Place it about 0.03 s before the contact. One sound per action, not a constant bed.
- **A sound nothing else has:** `studio sfx "<the sound>" --as <kind> --at <t>` generates it with ElevenLabs on the
  founder's key (playbook `sources`). Describe material and motion, keep it short, reuse it per kind.
- **Speech clips:** `studio silence` finds dead air to cut; `studio loudness` checks a clip before mixing.
- **Mix:** duck music under voice (-10 dB), 30 ms fades at every cut, master to -14 LUFS integrated and -1 dB
  true peak, AAC 192 kbps. `studio mix` does all of this.
- Never record audio from the browser. Picture and sound are joined by ffmpeg.
- Licences: only assets whose `license` allows commercial use go into a final. `studio fetch` records each one in
  `CREDITS.json`; `save_video` checks them.
