/**
 * /api/admin/actions — Service-role endpoint for coordinator admin CRUD on signups.
 * Bypasses RLS so approvers can add/update/remove signups on any date, any coordinator.
 *
 * Allowed callers: coordinators with id 'ndsw75' or 'g8rla2'.
 * Actions: add-signup | mark-delivered | undo-delivery | remove-signup
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
    { global: { headers: { cookie: cookieHeader } } },
  );

  const { data: { user } } = await anonClient.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from('coordinators')
    .select('id')
    .eq('user_id', user.id)
    .single();

  return data?.id ?? null;
}

const APPROVER_IDS = new Set(['ndsw75', 'g8rla2']);

export async function POST(request: Request) {
  const coordId = await getCallerCoordId();
  if (!coordId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await request.json() as {
    action:
      | 'add-signup'
      | 'mark-delivered'
      | 'undo-delivery'
      | 'remove-signup'
      | 'update-event'
      | 'delete-event';
    // add-signup fields
    event_id?: string;
    coord_id?: string;
    member_name?: string;
    member_phone?: string;
    item_type?: string;
    // mark-delivered / undo-delivery / remove-signup fields
    signup_id?: string;
    // update-event / delete-event fields
    patch?: Record<string, unknown>;
  };

  const admin = createAdminClient();

  if (body.action === 'add-signup') {
    if (!body.event_id || !body.member_name || !body.item_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Use the event's own coord_id so signups belong to the right coordinator
    let eventCoordId = body.coord_id;
    if (!eventCoordId) {
      const { data: ev } = await admin.from('events').select('coord_id').eq('id', body.event_id).single();
      eventCoordId = ev?.coord_id ?? coordId;
    }

    // Normalise phone
    const phone = body.member_phone ? body.member_phone.replace(/\D/g, '') : '';

    // Look up existing name for this phone under this coordinator
    let memberName = body.member_name;
    if (phone) {
      const { data: existing } = await admin
        .from('signups')
        .select('member_name')
        .eq('coord_id', eventCoordId)
        .eq('member_phone', phone)
        .order('signed_up_at', { ascending: true })
        .limit(1);
      if (existing?.[0]?.member_name) memberName = existing[0].member_name;
    }

    const { data, error } = await admin
      .from('signups')
      .insert({
        event_id: body.event_id,
        coord_id: eventCoordId,
        member_name: memberName,
        member_phone: phone,
        item_type: body.item_type,
        status: 'pending',
        added_by_admin: true,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (body.action === 'mark-delivered') {
    if (!body.signup_id) return NextResponse.json({ error: 'Missing signup_id' }, { status: 400 });
    const { error } = await admin
      .from('signups')
      .update({ status: 'delivered', delivered_at: new Date().toISOString() })
      .eq('id', body.signup_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'undo-delivery') {
    if (!body.signup_id) return NextResponse.json({ error: 'Missing signup_id' }, { status: 400 });
    const { error } = await admin
      .from('signups')
      .update({ status: 'pending', delivery_photo_url: null, delivered_at: null })
      .eq('id', body.signup_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'remove-signup') {
    if (!body.signup_id) return NextResponse.json({ error: 'Missing signup_id' }, { status: 400 });
    const { error } = await admin.from('signups').delete().eq('id', body.signup_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'update-event') {
    if (!body.event_id || !body.patch) {
      return NextResponse.json({ error: 'Missing event_id or patch' }, { status: 400 });
    }
    // Verify caller owns the event OR is an approver
    const { data: ev } = await admin.from('events').select('coord_id').eq('id', body.event_id).single();
    if (!ev) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    if (ev.coord_id !== coordId && !APPROVER_IDS.has(coordId)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }
    const { error } = await admin.from('events').update(body.patch).eq('id', body.event_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'delete-event') {
    if (!body.event_id) return NextResponse.json({ error: 'Missing event_id' }, { status: 400 });
    // Verify caller owns the event OR is an approver
    const { data: ev } = await admin.from('events').select('coord_id').eq('id', body.event_id).single();
    if (!ev) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    if (ev.coord_id !== coordId && !APPROVER_IDS.has(coordId)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }
    await admin.from('signups').delete().eq('event_id', body.event_id);
    const { error } = await admin.from('events').delete().eq('id', body.event_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
