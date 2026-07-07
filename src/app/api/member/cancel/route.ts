import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

// POST { signupId } — cancels a pending signup on behalf of a member.
// Uses the admin client (service role) to bypass RLS, since members have no auth session.
// Only allows cancellation of 'pending' signups — cannot cancel already-delivered ones.
export async function POST(request: Request) {
  try {
    const { signupId } = await request.json() as { signupId: string };
    if (!signupId) return NextResponse.json({ error: 'signupId required' }, { status: 400 });

    const admin = createAdminClient();

    // Verify the signup exists and is still pending
    const { data: signup, error: fetchError } = await admin
      .from('signups')
      .select('id, status')
      .eq('id', signupId)
      .single();

    if (fetchError || !signup) {
      return NextResponse.json({ error: 'Signup not found' }, { status: 404 });
    }
    if (signup.status !== 'pending') {
      return NextResponse.json({ error: 'Cannot cancel a signup that has already been delivered' }, { status: 400 });
    }

    const { error: deleteError } = await admin.from('signups').delete().eq('id', signupId);
    if (deleteError) throw new Error(deleteError.message);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}
