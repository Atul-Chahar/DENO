'use client';

import { useSyncExternalStore } from 'react';
import { onSoundChange, play, setSoundOn, soundOn } from '@/lib/sound';

/** A small speaker button that turns the site's click sounds on or off (remembered on this device). */
export function SoundToggle({ className = 'm-sound' }: { className?: string }) {
  const on = useSyncExternalStore(onSoundChange, soundOn, () => true);

  const toggle = () => {
    const next = !on;
    setSoundOn(next);
    if (next) play('tick');
  };

  return (
    <button type="button" className={className} onClick={toggle} aria-pressed={on} title={on ? 'Sounds on' : 'Sounds off'}>
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" stroke="none" />
        {on ? <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /> : <path d="M16 9l6 6M22 9l-6 6" />}
      </svg>
      <span className="visually-hidden">{on ? 'Turn sounds off' : 'Turn sounds on'}</span>
    </button>
  );
}
