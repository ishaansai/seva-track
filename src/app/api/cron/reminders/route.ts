import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { sendSMS } from '@/lib/sms';
import { formatTime } from '@/lib/ics';

function fmt(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

// Vercel calls this every Monday at 8am PT via vercel.json cron schedule.
// Sends a start-of-week reminder to all volunteers signed up for deliveries this week.
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

  const results: string[] = [];

  // Start-of-week reminder: every Monday, remind all volunteers signed up
  // for events happening in the next 7 days.
  const isMonday = today.getDay() === 1;
  if (isMonday) {
    const weekEnd = dateIn(7);
    const weekStart = today.toISOString().slice(0, 10);

    const { data: weekEvents } = await admin
      .from('events')
      .select('*')
      .gte('date', weekStart)
      .lte('date', weekEnd);

    for (const event of (weekEvents ?? [])) {
      const { data: signups } = await admin
        .from('signups').select('*')
        .eq('event_id', event.id)
        .neq('status', 'cancelled');

      const weekday = new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });

      for (const s of (signups ?? [])) {
        if (!s.member_phone) continue;
        try {
          await sendSMS(
            s.member_phone,
            `Hi ${s.member_name}! 🙏 Seva Commons weekly reminder: you're signed up to deliver meal bags this ${weekday} (${fmt(event.date)})!\n\nDrop-off: ${formatTime(event.drop_off_start)}–${formatTime(event.drop_off_end)}\nLocation: ${event.drop_off_location}\n\nStart prepping your ingredients! Thank you for your seva! 🌸`,
          );
          results.push(`week-start → ${s.member_name} (${s.member_phone})`);
        } catch (e) {
          results.push(`week-start FAILED → ${s.member_name}: ${e}`);
        }
      }
    }
  }

  return NextResponse.json({ sent: results.length, results });
}
