'use client';

import { useEffect, useRef, useState } from 'react';
import { INSTALL_CMD } from '@/lib/site';

/** What the real installer prints (web/public/install.sh), shortened to one line per step. */
const LINES: { n: string; label: string; done: string }[] = [
  { n: '1', label: 'Claude Code', done: 'found' },
  { n: '2', label: 'Deno plugin', done: 'installed deno-studio@deno' },
  { n: '3', label: 'Node.js', done: 'Node 22 or newer' },
  { n: '4', label: 'studio command', done: 'linked ~/.local/bin/studio' },
  { n: '5', label: 'Renderer', done: 'Chromium and ffmpeg ready' },
  { n: '6', label: 'Sign in', done: 'signed in from your browser' },
];

const TYPE_MS = 22;
const LINE_MS = 520;

/**
 * A terminal that plays the install once it scrolls into view: the command types itself, then each step ticks.
 * Text only, so it stays readable for screen readers; reduced motion shows the finished state.
 */
export function InstallTerminal() {
  const box = useRef<HTMLDivElement>(null);
  const [typed, setTyped] = useState(INSTALL_CMD.length);
  const [shown, setShown] = useState(LINES.length + 1);
  const [run, setRun] = useState(0);

  useEffect(() => {
    const el = box.current;
    if (!el || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let timer: number | undefined;
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      let c = 0;
      let l = 0;
      setTyped(0);
      setShown(0);
      const tick = () => {
        if (c < INSTALL_CMD.length) {
          c = Math.min(INSTALL_CMD.length, c + 2);
          setTyped(c);
          timer = window.setTimeout(tick, TYPE_MS);
        } else if (l <= LINES.length) {
          l += 1;
          setShown(l);
          timer = window.setTimeout(tick, l === 1 ? 380 : LINE_MS);
        }
      };
      timer = window.setTimeout(tick, 300);
    };
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        start();
        io.disconnect();
      }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
    };
  }, [run]);

  const finished = typed >= INSTALL_CMD.length && shown > LINES.length;

  return (
    <div className="m-term" ref={box}>
      <div className="m-term__bar" aria-hidden="true">
        <i /><i /><i />
        <span>Terminal</span>
      </div>
      <p className="visually-hidden">
        The installer prints one line per step: Claude Code found, Deno plugin installed, Node.js checked, studio command
        linked, renderer ready, signed in. Then: Done.
      </p>
      <div className="m-term__body" aria-hidden="true">
        <div className="m-term__cmd">
          <span className="m-term__ps">$</span>
          <span>{INSTALL_CMD.slice(0, typed)}</span>
          {typed < INSTALL_CMD.length && <span className="m-term__caret" />}
        </div>
        {LINES.slice(0, Math.min(shown, LINES.length)).map((line, i) => {
          const working = i === shown - 1 && shown <= LINES.length;
          return (
            <div key={line.n} className="m-term__line">
              <span className="m-term__n">{line.n}.</span>
              <span className="m-term__label">{line.label}</span>
              {working ? <span className="m-term__wait">…</span> : <span className="m-term__ok">✓ {line.done}</span>}
            </div>
          );
        })}
        {shown > LINES.length && (
          <div className="m-term__done">
            <b>Done.</b> Open Claude Code and ask for your first video.
          </div>
        )}
      </div>
      {finished && (
        <button type="button" className="m-term__again" aria-label="Play the install animation again" onClick={() => setRun((r) => r + 1)}>
          Play again
        </button>
      )}
    </div>
  );
}
