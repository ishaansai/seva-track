import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { sendSMS } from '@/lib/sms';

// POST { coordId, memberName, itemType, eventDate, action, memberPhone?, eventId? }
// Sends an SMS to the coordinator when a volunteer signs up or cancels.
// Also sends a confirmation SMS to the volunteer on signup (always, regardless
// of coordinator notification preferences).
export async function POST(request: Request) {
  try {
    const { coordId, memberName, itemType, eventDate, action, memberPhone, eventId } = await request.json() as {
      coordId: string;
      memberName: string;
      itemType: string;
      eventDate: string;
      action: 'signup' | 'cancel';
      memberPhone?: string;
      eventId?: string;
    };

    if (!coordId || !memberName || !eventDate || !action) {
      return NextResponse.json({ ok: false });
    }

    const admin = createAdminClient();

    const date = new Date(eventDate + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    });

    const itemLabel =
      itemType === 'meals' ? 'Meal Bags'
      : itemType === 'nutritional' ? 'Nutritional Items'
      : 'Meal Bags + Nutritional Items';

    // ── Volunteer confirmation SMS (always send on signup) ──────────────────
    if (action === 'signup' && memberPhone) {
      const normalizedPhone = memberPhone.replace(/\D/g, '');
      if (normalizedPhone) {
        let timeInfo = '';
        if (eventId) {
          const { data: ev } = await admin
            .from('events')
            .select('drop_off_start, drop_off_end, drop_off_location')
            .eq('id', eventId)
            .single();
          if (ev) {
            const { formatTime } = await import('@/lib/ics');
            timeInfo = `\n\nDrop-off: ${formatTime(ev.drop_off_start)}–${formatTime(ev.drop_off_end)}\nLocation: ${ev.drop_off_location}`;
          }
        }
        await sendSMS(
          normalizedPhone,
          `Hi ${memberName}! 🙏 You're signed up for Seva Commons meal bag delivery on ${date} (${itemLabel}).${timeInfo}\n\nYou'll get a reminder at the start of the week and the day before. Thank you for your seva! 🌸`,
        ).catch((e) => console.error('volunteer confirmation SMS failed:', e));
      }
    }

    // ── Coordinator notification (respects their notify_on_signup pref) ─────
    const { data: coord } = await admin
      .from('coordinators')
      .select('phone, notify_on_signup')
      .eq('id', coordId)
      .single();

    if (coord?.phone && coord.notify_on_signup) {
      const coordItemLabel =
        itemType === 'meals' ? '20 Meal Bags'
        : itemType === 'nutritional' ? 'Nutritional Items'
        : 'Meal Bags + Nutritional Items';
      const message = action === 'signup'
        ? `Seva Track: ${memberName} signed up for ${date} (${coordItemLabel}).`
        : `Seva Track: ${memberName} cancelled their signup for ${date} (${coordItemLabel}).`;
      await sendSMS(coord.phone, message).catch((e) => console.error('coordinator SMS failed:', e));
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('notify-coordinator error:', e);
    return NextResponse.json({ ok: false });
  }
}
