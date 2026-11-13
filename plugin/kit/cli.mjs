#!/usr/bin/env node
// Deno Studio kit: make code-rendered video and images on your machine, saved to your Deno dashboard (docs/18).
import { login, logout, setConfig, config, apiUrl } from './lib/api.mjs';
import { beats } from './lib/beats.mjs';
import { captions } from './lib/captions.mjs';
import { capture, crop, frames, sheet, still, strip } from './lib/look.mjs';
import { loudness, silence, transcript } from './lib/listen.mjs';
import { matte } from './lib/matte.mjs';
import { mix } from './lib/mix.mjs';
import { doctor, fetchAsset, ideas, init, notes, preview, search, upload } from './lib/project.mjs';
import { render } from './lib/render.mjs';
import { download, generateSfx } from './lib/sources.mjs';
import { fill, place, timeline } from './lib/timeline.mjs';
import { parseArgs, projectDir, info } from './lib/util.mjs';
import { verify } from './lib/verify.mjs';
import { voice } from './lib/voice.mjs';

const HELP = `studio — Deno Studio kit (render, check, caption, voice and mix on your machine)

Setup      doctor [--install [--voice] [--captions] [--matte]] · login · logout · config set <key> <value> · ideas
Project    init <folder> [--idea id] [--ratio 9:16,16:9] [--duration 20] [--style name] [--still --pages 8]
           preview · verify [--formats 9:16] [--chapter id] · timeline
Shape      place <id> --start 2 --end 4.5 [--label "what it shows"] [--kind graphic] [--as-chapter] · fill <id>
Look       sheet [--phone] [--live] [--at 1,4.5,9 | --range 10,14 --every 0.5] [--stats] [--reference ref.jpg] [--audio]
           strip --at 4.2 [--n 12] · crop --at 7 --box x,y,w,h
Render     render [--draft] [--formats 9:16,16:9] [--from 6 --to 9] [--sub 3] · still [--pdf]
Media      search <video|image|sfx|music|icon|youtube> <query> · fetch <id> [--as whoosh] · download "<link>"|"ytsearch3:<q>" [--license own]
           frames <video> [--name n] · matte <name> · capture <url>
Listen     transcribe <media> [--format words|text|srt|json] · silence <media> · loudness <media>
Sound      beats <track> · voice <script.md> [--engine kokoro|elevenlabs|sarvam] · sfx "<sound>" [--as kind] [--at 2.4] (free synth; ElevenLabs if keyed)
           captions <audio> [--text script.md] [--preset beast-mode|billboard|sideline|butter-serif] · mix [--bed]
Deliver    upload [--idea id] [--summary "what changed"] [--final] [--brief id] [--video-url https://…] [--with-video]
           · notes [item_id] [--all]   (upload sends poster + contact sheet, ~250 KB; the MP4s stay on this disk.
           It needs a clean, current verify and a sheet of the mixed file)

Everything a command writes goes in the project folder (out/ for renders). Docs: get_playbook via the Deno MCP.`;

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
const commands = {
  doctor: () => doctor(args),
  login: () => login(),
  logout: () => logout(),
  ideas: () => ideas(),
  config: () => {
    const [, action, key, ...rest] = args._;
    if (action === 'set' && key) {
      setConfig(key, rest.join(' '));
      return info(`saved ${key}${/key|token|secret/i.test(key) ? ' (kept on this machine only)' : ''}`);
    }
    const c = config();
    for (const k of Object.keys(c)) info(`${k} = ${/key|token|secret/i.test(k) ? '••••' : c[k]}`);
    info(`api_url (in use) = ${apiUrl()}`);
  },
  init: () => init(args),
  search: () => search(args),
  notes: () => notes(projectDir(false), args),
  preview: () => preview(projectDir(), args),
  verify: () => verify(projectDir(), args),
  timeline: () => timeline(projectDir()),
  place: () => place(projectDir(), args),
  fill: () => fill(projectDir(), args),
  download: () => download(projectDir(), args),
  matte: () => matte(projectDir(), args),
  transcribe: () => transcript(projectDir(), args),
  silence: () => silence(projectDir(), args),
  loudness: () => loudness(projectDir(), args),
  sfx: () => generateSfx(projectDir(), args),
  sheet: () => sheet(projectDir(), args),
  strip: () => strip(projectDir(), args),
  crop: () => crop(projectDir(), args),
  render: () => render(projectDir(), args),
  still: () => still(projectDir(), args),
  frames: () => frames(projectDir(), args),
  capture: () => capture(projectDir(), args),
  fetch: () => fetchAsset(projectDir(), args),
  beats: () => beats(projectDir(), args),
  captions: () => captions(projectDir(), args),
  voice: () => voice(projectDir(), args),
  mix: () => mix(projectDir(), args),
  upload: () => upload(projectDir(), args),
};

if (!cmd || cmd === 'help' || args.help) {
  info(HELP);
} else if (!commands[cmd]) {
  process.stderr.write(`studio: unknown command "${cmd}"\n\n${HELP}\n`);
  process.exitCode = 2;
} else {
  try {
    await commands[cmd]();
  } catch (err) {
    process.stderr.write(`studio ${cmd}: ${err.message}\n`);
    process.exitCode = 1;
  }
}
