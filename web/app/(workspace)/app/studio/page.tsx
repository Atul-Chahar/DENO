import { redirect } from 'next/navigation';
import { StudioLibrary } from '@/components/studio/StudioLibrary';
import { isAuthEnabled } from '@/lib/supabase/config';
import { getUserId } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function Studio() {
  if (isAuthEnabled() && !(await getUserId())) redirect('/auth?next=/app/studio');
  return <StudioLibrary />;
}
