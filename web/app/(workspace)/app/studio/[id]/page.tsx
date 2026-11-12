import { redirect } from 'next/navigation';
import { StudioReview } from '@/components/studio/StudioReview';
import { isAuthEnabled } from '@/lib/supabase/config';
import { getUserId } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function StudioItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (isAuthEnabled() && !(await getUserId())) redirect(`/auth?next=/app/studio/${encodeURIComponent(id)}`);
  return <StudioReview id={id} />;
}
