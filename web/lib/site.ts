/** Public addresses and the one-paste setup prompt, shared by the landing page, docs and dashboard. */

export const MCP_URL = 'https://deno-api-swart.vercel.app/mcp';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://deno-web-eight.vercel.app').replace(/\/$/, '');
export const PLUGIN_REPO = 'Atul-Chahar/DENO';

/** Where people write to us. Set NEXT_PUBLIC_CONTACT_EMAIL in Vercel to a mailbox that exists. */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'hello@deno.gtm';

/** The one-line installers (web/public/install.sh and install.ps1). */
export const INSTALL_CMD = `curl -fsSL ${SITE_URL}/install.sh | bash`;
export const INSTALL_CMD_WIN = `irm ${SITE_URL}/install.ps1 | iex`;
export const INSTALL_CMD_POSTS = `curl -fsSL ${SITE_URL}/install.sh | bash -s -- --posts-only`;
export const INSTALL_CMD_POSTS_WIN = `$env:DENO_POSTS_ONLY="1"; irm ${SITE_URL}/install.ps1 | iex`;

/** One-click installs for editors that accept an MCP deeplink. */
export const CURSOR_INSTALL_URL = `cursor://anysphere.cursor-deeplink/mcp/install?name=deno&config=${encodeURIComponent(btoa(JSON.stringify({ url: MCP_URL })))}`;
export const VSCODE_INSTALL_URL = `vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name: 'deno', type: 'http', url: MCP_URL }))}`;

/**
 * A prompt a founder pastes into any AI agent so the agent sets Deno up by itself.
 * Keep it self-contained: the agent may have no web access, so every step is spelled out here.
 */
export const SETUP_PROMPT = `Set up Deno for me.

Deno is a marketing workspace with an MCP server. Once it is connected, you (my AI) can read my validated startup idea, the evidence behind it, my stories and my writing voice, and then write posts, plan content and make marketing videos and carousels that are saved to my Deno dashboard.

Facts you need
- MCP server address: ${MCP_URL}
- Transport: Streamable HTTP.
- Sign-in: OAuth in my browser with my Deno account. There is no API key. Never ask me for a password or a token.
- I need a free Deno account first: ${SITE_URL}/auth?mode=signup
- Full docs in plain text: ${SITE_URL}/llms-full.txt

Step 1. Work out which app you are running in, then follow the matching section. If you are not sure, ask me.

A) Claude Code (you can run shell commands)
1. On macOS, Linux or WSL, run:
   curl -fsSL ${SITE_URL}/install.sh | bash -s -- --yes
   On Windows PowerShell, run instead:
   $env:DENO_YES="1"; irm ${SITE_URL}/install.ps1 | iex
2. The installer adds the deno-studio plugin (the Deno MCP server, the video skills and a local command called "studio"), installs what the video renderer needs into ~/.deno-studio, and opens my browser so I can sign in. Wait while I sign in.
3. If it says Node 22 or newer is missing, tell me the exact command to install Node on my system, then run the installer again.
4. If I only want posts and no video, run instead:
   curl -fsSL ${SITE_URL}/install.sh | bash -s -- --posts-only
5. When it finishes, tell me to restart Claude Code, type /mcp, pick "deno" and choose Authenticate.

B) Cursor, VS Code, Windsurf or another editor with an MCP config file
1. Add this server to the MCP config (for Cursor: .cursor/mcp.json in the project, or the global one):
   { "mcpServers": { "deno": { "url": "${MCP_URL}" } } }
2. Keep any servers that are already in the file.
3. Tell me to reload the editor and to approve the sign-in when it opens.

C) Claude Desktop or claude.ai (you cannot add connectors yourself)
Give me these exact clicks:
1. Open Settings, then Connectors.
2. Click "Add custom connector".
3. Name: Deno. Address: ${MCP_URL}
4. Click Connect, sign in to Deno, then press Allow.
5. Start a new chat so the tools load.

D) ChatGPT (you cannot add connectors yourself)
Give me these exact clicks:
1. Open Settings, then Connectors (it may be under "Apps and connectors").
2. Create a new connector with the address ${MCP_URL} and choose OAuth.
3. Sign in to Deno and press Allow.
4. Start a new chat so the tools load.

E) Any other MCP client
Add a remote MCP server with the address above (Streamable HTTP, OAuth). If the client only supports local servers, use: npx mcp-remote ${MCP_URL}

Step 2. Check that it worked
Call the Deno tool "list_ideas". If it returns my ideas, or an empty list, the connection works. If the tool is missing, tell me to start a new chat. If sign-in fails, tell me to disconnect Deno in the connector settings and connect again.

Step 3. Ask who I am (once)
Ask me "Who are you?" with these choices: founder, content creator, indie hacker / developer, agency / marketer, educator / coach. Save my answer with the Deno tool "set_persona". It sets the format of every video you make for me. If I skip it, move on.

Step 4. Tell me what I can do now
In three short lines, offer me these and ask which I want first:
1. Validate a startup idea against real public posts (tool: validate_idea, takes 3 to 4 minutes).
2. Write a week of posts in my voice and save them to Deno (tools: get_founder_context, create_content_plan, save_draft).
3. Make a launch video or reel (needs Claude Code with the deno-studio plugin).

Rules while you work
- Do one step at a time and show me the result before the next one.
- Do not invent numbers, quotes or features. Use only what Deno returns.
- Deno never posts for me. Do not try to post anything on my behalf.`;

/** Prompts a founder can paste once Deno is connected. */
export const STARTER_PROMPTS: { tag: string; tone: 'green' | 'peach' | 'blue' | 'amber'; text: string }[] = [
  { tag: 'Video', tone: 'green', text: 'Make a 20 second launch video for my validated idea.' },
  { tag: 'Edit', tone: 'peach', text: 'Read my review notes on my latest Deno video and fix them one by one.' },
  { tag: 'Posts', tone: 'blue', text: 'Write a week of posts from my Story Bank and save them to Deno.' },
  { tag: 'Carousel', tone: 'amber', text: 'Turn my strongest evidenced pain into a LinkedIn carousel.' },
];
