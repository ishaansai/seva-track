import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { sendSMS } from '@/lib/sms';
import { formatTime } from '@/lib/ics';

function fmt(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const todayStr = new Date().toISOString().slice(0, 10);
  const results: string[] = [];

  const { data: events } = await admin.from('events').select('*').eq('date', todayStr);

  for (const event of (events ?? [])) {
    const { data: signups } = await admin
      .from('signups').select('*')
      .eq('event_id', event.id)
      .neq('status', 'cancelled');

    for (const s of (signups ?? [])) {
      if (!s.member_phone) continue;
      const itemLabel =
        s.item_type === 'meals' ? 'Meal Bags' :
        s.item_type === 'nutritional' ? 'Nutritional Items' :
        'Meal Bags + Nutritional Items';
      try {
        await sendSMS(
          s.member_phone,
          `Hi ${s.member_name}! 🙏 Seva Commons reminder: you're signed up for meal bag delivery TODAY (${fmt(event.date)}) — ${itemLabel}.\n\nDrop-off: ${formatTime(event.drop_off_start)}–${formatTime(event.drop_off_end)}\nLocation: ${event.drop_off_location}\n\nThank you for your seva! 🌸`,
        );
        results.push(`✅ ${s.member_name} (${s.member_phone})`);
      } catch (e) {
        results.push(`❌ ${s.member_name}: ${e}`);
      }
    }
  }

  return NextResponse.json({ sent: results.length, results });
}
