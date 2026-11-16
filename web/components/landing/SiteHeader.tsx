'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Section = 'home' | 'pricing' | 'docs';

export function SiteHeader({ active = 'home' }: { active?: Section }) {
  const [signedIn, setSignedIn] = useState(false);

  // Read the local session (no network call) so a signed-in visitor gets a way back to the workspace.
  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session))).catch(() => undefined);
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)));
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <header className="site-header" id="top">
      <div className="site-header__row">
        <a href="/" className="brand" aria-label="Deno home">
          <span className="brand__word">deno</span>
          <span className="brand__chip">GTM</span>
        </a>

        <nav className="site-nav" aria-label="Main">
          <a href="/#how" className="site-nav__link">How it works</a>
          <a href="/#make" className="site-nav__link">What you can make</a>
          <a href="/pricing" className="site-nav__link" aria-current={active === 'pricing' ? 'page' : undefined}>Pricing</a>
          <a href="/docs" className="site-nav__link" aria-current={active === 'docs' ? 'page' : undefined}>Docs</a>
        </nav>

        <div className="site-header__actions">
          {signedIn ? (
            <>
              <a href="/app/account" className="site-header__login">Account</a>
              <a href="/app/home" className="btn btn--lime btn--raised">Open dashboard</a>
            </>
          ) : (
            <>
              <a href="/auth" className="site-header__login">Log in</a>
              <a href="/auth?mode=signup" className="btn btn--lime btn--raised">Connect your AI</a>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
