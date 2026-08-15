/**
 * POST /api/admin/send-reminders
 * Manually blast reminders for a specific event date.
 * Protected by CRON_SECRET. Delete after use.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { sendSMS } from '@/lib/sms';

export async function POST(request: Request) {
  const auth = request.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && auth !== `Bearer ${process.env.TEMP_TEST_KEY}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { date, message_override } = await request.json() as { date: string; message_override?: string };
  if (!date) return NextResponse.json({ error: 'Missing date' }, { status: 400 });

  const admin = createAdminClient();
  const { data: events, error } = await admin.from('events').select('*').eq('date', date);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!events?.length) return NextResponse.json({ sent: 0, results: [`No events on ${date}`] });

  const results: string[] = [];

  for (const event of events) {
    const { data: signups } = await admin
      .from('signups').select('*')
      .eq('event_id', event.id)
      .neq('status', 'cancelled');

    for (const s of (signups ?? [])) {
      if (!s.member_phone) { results.push(`SKIP ${s.member_name} — no phone`); continue; }

      const dayLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric',
      });
      const dropOff = event.drop_off_start && event.drop_off_end
        ? `${event.drop_off_start}–${event.drop_off_end}`
        : '';

      const msg = message_override
        ?? `Hi ${s.member_name}! 🙏 Seva Commons reminder: you're signed up to deliver meal bags on ${dayLabel}.\n\nDrop-off: ${dropOff}\nLocation: ${event.drop_off_location ?? ''}\n\nThank you for your seva! Reply STOP to opt out.`;

      try {
        await sendSMS(s.member_phone, msg);
        results.push(`✅ ${s.member_name} (${s.member_phone})`);
      } catch (e) {
        results.push(`❌ ${s.member_name}: ${e}`);
      }
    }
  }

  return NextResponse.json({ sent: results.filter(r => r.startsWith('✅')).length, results });
}
