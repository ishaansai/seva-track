import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { sendSMS } from '@/lib/sms';

export async function POST(request: Request) {
  try {
    const { phone } = await request.json() as { phone: string };
    const cleaned = (phone ?? '').replace(/\D/g, '');
    if (cleaned.length < 7) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Rate limit: max 3 OTPs per phone per hour
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from('otp_tokens')
      .select('*', { count: 'exact', head: true })
      .eq('phone', cleaned)
      .gte('created_at', hourAgo);

    if ((count ?? 0) >= 3) {
      return NextResponse.json(
        { error: 'Too many codes requested. Please wait an hour before trying again.' },
        { status: 429 },
      );
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await admin.from('otp_tokens').insert({ phone: cleaned, code, expires_at: expiresAt });

    await sendSMS(
      cleaned,
      `Your Seva Track verification code is: ${code}\n\nExpires in 10 minutes. Do not share this code.`,
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to send code' },
      { status: 500 },
    );
  }
}
