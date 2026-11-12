import type { ReactNode } from 'react';

/** The Studio pages' frame: brand, back link and the Library / Rulebook tabs (docs/18). */
export function StudioShell({ active, children, right }: { active: 'library' | 'rulebook' | 'review'; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="dv-shell">
      <div className="dv-frame">
        <div className="dv-top">
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <a href="/app" className="dv-brand">
              <span className="dv-brand-word">deno</span>
              <span className="dv-brand-chip">GTM</span>
            </a>
            <a href="/app" className="dv-back">← WORKSPACE</a>
          </div>
          <div className="dv-tabs">
            <a href="/app/studio" className={`dv-tab${active === 'library' ? ' on' : ''}`} style={{ textDecoration: 'none' }}>STUDIO</a>
            <a href="/app/studio/rulebook" className={`dv-tab${active === 'rulebook' ? ' on' : ''}`} style={{ textDecoration: 'none' }}>RULEBOOK</a>
            {right}
            <a href="/app/account" className="dv-tab" style={{ textDecoration: 'none' }}>ACCOUNT</a>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

export function fmtTime(t: number | null | undefined, fps = 30): string {
  if (t == null || !Number.isFinite(t)) return '--:--';
  const total = Math.max(0, t);
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  const f = Math.floor((total - Math.floor(total)) * fps + 1e-6);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
}

export const STATUS_LABEL: Record<string, string> = {
  draft: 'DRAFT',
  in_review: 'IN REVIEW',
  approved: 'APPROVED',
  archived: 'ARCHIVED',
};
