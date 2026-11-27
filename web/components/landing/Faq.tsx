'use client';

import type { ReactNode } from 'react';
import { play } from '@/lib/sound';

/** Questions that open in place (native <details>, so they work without JavaScript and with a keyboard). */
export function Faq({ items }: { items: { q: string; a: ReactNode }[] }) {
  return (
    <div className="m-faq m-faq--open">
      {items.map((item, i) => (
        <details key={item.q} open={i === 0}>
          <summary onClick={(e) => { if (!(e.currentTarget.parentElement as HTMLDetailsElement).open) play('open'); }}>
            <h3>{item.q}</h3>
            <span className="m-faq__mark" aria-hidden="true" />
          </summary>
          <div className="m-faq__a">{item.a}</div>
        </details>
      ))}
    </div>
  );
}
