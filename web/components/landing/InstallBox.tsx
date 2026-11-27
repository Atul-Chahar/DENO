'use client';

import { useId, useState, useSyncExternalStore } from 'react';
import { CopyButton } from '@/components/CopyButton';
import { SoundToggle } from '@/components/landing/SoundToggle';
import { play } from '@/lib/sound';
import {
  CURSOR_INSTALL_URL,
  INSTALL_CMD,
  INSTALL_CMD_POSTS,
  INSTALL_CMD_POSTS_WIN,
  INSTALL_CMD_WIN,
  MCP_URL,
  SETUP_PROMPT,
  VSCODE_INSTALL_URL,
} from '@/lib/site';

const TABS = [
  { id: 'unix', label: 'Mac and Linux' },
  { id: 'win', label: 'Windows' },
  { id: 'apps', label: 'No terminal' },
] as const;
type Tab = (typeof TABS)[number]['id'];

const noop = () => () => {};
const detect = (): Tab => (/Win/i.test(navigator.userAgent) ? 'win' : 'unix');

/**
 * The hero's "how do I install it" answer: one command per system, a posts-only switch, and a tab for
 * people who use Claude, ChatGPT or an editor instead of a terminal.
 */
export function InstallBox({ id }: { id?: string }) {
  const detected = useSyncExternalStore(noop, detect, () => 'unix' as Tab);
  const [picked, setPicked] = useState<Tab | null>(null);
  const [postsOnly, setPostsOnly] = useState(false);
  const base = useId();
  const tab = picked ?? detected;

  const cmd = tab === 'win' ? (postsOnly ? INSTALL_CMD_POSTS_WIN : INSTALL_CMD_WIN) : postsOnly ? INSTALL_CMD_POSTS : INSTALL_CMD;
  const pick = (t: Tab) => {
    if (t !== tab) play('tick');
    setPicked(t);
  };

  return (
    <div className="m-install" id={id}>
      <div className="m-install__head">
        <div className="m-install__tabs" role="tablist" aria-label="Your system">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`${base}-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`${base}-panel`}
              tabIndex={tab === t.id ? 0 : -1}
              className="m-install__tab"
              onClick={() => pick(t.id)}
              onKeyDown={(e) => {
                const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
                if (!step) return;
                e.preventDefault();
                const next = TABS[(i + step + TABS.length) % TABS.length].id;
                pick(next);
                document.getElementById(`${base}-${next}`)?.focus();
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <SoundToggle />
      </div>

      <div className="m-install__panel" role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-${tab}`}>
        {tab !== 'apps' ? (
          <>
            <p className="m-install__say">
              {tab === 'win' ? 'Paste this into PowerShell' : 'Paste this into your terminal'} and press Enter.
            </p>
            <div className="m-install__cmd" key={cmd}>
              <span className="m-install__prompt" aria-hidden="true">{tab === 'win' ? '>' : '$'}</span>
              <code>{cmd}</code>
              <CopyButton text={cmd} label="Copy" done="Copied ✓" className="btn" chime />
            </div>
            <div className="m-install__opts">
              <div className="m-install__mode" role="group" aria-label="What to install">
                <button type="button" aria-pressed={!postsOnly} onClick={() => { if (postsOnly) play('tick'); setPostsOnly(false); }}>Video and posts</button>
                <button type="button" aria-pressed={postsOnly} onClick={() => { if (!postsOnly) play('tick'); setPostsOnly(true); }}>Posts only</button>
              </div>
              <a href={tab === 'win' ? '/install.ps1' : '/install.sh'} className="link-mono" target="_blank" rel="noopener">Read the script first →</a>
            </div>
            <ol className="m-install__steps">
              <li><b>1</b><span>{postsOnly ? 'It connects Deno to Claude Code.' : 'It adds Deno to Claude Code and sets up the video renderer.'}</span></li>
              <li><b>2</b><span>Your browser opens. Sign in or make a free account. No card.</span></li>
              <li><b>3</b><span>Open Claude Code and ask for your first {postsOnly ? 'posts' : 'video'}.</span></li>
            </ol>
          </>
        ) : (
          <>
            <p className="m-install__say">Use Claude, ChatGPT or your editor. Pick yours. Each one takes about a minute.</p>
            <div className="m-install__apps">
              <a href={CURSOR_INSTALL_URL} className="m-install__app" onClick={() => play('open')}>
                <b>Cursor</b><span>One click: add Deno →</span>
              </a>
              <a href={VSCODE_INSTALL_URL} className="m-install__app" onClick={() => play('open')}>
                <b>VS Code</b><span>One click: add Deno →</span>
              </a>
              <a href="/docs/claude" className="m-install__app">
                <b>Claude Desktop and claude.ai</b><span>Settings → Connectors →</span>
              </a>
              <a href="/docs/chatgpt" className="m-install__app">
                <b>ChatGPT</b><span>Settings → Connectors →</span>
              </a>
            </div>
            <div className="m-install__cmd m-install__cmd--soft">
              <span className="m-install__prompt" aria-hidden="true">@</span>
              <code>{MCP_URL}</code>
              <CopyButton text={MCP_URL} label="Copy address" done="Copied ✓" className="btn" chime />
            </div>
            <p className="m-install__fine">
              Any other AI agent:{' '}
              <CopyButton text={SETUP_PROMPT} label="copy the setup prompt" done="copied, paste it into your AI" className="m-install__textbtn" chime />
              {' '}and it sets itself up. Making video needs Claude Code.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
