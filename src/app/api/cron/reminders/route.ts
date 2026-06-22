import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { sendWhatsApp } from '@/lib/twilio';
import { formatTime } from '@/lib/ics';

function fmt(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

// Vercel calls this every morning at 8am PT via vercel.json cron schedule.
// It sends two types of reminders:
//   - 3 days before: "time to buy ingredients" to signed-up volunteers
//   - 1 day before:  "delivery is tomorrow" to signed-up volunteers
export async function GET(request: Request) {
  // Verify this is called by Vercel cron, not a random request
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const today = new Date();

  const dateIn = (days: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const threeDaysOut = dateIn(3);
  const oneDayOut    = dateIn(1);

  const [{ data: events3 }, { data: events1 }] = await Promise.all([
    admin.from('events').select('*').eq('date', threeDaysOut),
    admin.from('events').select('*').eq('date', oneDayOut),
  ]);

  const results: string[] = [];

  // 3-day reminder: buy ingredients
  for (const event of (events3 ?? [])) {
    const { data: signups } = await admin
      .from('signups').select('*')
      .eq('event_id', event.id)
      .neq('status', 'cancelled');

    for (const s of (signups ?? [])) {
      if (!s.member_phone) continue;
      try {
        await sendWhatsApp(
          s.member_phone,
          `Hi ${s.member_name}! 🛍️ Seva Commons reminder: your delivery is in 3 days — ${fmt(event.date)}. Time to pick up your ingredients!\n\nDrop-off: ${formatTime(event.drop_off_start)}–${formatTime(event.drop_off_end)} at ${event.drop_off_location}\n\nThank you! 🫶`,
        );
        results.push(`3-day → ${s.member_name} (${s.member_phone})`);
      } catch (e) {
        results.push(`3-day FAILED → ${s.member_name}: ${e}`);
      }
    }
  }

  // 1-day reminder: delivery is tomorrow
  for (const event of (events1 ?? [])) {
    const { data: signups } = await admin
      .from('signups').select('*')
      .eq('event_id', event.id)
      .neq('status', 'cancelled');

    for (const s of (signups ?? [])) {
      if (!s.member_phone) continue;
      try {
        await sendWhatsApp(
          s.member_phone,
          `Hi ${s.member_name}! 🍱 Your Seva Commons delivery is TOMORROW — ${fmt(event.date)}.\n\nDrop-off: ${formatTime(event.drop_off_start)}–${formatTime(event.drop_off_end)}\n📍 ${event.drop_off_location}\n\nThank you for volunteering! 🙏`,
        );
        results.push(`1-day → ${s.member_name} (${s.member_phone})`);
      } catch (e) {
        results.push(`1-day FAILED → ${s.member_name}: ${e}`);
      }
    }
  }

  return NextResponse.json({ sent: results.length, results });
}
