'use client';

import { useEffect, useState } from 'react';

type State = 'checking' | 'ok' | 'down';
const TEXT: Record<State, string> = {
  checking: 'Checking status…',
  ok: 'All systems working',
  down: 'Some parts are slow right now',
};

/** A small live status line for the footer (reads /status.json once, when the page loads). */
export function StatusDot() {
  const [state, setState] = useState<State>('checking');

  useEffect(() => {
    let live = true;
    fetch('/status.json')
      .then((r) => r.json() as Promise<{ ok?: boolean }>)
      .then((d) => live && setState(d.ok ? 'ok' : 'down'))
      .catch(() => live && setState('down'));
    return () => {
      live = false;
    };
  }, []);

  return (
    <span className={`m-status m-status--${state}`} role="status">
      <i aria-hidden="true" />
      {TEXT[state]}
    </span>
  );
}
