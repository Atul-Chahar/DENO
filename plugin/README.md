# Deno Studio (Claude Code plugin)

Make launch videos, reels, explainers, carousels and posts from your validated idea, in your own Claude Code.

- **The `deno` MCP server** (hosted): your evidenced pains, ICP words, Story Bank, voice and brand kit; playbooks
  and named styles; licensed stock footage, images, CC0 sound effects and music; anti-slop checks on every line of
  copy; saving versions to your Deno dashboard; frame-pinned review notes.
- **The `studio` command** (local): renders the film your Claude writes (HTML where every frame is a function of
  time) with headless Chromium and ffmpeg, checks it, makes contact sheets, analyses music beats, writes captions,
  generates voiceover, mixes sound to -14 LUFS and uploads review copies. Rendering happens on your machine.
- **Skills**: `video`, `sound`, `captions`, `voice`, `stills`, `posts`, `review`. **Agents**: `director`,
  `scene-builder`, `reviewer`.

## Install
```
/plugin marketplace add Atul-Chahar/DENO
/plugin install deno-studio@deno
```
Then in a terminal: `studio doctor --install` (Node 22+ and ffmpeg needed) and `studio login`.

## Use
> make a 20 s vertical reel about the pain my last validation found

Your Claude asks five questions once, writes a treatment for your OK, builds, checks and renders, then uploads a
review copy. Open the link, press play, and type when something feels off: the note pins to that frame. Your Claude
reads the notes and fixes them one by one.

## Commands
`studio help` lists them all. Heavy dependencies (Playwright, speech models) install into `~/.deno-studio/`.
Voice uses Kokoro locally by default; `--engine elevenlabs|sarvam` uses your own key (`studio config set
elevenlabs_key …`, typed in your terminal, never in chat).
