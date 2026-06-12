import { Suspense } from 'react';
import { createAdminClient } from '@/lib/supabase';
import { CoordinatorProfile, SevaEvent, Signup } from '@/lib/db';
import MemberPageClient from './client';

/**
 * Server component — runs on Vercel server with the admin/service-role key.
 * Bypasses Supabase RLS entirely so all coordinators' events are loaded.
 * Passes pre-loaded data as props to the interactive client component.
 */
async function MemberDataLoader() {
  const admin = createAdminClient();

  const [{ data: coordinators }, { data: events }, { data: signups }] = await Promise.all([
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

  return (
    <MemberPageClient
      initialCoordinators={(coordinators ?? []) as CoordinatorProfile[]}
      initialEvents={(events ?? []) as SevaEvent[]}
      initialSignups={(signups ?? []) as Signup[]}
    />
  );
}

export default function MemberPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <div className="text-4xl mb-3">🍱</div>
          <p className="text-base">Loading…</p>
        </div>
      </div>
    }>
      <MemberDataLoader />
    </Suspense>
  );
}
