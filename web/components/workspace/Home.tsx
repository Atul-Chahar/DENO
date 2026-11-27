'use client';

import { useEffect, useMemo, useState } from 'react';
import { CopyButton } from '@/components/CopyButton';
import { api, type Billing, type Me, type Project, type StudioItemCard } from '@/lib/api';
import { PERSONAS, personaLabel } from '@/lib/personas';
import { MCP_URL, SETUP_PROMPT, STARTER_PROMPTS } from '@/lib/site';

const APPS: { id: string; name: string; can: string; doc: string; match: (client: string) => boolean }[] = [
  { id: 'code', name: 'Claude Code', can: 'Posts, video, carousels.', doc: '/docs/claude-code', match: (c) => /claude[\s-]?code/.test(c) },
  { id: 'claude', name: 'Claude', can: 'Posts and validation.', doc: '/docs/claude', match: (c) => c.includes('claude') && !/claude[\s-]?code/.test(c) },
  { id: 'gpt', name: 'ChatGPT', can: 'Posts and validation.', doc: '/docs/chatgpt', match: (c) => c.includes('chatgpt') || c.includes('openai') },
  { id: 'cursor', name: 'Cursor and others', can: 'Any app that supports MCP.', doc: '/docs/other-clients', match: (c) => c.includes('cursor') },
];

const USAGE_LABEL: Record<string, string> = {
  validation_run: 'Idea validations',
  content_plan: 'Content plans',
  audit: 'Copy checks',
};

const TONE_TAG: Record<string, string> = { green: 'tag--green', peach: 'tag--peach', blue: 'tag--blue', amber: 'tag--amber' };

function ago(iso: string, now: number): string {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

interface Activity {
  client: string;
  what: string;
  at: string;
}

/** The dashboard's first screen: which AI apps use this account, what waits for review, and what to say next. */
export function Home() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [items, setItems] = useState<StudioItemCard[]>([]);
  const [billing, setBilling] = useState<Billing | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [personaJustSaved, setPersonaJustSaved] = useState(false);
  const [personaError, setPersonaError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [p, s, b, who] = await Promise.allSettled([api.listProjects(), api.studioItems(), api.billing(), api.me()]);
      if (cancelled) return;
      if (who.status === 'fulfilled') setMe(who.value);
      setProjects(p.status === 'fulfilled' ? p.value.items : []);
      if (s.status === 'fulfilled') setItems(s.value);
      if (b.status === 'fulfilled') setBilling(b.value);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const activity = useMemo<Activity[]>(() => {
    const rows: Activity[] = [];
    for (const item of items) {
      if (item.client_name) rows.push({ client: item.client_name, what: `saved ${item.title} v${item.current_version}`, at: item.updated_at });
    }
    for (const project of projects ?? []) {
      const run = project.latest_run;
      if (run?.client_name) rows.push({ client: run.client_name, what: `validated "${project.title}"`, at: run.finished_at ?? run.created_at });
    }
    return rows.sort((a, b) => b.at.localeCompare(a.at));
  }, [items, projects]);

  const lastSeen = (app: (typeof APPS)[number]): string | null =>
    activity.find((row) => app.match(row.client.toLowerCase()))?.at ?? null;

  const loading = projects === null;
  const connected = activity.length > 0;
  const waiting = items.filter((i) => i.status === 'in_review' || i.open_notes > 0).slice(0, 2);
  const openNotes = items.reduce((sum, i) => sum + i.open_notes, 0);
  const idea = (projects ?? []).find((p) => p.latest_run?.verdict) ?? (projects ?? [])[0];
  const isFree = !billing || billing.plan === 'free';
  const meters = (billing?.usage ?? []).filter((u) => u.limit !== null && u.limit > 0);

  async function choosePersona(id: string) {
    setPersonaError(null);
    try {
      setMe(await api.updateMe({ persona: id }));
      setPersonaJustSaved(true);
    } catch (err) {
      setPersonaError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="h-shell">
      <aside className="h-side">
        <a href="/" className="brand" aria-label="Deno home">
          <span className="brand__word">deno</span>
          <span className="brand__chip">GTM</span>
        </a>
        <a href="/app/home" className="h-link" aria-current="page">Home</a>
        <a href="/app" className="h-link">Ideas and verdicts</a>
        <a href="/app" className="h-link">Posts and calendar</a>
        <a href="/app/studio" className="h-link">
          <span>Studio</span>
          {openNotes > 0 && <span className="h-count" aria-label={`${openNotes} open notes`}>{openNotes}</span>}
        </a>
        <a href="/app/studio/rulebook" className="h-link">Rulebook</a>
        <span className="h-side__group">YOUR AI</span>
        <a href="/docs/quickstart" className="h-link">Connect an AI app</a>
        <a href="/docs" className="h-link">Docs</a>
        <a href="/app/account" className="h-link">Account</a>
        {isFree && (
          <div className="h-plan">
            <span className="h-side__group" style={{ padding: 0 }}>FREE PLAN</span>
            <span style={{ fontSize: 13.5, color: 'var(--on-dark)' }}>Unlimited videos, carousels and revisions on Studio.</span>
            <a href="/pricing" className="btn btn--lime">See plans</a>
          </div>
        )}
      </aside>

      <main className="h-main">
        <div className="h-head">
          <div>
            <span className="h-kicker">HOME</span>
            <h1 className="display">
              {loading ? 'Loading your workspace…' : connected ? "Your AI is connected. Here's what it made." : 'Connect your AI to start making.'}
            </h1>
          </div>
          <a href="/app" className="btn btn--ghost">Validate a new idea</a>
        </div>

        {me && (!me.persona || personaJustSaved) && (
          <section className="h-card h-card--raised" aria-label="Who are you?">
            <div className="h-card__head">
              <h2>{me.persona ? `Saved: ${personaLabel(me.persona)}` : 'Who are you?'}</h2>
              <span className="h-hint" style={{ margin: 0 }}>
                {me.persona ? 'Your AI now makes videos in this format. Change it any time on the Account page.' : 'Pick one. Your AI makes every video in the format that fits you.'}
              </span>
            </div>
            {!me.persona && (
              <div className="h-apps">
                {PERSONAS.map((p) => (
                  <button key={p.id} type="button" className="h-app h-choice" onClick={() => void choosePersona(p.id)}>
                    <span className="h-app__top">{p.label}</span>
                    <span className="h-sub">{p.blurb}</span>
                    <span className="h-sub">{p.videos}</span>
                  </button>
                ))}
              </div>
            )}
            {personaError && <div className="h-card__body"><span style={{ color: 'var(--red-ink)', fontSize: 14 }}>{personaError}</span></div>}
          </section>
        )}

        <section className="h-card h-card--raised" aria-label="Your AI apps">
          <div className="h-card__head">
            <h2>Your AI apps</h2>
            <a href="/docs/quickstart" className="link-mono">Setup guide →</a>
          </div>
          <div className="h-apps">
            {APPS.map((app) => {
              const seen = lastSeen(app);
              return (
                <div key={app.id} className="h-app">
                  <div className="h-app__top">
                    <span>{app.name}</span>
                    {seen ? <span className="tag tag--green">In use</span> : <a href={app.doc} className="link-mono">Connect →</a>}
                  </div>
                  <span className="h-sub">{seen ? `${app.can} Last used ${ago(seen, now)}.` : `${app.can} Not used yet.`}</span>
                </div>
              );
            })}
          </div>
          <div className="h-addr">
            <strong style={{ fontSize: 13.5 }}>Your Deno address</strong>
            <code>{MCP_URL}</code>
            <CopyButton text={MCP_URL} className="btn btn--sm btn--lime" />
          </div>
          <div className="h-agent">
            <span>
              <strong>{connected ? 'Adding another AI app?' : 'The easy way.'}</strong>{' '}
              <em>Paste one prompt into your AI and it sets Deno up by itself. You only sign in.</em>
            </span>
            <CopyButton text={SETUP_PROMPT} label="Copy the setup prompt" done="Copied. Paste it into your AI" className="btn btn--sm btn--lime" />
          </div>
        </section>

        <div className="h-cols">
          <div className="h-cols__main">
            <section>
              <div className="h-sec__head">
                <h2>Waiting for you</h2>
                {waiting.length > 0 && <span>{waiting.length === 1 ? '1 thing needs a look' : `${waiting.length} things need a look`}</span>}
              </div>
              {waiting.length > 0 ? (
                <div className="h-wait">
                  {waiting.map((item) => (
                    <a key={item.id} href={`/app/studio/${item.id}`} className="h-item">
                      <div className="h-item__art">
                        {item.poster_url ? (
                          <img src={item.poster_url} alt="" />
                        ) : (
                          <svg aria-hidden="true" width="40" height="40" viewBox="0 0 24 24" fill="#C6F24E"><path d="M7 4v16l13-8z" /></svg>
                        )}
                        <span className="h-item__ver">v{item.current_version}{item.client_name ? ` · via ${item.client_name}` : ''}</span>
                      </div>
                      <div className="h-item__body">
                        <b>{item.title}</b>
                        <span>{item.open_notes > 0 ? `${item.open_notes} open ${item.open_notes === 1 ? 'note' : 'notes'}. Ask your AI to fix them.` : 'New version ready to review.'}</span>
                        <span className="h-item__go">REVIEW VERSION {item.current_version} →</span>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="h-empty">
                  {loading ? 'Loading…' : 'Nothing is waiting. When your AI saves a video, a carousel or a post, it shows up here for review.'}
                </div>
              )}
            </section>

            <section>
              <div className="h-sec__head"><h2>Say this to your AI next</h2></div>
              <p className="h-hint">Copy a line and paste it into Claude or ChatGPT. Deno fills in your idea, proof and voice.</p>
              <div className="h-prompts">
                {STARTER_PROMPTS.map((prompt) => (
                  <div key={prompt.text} className="h-prompt">
                    <span className={`tag ${TONE_TAG[prompt.tone]}`}>{prompt.tag}</span>
                    <span>&ldquo;{prompt.text}&rdquo;</span>
                    <CopyButton text={prompt.text} />
                  </div>
                ))}
              </div>
            </section>

            {items.length > 0 && (
              <section>
                <div className="h-sec__head">
                  <h2>Recent work</h2>
                  <a href="/app/studio" className="link-mono">Open Studio →</a>
                </div>
                <div className="h-table-box">
                  <table className="h-table">
                    <thead><tr><th>WHAT</th><th>MADE BY</th><th>NOTES</th><th>STATE</th></tr></thead>
                    <tbody>
                      {items.slice(0, 6).map((item) => (
                        <tr key={item.id}>
                          <td><a href={`/app/studio/${item.id}`}>{item.title} · v{item.current_version}</a></td>
                          <td>{item.client_name ?? 'Deno web app'}</td>
                          <td style={item.open_notes > 0 ? { color: 'var(--red-ink)', fontWeight: 600 } : { color: 'var(--green)', fontWeight: 600 }}>
                            {item.open_notes > 0 ? `${item.open_notes} open` : 'None open'}
                          </td>
                          <td>{item.status === 'in_review' ? 'Ready to review' : item.status === 'approved' ? 'Approved' : item.status === 'archived' ? 'Archived' : 'Draft'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>

          <div className="h-cols__side">
            <section className="h-card">
              <div className="h-card__head">
                <h2>Your idea</h2>
                {idea?.latest_run?.verdict && (
                  <span className="tag tag--amber">
                    {idea.latest_run.verdict.replace('_', ' ')}
                    {idea.latest_run.confidence != null ? ` · ${Math.round(idea.latest_run.confidence * 100)}%` : ''}
                  </span>
                )}
              </div>
              <div className="h-card__body">
                {idea ? (
                  <>
                    <span className="display" style={{ fontSize: 21, lineHeight: 1.2 }}>{idea.title}</span>
                    <span style={{ fontSize: 13.5, color: 'var(--muted)' }}>
                      {idea.latest_run?.verdict ? 'This verdict and its evidence are what your AI writes from.' : 'Not validated yet. Run it so your AI has evidence to write from.'}
                    </span>
                    <a href="/app" className="link-mono" style={{ alignSelf: 'flex-start' }}>{idea.latest_run?.verdict ? 'Read the verdict →' : 'Run the validation →'}</a>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 14.5 }}>{loading ? 'Loading…' : 'No idea yet. Validate one so your AI has real evidence to write from.'}</span>
                    {!loading && <a href="/app" className="btn btn--sm btn--ink" style={{ alignSelf: 'flex-start' }}>Validate an idea</a>}
                  </>
                )}
              </div>
            </section>

            {meters.length > 0 && (
              <section className="h-card">
                <div className="h-card__head"><h2>This month{isFree ? ' on Free' : ''}</h2></div>
                <div className="h-card__body" style={{ gap: 16 }}>
                  {meters.map((m) => {
                    const limit = m.limit ?? 0;
                    const full = m.used >= limit;
                    return (
                      <div key={m.kind} className={`h-meter${full ? ' h-meter--full' : ''}`}>
                        <div className="h-meter__row"><span>{USAGE_LABEL[m.kind] ?? m.kind.replace(/_/g, ' ')}</span><b>{m.used} of {limit}</b></div>
                        <div className="h-meter__bar"><i style={{ width: `${Math.min(100, (m.used / limit) * 100)}%` }} /></div>
                      </div>
                    );
                  })}
                  {isFree && (
                    <div className="h-nudge">
                      <strong>Making more than one video?</strong>
                      <span>Studio is unlimited videos, carousels and revisions for $39 a month. No per-video charge.</span>
                      <a href="/pricing" className="btn btn--sm btn--ink">See Studio</a>
                    </div>
                  )}
                </div>
              </section>
            )}

            <section className="h-card">
              <div className="h-card__head"><h2>What your AI did</h2></div>
              {activity.length > 0 ? (
                <div className="h-feed">
                  {activity.slice(0, 5).map((row) => (
                    <div key={`${row.at}-${row.what}`}><span><strong>{row.client}</strong> {row.what}</span><small>{ago(row.at, now)}</small></div>
                  ))}
                </div>
              ) : (
                <div className="h-card__body"><span style={{ fontSize: 14, color: 'var(--muted)' }}>Nothing yet. Once an AI app saves something through Deno, it is listed here.</span></div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
