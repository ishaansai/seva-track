import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

// POST { phone } → returns only signups belonging to that phone number.
// Does not expose any other phone numbers.
export async function POST(request: Request) {
  try {
    const { phone } = await request.json() as { phone: string };
    const cleaned = (phone ?? '').replace(/\D/g, '');
    if (cleaned.length < 7) return NextResponse.json({ signups: [] });

    const admin = createAdminClient();
    const { data } = await admin
      .from('signups')
      .select('id,event_id,member_name,member_phone,item_type,status,signed_up_at,delivered_at,confirmed_at,nutritional_slots')
      .eq('member_phone', cleaned);

    return NextResponse.json({ signups: data ?? [] });
  } catch {
    return NextResponse.json({ signups: [] });
  }
}
