import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

/**
 * GET /api/public
 * Returns all coordinators + all events + all signups for the public member page.
 * Uses the service role key to bypass RLS — safe because it only returns non-sensitive data.
 */
export async function GET() {
  try {
    const admin = createAdminClient();

    const [{ data: coordinators }, { data: events }, { data: signups }] = await Promise.all([
      admin
        .from('coordinators')
        .select('id,name,phone,address,signup_open_day,signup_open_override,signup_close_override,notify_on_signup')
        .order('created_at', { ascending: true }),
      admin
        .from('events')
        .select('*')
        .order('date', { ascending: true }),
      admin
        .from('signups')
        .select('id,event_id,member_name,item_type,status,signed_up_at,delivered_at,confirmed_at,nutritional_slots')
        .order('signed_up_at', { ascending: true }),
    ]);

    return NextResponse.json({
      coordinators: coordinators ?? [],
      events: events ?? [],
      signups: signups ?? [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ coordinators: [], events: [], signups: [], error: msg }, { status: 200 });
  }
}
