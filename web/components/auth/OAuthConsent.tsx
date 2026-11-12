'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ErrorNotice } from './ErrorNotice';

type Pending = { clientName: string; redirectHost: string; scopes: string[]; email: string | null };

const SCOPE_TEXT: Record<string, string> = {
  openid: 'Confirm it’s you',
  email: 'See your email address',
  profile: 'See your name',
};

/** The consent step of Supabase's OAuth server, built from the auth screen's components (docs/16). */
export function OAuthConsent({ authorizationId }: { authorizationId: string }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [busy, setBusy] = useState(false);

  function showError(message: string) {
    setError(message);
    setNonce((n) => n + 1);
  }

  useEffect(() => {
    void (async () => {
      const supabase = createClient();
      if (!supabase) return showError('Sign-in is not configured yet.');
      const [{ data, error: detailsError }, { data: user }] = await Promise.all([
        supabase.auth.oauth.getAuthorizationDetails(authorizationId),
        supabase.auth.getUser(),
      ]);
      if (detailsError || !data) return showError('This connection request has expired. Start it again from the app.');
      if (!('authorization_id' in data)) {
        window.location.assign(data.redirect_url); // already approved earlier
        return;
      }
      let redirectHost = data.redirect_uri;
      try {
        redirectHost = new URL(data.redirect_uri).host;
      } catch {
        // keep the raw value
      }
      setPending({
        clientName: data.client.name || 'An app',
        redirectHost,
        scopes: (data.scope || '').split(' ').filter(Boolean),
        email: user.user?.email ?? null,
      });
    })();
  }, [authorizationId]);

  async function decide(approve: boolean) {
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true);
    try {
      const result = approve
        ? await supabase.auth.oauth.approveAuthorization(authorizationId)
        : await supabase.auth.oauth.denyAuthorization(authorizationId);
      if (result.error || !result.data) return showError('That didn’t go through. Try again.');
      window.location.assign(result.data.redirect_url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-frame">
        <div className="auth-topbar">
          <a href="/" className="brand brand--sm">
            <span className="brand__word">deno</span>
            <span className="brand__chip">GTM</span>
          </a>
          <form action="/auth/signout" method="post">
            <button type="submit" className="mono-plain auth-linklike auth-topbar__back">← Use a different account</button>
          </form>
        </div>

        <div className="auth-grid">
          <div className="auth-col">
            <div className="auth-heading">
              <span className="tag tag--green">Connect</span>
              <h1 className="display auth-heading__title">
                {pending ? `${pending.clientName} wants to use your Deno account.` : 'Checking the request…'}
              </h1>
              {pending && (
                <p className="prose auth-heading__sub">
                  It will be able to list your ideas, start validations, read your reports and use your founder
                  context to write content{pending.email ? ` as ${pending.email}` : ''}. Everything it makes shows up
                  on your Deno dashboard. You can disconnect it any time from {pending.clientName}.
                </p>
              )}
            </div>

            {pending && pending.scopes.length > 0 && (
              <ul className="prose" style={{ marginBottom: 16 }}>
                {pending.scopes.map((s) => (
                  <li key={s}>{SCOPE_TEXT[s] ?? s}</li>
                ))}
              </ul>
            )}
            {pending && (
              <p className="prose auth-heading__sub" style={{ marginBottom: 16 }}>
                You’ll be sent back to <b>{pending.redirectHost}</b>.
              </p>
            )}

            <ErrorNotice message={error} nonce={nonce} />

            {pending && (
              <div style={{ display: 'grid', gap: 12 }}>
                <button
                  type="button"
                  className="btn btn--lime btn--block btn--raised"
                  style={{ fontSize: 16, padding: 16 }}
                  disabled={busy}
                  onClick={() => void decide(true)}
                >
                  Allow
                </button>
                <button type="button" className="btn btn--block" disabled={busy} onClick={() => void decide(false)}>
                  Deny
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
