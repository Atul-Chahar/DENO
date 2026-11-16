import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Home } from '@/components/workspace/Home';
import { isAuthEnabled } from '@/lib/supabase/config';
import { getUserId } from '@/lib/supabase/server';
import '@/styles/home.css';

export const metadata: Metadata = { title: 'Deno — Home' };

// Depends on the request's auth cookies; never prerender.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  // proxy.ts already redirects signed-out users; this is the authoritative check.
  if (isAuthEnabled() && !(await getUserId())) redirect('/auth?next=/app/home');
  return <Home />;
}
