/**
 * The public docs, as data. One source renders three ways: the /docs pages (components/docs),
 * Markdown per page (/md/<slug>) and the plain-text bundles for AI tools (/llms.txt, /llms-full.txt).
 *
 * Inline text supports `code`, **bold** and [links](/path). Keep every claim true to the product:
 * tool behaviour comes from apps/api/src/deno_api/mcp_server.py, kit commands from plugin/kit/cli.mjs.
 */

import { CONTACT_EMAIL, INSTALL_CMD, INSTALL_CMD_POSTS, INSTALL_CMD_WIN, MCP_URL, PLUGIN_REPO, SITE_URL } from '@/lib/site';

export type Block =
  | { t: 'p'; text: string }
  | { t: 'h2'; text: string }
  | { t: 'h3'; text: string }
  | { t: 'ul' | 'ol'; items: string[] }
  | { t: 'code'; code: string }
  | { t: 'note'; text: string; warn?: boolean }
  | { t: 'say'; text: string }
  | { t: 'table'; head: string[]; rows: string[][] }
  | { t: 'cards'; items: { title: string; text: string; href: string }[] }
  | { t: 'setupPrompt' }
  | { t: 'setupTabs' }
  | { t: 'tools' }
  | { t: 'prompts' };

export interface DocPage {
  slug: string;
  title: string;
  lead: string;
  group: string;
  blocks: Block[];
}

export const GROUPS = ['Get started', 'Connect your AI', 'MCP reference', 'Studio', 'Guides'] as const;

const CHECK: Block[] = [
  { t: 'h2', text: 'Check it worked' },
  { t: 'p', text: 'Start a new chat and ask this. Your AI should answer with your Deno ideas, or say you have none yet.' },
  { t: 'say', text: 'List my Deno ideas.' },
];

export const DOCS: DocPage[] = [
  /* ------------------------------ Get started ------------------------------ */
  {
    slug: 'index',
    title: 'What Deno is',
    lead: 'Deno lets the AI you already use make your marketing: posts, reels, carousels and launch videos, grounded in real evidence about your idea.',
    group: 'Get started',
    blocks: [
      { t: 'p', text: 'Deno is two things that work together.' },
      { t: 'ul', items: [
        '**A workspace.** It validates your startup idea against real public posts (Reddit, Hacker News, X, LinkedIn, Product Hunt, GitHub) and keeps the evidence, your stories, your writing voice and your brand kit.',
        '**An MCP server.** MCP is the standard way AI apps connect to other products. Once you connect Deno, your Claude or ChatGPT can read all of the above and use it to write and edit your marketing.',
      ] },
      { t: 'h2', text: 'Who does what' },
      { t: 'table', head: ['Job', 'Who does it'], rows: [
        ['Writing, editing, planning', 'Your AI (your Claude or ChatGPT plan)'],
        ['Rendering video', 'Your computer, with the `studio` command'],
        ['Evidence, verdict, voice, stories, brand', 'Deno'],
        ['Checking copy for AI tells and invented numbers', 'Deno'],
        ['Finding licensed footage, images and sound', 'Deno'],
        ['Review notes pinned to a frame', 'Deno dashboard'],
        ['Pressing send on a post', 'You. Deno never posts for you.'],
      ] },
      { t: 'h2', text: 'What you can make' },
      { t: 'ul', items: [
        'A week or a month of posts for LinkedIn, Reddit, X and Hacker News, in your voice.',
        'Launch videos, vertical reels and narrated explainers.',
        'LinkedIn carousels and other still images.',
      ] },
      { t: 'note', text: 'Posts and validation work in any AI app. Making video needs **Claude Code** with the `deno-studio` plugin, because rendering runs on your machine.' },
      { t: 'h2', text: 'Start here' },
      { t: 'cards', items: [
        { title: 'Quickstart', text: 'Connect your AI in about two minutes.', href: '/docs/quickstart' },
        { title: 'Your first video', text: 'From prompt to a reviewed reel.', href: '/docs/first-video' },
        { title: 'Tool reference', text: 'All 19 tools your AI gets.', href: '/docs/tools' },
      ] },
    ],
  },
  {
    slug: 'quickstart',
    title: 'Quickstart',
    lead: 'Connect Deno to your AI app and make your first piece of content. It takes about two minutes.',
    group: 'Get started',
    blocks: [
      { t: 'setupPrompt' },
      { t: 'note', text: `**Are you an AI agent setting this up for someone?** Read [${SITE_URL}/llms-full.txt](/llms-full.txt). It has every page of these docs in plain text.` },
      { t: 'h2', text: 'Before you start' },
      { t: 'ul', items: [
        'A free Deno account. [Create one](/auth?mode=signup).',
        'An AI app: Claude Code, Claude Desktop, claude.ai, ChatGPT or Cursor.',
        'For video: Claude Code and Node 22 or newer. The one-line installer adds the rest.',
      ] },
      { t: 'h2', text: 'Step 1. Connect your AI app' },
      { t: 'p', text: 'The setup prompt above does this for you. To do it by hand, pick the app you use.' },
      { t: 'setupTabs' },
      { t: 'h2', text: 'Step 2. Check it worked' },
      { t: 'p', text: 'Start a new chat and ask this. Your AI should answer with your Deno ideas, or say you have none yet.' },
      { t: 'say', text: 'List my Deno ideas.' },
      { t: 'h2', text: 'Step 3. Make something' },
      { t: 'cards', items: [
        { title: 'Validate an idea', text: '"Validate this idea with Deno: …"', href: '/docs/validate' },
        { title: 'Write a week of posts', text: '"Write a week of posts and save them to Deno."', href: '/docs/posts' },
        { title: 'Make your first video', text: '"Make a 20 second reel about my idea."', href: '/docs/first-video' },
      ] },
      { t: 'h2', text: 'If something goes wrong' },
      { t: 'ul', items: [
        '**The AI says it has no Deno tools.** Start a new chat. Most apps load connectors only when a chat begins.',
        '**Sign-in loops or fails.** Disconnect Deno in your AI app\'s connector settings, then connect again.',
        '**"Your plan includes 5 validation runs a month."** You reached a plan limit. See [pricing](/pricing).',
      ] },
      { t: 'p', text: 'More fixes are in [Troubleshooting](/docs/troubleshooting).' },
    ],
  },
  {
    slug: 'first-video',
    title: 'Your first video',
    lead: 'From one prompt to a reviewed launch reel. Plan for about 30 minutes the first time.',
    group: 'Get started',
    blocks: [
      { t: 'h2', text: 'What you need' },
      { t: 'ul', items: [
        'Claude Code with the `deno-studio` plugin. See [Install the plugin](/docs/studio-install).',
        'One validated idea in Deno. See [Validate an idea](/docs/validate).',
        'A Claude Pro or Max plan is recommended. Video work uses a lot of AI.',
      ] },
      { t: 'h2', text: '1. Ask for the video' },
      { t: 'say', text: 'Make a 20 second vertical reel about the pain my last validation found.' },
      { t: 'p', text: 'Your Claude asks five questions once (audience, tone, what to show, and so on), then writes a short treatment. Read it and say yes or what to change.' },
      { t: 'h2', text: '2. Claude builds and renders' },
      { t: 'p', text: 'Claude writes the film as HTML where every frame is a function of time, then runs the `studio` command to check it, render it with headless Chromium and ffmpeg, and mix the sound. All of this happens on your computer.' },
      { t: 'h2', text: '3. Review on your dashboard' },
      { t: 'p', text: 'Claude uploads a review copy (a poster and a contact sheet, about 250 KB) and gives you a link. Open it, press play, and type a note when something feels off. The note pins to that frame.' },
      { t: 'h2', text: '4. Ask for the fixes' },
      { t: 'say', text: 'Read my review notes on the reel and fix them one by one.' },
      { t: 'p', text: 'Claude reads each note, makes the change, renders a new version and answers under your note. Repeat until you approve it.' },
      { t: 'note', text: 'The finished MP4 is in the `out/` folder of the project on your disk. Deno does not store your video files.' },
    ],
  },

  /* ---------------------------- Connect your AI ---------------------------- */
  {
    slug: 'claude-code',
    title: 'Connect Claude Code',
    lead: 'The full setup: posts, validation and video. Claude Code is the only app that can render video today.',
    group: 'Connect your AI',
    blocks: [
      { t: 'h2', text: 'Install with one command' },
      { t: 'p', text: 'Open a terminal (on a Mac: the Terminal app) and paste this line. It works on macOS, Linux and WSL.' },
      { t: 'code', code: INSTALL_CMD },
      { t: 'p', text: 'On Windows, paste this into PowerShell instead:' },
      { t: 'code', code: INSTALL_CMD_WIN },
      { t: 'p', text: 'The installer is safe to run again. Each step skips what is already done. [Read the script](/install.sh) before you run it if you like. In order, it:' },
      { t: 'ol', items: [
        'Checks for Claude Code, and offers to install it with Anthropic\'s official installer if it is missing.',
        'Adds the `deno-studio` plugin: the Deno MCP server, seven skills (video, sound, captions, voice, stills, posts, review), three agents (director, scene-builder, reviewer) and the `studio` command.',
        'Puts `studio` in `~/.local/bin` so it also works in a normal terminal.',
        'Installs what the renderer needs (Chromium, plus ffmpeg if you have none) into `~/.deno-studio/`. About 150 MB. Nothing system-wide.',
        'Opens your browser once so you can sign in to Deno. You never type a password or a key into the terminal.',
      ] },
      { t: 'p', text: 'Then open Claude Code, type `/mcp`, pick **deno** and choose **Authenticate**.' },
      { t: 'note', text: 'Video needs Node 22 or newer. If you do not have it, the installer tells you the command for your system and still sets up posts and validation.' },
      { t: 'h2', text: 'Or install by hand' },
      { t: 'p', text: 'Type these two lines inside Claude Code:' },
      { t: 'code', code: `/plugin marketplace add ${PLUGIN_REPO}\n/plugin install deno-studio@deno` },
      { t: 'p', text: 'Then ask Claude to run `studio doctor --install` and `studio login` for you. The `studio` command is only on the path inside Claude Code unless you used the installer.' },
      { t: 'h2', text: 'Posts only, no video' },
      { t: 'p', text: 'If you do not need video, connect just the server:' },
      { t: 'code', code: INSTALL_CMD_POSTS },
      { t: 'p', text: 'That is the same as running `claude mcp add --transport http --scope user deno ' + MCP_URL + '` yourself.' },
      { t: 'p', text: 'Then run `/mcp` inside Claude Code and sign in to Deno.' },
      ...CHECK,
      { t: 'h2', text: 'Updating' },
      { t: 'p', text: 'To get new skills and kit fixes, run `/plugin marketplace update deno` inside Claude Code.' },
    ],
  },
  {
    slug: 'claude',
    title: 'Connect Claude Desktop and claude.ai',
    lead: 'Use Deno for validation, posts and content plans in the Claude apps.',
    group: 'Connect your AI',
    blocks: [
      { t: 'ol', items: [
        'Open **Settings**, then **Connectors**.',
        'Click **Add custom connector**.',
        'Name it **Deno** and paste the address below.',
        'Click **Connect**, sign in to Deno and press **Allow**.',
        'Start a new chat so the tools load.',
      ] },
      { t: 'code', code: MCP_URL },
      { t: 'note', text: 'These apps cannot render video. Your Claude can still plan a film (treatment, copy, shot list) and check the copy here. Finish rendering in Claude Code.' },
      ...CHECK,
    ],
  },
  {
    slug: 'chatgpt',
    title: 'Connect ChatGPT',
    lead: 'Use Deno from ChatGPT with a custom connector.',
    group: 'Connect your AI',
    blocks: [
      { t: 'ol', items: [
        'Open **Settings**, then **Connectors** (it may be under "Apps and connectors").',
        'Create a new connector and paste the address below.',
        'Choose **OAuth**, sign in to Deno and press **Allow**.',
        'Start a new chat so the tools load.',
      ] },
      { t: 'code', code: MCP_URL },
      { t: 'note', warn: true, text: 'Reading works on every ChatGPT plan. Whether ChatGPT can call tools that save data (saving drafts, starting a validation) depends on your ChatGPT plan and mode. If saving fails, use Claude or the Deno dashboard for that step.' },
      ...CHECK,
    ],
  },
  {
    slug: 'cursor',
    title: 'Connect Cursor',
    lead: 'Add Deno as a remote MCP server in Cursor.',
    group: 'Connect your AI',
    blocks: [
      { t: 'p', text: 'Add this to `.cursor/mcp.json` in your project (or your global MCP config). Keep any servers that are already there.' },
      { t: 'code', code: `{\n  "mcpServers": {\n    "deno": { "url": "${MCP_URL}" }\n  }\n}` },
      { t: 'p', text: 'Reload Cursor, open the MCP settings and sign in to Deno when it asks.' },
      ...CHECK,
    ],
  },
  {
    slug: 'other-clients',
    title: 'Connect any MCP client',
    lead: 'Deno is a standard remote MCP server. Any client that supports Streamable HTTP and OAuth can use it.',
    group: 'Connect your AI',
    blocks: [
      { t: 'table', head: ['Setting', 'Value'], rows: [
        ['Address', `\`${MCP_URL}\``],
        ['Transport', 'Streamable HTTP (stateless)'],
        ['Sign-in', 'OAuth 2.1 with dynamic client registration'],
        ['API key', 'None'],
      ] },
      { t: 'h2', text: 'Clients that only run local servers' },
      { t: 'p', text: 'Bridge the remote server with `mcp-remote`:' },
      { t: 'code', code: `npx mcp-remote ${MCP_URL}` },
      { t: 'h2', text: 'Building your own agent' },
      { t: 'p', text: 'Point your MCP client library at the address. On connect, the server sends instructions that tell the model where to start: `list_ideas`, then `get_founder_context`. See [How the server works](/docs/how-it-works).' },
    ],
  },

  /* ----------------------------- MCP reference ----------------------------- */
  {
    slug: 'how-it-works',
    title: 'How the server works',
    lead: 'What Deno\'s MCP server exposes and how a session usually goes.',
    group: 'MCP reference',
    blocks: [
      { t: 'ul', items: [
        `**Address:** \`${MCP_URL}\``,
        '**19 tools**, **5 prompts** and one resource, `deno://playbooks/{topic}`.',
        '**Stateless.** Every call stands alone, so there is no session to keep alive.',
        '**Your data only.** Every call runs as the signed-in founder. A founder can never read another founder\'s data.',
      ] },
      { t: 'h2', text: 'The usual order of calls' },
      { t: 'h3', text: 'Posts' },
      { t: 'ol', items: [
        '`list_ideas` to find the idea.',
        '`get_founder_context` for the evidence, stories, voice and taste.',
        '`create_content_plan` with the briefs your AI wrote.',
        '`save_draft` for each post. Deno gates it and scores it.',
        'If a draft is saved as "needs work", fix the listed lines and call `save_draft` again.',
      ] },
      { t: 'h3', text: 'Video and stills' },
      { t: 'ol', items: [
        '`get_founder_context`, then `get_playbook` and `list_styles`.',
        '`search_recipes` for a proven format and `search_media` for licensed assets.',
        'Build and render on the founder\'s machine with the `studio` kit.',
        'Review on the founder\'s machine: `studio review`, then `studio notes --wait` and `studio reply`.',
        '`save_video` (the kit calls it through `studio upload`) saves the approved version to the dashboard.',
        'Notes left on the dashboard: `get_review_notes`, fix each note, then `reply_note`.',
      ] },
      { t: 'h2', text: 'Rules the model should follow' },
      { t: 'ul', items: [
        'Write only from what Deno returns. Never invent numbers, quotes or features.',
        'Fix every `check_copy` finding with severity "block". Do not argue with the gates.',
        'Never post, vote or message on the founder\'s behalf.',
      ] },
    ],
  },
  {
    slug: 'tools',
    title: 'Tools',
    lead: 'The 19 tools your AI gets. You never call them yourself; your AI picks the right one.',
    group: 'MCP reference',
    blocks: [
      { t: 'p', text: '"Changes data" means the tool saves something to your Deno account or uses part of a monthly limit. The others only read.' },
      { t: 'tools' },
    ],
  },
  {
    slug: 'prompts',
    title: 'Prompts',
    lead: 'Five ready prompts that start a whole job. In Claude apps they appear in the prompt or slash menu.',
    group: 'MCP reference',
    blocks: [
      { t: 'prompts' },
      { t: 'p', text: 'Each prompt loads the matching skill (video, stills or posts) so your AI follows Deno\'s process: questions first, a treatment for your OK, then the build.' },
    ],
  },
  {
    slug: 'auth',
    title: 'Sign-in and permissions',
    lead: 'How your AI app is allowed to use your Deno account, and how to take that back.',
    group: 'MCP reference',
    blocks: [
      { t: 'ul', items: [
        'Sign-in is **OAuth 2.1**. Your AI app opens a Deno page in your browser; you sign in and press Allow.',
        'Your AI app never sees your password. There is no API key to copy or leak.',
        'The app gets access to your own Deno data only: ideas, evidence, posts, Studio items and notes.',
      ] },
      { t: 'h2', text: 'Remove access' },
      { t: 'p', text: 'Disconnect Deno in your AI app\'s connector settings. To sign the `studio` command out, run `studio logout`.' },
      { t: 'h2', text: 'What Deno will never do' },
      { t: 'ul', items: [
        'Post, vote or send messages on any platform.',
        'Store your MP4 files, unless you ask for a review copy to be uploaded.',
      ] },
    ],
  },
  {
    slug: 'errors',
    title: 'Errors and limits',
    lead: 'What the messages mean and what to do about them.',
    group: 'MCP reference',
    blocks: [
      { t: 'table', head: ['Message', 'What it means', 'What to do'], rows: [
        ['Your plan includes N validation runs a month.', 'You used this month\'s validations.', 'Wait for next month or see [pricing](/pricing).'],
        ['You already have a validation running.', 'One validation at a time.', 'Wait for it to finish, or cancel it on the dashboard.'],
        ['queue_position in get_validation', 'Other founders\' runs are ahead of yours.', 'Keep polling. Your place is shown.'],
        ['The line is full (503)', 'Too many runs are waiting.', 'Try again at the time the message gives.'],
        ['A draft saved as "needs work"', 'A gate found AI tells, an invented number or a rule conflict.', 'Fix the listed lines and save again.'],
        ['save_video refused with final=true', 'An asset has no commercial licence or credit.', 'Replace the asset, or add the credit.'],
      ] },
      { t: 'h2', text: 'Timing' },
      { t: 'ul', items: [
        'A validation takes about 3 to 4 minutes and always finishes in under 5.',
        'Poll `get_validation` every 20 to 30 seconds instead of waiting on one call.',
      ] },
    ],
  },

  /* --------------------------------- Studio -------------------------------- */
  {
    slug: 'studio-install',
    title: 'Install the plugin',
    lead: 'The deno-studio plugin gives Claude Code everything it needs to make video on your machine.',
    group: 'Studio',
    blocks: [
      { t: 'h2', text: 'Requirements' },
      { t: 'ul', items: ['Claude Code (the installer can add it)', 'Node 22 or newer', 'ffmpeg (the installer adds its own copy if you have none)', 'A Claude Pro or Max plan is recommended'] },
      { t: 'h2', text: 'Install' },
      { t: 'p', text: 'Paste this into a terminal (macOS, Linux, WSL):' },
      { t: 'code', code: INSTALL_CMD },
      { t: 'p', text: 'On Windows, in PowerShell:' },
      { t: 'code', code: INSTALL_CMD_WIN },
      { t: 'p', text: 'It adds the plugin, puts the `studio` command on your path, installs the renderer and signs you in. See [Connect Claude Code](/docs/claude-code) for each step, or how to do it by hand.' },
      { t: 'h2', text: 'Optional extras' },
      { t: 'ul', items: [
        '`studio doctor --install --voice` adds local voiceover (Kokoro).',
        '`studio doctor --install --captions` adds word-timed captions.',
        '`studio doctor --install --matte` adds background removal.',
        'Heavy dependencies install into `~/.deno-studio/`, not into your project.',
      ] },
      { t: 'h2', text: 'Your own keys (optional)' },
      { t: 'p', text: 'Everything works with zero API keys. Keys only add choice. Set them in your terminal, never in chat:' },
      { t: 'code', code: 'studio config set elevenlabs_key <your key>' },
    ],
  },
  {
    slug: 'studio-cli',
    title: 'The studio command',
    lead: 'The local kit that renders, checks, captions, voices and mixes. Your Claude runs it for you; this page is for when you want to run it yourself.',
    group: 'Studio',
    blocks: [
      { t: 'p', text: 'Run `studio help` for the full list. Everything a command writes goes in the project folder; renders go in `out/`.' },
      { t: 'table', head: ['Group', 'Commands', 'What they do'], rows: [
        ['Setup', 'doctor, login, logout, config set, ideas', 'Check the machine, sign in, list your Deno ideas.'],
        ['Project', 'init, preview, verify, timeline', 'Start a film folder, preview it, check it against the rules.'],
        ['Shape', 'place, fill', 'Block out the timeline with placeholders, then fill each one.'],
        ['Look', 'check, sheet, strip, crop', 'One check (rules, a contact sheet at phone size and colour numbers) after each draft, plus frame strips, so the AI can see its own work.'],
        ['Render', 'render, still', 'Render video (draft or final, one or many ratios) or still pages.'],
        ['Media', 'search, fetch, download, frames, matte, capture', 'Find and bring in licensed media; record a web page.'],
        ['Listen', 'transcribe, silence, loudness', 'Read what is in an audio or video file.'],
        ['Sound', 'beats, voice, sfx, captions, mix', 'Beat analysis, voiceover, sound effects, captions, final mix.'],
        ['Review', 'review, notes, reply', 'A review page on your machine: frame-by-frame notes your AI reads and answers.'],
        ['Deliver', 'upload', 'Save a version to your Deno library (a poster and a contact sheet, never the video).'],
      ] },
      { t: 'h2', text: 'Commands you may run yourself' },
      { t: 'code', code: 'studio init my-reel --ratio 9:16 --duration 20\nstudio preview\nstudio render --draft\nstudio review\nstudio upload --draft --summary "first cut"' },
      { t: 'note', text: '`studio upload` sends a poster and a contact sheet (about 250 KB). It needs a clean, current `studio verify` first. Add `--with-video` only if you want the MP4 uploaded too.' },
    ],
  },
  {
    slug: 'review',
    title: 'Review and notes',
    lead: 'How you tell your AI what to change, without writing a long message.',
    group: 'Studio',
    blocks: [
      { t: 'h2', text: 'On your machine (every frame, nothing uploaded)' },
      { t: 'ol', items: [
        'When a draft is ready, your AI gives you a link that starts with `http://127.0.0.1`. That page runs on your own computer.',
        'The video plays from your disk. It is never uploaded to Deno or anywhere else.',
        'Press play, or step one frame at a time with the arrow keys.',
        'Start typing when something feels off. The note pins to that frame. Click the picture to point at a spot, or press `[` and `]` to mark a time range.',
        'Press **I\'m done reviewing**. Your AI is waiting for that: it reads the notes and fixes them one by one.',
        'Each note gets an answer under it (fixed, or why not), and the next round loads on the same page.',
      ] },
      { t: 'note', text: 'Your AI starts the page with `studio review`. It works with any AI tool that can run the `studio` kit, because the notes are a plain file in the film folder (`review/notes.json`).' },
      { t: 'h2', text: 'On your dashboard' },
      { t: 'ol', items: [
        'Go to **Studio** on your dashboard and open a saved version.',
        'Scrub the contact sheet (one picture per moment), or play your own video link if you added one.',
        'Notes work the same way, and your AI reads them with `get_review_notes`.',
        'Press **Approve** when it is right.',
      ] },
      { t: 'h2', text: 'System notes' },
      { t: 'p', text: 'Notes by "system" are Deno\'s automated checks: reading time, words per screen, licences and copy gates. Your AI fixes those too.' },
      { t: 'h2', text: 'Taste memory' },
      { t: 'p', text: 'What you ask to fix on the dashboard is kept as your taste. Next time, your AI reads it through `get_founder_context` and avoids the same mistake.' },
    ],
  },
  {
    slug: 'media',
    title: 'Media and licences',
    lead: 'Where footage, images and sound come from, and what is allowed in a final video.',
    group: 'Studio',
    blocks: [
      { t: 'h2', text: 'Sources' },
      { t: 'ul', items: [
        '**No keys needed:** Wikimedia Commons, Internet Archive, Openverse, synthesized sound effects, and YouTube through yt-dlp for your own or licensed material.',
        '**With your own key:** Pexels, Pixabay, Freesound and ElevenLabs sound effects.',
        '**Icons:** Lucide and Tabler.',
      ] },
      { t: 'p', text: 'Use real product screenshots for UI, never stock.' },
      { t: 'h2', text: 'Licences' },
      { t: 'table', head: ['Licence', 'In a final video?', 'Credit needed?'], rows: [
        ['CC0, Pexels, Pixabay, your own', 'Yes', 'No'],
        ['CC BY', 'Yes', 'Yes'],
        ['CC BY-SA, public-domain archive, generated', 'Yes, with a warning', 'Depends'],
        ['CC BY-NC, CC BY-ND', 'No', 'n/a'],
        ['Unknown', 'Draft only', 'n/a'],
      ] },
      { t: 'p', text: '`studio fetch <id>` downloads an asset and records its credit in `CREDITS.json`. `studio upload --final` refuses a film with an asset that is not allowed.' },
    ],
  },
  {
    slug: 'rulebook',
    title: 'Rulebook and styles',
    lead: 'The written rules your AI follows, and how to change them.',
    group: 'Studio',
    blocks: [
      { t: 'h2', text: 'Rulebook' },
      { t: 'p', text: 'Open **Rulebook** on your dashboard to read every rule in plain words. Strike out a rule you disagree with and your AI stops following it. A few core rules (licensing, honesty checks, the render contract) cannot be struck.' },
      { t: 'h2', text: 'Styles' },
      { t: 'p', text: 'Pick one named style per film. One name beats five adjectives.' },
      { t: 'ul', items: ['dark-keynote', 'flat-explainer', 'ink-wash', 'living-ui', 'paper-cutout', 'risograph', 'swiss-kinetic', 'vertical-captions'] },
      { t: 'say', text: 'Show me the Deno Studio styles and suggest one for a developer tool.' },
      { t: 'h2', text: 'Brand kit' },
      { t: 'p', text: 'Ask your AI to "set my brand kit from my website". Deno reads your colours, fonts and logo, and every video and image uses them.' },
    ],
  },

  /* --------------------------------- Guides -------------------------------- */
  {
    slug: 'validate',
    title: 'Validate an idea',
    lead: 'Find out if the idea is worth marketing before you make anything.',
    group: 'Guides',
    blocks: [
      { t: 'say', text: 'Validate this idea with Deno: a refund tracker for small Shopify stores. https://example.com' },
      { t: 'ol', items: [
        'Your AI calls `validate_idea`. Deno collects real posts about the problem.',
        'Analysts argue from what they find, a critic attacks the result, and a judge checks every claim against the post it cites.',
        'After 3 to 4 minutes you get **Build**, **Pivot**, **Kill** or **not enough evidence**, with a confidence number.',
        'Every kept claim links to its source. Claims the judge could not verify are dropped.',
      ] },
      { t: 'p', text: 'You can also do this on the dashboard: open **Ideas**, paste the idea and press run.' },
      { t: 'note', text: 'Add your product\'s website or GitHub URL to the idea. Deno reads it and the result is more specific.' },
    ],
  },
  {
    slug: 'posts',
    title: 'Write a week of posts',
    lead: 'Posts in your voice, written from your evidence and your real stories.',
    group: 'Guides',
    blocks: [
      { t: 'h2', text: 'Before you start' },
      { t: 'ul', items: [
        'Add two or three writing samples on the dashboard so Deno can match your voice.',
        'Add a few real stories to your Story Bank: a number, a failure, a customer quote.',
      ] },
      { t: 'h2', text: 'Ask' },
      { t: 'say', text: 'Write a week of posts for my idea on LinkedIn and X and save them to Deno.' },
      { t: 'ol', items: [
        'Your AI reads your context and writes a plan: at most one promotional post in five.',
        'It saves the plan to your Deno calendar.',
        'It writes each post and saves it. Deno checks every draft for AI tells, invented numbers, community rules and your voice.',
        'A draft that fails is marked "needs work" with the exact lines to fix. Your AI fixes and saves again.',
      ] },
      { t: 'h2', text: 'Send' },
      { t: 'p', text: 'Open **Posts and calendar** on the dashboard, approve a draft, copy it and post it yourself. Deno never posts for you.' },
    ],
  },
  {
    slug: 'troubleshooting',
    title: 'Troubleshooting',
    lead: 'The problems people hit most, and the fix for each.',
    group: 'Guides',
    blocks: [
      { t: 'h2', text: 'Connecting' },
      { t: 'ul', items: [
        '**No Deno tools in the chat.** Start a new chat. Check the connector is switched on for that chat.',
        '**Sign-in loops or fails.** Disconnect Deno in the connector settings and connect again. Check your browser allows pop-ups.',
        '**"Not found" for the address.** The address must end in `/mcp`.',
      ] },
      { t: 'h2', text: 'Studio' },
      { t: 'ul', items: [
        '**`studio` is not found.** Run the installer again (`' + INSTALL_CMD + '`), then open a new terminal. If it warns that `~/.local/bin` is not on your path, add the line it prints to your shell profile.',
        '**Render fails.** Run `studio doctor`. It names what is missing (Node, ffmpeg, Chromium).',
        '**Upload refused.** Run `studio verify` and fix what it lists, then upload again.',
      ] },
      { t: 'h2', text: 'Validation' },
      { t: 'ul', items: [
        '**Stuck on queued.** Other runs are ahead. `get_validation` shows your place.',
        '**"Not enough evidence".** The idea is too broad or too new. Name the customer and the problem more exactly and run again.',
      ] },
      { t: 'h2', text: 'Still stuck' },
      { t: 'p', text: `Paste [the full docs](/llms-full.txt) into your AI and describe the problem, or write to ${CONTACT_EMAIL}.` },
    ],
  },
];

export function findDoc(slug: string): DocPage | undefined {
  return DOCS.find((d) => d.slug === slug);
}

export function docHref(slug: string): string {
  return slug === 'index' ? '/docs' : `/docs/${slug}`;
}

/** URL-safe id for an h2. */
export function headingId(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
