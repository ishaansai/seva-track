import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

// POST { phone } → returns only signups belonging to that phone number.
// Does not expose any other phone numbers.
export async function POST(request: Request) {
  try {
    const { phone } = await request.json() as { phone: string };
    const cleaned = (phone ?? '').replace(/\D/g, '');
    if (cleaned.length < 7) return NextResponse.json({ signups: [], debug: 'phone too short' });

    // Try both 10-digit and 11-digit (with leading 1) to handle any storage variation
    const variants = new Set([cleaned]);
    if (cleaned.length === 10) variants.add('1' + cleaned);
    if (cleaned.length === 11 && cleaned.startsWith('1')) variants.add(cleaned.slice(1));

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('signups')
      .select('id,event_id,member_name,member_phone,item_type,status,signed_up_at,delivered_at,confirmed_at,nutritional_slots')
      .in('member_phone', [...variants]);

    return NextResponse.json({ signups: data ?? [], debug: error?.message ?? `found ${data?.length ?? 0}` });
  } catch (e) {
    return NextResponse.json({ signups: [], debug: String(e) });
  }
}
