import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { sendSMS } from '@/lib/sms';

// POST { coordId, memberName, itemType, eventDate, action }
// Sends an SMS to the coordinator when a volunteer signs up or cancels.
// Respects the coordinator's notify_on_signup preference.
export async function POST(request: Request) {
  try {
    const { coordId, memberName, itemType, eventDate, action } = await request.json() as {
      coordId: string;
      memberName: string;
      itemType: string;
      eventDate: string;
      action: 'signup' | 'cancel';
    };

    if (!coordId || !memberName || !eventDate || !action) {
      return NextResponse.json({ ok: false });
    }

    const admin = createAdminClient();
    const { data: coord } = await admin
      .from('coordinators')
      .select('phone, notify_on_signup')
      .eq('id', coordId)
      .single();

    if (!coord?.phone || !coord.notify_on_signup) {
      return NextResponse.json({ ok: false, reason: 'notifications off or no phone' });
    }

    const date = new Date(eventDate + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    });

    const itemLabel =
      itemType === 'meals' ? '20 Meal Bags'
      : itemType === 'nutritional' ? 'Nutritional Items'
      : 'Meal Bags + Nutritional Items';

    const message = action === 'signup'
      ? `Seva Track: ${memberName} signed up for ${date} (${itemLabel}).`
      : `Seva Track: ${memberName} cancelled their signup for ${date} (${itemLabel}).`;

    await sendSMS(coord.phone, message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    // Fire-and-forget — don't surface errors to the volunteer
    console.error('notify-coordinator error:', e);
    return NextResponse.json({ ok: false });
  }
}
