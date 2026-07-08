import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { sendSMS } from '@/lib/sms';

// POST { signupId } — cancels a pending signup on behalf of a member.
// Uses the admin client (service role) to bypass RLS, since members have no auth session.
// Only allows cancellation of 'pending' signups — cannot cancel already-delivered ones.
export async function POST(request: Request) {
  try {
    const { signupId } = await request.json() as { signupId: string };
    if (!signupId) return NextResponse.json({ error: 'signupId required' }, { status: 400 });

    const admin = createAdminClient();

    // Fetch full signup details needed for coordinator notification
    const { data: signup, error: fetchError } = await admin
      .from('signups')
      .select('id, status, member_name, item_type, coord_id, event_id')
      .eq('id', signupId)
      .single();

    if (fetchError || !signup) {
      return NextResponse.json({ error: 'Signup not found' }, { status: 404 });
    }
    if (signup.status !== 'pending') {
      return NextResponse.json({ error: 'Cannot cancel a signup that has already been delivered' }, { status: 400 });
    }

    const { error: deleteError } = await admin.from('signups').delete().eq('id', signupId);
    if (deleteError) throw new Error(deleteError.message);

    // Notify coordinator via SMS (fire-and-forget — don't fail the cancel if SMS fails)
    try {
      const [{ data: coord }, { data: event }] = await Promise.all([
        admin.from('coordinators').select('phone, notify_on_signup').eq('id', signup.coord_id).single(),
        admin.from('events').select('date').eq('id', signup.event_id).single(),
      ]);
      if (coord?.phone && coord.notify_on_signup && event?.date) {
        const date = new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric',
        });
        const itemLabel =
          signup.item_type === 'meals' ? '20 Meal Bags'
          : signup.item_type === 'nutritional' ? 'Nutritional Items'
          : 'Meal Bags + Nutritional Items';
        await sendSMS(coord.phone, `Seva Track: ${signup.member_name} cancelled their signup for ${date} (${itemLabel}).`);
      }
    } catch { /* SMS failure doesn't affect the cancel */ }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}
