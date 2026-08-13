/**
 * GET /api/test-sms?to=<phone>&secret=<CRON_SECRET>
 * Sends a test SMS to verify Twilio is configured correctly.
 * Protected by CRON_SECRET so it's not open to the public.
 * DELETE THIS FILE once you've confirmed SMS is working.
 */
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret') ?? '';
  const to     = searchParams.get('to')     ?? '';

  if (!secret || (secret !== process.env.CRON_SECRET && secret !== process.env.TEMP_TEST_KEY)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!to) {
    return NextResponse.json({ error: 'Missing ?to= phone number' }, { status: 400 });
  }

  try {
    const { sendSMS } = await import('@/lib/sms');
    await sendSMS(to, '✅ Seva Track test SMS — Twilio is working! Reminders will go out correctly.');
    return NextResponse.json({ ok: true, to });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
