/** Renders the docs data as Markdown, for /md/<slug>, /llms.txt and /llms-full.txt. */

import { DOCS, GROUPS, docHref, type Block, type DocPage } from '@/lib/docs/content';
import { PROMPTS, TOOLS } from '@/lib/docs/tools';
import { MCP_URL, PLUGIN_REPO, SETUP_PROMPT, SITE_URL } from '@/lib/site';

/** Site-relative links become absolute so the text works outside the site. */
function abs(text: string): string {
  return text.replace(/\]\((\/[^)]*)\)/g, (_m, path: string) => `](${SITE_URL}${path})`);
}

function table(head: string[], rows: string[][]): string {
  const line = (cells: string[]) => `| ${cells.map((c) => abs(c).replace(/\|/g, '\\|')).join(' | ')} |`;
  return [line(head), `| ${head.map(() => '---').join(' | ')} |`, ...rows.map(line)].join('\n');
}

const SETUP_TABS_MD = `### Claude Code
Type inside Claude Code:
\`\`\`
/plugin marketplace add ${PLUGIN_REPO}
/plugin install deno-studio@deno
\`\`\`
Then in a terminal (needs Node 22+ and ffmpeg):
\`\`\`
studio doctor --install
studio login
\`\`\`
Posts only, no video: \`claude mcp add --transport http deno ${MCP_URL}\`

### Claude Desktop and claude.ai
1. Open Settings, then Connectors.
2. Click "Add custom connector".
3. Name it Deno and paste \`${MCP_URL}\`.
4. Click Connect, sign in to Deno and press Allow.
5. Start a new chat.

### ChatGPT
1. Open Settings, then Connectors.
2. Create a new connector with the address \`${MCP_URL}\` and choose OAuth.
3. Sign in to Deno and press Allow.
4. Start a new chat.

### Cursor
Add to \`.cursor/mcp.json\`, reload, then sign in:
\`\`\`json
{ "mcpServers": { "deno": { "url": "${MCP_URL}" } } }
\`\`\``;

function block(b: Block): string {
  switch (b.t) {
    case 'p':
      return abs(b.text);
    case 'h2':
      return `## ${b.text}`;
    case 'h3':
      return `### ${b.text}`;
    case 'ul':
      return b.items.map((i) => `- ${abs(i)}`).join('\n');
    case 'ol':
      return b.items.map((i, n) => `${n + 1}. ${abs(i)}`).join('\n');
    case 'code':
      return `\`\`\`\n${b.code}\n\`\`\``;
    case 'note':
      return `> ${b.warn ? '**Note:** ' : ''}${abs(b.text)}`;
    case 'say':
      return `Say to your AI:\n\n> ${b.text}`;
    case 'table':
      return table(b.head, b.rows);
    case 'cards':
      return b.items.map((c) => `- [${c.title}](${SITE_URL}${c.href}): ${c.text}`).join('\n');
    case 'setupPrompt':
      return `## The setup prompt\n\nPaste this into any AI agent and it sets Deno up for you.\n\n\`\`\`\n${SETUP_PROMPT}\n\`\`\``;
    case 'setupTabs':
      return SETUP_TABS_MD;
    case 'tools':
      return table(
        ['Tool', 'Title', 'Changes data', 'Arguments', 'What it does'],
        TOOLS.map((t) => [`\`${t.name}\``, t.title, t.writes ? 'Yes' : 'No', t.args, t.does]),
      );
    case 'prompts':
      return table(
        ['Prompt', 'Title', 'Arguments (defaults)', 'What it does'],
        PROMPTS.map((p) => [`\`${p.name}\``, p.title, p.args, p.does]),
      );
  }
}

export function pageMarkdown(page: DocPage): string {
  return [`# ${page.title}`, page.lead, ...page.blocks.map(block)].join('\n\n') + '\n';
}

/** The short index AI tools look for first (llmstxt.org). */
export function llmsTxt(): string {
  const sections = GROUPS.map((group) => {
    const links = DOCS.filter((d) => d.group === group).map((d) => `- [${d.title}](${SITE_URL}/md/${d.slug}): ${d.lead}`);
    return `## ${group}\n\n${links.join('\n')}`;
  });
  return [
    '# Deno',
    '> Deno lets a founder\'s own AI (Claude, ChatGPT, Cursor or any MCP client) write and edit their marketing: posts, reels, carousels and launch videos, grounded in real public evidence about their startup idea. Deno is a web workspace plus a remote MCP server.',
    `- MCP server: ${MCP_URL} (Streamable HTTP, OAuth 2.1, no API key)\n- Claude Code plugin: \`/plugin marketplace add ${PLUGIN_REPO}\` then \`/plugin install deno-studio@deno\`\n- Setup prompt for agents: ${SITE_URL}/setup-prompt.txt\n- Every page in one file: ${SITE_URL}/llms-full.txt`,
    ...sections,
    `## Optional\n\n- [Pricing](${SITE_URL}/pricing): Free, Launch, Studio and Agency plans.\n- [Human-readable docs](${SITE_URL}${docHref('index')})`,
  ].join('\n\n') + '\n';
}

/** Every docs page in one plain-text file. */
export function llmsFullTxt(): string {
  const intro = `# Deno: full documentation\n\nMCP server: ${MCP_URL}\nSource: ${SITE_URL}/docs\n`;
  return [intro, ...DOCS.map((d) => pageMarkdown(d).trimEnd())].join('\n\n---\n\n') + '\n';
}
