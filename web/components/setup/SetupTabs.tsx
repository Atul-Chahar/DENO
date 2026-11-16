'use client';

import { useId, useState } from 'react';
import { CodeBlock } from '@/components/setup/CodeBlock';
import { MCP_URL, PLUGIN_REPO } from '@/lib/site';

const APPS = [
  { id: 'code', label: 'Claude Code' },
  { id: 'claude', label: 'Claude Desktop and claude.ai' },
  { id: 'gpt', label: 'ChatGPT' },
  { id: 'cursor', label: 'Cursor' },
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
            onClick={() => setApp(a.id)}
          >
            {a.label}
          </button>
        ))}
      </div>

      <div className="m-tabs__panel" role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-tab-${app}`}>
        {app === 'code' && (
          <>
            <p>Type these two lines inside Claude Code. The plugin adds the Deno connection, the video skills and the local renderer.</p>
            <CodeBlock code={`/plugin marketplace add ${PLUGIN_REPO}\n/plugin install deno-studio@deno`} />
            <p>Then run these in a normal terminal. The first installs what the renderer needs. The second opens your browser to sign in.</p>
            <CodeBlock code={'studio doctor --install\nstudio login'} />
            <p className="m-fine">
              Needs Node 22 or newer and ffmpeg. Only want posts, not video? One line is enough:{' '}
              <span className="m-inline">claude mcp add --transport http deno {MCP_URL}</span>
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
            <p>
              Add this to <span className="m-inline">.cursor/mcp.json</span>, reload Cursor, then sign in when it asks.
            </p>
            <CodeBlock code={CURSOR_JSON} />
            <p className="m-fine">The same address works in any app that supports remote MCP servers.</p>
          </>
        )}
      </div>
    </div>
  );
}
