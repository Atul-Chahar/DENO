import { redirect } from 'next/navigation';
import { Rulebook } from '@/components/studio/Rulebook';
import { isAuthEnabled } from '@/lib/supabase/config';
import { getUserId } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function StudioRulebook() {
  if (isAuthEnabled() && !(await getUserId())) redirect('/auth?next=/app/studio/rulebook');
  return <Rulebook />;
}
