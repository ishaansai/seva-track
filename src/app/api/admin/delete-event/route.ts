import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

async function getCoordId(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { cookie: cookieHeader } } }
  );
  const { data: { user } } = await anonClient.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data } = await admin.from('coordinators').select('id').eq('user_id', user.id).single();
  return data?.id ?? null;
}

// POST { eventId } — deletes an event and all its signups.
// Verifies the logged-in coordinator owns the event before deleting.
export async function POST(request: Request) {
  try {
    const { eventId } = await request.json() as { eventId: string };
    if (!eventId) return NextResponse.json({ error: 'eventId required' }, { status: 400 });

    const coordId = await getCoordId();
    if (!coordId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const admin = createAdminClient();

    // Verify coordinator owns this event
    const { data: event } = await admin.from('events').select('id, coord_id').eq('id', eventId).single();
    if (!event || event.coord_id !== coordId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Delete signups first, then the event
    await admin.from('signups').delete().eq('event_id', eventId);
    const { error } = await admin.from('events').delete().eq('id', eventId);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}
