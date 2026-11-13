# Getting footage, sound and words

_Where each kind of asset comes from, in order of preference, with the rights rule for each. Works out of the box with zero API keys; word-timed transcripts for cutting._

# Getting footage, sound and words

Media search works out of the box: **no API key is needed for anything below**. Keys (Pexels, Pixabay,
Freesound on the Deno server; ElevenLabs on the founder's machine) only add more choice. Without them the same
commands fall back to free, keyless sources by themselves, so never ask the founder for a key before trying.

## Footage and images
- **The founder's own product:** `studio capture <url>` (real UI, best evidence there is).
- **Free stock:** `search_media kind=video|image` (or `studio search video <query>`), then `studio fetch <id>`.
  Licence and credit are recorded for you. Sources, in order: Pexels and Pixabay when the server has keys,
  otherwise Wikimedia Commons (CC0, public domain, CC BY; paste the credit) and the Internet Archive
  (public-domain film). Internet Archive licences are the uploader's claim (`archive-pd`, a warning on review):
  skip anything that looks like a TV show, a film studio's work or a famous song.
- **YouTube and the web, no Google key:** `studio search youtube <query>` lists videos; `studio download
  "<url>"` or `studio download "ytsearch3:<query>"` brings them down with yt-dlp.
- **A link the founder brings** (YouTube, X, Instagram, TikTok, Vimeo, a file URL): `studio download "<link>"`.
  Quote the link. `--max-height 1080`, `--audio-only` for sound, `--browser chrome` when the post needs a
  signed-in session.
- Rights: a downloaded clip is recorded with licence `unknown`, unless YouTube marks it Creative Commons (then
  `cc-by`: credit the uploader). `unknown` is fine for drafts and blocked in a final. Ask the founder whether they
  own it or hold a licence, then download again with `--license own|licensed`. Never put someone else's video in
  the founder's marketing on a guess.

## Sound effects
- Default: the kit's synthesized hits (no key, no licence questions), fired by `window.CUES`.
- `studio sfx "<the sound>" --as <kind> --at <t>`: with no ElevenLabs key it picks the closest synthesized sound
  (click, tick, pop, whoosh, swoosh-out, thump, slam, riser, chime; `--seed N` for a variation), free and
  licensed `synth`. With the founder's ElevenLabs key it generates a custom one instead (their credits; 0.5–30 s;
  `--synth` forces the free path). Describe the material and motion ("soft paper slide, close"), not the
  emotion. One sound per kind; reuse it on every cue of that kind.
- Library: `search_media kind=sfx` + `studio fetch <id> --as whoosh` (Freesound CC0 with a key, otherwise the
  Internet Archive).

## Music
- Best: the founder's own licensed track. Then a library track (`search_media kind=music`: Freesound CC0 or the
  Internet Archive). Then the kit's synthesized bed (`studio mix --bed`). Then silence with captions. Say which
  one you chose.
- Run `studio beats` on any track and cut on its downbeats.

## Voice
- `studio voice script.md`: Kokoro (local, free) by default; ElevenLabs or Sarvam on the founder's key. Word times
  come back aligned to the script, so captions and cue words need no extra pass.

## Words and silence (cutting talking footage)
- `studio transcribe <file>` gives word-level times (`[mm:ss.mmm] word`), cached until the file changes. Cut in on
  a word's start and out on the next word's start; find the soundbite by its words, not by scrubbing.
- `studio silence <file>` lists dead air for jump cuts (keep about 0.1 s so words don't clip).
- `studio loudness <file>` checks a clip against the -14 LUFS social target; `studio mix` normalises the final.
- Combine both clocks: the best cut lands where a sentence ends close to a downbeat.

## Generated video
- Deno Studio films are made from code, real UI, stock and the founder's footage. Don't generate fake people or
  fake product footage; it reads as fake and can mislead.
