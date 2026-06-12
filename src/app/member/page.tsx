import { Suspense } from 'react';
import { createAdminClient } from '@/lib/supabase';
import { CoordinatorProfile, SevaEvent, Signup } from '@/lib/db';
import MemberPageClient from './client';

// Always render fresh — never use a cached/static version of this page
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MemberPage() {
  let coordinators: CoordinatorProfile[] = [];
  let events: SevaEvent[] = [];
  let signups: Signup[] = [];

  try {
    const admin = createAdminClient();
    const [cRes, eRes, sRes] = await Promise.all([
      admin
        .from('coordinators')
        .select('id,name,email,phone,address,signup_open_day,signup_open_override,signup_close_override,notify_on_signup')
        .order('created_at', { ascending: true }),
      admin
        .from('events')
        .select('*')
        .order('date', { ascending: true }),
      admin
        .from('signups')
        .select('*')
        .order('signed_up_at', { ascending: true }),
    ]);
    coordinators = (cRes.data ?? []) as CoordinatorProfile[];
    events       = (eRes.data ?? []) as SevaEvent[];
    signups      = (sRes.data ?? []) as Signup[];
  } catch (err) {
    console.error('[MemberPage] Failed to load data:', err);
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <div className="text-4xl mb-3">🍱</div>
          <p className="text-base">Loading…</p>
        </div>
      </div>
    }>
      <MemberPageClient
        initialCoordinators={coordinators}
        initialEvents={events}
        initialSignups={signups}
      />
    </Suspense>
  );
}
