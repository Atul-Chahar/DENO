import { PERSONAS, lengthText, personaHref } from '@/lib/personas';

/** "Who are you?" as five cards, each opening the page that shows that persona's video format. */
export function PersonaCards({ current }: { current?: string }) {
  return (
    <div className="m-grid m-grid--5" data-play>
      {PERSONAS.filter((p) => p.id !== current).map((p) => (
        <a key={p.id} href={personaHref(p.id)} className="m-step m-hit" style={{ background: p.bg, padding: 22 }}>
          <h3>{p.label}</h3>
          <p style={{ fontSize: 14.5 }}>{p.blurb}</p>
          <div className="m-step__eg" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
            <span className="m-mono" style={{ color: 'var(--ink)' }}>{p.ratio} · {lengthText(p)}</span>
            <span style={{ fontSize: 13.5 }}>{p.videos}</span>
          </div>
          <span className="m-mono" style={{ color: 'var(--ink)' }}>See your format →</span>
        </a>
      ))}
    </div>
  );
}
