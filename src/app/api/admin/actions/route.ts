/**
 * /api/admin/actions — Service-role endpoint for coordinator admin CRUD on signups.
 * Bypasses RLS so approvers can add/update/remove signups on any date, any coordinator.
 *
 * Allowed callers: coordinators with id 'ndsw75' or 'g8rla2'.
 * Actions: add-signup | mark-delivered | undo-delivery | remove-signup
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { sendSMS } from '@/lib/sms';
import { formatTime } from '@/lib/ics';

/**
 * Verify the caller by reading the JWT from the Authorization header.
 * The browser client stores the session in localStorage (not cookies),
 * so cookie-based auth never works here. The dashboard passes the token
 * explicitly via `Authorization: Bearer <token>`.
 */
async function getCallerCoordId(request: Request): Promise<string | null> {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/, '');
  if (!token) return null;

  const admin = createAdminClient();
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return null;

  const { data } = await admin
    .from('coordinators')
    .select('id')
    .eq('user_id', user.id)
    .single();

  return data?.id ?? null;
}

const APPROVER_IDS = new Set(['ndsw75', 'g8rla2']);

export async function POST(request: Request) {
  const coordId = await getCallerCoordId(request);
  if (!coordId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await request.json() as {
    action:
      | 'add-signup'
      | 'mark-delivered'
      | 'undo-delivery'
      | 'remove-signup'
      | 'update-signup'
      | 'update-event'
      | 'delete-event'
      | 'update-member-phone'
      | 'send-reminder';
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
    // update-member-phone fields
    old_phone?: string;
    new_phone?: string;
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

    // Send confirmation SMS to the volunteer (fire-and-forget, dynamic import avoids build issues)
    if (phone && data) {
      const { data: ev } = await admin.from('events').select('date, drop_off_start, drop_off_end, drop_off_location').eq('id', body.event_id).single();
      if (ev) {
        const itemLabel =
          body.item_type === 'meals' ? 'Meal Bags'
          : body.item_type === 'nutritional' ? 'Nutritional Items'
          : 'Meal Bags + Nutritional Items';
        const dateLabel = new Date(ev.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        Promise.all([import('@/lib/sms'), import('@/lib/ics')]).then(([{ sendSMS }, { formatTime }]) =>
          sendSMS(
            phone,
            `Hi ${memberName}! 🙏 You've been signed up for Seva Commons meal bag delivery on ${dateLabel} (${itemLabel}).\n\nDrop-off: ${formatTime(ev.drop_off_start)}–${formatTime(ev.drop_off_end)}\nLocation: ${ev.drop_off_location}\n\nYou'll get a reminder at the start of the week and the day before. Thank you! 🌸`,
          )
        ).catch((e) => console.error('admin add-signup SMS failed:', e));
      }
    }

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

  if (body.action === 'update-signup') {
    if (!body.signup_id || !body.patch) {
      return NextResponse.json({ error: 'Missing signup_id or patch' }, { status: 400 });
    }
    const allowed = ['item_type', 'member_name', 'member_phone'];
    const safePatch = Object.fromEntries(
      Object.entries(body.patch).filter(([k]) => allowed.includes(k))
    );
    const { error } = await admin.from('signups').update(safePatch).eq('id', body.signup_id);
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

  if (body.action === 'update-member-phone') {
    const { old_phone, new_phone } = body;
    if (!old_phone || !new_phone) {
      return NextResponse.json({ error: 'Missing old_phone or new_phone' }, { status: 400 });
    }
    const digits = new_phone.replace(/\D/g, '');
    if (digits.length !== 10) {
      return NextResponse.json({ error: 'Phone must be exactly 10 digits' }, { status: 400 });
    }
    // Update all signups for this member+coordinator
    const { error } = await admin
      .from('signups')
      .update({ member_phone: digits })
      .eq('coord_id', coordId)
      .eq('member_phone', old_phone.replace(/\D/g, ''));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'send-reminder') {
    if (!body.signup_id) return NextResponse.json({ error: 'Missing signup_id' }, { status: 400 });
    const { data: s, error: sErr } = await admin
      .from('signups')
      .select('member_name, member_phone, event_id, item_type')
      .eq('id', body.signup_id)
      .single();
    if (sErr || !s) return NextResponse.json({ error: 'Signup not found' }, { status: 404 });
    if (!s.member_phone) return NextResponse.json({ error: 'No phone on file' }, { status: 400 });

    const { data: ev } = await admin
      .from('events')
      .select('date, drop_off_start, drop_off_end, drop_off_location')
      .eq('id', s.event_id)
      .single();
    if (!ev) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const dayLabel = new Date(ev.date + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    });
    const dropOff = ev.drop_off_start && ev.drop_off_end
      ? `${formatTime(ev.drop_off_start)}–${formatTime(ev.drop_off_end)}`
      : '';

    const msg = `Hi ${s.member_name}! 🙏 Seva Commons reminder: you're signed up to deliver meal bags on ${dayLabel}.\n\nDrop-off: ${dropOff}\nLocation: ${ev.drop_off_location ?? ''}\n\nThank you for your seva! Reply STOP to opt out.`;

    try {
      await sendSMS(s.member_phone, msg);
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
