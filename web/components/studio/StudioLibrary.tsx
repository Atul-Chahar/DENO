'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type BrandKit, type Project, type StudioItemCard } from '@/lib/api';
import { fmtTime, STATUS_LABEL, StudioShell } from './StudioShell';

const MARKETPLACE = process.env.NEXT_PUBLIC_STUDIO_MARKETPLACE ?? 'Atul-Chahar/DENO';

function ago(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/** Studio library: every video and still the founder's AI saved, the brand kit per idea, and how to start. */
export function StudioLibrary() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [items, setItems] = useState<StudioItemCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (pid: string | null) => {
    try {
      setItems(await api.studioItems(pid));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setItems([]);
    }
  }, []);

  useEffect(() => {
    const pid = new URLSearchParams(window.location.search).get('project');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the deep link once on mount
    setProjectId(pid);
    api.listProjects().then((p) => setProjects(p.items)).catch(() => undefined);
    void load(pid);
  }, [load]);

  function pick(pid: string | null) {
    setProjectId(pid);
    setItems(null);
    const url = new URL(window.location.href);
    if (pid) url.searchParams.set('project', pid);
    else url.searchParams.delete('project');
    window.history.replaceState(null, '', url);
    void load(pid);
  }

  const ideaTitle = (id: string) => projects.find((p) => p.id === id)?.title ?? 'Idea';

  return (
    <StudioShell active="library">
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        <aside style={{ flex: '1 1 260px', maxWidth: '100%', borderRight: '1.5px solid var(--ink)', background: 'var(--paper-2)', minWidth: 0 }}>
          <div style={{ padding: '22px clamp(14px,2vw,22px) 12px' }}>
            <div className="dv-mono" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em', color: 'var(--muted)' }}>IDEAS</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1.5px solid var(--ink)' }}>
            {[{ id: null as string | null, title: 'All ideas' }, ...projects.map((p) => ({ id: p.id as string | null, title: p.title }))].map((p) => {
              const on = projectId === p.id;
              return (
                <button
                  key={p.id ?? 'all'}
                  onClick={() => pick(p.id)}
                  style={{ textAlign: 'left', border: 0, borderBottom: '1px solid rgba(16,22,19,.16)', padding: '12px clamp(14px,2vw,22px)', cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 600, background: on ? 'var(--ink)' : 'transparent', color: on ? 'var(--paper)' : 'var(--ink)', overflowWrap: 'anywhere' }}
                >
                  {p.title}
                </button>
              );
            })}
          </div>
          {projectId && <BrandKitCard projectId={projectId} onError={setError} />}
        </aside>

        <main style={{ flex: '999 1 560px', minWidth: 0 }}>
          <div className="dv-pad dv-rb">
            <span className="dv-kicker lime">STUDIO</span>
            <h1 className="dv-h1">Videos and images your Claude made.</h1>
            <p className="dv-lede">
              Your own Claude directs and renders on your machine with Deno&apos;s playbooks, styles, licensed media and your validated pains. Every
              version lands here for frame-by-frame review.
            </p>
          </div>
          {error && (
            <div className="dv-err" style={{ margin: '16px clamp(22px,3vw,40px) 0' }}>
              <span className="dv-mono" style={{ fontWeight: 700, color: 'var(--red-ink)' }}>ERR</span>
              <span>{error}</span>
            </div>
          )}
          <div className="dv-pad">
            {items === null && <div className="dv-mono dv-muted" style={{ fontSize: 12 }}>LOADING…</div>}
            {items && items.length === 0 && <GetStarted />}
            {items && items.length > 0 && (
              <div className="st-grid">
                {items.map((it) => (
                  <a key={it.id} href={`/app/studio/${it.id}`} className="st-card dv-rise">
                    <div className="st-thumb">
                      {it.poster_url ? (
                        <img src={it.poster_url} alt="" />
                      ) : (
                        <span className="dv-mono dv-muted" style={{ fontSize: 11 }}>{it.kind === 'video' ? 'VIDEO' : 'STILL'}</span>
                      )}
                    </div>
                    <div className="st-card-body">
                      <span className={`st-status ${it.status}`}>{STATUS_LABEL[it.status] ?? it.status.toUpperCase()}</span>
                      <div className="st-card-title">{it.title}</div>
                      <div className="st-meta">
                        v{it.current_version}
                        {it.duration ? ` · ${fmtTime(it.duration).slice(0, 5)}` : ''}
                        {it.open_notes ? ` · ${it.open_notes} open note${it.open_notes === 1 ? '' : 's'}` : ''}
                      </div>
                      <div className="st-meta">
                        {ideaTitle(it.idea_id)} · {ago(it.updated_at)}
                        {it.client_name ? ` · via ${it.client_name}` : ''}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
            {items && items.length > 0 && (
              <details style={{ marginTop: 28 }}>
                <summary className="dv-link" style={{ cursor: 'pointer' }}>How to make another one →</summary>
                <div style={{ marginTop: 16 }}>
                  <GetStarted />
                </div>
              </details>
            )}
          </div>
        </main>
      </div>
    </StudioShell>
  );
}

function GetStarted() {
  return (
    <div className="dv-split wide" style={{ border: '1.5px solid var(--ink)' }}>
      <div className="dv-pad dv-rr dv-cell">
        <span className="dv-kicker ink">CLAUDE CODE · RENDERS VIDEO</span>
        <div className="dv-label" style={{ marginBottom: 0 }}>1. INSTALL THE PLUGIN (ONCE)</div>
        <div className="st-code">{`/plugin marketplace add ${MARKETPLACE}\n/plugin install deno-studio@deno`}</div>
        <div className="dv-label" style={{ marginBottom: 0 }}>2. ASK FOR WHAT YOU WANT</div>
        <div className="st-code">{'make a 20 s vertical reel about the\npain my last validation found'}</div>
        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.55 }}>
          The plugin connects to Deno, brings the <span className="dv-mono">studio</span> command (renders, captions, voiceover, beats, mix on your
          machine) and the director, scene-builder and reviewer agents. Needs Node 22+ and ffmpeg; <span className="dv-mono">studio doctor</span> checks.
        </p>
      </div>
      <div className="dv-pad dv-cell">
        <span className="dv-kicker">CLAUDE.AI · CHATGPT</span>
        <div className="dv-label" style={{ marginBottom: 0 }}>ADD DENO AS A CONNECTOR</div>
        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.55 }}>
          Settings → Connectors → Add custom connector → <span className="dv-mono">{(process.env.NEXT_PUBLIC_API_URL ?? 'https://deno-api-swart.vercel.app') + '/mcp'}</span>.
          Plan posts, storyboards and carousels, check copy against the gates, and find licensed media. Rendering needs Claude Code.
        </p>
      </div>
    </div>
  );
}

function BrandKitCard({ projectId, onError }: { projectId: string; onError: (m: string) => void }) {
  const [kit, setKit] = useState<BrandKit | null>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<{ accent: string; background: string; ink: string; display: string; body: string } | null>(null);

  useEffect(() => {
    let live = true;
    api
      .brandKit(projectId)
      .then((r) => {
        if (!live) return;
        setKit(r.brand_kit);
        setUrl(r.source_url ?? '');
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [projectId]);

  async function importSite() {
    setBusy(true);
    try {
      setKit((await api.importBrandKit(projectId, url.trim())).brand_kit);
    } catch (err) {
      onError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!edit) return;
    try {
      const r = await api.saveBrandKit(projectId, {
        colors: { accent: edit.accent, background: edit.background, ink: edit.ink },
        fonts: { display: edit.display, body: edit.body },
      });
      setKit(r.brand_kit);
      setEdit(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  const colors = kit?.colors ?? {};
  const fonts = kit?.fonts ?? {};
  return (
    <div style={{ padding: '20px clamp(14px,2vw,22px)', borderTop: '1.5px solid var(--ink)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="dv-mono" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em', color: 'var(--muted)' }}>BRAND KIT</div>
      {kit ? (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['background', 'ink', 'accent'].map((k) =>
              colors[k] ? <span key={k} className="st-swatch" title={`${k} ${colors[k]}`} style={{ background: colors[k] }} /> : null,
            )}
            {(kit.palette ?? []).filter((c) => !Object.values(colors).includes(c)).slice(0, 4).map((c) => (
              <span key={c} className="st-swatch" title={c} style={{ background: c, opacity: 0.7 }} />
            ))}
          </div>
          <div className="st-meta">
            {fonts.display ?? '—'} / {fonts.body ?? '—'}
            {fonts.mono ? ` / ${fonts.mono}` : ''}
          </div>
          {(kit.notes ?? []).map((n) => (
            <div key={n} className="dv-note">{n}</div>
          ))}
        </>
      ) : (
        <div className="st-meta">None yet. Read it from your site:</div>
      )}
      <input className="dv-input" style={{ fontSize: 13, padding: '9px 10px' }} placeholder="https://yourproduct.com" value={url} onChange={(e) => setUrl(e.target.value)} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="dv-btn ink sm" disabled={busy || url.trim().length < 4} onClick={importSite}>
          {busy ? 'Reading…' : 'Read from site'}
        </button>
        <button
          className="dv-btn ghost sm"
          onClick={() =>
            setEdit({
              accent: colors.accent ?? '#C6F24E',
              background: colors.background ?? '#FAF8F3',
              ink: colors.ink ?? '#101613',
              display: fonts.display ?? '',
              body: fonts.body ?? '',
            })
          }
        >
          Edit
        </button>
      </div>
      {edit && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(['accent', 'background', 'ink'] as const).map((k) => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input type="color" value={edit[k]} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} style={{ width: 34, height: 28, border: '1.5px solid var(--ink)', padding: 0 }} />
              <span className="dv-mono" style={{ fontSize: 11 }}>{k.toUpperCase()}</span>
            </label>
          ))}
          <input className="dv-input" style={{ fontSize: 13, padding: '8px 10px' }} placeholder="Display font" value={edit.display} onChange={(e) => setEdit({ ...edit, display: e.target.value })} />
          <input className="dv-input" style={{ fontSize: 13, padding: '8px 10px' }} placeholder="Body font" value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
          <button className="dv-btn lime sm" onClick={save}>Save brand kit</button>
        </div>
      )}
    </div>
  );
}
