import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import CapturePage from '@/components/CapturePage';

export default async function CaptureRoute() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/capture');
  return <CapturePage userId={user.id} />;
}
