'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, type Rule, type Rulebook as RulebookData } from '@/lib/api';
import { StudioShell } from './StudioShell';

/** The Rulebook: every rule your Claude follows when it makes video and images. Strike the ones you disagree
 * with; core rules (render contract, licences, honesty about facts) stay on. */
export function Rulebook() {
  const [book, setBook] = useState<RulebookData | null>(null);
  const [struck, setStruck] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api
      .rulebook()
      .then((b) => {
        setBook(b);
        setStruck(new Set(b.rules.filter((r) => r.struck).map((r) => r.id)));
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const groups = useMemo(() => {
    const out = new Map<string, { title: string; kind: string; rules: Rule[] }>();
    for (const r of book?.rules ?? []) {
      if (query && !r.text.toLowerCase().includes(query.toLowerCase())) continue;
      const g = out.get(r.doc) ?? { title: r.doc_title, kind: r.kind, rules: [] };
      g.rules.push(r);
      out.set(r.doc, g);
    }
    return [...out.entries()];
  }, [book, query]);

  async function toggle(rule: Rule) {
    if (rule.core) return;
    const next = new Set(struck);
    if (next.has(rule.id)) next.delete(rule.id);
    else next.add(rule.id);
    setStruck(next);
    try {
      await api.saveRulebook([...next]);
      setSaved(next.has(rule.id) ? 'Rule off. Your Claude won’t see it.' : 'Rule back on.');
      window.setTimeout(() => setSaved(null), 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const tags = Object.entries(book?.taste.tag_counts ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <StudioShell active="rulebook">
      <div className="dv-split">
        <div className="dv-pad dv-rr">
          <span className="dv-kicker lime">RULEBOOK</span>
          <h1 className="dv-h1">The rules your Claude follows.</h1>
          <p className="dv-lede">
            Deno&apos;s playbooks and styles, line by line. Switch off what doesn&apos;t fit your taste. Locked rules keep renders working and keep you
            out of trouble: the render contract, licences, and never inventing facts.
          </p>
          <input className="dv-input" style={{ marginTop: 18 }} placeholder="Search rules" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="dv-pad dv-soft">
          <div className="dv-label">YOUR TASTE, FROM YOUR NOTES</div>
          {tags.length === 0 ? (
            <p className="st-meta">Tag your review notes (pacing, text, sound…) and the patterns show up here. Your Claude reads them too.</p>
          ) : (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {tags.map(([tag, n]) => (
                <span key={tag} className="dv-pill">{tag.toUpperCase()} · {n}</span>
              ))}
            </div>
          )}
          {(book?.taste.recent_notes ?? []).slice(0, 5).map((n) => (
            <div key={n} className="dv-note" style={{ marginTop: 8 }}>“{n}”</div>
          ))}
          <div className="st-meta" style={{ marginTop: 14 }}>{struck.size} rule{struck.size === 1 ? '' : 's'} switched off.</div>
        </div>
      </div>
      {error && (
        <div className="dv-err" style={{ margin: '0 clamp(22px,3vw,40px) 16px' }}>
          <span className="dv-mono" style={{ fontWeight: 700, color: 'var(--red-ink)' }}>ERR</span>
          <span>{error}</span>
        </div>
      )}
      <div style={{ borderTop: '1.5px solid var(--ink)' }}>
        {!book && !error && <div className="dv-pad dv-mono dv-muted" style={{ fontSize: 12 }}>LOADING…</div>}
        {groups.map(([doc, g]) => (
          <section key={doc} className="dv-pad dv-rb" style={{ paddingTop: 22, paddingBottom: 22 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', marginBottom: 6 }}>
              <h2 className="dv-serif" style={{ fontSize: 24, margin: 0 }}>{g.title}</h2>
              <span className="st-meta">{g.kind === 'styles' ? 'STYLE' : 'PLAYBOOK'}</span>
            </div>
            {g.rules.map((r) => {
              const off = struck.has(r.id);
              return (
                <div key={r.id} className={`st-rule${off ? ' struck' : ''}`}>
                  <button
                    className={`dv-toggle${off ? '' : ' on'}`}
                    disabled={r.core}
                    title={r.core ? 'Locked: core rule' : off ? 'Switch on' : 'Switch off'}
                    aria-pressed={!off}
                    onClick={() => toggle(r)}
                    style={r.core ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
                  >
                    <span />
                  </button>
                  <span className="st-rule-text">{r.text.replace(/\*\*/g, '').replace(/`/g, '')}</span>
                  {r.core && <span className="dv-mono" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.08em', marginLeft: 'auto', flex: 'none' }}>LOCKED</span>}
                </div>
              );
            })}
          </section>
        ))}
      </div>
      <div className={`toast${saved ? ' show' : ''}`}>{saved}</div>
    </StudioShell>
  );
}
