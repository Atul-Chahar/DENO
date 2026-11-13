'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, type FilmManifest, type ReviewNote, type StudioItem, type StudioVersion } from '@/lib/api';
import { fmtTime, STATUS_LABEL, StudioShell } from './StudioShell';

const TAGS = ['pacing', 'text', 'motion', 'sound', 'brand', 'lost-interest', 'facts', 'composition'];
const STEP_KEYS = new Set(['ArrowLeft', 'ArrowRight', ' ', ',', '.', '[', ']', 'Escape', 'Enter', 'Tab', 'Shift', 'Alt', 'Control', 'Meta']);

type Draft = { text: string; t: number | null; t_end: number | null; x: number | null; y: number | null; page: number | null; tags: string[] };
const EMPTY: Draft = { text: '', t: null, t_end: null, x: null, y: null, page: null, tags: [] };

function film(v: StudioVersion | undefined): FilmManifest | null {
  const m = v?.manifest as FilmManifest | undefined;
  return m && typeof m === 'object' && 'fps' in m ? m : null;
}

/** Review one video or still: frame-exact transport, notes pinned to frames, ranges and spots (docs/18 §7 F). */
export function StudioReview({ id }: { id: string }) {
  const [item, setItem] = useState<StudioItem | null>(null);
  const [versionNo, setVersionNo] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [range, setRange] = useState<{ a: number | null; b: number | null }>({ a: null, b: null });
  const [compare, setCompare] = useState(false);
  const [showClosed, setShowClosed] = useState(true);
  const [onlyThisVersion, setOnlyThisVersion] = useState(false);
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const other = useRef<HTMLVideoElement>(null);
  const noteBox = useRef<HTMLTextAreaElement>(null);
  const scrubbing = useRef(false);
  const router = useRouter();

  const flash = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  const load = useCallback(async () => {
    try {
      const it = await api.studioItem(id);
      setItem(it);
      setVersionNo((v) => v ?? it.current_version);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 404 ? 'This item does not exist or was deleted.' : String(err instanceof Error ? err.message : err));
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void load();
  }, [load]);

  const version = item?.versions.find((v) => v.version === versionNo) ?? item?.versions[0];
  const previous = item?.versions.find((v) => v.version === (version?.version ?? 0) - 1);
  const fm = film(version);
  const fps = fm?.fps ?? 30;
  const duration = fm?.duration || version?.duration || 0;
  const isStill = item?.kind === 'still';
  const pages = (version?.files.pages ?? []).filter((p): p is string => Boolean(p));
  const frame = Math.floor(t * fps + 1e-3);

  // ---- transport -------------------------------------------------------------------------------

  // No useCallback here: these read refs, and the React Compiler memoizes the component itself.
  function seek(to: number) {
    const v = video.current;
    const clamped = Math.max(0, Math.min(to, (v?.duration || duration || to) - 1 / fps / 2));
    if (v) v.currentTime = clamped;
    if (other.current) other.current.currentTime = clamped;
    setT(clamped);
  }
  function pause() {
    video.current?.pause();
    other.current?.pause();
  }
  function toggle() {
    const v = video.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
      if (other.current) {
        other.current.currentTime = v.currentTime;
        void other.current.play();
      }
    } else pause();
  }
  function stepFrames(n: number) {
    pause();
    // Land mid-frame so the decoder shows exactly that frame.
    seek((Math.max(0, frame + n) + 0.5) / fps);
  }

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      if (video.current && !scrubbing.current) setT(video.current.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  function startNote(first = '') {
    pause();
      setDraft((d) => ({
        ...d,
        text: d.text || first,
        t: isStill ? null : (range.a ?? t),
        t_end: isStill ? null : range.b != null && range.a != null && range.b > range.a ? range.b : null,
        page: isStill ? page : null,
      }));
      window.setTimeout(() => {
        const box = noteBox.current;
        if (box) {
          box.focus();
          box.setSelectionRange(box.value.length, box.value.length);
        }
      }, 0);
  }

  // Keyboard: frame keys, and typing anywhere pins a note to the current frame (Cut Notes' best idea).
  const onKeyRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKeyRef.current(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
  function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.isContentEditable)) {
        if (e.key === 'Escape') target.blur();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isStill) {
        if (e.key === 'ArrowRight') setPage((p) => Math.min(p + 1, Math.max(0, pages.length - 1)));
        else if (e.key === 'ArrowLeft') setPage((p) => Math.max(0, p - 1));
        else if (e.key.length === 1 && !STEP_KEYS.has(e.key)) {
          e.preventDefault();
          startNote(e.key);
        }
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        toggle();
      } else if (e.key === 'ArrowRight' || e.key === '.') {
        e.preventDefault();
        if (e.shiftKey) seek(t + 1);
        else stepFrames(1);
      } else if (e.key === 'ArrowLeft' || e.key === ',') {
        e.preventDefault();
        if (e.shiftKey) seek(t - 1);
        else stepFrames(-1);
      } else if (e.key === '[') setRange((r) => ({ a: t, b: r.b != null && r.b > t ? r.b : null }));
      else if (e.key === ']') setRange((r) => ({ a: r.a ?? 0, b: t }));
      else if (e.key === 'Escape') setRange({ a: null, b: null });
      else if (e.key.length === 1 && !STEP_KEYS.has(e.key)) {
        e.preventDefault();
        startNote(e.key);
      }
  }
  useEffect(() => {
    onKeyRef.current = onKey;
  });

  // ---- notes -------------------------------------------------------------------------------------

  const notes = useMemo(() => {
    const all = item?.notes ?? [];
    return all
      .filter((n) => (showClosed ? true : n.status === 'open'))
      .filter((n) => (onlyThisVersion ? n.version === version?.version : true))
      .sort((a, b) => (a.t ?? a.page ?? 0) - (b.t ?? b.page ?? 0) || a.created_at.localeCompare(b.created_at));
  }, [item?.notes, onlyThisVersion, showClosed, version?.version]);

  async function submit() {
    if (!item || !version || !draft.text.trim()) return;
    try {
      const note = await api.addNote(item.id, {
        text: draft.text.trim(),
        version: version.version,
        t: draft.t,
        t_end: draft.t_end,
        x: draft.x,
        y: draft.y,
        page: draft.page,
        tags: draft.tags,
      });
      setItem({ ...item, notes: [...(item.notes ?? []), note] });
      setDraft(EMPTY);
      setRange({ a: null, b: null });
      setActiveNote(note.id);
      flash('Note pinned. Your Claude sees it with get_review_notes.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function setStatus(n: ReviewNote, status: ReviewNote['status']) {
    if (!item) return;
    try {
      const updated = await api.updateNote(n.id, { status });
      setItem({ ...item, notes: (item.notes ?? []).map((x) => (x.id === n.id ? updated : x)) });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function remove(n: ReviewNote) {
    if (!item) return;
    try {
      await api.deleteNote(n.id);
      setItem({ ...item, notes: (item.notes ?? []).filter((x) => x.id !== n.id) });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function approve() {
    if (!item) return;
    try {
      await api.approveStudioItem(item.id);
      await load();
      flash('Approved. Ask your Claude for the final formats.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function del() {
    if (!item) return;
    if (!window.confirm('Delete this item and every version? This cannot be undone.')) return;
    try {
      await api.deleteStudioItem(item.id);
      router.push('/app/studio');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function copyForClaude() {
    if (!item) return;
    const open = (item.notes ?? []).filter((n) => n.status === 'open');
    const lines = open.map((n) => {
      const where = n.page != null ? `page ${n.page + 1}` : n.t_end != null ? `${fmtTime(n.t, fps)}–${fmtTime(n.t_end, fps)}` : `${fmtTime(n.t, fps)} (frame ${n.frame ?? '?'})`;
      const spot = n.x != null && n.y != null ? ` at x=${n.x.toFixed(2)} y=${n.y.toFixed(2)}` : '';
      const clip = n.clip_id ? ` [clip ${n.clip_id}${n.chapter_id ? `, chapter ${n.chapter_id}` : ''}]` : '';
      return `- v${n.version} ${where}${spot}${clip}${n.author === 'system' ? ' (automated check)' : ''}: ${n.text}${n.tags.length ? ` #${n.tags.join(' #')}` : ''} (note ${n.id})`;
    });
    const text = `Review notes for "${item.title}" (Deno Studio item ${item.id}). Fix one at a time, keep everything else exactly as it is, upload a new version, then answer each with reply_note.\n\n${lines.join('\n') || '(no open notes)'}`;
    void navigator.clipboard.writeText(text).then(() => flash('Copied. Paste it into any chat with your AI.'));
  }

  // ---- pins on the frame -----------------------------------------------------------------------

  function onStageClick(e: ReactMouseEvent<HTMLDivElement>) {
    const media = (isStill ? e.currentTarget.querySelector('img.st-page') : video.current) as HTMLElement | null;
    if (!media) return;
    const box = media.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width;
    const y = (e.clientY - box.top) / box.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    startNote();
    setDraft((d) => ({ ...d, x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 }));
  }

  function scrubTo(e: ReactPointerEvent<HTMLDivElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (e.clientX - box.left) / box.width));
    seek(p * duration);
  }

  if (error && !item) {
    return (
      <StudioShell active="review">
        <div className="dv-pad">
          <div className="dv-err">
            <span className="dv-mono" style={{ fontWeight: 700, color: 'var(--red-ink)' }}>ERR</span>
            <span>{error}</span>
          </div>
        </div>
      </StudioShell>
    );
  }
  if (!item || !version) {
    return (
      <StudioShell active="review">
        <div className="dv-pad dv-mono dv-muted" style={{ fontSize: 12 }}>LOADING…</div>
      </StudioShell>
    );
  }

  const pinsHere = (item.notes ?? []).filter(
    (n) => n.x != null && n.y != null && (isStill ? n.page === page : n.t != null && Math.abs(n.t - t) < 0.5) && n.version === version.version,
  );
  const blockers = version.checks.filter((c) => c.severity === 'block');

  return (
    <StudioShell
      active="review"
      right={
        <a href="/app/studio" className="dv-tab" style={{ textDecoration: 'none' }}>
          ← LIBRARY
        </a>
      }
    >
      <div className="dv-pad dv-rb" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ minWidth: 0 }}>
          <span className={`st-status ${item.status}`}>{STATUS_LABEL[item.status] ?? item.status}</span>
          <h1 className="dv-h1" style={{ marginBottom: 6 }}>{item.title}</h1>
          <div className="st-meta">
            {item.kind.toUpperCase()} · v{version.version} of {item.current_version}
            {fm?.formats?.length ? ` · ${fm.formats.map((f) => f.ratio).join(', ')}` : ''}
            {fm?.style ? ` · ${fm.style}` : ''}
            {version.client_name ? ` · via ${version.client_name}` : ''}
          </div>
          {version.summary && <p className="dv-lede" style={{ marginTop: 8, fontSize: 14 }}>{version.summary}</p>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="dv-input" style={{ width: 'auto', padding: '9px 10px', fontSize: 13 }} value={version.version} onChange={(e) => setVersionNo(Number(e.target.value))} aria-label="Version">
            {item.versions.map((v) => (
              <option key={v.version} value={v.version}>
                Round {v.version}
                {v.version === item.current_version ? ' (latest)' : ''}
              </option>
            ))}
          </select>
          <button className="dv-btn ghost sm" onClick={copyForClaude}>Copy notes for Claude</button>
          <button className="dv-btn lime sm" disabled={item.status === 'approved' || version.version !== item.current_version} onClick={approve}>
            {item.status === 'approved' ? 'Approved' : 'Approve this cut'}
          </button>
        </div>
      </div>
      {error && (
        <div className="dv-err" style={{ margin: '12px clamp(22px,3vw,40px)' }}>
          <span className="dv-mono" style={{ fontWeight: 700, color: 'var(--red-ink)' }}>ERR</span>
          <span>{error}</span>
        </div>
      )}

      <div className="st-review">
        <div className="dv-rr" style={{ minWidth: 0 }}>
          {/* Stage */}
          {isStill ? (
            <div className="st-stage" onClick={onStageClick} style={{ cursor: 'crosshair' }}>
              {pages[page] || version.files.poster ? (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img className="st-page" src={(pages[page] ?? version.files.poster) as string} alt={`Page ${page + 1}`} />
                  {pinsHere.map((n) => (
                    <span key={n.id} className={`st-pin ${n.status === 'open' ? '' : 'fixed'}`} style={{ left: `${(n.x ?? 0) * 100}%`, top: `${(n.y ?? 0) * 100}%` }} />
                  ))}
                  {draft.x != null && draft.page === page && <span className="st-pin pending" style={{ left: `${draft.x * 100}%`, top: `${(draft.y ?? 0) * 100}%` }} />}
                </div>
              ) : (
                <span className="dv-mono" style={{ color: 'var(--paper)' }}>NO PAGES UPLOADED</span>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: compare && previous ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)', background: 'var(--ink)' }}>
              {compare && previous?.files.review && (
                <div className="st-stage">
                  <video ref={other} src={previous.files.review} muted playsInline preload="auto" />
                  <span className="st-compare">ROUND {previous.version}</span>
                </div>
              )}
              <div className="st-stage" onClick={onStageClick} style={{ cursor: 'crosshair' }}>
                <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
                  {version.files.review ? (
                    <video
                      ref={video}
                      src={version.files.review}
                      poster={version.files.poster ?? undefined}
                      playsInline
                      preload="auto"
                      onPlay={() => setPlaying(true)}
                      onPause={() => {
                        setPlaying(false);
                        if (video.current) setT(video.current.currentTime);
                      }}
                      onSeeked={() => video.current && setT(video.current.currentTime)}
                      onEnded={() => setPlaying(false)}
                    />
                  ) : (
                    <span className="dv-mono" style={{ color: 'var(--paper)', padding: 40, display: 'block' }}>NO REVIEW COPY</span>
                  )}
                  {pinsHere.map((n) => (
                    <span key={n.id} className={`st-pin ${n.status === 'open' ? '' : 'fixed'}`} style={{ left: `${(n.x ?? 0) * 100}%`, top: `${(n.y ?? 0) * 100}%` }} />
                  ))}
                  {draft.x != null && draft.t != null && <span className="st-pin pending" style={{ left: `${draft.x * 100}%`, top: `${(draft.y ?? 0) * 100}%` }} />}
                  {compare && previous && <span className="st-compare">ROUND {version.version}</span>}
                </div>
              </div>
            </div>
          )}

          {/* Transport */}
          {isStill ? (
            <div className="st-transport">
              <button className="st-key" onClick={() => setPage((p) => Math.max(0, p - 1))}>←</button>
              <span className="st-tc">PAGE {page + 1} / {Math.max(1, pages.length)}</span>
              <button className="st-key" onClick={() => setPage((p) => Math.min(Math.max(0, pages.length - 1), p + 1))}>→</button>
              <span className="st-meta" style={{ marginLeft: 'auto' }}>Click the page to pin a spot · type to write a note</span>
            </div>
          ) : (
            <>
              <div className="st-transport">
                <button className="st-key" onClick={() => stepFrames(-1)} title="One frame back (←)">◀︎ 1F</button>
                <button className={`st-key${playing ? ' on' : ''}`} onClick={toggle} title="Play / pause (space)">{playing ? 'PAUSE' : 'PLAY'}</button>
                <button className="st-key" onClick={() => stepFrames(1)} title="One frame forward (→)">1F ▶︎</button>
                <span className="st-tc">{fmtTime(t, fps)} · F{frame}</span>
                <button className="st-key" onClick={() => setRange((r) => ({ a: t, b: r.b != null && r.b > t ? r.b : null }))} title="Range start ([)">[ IN</button>
                <button className="st-key" onClick={() => setRange((r) => ({ a: r.a ?? 0, b: t }))} title="Range end (])">OUT ]</button>
                {previous?.files.review && (
                  <button className={`st-key${compare ? ' on' : ''}`} onClick={() => setCompare((c) => !c)} title="Show the previous round side by side">COMPARE v{previous.version}</button>
                )}
                <span className="st-meta" style={{ marginLeft: 'auto' }}>← → frame · ⇧ ±1 s · type to note</span>
              </div>
              <div
                className="st-scrub"
                onPointerDown={(e) => {
                  scrubbing.current = true;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  pause();
                  scrubTo(e);
                }}
                onPointerMove={(e) => scrubbing.current && scrubTo(e)}
                onPointerUp={() => {
                  scrubbing.current = false;
                }}
                role="slider"
                aria-label="Timeline"
                aria-valuemin={0}
                aria-valuemax={duration}
                aria-valuenow={t}
                tabIndex={-1}
              >
                <div className="st-scrub-fill" style={{ width: `${duration ? (t / duration) * 100 : 0}%` }} />
                {range.a != null && (
                  <div className="st-scrub-range" style={{ left: `${(range.a / (duration || 1)) * 100}%`, width: `${(((range.b ?? range.a) - range.a) / (duration || 1)) * 100}%` }} />
                )}
                {(item.notes ?? [])
                  .filter((n) => n.t != null && n.version === version.version)
                  .map((n) => (
                    <span key={n.id} className={`st-mark ${n.author === 'system' ? 'system' : n.status}`} style={{ left: `${((n.t ?? 0) / (duration || 1)) * 100}%` }} />
                  ))}
                <div className="st-scrub-head" style={{ left: `${duration ? (t / duration) * 100 : 0}%` }} />
              </div>
              {fm?.chapters && fm.chapters.length > 0 && (
                <div className="st-chapters">
                  {fm.chapters.map((c) => (
                    <span key={c.id} className="st-chapter" style={{ left: `${(c.start / (duration || 1)) * 100}%`, width: `${((c.end - c.start) / (duration || 1)) * 100}%` }}>
                      {c.title || c.id}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}

          {/* New note */}
          <div className="dv-pad dv-cell" style={{ paddingTop: 18 }}>
            <div className="dv-label" style={{ marginBottom: 0 }}>
              NOTE {isStill ? `· PAGE ${(draft.page ?? page) + 1}` : `· ${fmtTime(draft.t ?? range.a ?? t, fps)}${(draft.t_end ?? range.b) != null ? ` → ${fmtTime(draft.t_end ?? range.b, fps)}` : ''}`}
              {draft.x != null ? ' · SPOT PINNED' : ''}
            </div>
            <textarea
              ref={noteBox}
              className="dv-input"
              rows={3}
              placeholder="Describe the feeling, not the fix: “I lost interest here”, “the logo is too small”. Start typing anywhere to pin the current frame."
              value={draft.text}
              onFocus={() => {
                if (draft.t == null && draft.page == null) startNote();
              }}
              onChange={(e) => setDraft({ ...draft, text: e.target.value })}
              onKeyDown={(e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit();
              }}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {TAGS.map((tag) => (
                <button
                  key={tag}
                  className={`st-tag${draft.tags.includes(tag) ? ' on' : ''}`}
                  onClick={() => setDraft((d) => ({ ...d, tags: d.tags.includes(tag) ? d.tags.filter((x) => x !== tag) : [...d.tags, tag] }))}
                >
                  {tag.toUpperCase()}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="dv-btn ink sm" disabled={!draft.text.trim()} onClick={submit}>Pin note</button>
              {(draft.text || draft.x != null) && (
                <button className="dv-btn ghost sm" onClick={() => setDraft(EMPTY)}>Clear</button>
              )}
            </div>
          </div>
        </div>

        {/* Notes, checks, credits */}
        <aside style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1.5px solid var(--ink)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="dv-mono" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em' }}>NOTES</span>
            <button className={`st-tag${showClosed ? '' : ' on'}`} onClick={() => setShowClosed((s) => !s)}>OPEN ONLY</button>
            <button className={`st-tag${onlyThisVersion ? ' on' : ''}`} onClick={() => setOnlyThisVersion((s) => !s)}>THIS ROUND</button>
          </div>
          <div className="st-notes">
            {notes.length === 0 && <div className="st-note st-meta">{isStill ? 'No notes yet. Click a spot on a page and type.' : 'No notes yet. Press play, and type when something feels off.'}</div>}
            {notes.map((n) => (
              <div key={n.id} className={`st-note${activeNote === n.id ? ' on' : ''}${n.status !== 'open' ? ' closed' : ''}`}>
                <div className="st-note-head">
                  {n.page != null ? (
                    <button className="st-tcode" onClick={() => setPage(n.page ?? 0)}>PAGE {n.page + 1}</button>
                  ) : n.t != null ? (
                    <button
                      className="st-tcode"
                      onClick={() => {
                        if (n.version !== version.version) setVersionNo(n.version);
                        setActiveNote(n.id);
                        pause();
                        seek(n.t ?? 0);
                      }}
                    >
                      {fmtTime(n.t, fps)}
                      {n.t_end != null ? `–${fmtTime(n.t_end, fps)}` : ''}
                    </button>
                  ) : null}
                  <span className="st-meta">v{n.version}{n.clip_id ? ` · ${n.clip_id}` : ''}</span>
                  {n.author === 'system' && <span className="dv-kicker red" style={{ padding: '1px 5px', fontSize: 9 }}>CHECK</span>}
                  <span className="st-meta" style={{ marginLeft: 'auto' }}>{n.status.toUpperCase()}{n.fixed_in ? ` IN v${n.fixed_in}` : ''}</span>
                </div>
                <div className="st-note-text">{n.text}</div>
                {n.tags.filter((tg) => tg !== 'check' && tg !== 'block' && tg !== 'warn').length > 0 && (
                  <div className="st-meta">#{n.tags.filter((tg) => !['check', 'block', 'warn'].includes(tg)).join(' #')}</div>
                )}
                {n.reply && <div className="st-reply">{n.reply}</div>}
                <div style={{ display: 'flex', gap: 10 }}>
                  {n.status === 'open' ? (
                    <button className="dv-link" onClick={() => setStatus(n, 'resolved')}>Resolve</button>
                  ) : (
                    <button className="dv-link" onClick={() => setStatus(n, 'open')}>Reopen</button>
                  )}
                  {n.author === 'founder' && (
                    <button className="dv-link" onClick={() => remove(n)}>Delete</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: '14px 16px', borderTop: '1.5px solid var(--ink)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="dv-mono" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em' }}>
              DENO CHECKS · ROUND {version.version}
            </span>
            {version.checks.length === 0 && <span className="st-meta">Nothing flagged.</span>}
            {blockers.length > 0 && <div className="dv-note" style={{ color: 'var(--red-ink)' }}>{blockers.length} blocking: fix before a final.</div>}
            {version.checks
              .filter((c) => c.t == null)
              .slice(0, 12)
              .map((c, i) => (
                <div key={`${c.rule_id}-${i}`} style={{ fontSize: 12.5, lineHeight: 1.45 }}>
                  <span className="dv-mono" style={{ fontSize: 10, fontWeight: 700, color: c.severity === 'block' ? 'var(--red-ink)' : 'var(--amber)' }}>
                    {c.severity === 'block' ? 'BLOCK' : 'WARN'}
                  </span>{' '}
                  {c.message}
                  {c.quote ? ` “${c.quote}”` : ''} <span className="dv-muted">→ {c.fix}</span>
                </div>
              ))}
          </div>

          {(item.credits ?? []).length > 0 && (
            <div style={{ padding: '14px 16px', borderTop: '1.5px solid var(--ink)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="dv-mono" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em' }}>CREDITS · PASTE IN THE POST</span>
              {(item.credits ?? []).map((c) => (
                <div key={c.asset_id} style={{ fontSize: 12.5 }}>
                  {c.credit || c.asset_id} <span className="st-meta">({c.license}{c.commercial ? '' : ' · NOT FOR COMMERCIAL USE'})</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ padding: '14px 16px', borderTop: '1.5px solid var(--ink)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {version.files.sheet && (
              <a className="dv-link" href={version.files.sheet} target="_blank" rel="noreferrer">Contact sheet ↗</a>
            )}
            {version.files.captions && (
              <a className="dv-link" href={version.files.captions} target="_blank" rel="noreferrer">Captions ↗</a>
            )}
            {version.files.review && (
              <a className="dv-link" href={version.files.review} target="_blank" rel="noreferrer">Review copy ↗</a>
            )}
            <button className="dv-link" style={{ marginLeft: 'auto', color: 'var(--red-ink)', borderColor: 'var(--red-ink)' }} onClick={del}>Delete item</button>
          </div>
        </aside>
      </div>
      {isStill && pages.length > 1 && (
        <div className="dv-pad" style={{ borderTop: '1.5px solid var(--ink)' }}>
          <div className="st-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
            {pages.map((src, i) => (
              <button key={src} className="st-card" style={{ padding: 0, cursor: 'pointer', outline: i === page ? '3px solid var(--lime)' : undefined }} onClick={() => setPage(i)}>
                <img src={src} alt={`Page ${i + 1}`} style={{ width: '100%', display: 'block' }} />
                <span className="st-meta" style={{ padding: 6 }}>PAGE {i + 1}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className={`toast${toast ? ' show' : ''}`}>{toast}</div>
    </StudioShell>
  );
}
