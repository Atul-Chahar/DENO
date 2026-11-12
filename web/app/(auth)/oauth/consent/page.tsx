import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { OAuthConsent } from '@/components/auth/OAuthConsent';
import { getUserId } from '@/lib/supabase/server';

// Depends on the request's auth cookies; never prerender.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Deno — Connect an app' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Supabase's OAuth server sends people here when Claude, ChatGPT or another MCP client asks to use their
 * Deno account (docs/16). Sign in first, then approve or deny.
 */
export default async function OAuthConsentPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const raw = Array.isArray(params.authorization_id) ? params.authorization_id[0] : params.authorization_id;
  const authorizationId = raw && /^[A-Za-z0-9_-]{1,200}$/.test(raw) ? raw : null;
  if (!authorizationId) redirect('/app');
  const here = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
  if (!(await getUserId())) redirect(`/auth?next=${encodeURIComponent(here)}`);
  return <OAuthConsent authorizationId={authorizationId} />;
}
