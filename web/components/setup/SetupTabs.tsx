'use client';

import { useId, useState } from 'react';
import { CodeBlock } from '@/components/setup/CodeBlock';
import { play } from '@/lib/sound';
import { CURSOR_INSTALL_URL, INSTALL_CMD, INSTALL_CMD_POSTS, INSTALL_CMD_WIN, MCP_URL, PLUGIN_REPO, VSCODE_INSTALL_URL } from '@/lib/site';

const APPS = [
  { id: 'code', label: 'Claude Code' },
  { id: 'claude', label: 'Claude Desktop and claude.ai' },
  { id: 'gpt', label: 'ChatGPT' },
  { id: 'cursor', label: 'Cursor and VS Code' },
] as const;

type AppId = (typeof APPS)[number]['id'];

const CURSOR_JSON = `{
  "mcpServers": {
    "deno": { "url": "${MCP_URL}" }
  }
}`;

/** Manual setup steps for each AI app, as tabs. */
export function SetupTabs({ initial = 'code' }: { initial?: AppId }) {
  const [app, setApp] = useState<AppId>(initial);
  const base = useId();

  return (
    <div className="m-tabs">
      <div className="m-tabs__list" role="tablist" aria-label="Your AI app">
        {APPS.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            id={`${base}-tab-${a.id}`}
            aria-selected={app === a.id}
            aria-controls={`${base}-panel`}
            className="m-tabs__tab"
            onClick={() => {
              if (a.id !== app) play('tick');
              setApp(a.id);
            }}
            onKeyDown={(e) => {
              const i = APPS.findIndex((x) => x.id === app);
              const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
              if (!step) return;
              e.preventDefault();
              const next = APPS[(i + step + APPS.length) % APPS.length];
              setApp(next.id);
              document.getElementById(`${base}-tab-${next.id}`)?.focus();
            }}
            tabIndex={app === a.id ? 0 : -1}
          >
            {a.label}
          </button>
        ))}
      </div>

      <div className="m-tabs__panel" role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-tab-${app}`}>
        {app === 'code' && (
          <>
            <p>
              Open a terminal and paste one line. It adds the Deno plugin to Claude Code, installs the video renderer and
              opens your browser so you can sign in. <a href="/docs/claude-code" className="link-mono">What it does →</a>
            </p>
            <p className="m-mono">macOS, Linux and WSL</p>
            <CodeBlock code={INSTALL_CMD} />
            <p className="m-mono">Windows PowerShell</p>
            <CodeBlock code={INSTALL_CMD_WIN} />
            <p>Then open Claude Code, type <span className="m-inline">/mcp</span>, pick <strong>deno</strong> and choose <strong>Authenticate</strong>.</p>
            <p className="m-fine">
              Only want posts, not video? <span className="m-inline">{INSTALL_CMD_POSTS}</span>. Prefer to type it inside
              Claude Code? <span className="m-inline">/plugin marketplace add {PLUGIN_REPO}</span> then{' '}
              <span className="m-inline">/plugin install deno-studio@deno</span>.
            </p>
          </>
        )}
        {app === 'claude' && (
          <>
            <ol>
              <li>Open <strong>Settings</strong>, then <strong>Connectors</strong>.</li>
              <li>Click <strong>Add custom connector</strong>.</li>
              <li>Name it <strong>Deno</strong> and paste the address below.</li>
              <li>Click <strong>Connect</strong>, sign in to Deno and press <strong>Allow</strong>.</li>
              <li>Start a new chat so the tools load.</li>
            </ol>
            <CodeBlock code={MCP_URL} />
            <p className="m-fine">Posts and validation work here. To make video, use Claude Code.</p>
          </>
        )}
        {app === 'gpt' && (
          <>
            <ol>
              <li>Open <strong>Settings</strong>, then <strong>Connectors</strong>.</li>
              <li>Create a new connector and paste the address below.</li>
              <li>Choose <strong>OAuth</strong>, sign in to Deno and press <strong>Allow</strong>.</li>
              <li>Start a new chat so the tools load.</li>
            </ol>
            <CodeBlock code={MCP_URL} />
            <p className="m-fine">Reading works on every ChatGPT plan. Whether ChatGPT can save drafts depends on your ChatGPT plan.</p>
          </>
        )}
        {app === 'cursor' && (
          <>
            <p>One click adds Deno to your editor. It asks you to confirm, then opens your browser to sign in.</p>
            <div className="m-hero__actions" style={{ marginTop: 0 }}>
              <a href={CURSOR_INSTALL_URL} className="btn btn--ink btn--sm">Add to Cursor</a>
              <a href={VSCODE_INSTALL_URL} className="btn btn--ghost btn--sm">Add to VS Code</a>
            </div>
            <p>
              Or add this to <span className="m-inline">.cursor/mcp.json</span> by hand, reload Cursor, then sign in when it asks.
            </p>
            <CodeBlock code={CURSOR_JSON} />
            <p className="m-fine">The same address works in Windsurf and any app that supports remote MCP servers.</p>
          </>
        )}
      </div>
    </div>
  );
}
