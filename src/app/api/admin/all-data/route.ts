/**
 * GET /api/admin/all-data
 * Returns ALL events + signups across every coordinator using the service-role
 * key, which bypasses RLS entirely. Only callable by authenticated, approved
 * coordinators — verified via the caller's session cookie.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

async function getCallerCoordId(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { cookie: cookieHeader } },
    },
  );

  const { data: { user } } = await anonClient.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from('coordinators')
    .select('id')
    .eq('user_id', user.id)
    .eq('approved', true)
    .single();

  return data?.id ?? null;
}

export async function GET() {
  const coordId = await getCallerCoordId();
  if (!coordId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const admin = createAdminClient();

  const [{ data: events }, { data: signups }] = await Promise.all([
    admin.from('events').select('*').order('date', { ascending: true }),
    admin.from('signups').select('*').order('signed_up_at', { ascending: true }),
  ]);

  return NextResponse.json({
    events: events ?? [],
    signups: signups ?? [],
  });
}
