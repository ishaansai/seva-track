import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { sendWhatsApp } from '@/lib/twilio';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

// POST body: { coordId: string, signupUrl: string, dates: string[] }
// Called by the admin dashboard immediately after creating new events.
export async function POST(request: Request) {
  try {
    // Verify caller is the authenticated coordinator for the given coordId
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { cookie: cookieHeader } } },
    );
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { coordId, signupUrl, dates } = await request.json() as {
      coordId: string; signupUrl: string; dates: string[];
    };
    if (!coordId || !signupUrl || !dates?.length) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Confirm the logged-in user owns the coordId they're blasting for
    const { data: coord } = await admin
      .from('coordinators')
      .select('id')
      .eq('id', coordId)
      .eq('user_id', user.id)
      .single();
    if (!coord) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data: members } = await admin
      .from('members')
      .select('name, phone')
      .eq('coord_id', coordId);

    if (!members?.length) {
      return NextResponse.json({ sent: 0, message: 'No members to notify' });
    }

    const dateList = dates
      .map(d => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' }))
      .join(', ');

    const results: string[] = [];
    for (const m of members) {
      if (!m.phone) continue;
      try {
        await sendWhatsApp(
          m.phone,
          `Hi ${m.name}! 🫶 New Seva Commons delivery dates are open for sign-up:\n\n📅 ${dateList}\n\nSign up here: ${signupUrl}\n\nThank you for volunteering! 🙏`,
        );
        results.push(`notified ${m.name}`);
      } catch (e) {
        results.push(`FAILED ${m.name}: ${e}`);
      }
    }

    return NextResponse.json({ sent: results.length, results });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
