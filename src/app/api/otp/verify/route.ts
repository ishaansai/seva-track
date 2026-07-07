import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { phone, code } = await request.json() as { phone: string; code: string };
    const cleaned = (phone ?? '').replace(/\D/g, '');
    if (!cleaned || !code) {
      return NextResponse.json({ error: 'Phone and code required' }, { status: 400 });
    }

    const admin = createAdminClient();
    const now = new Date().toISOString();

    const { data: token } = await admin
      .from('otp_tokens')
      .select('id, code, expires_at, used')
      .eq('phone', cleaned)
      .eq('used', false)
      .gte('expires_at', now)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!token) {
      return NextResponse.json({ error: 'Code not found or expired. Request a new one.' }, { status: 400 });
    }
    if (token.code !== code) {
      return NextResponse.json({ error: 'Incorrect code. Please try again.' }, { status: 400 });
    }

    await admin.from('otp_tokens').update({ used: true }).eq('id', token.id);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Verification failed' },
      { status: 500 },
    );
  }
}
