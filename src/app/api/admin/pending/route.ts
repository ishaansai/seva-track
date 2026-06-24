import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';


async function getApproverCoordId(): Promise<string | null> {
  // Verify the caller has a valid Supabase session and is an approver
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const cookieHeader = allCookies.map(c => `${c.name}=${c.value}`).join('; ');

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { cookie: cookieHeader } },
    },
  );

  const { data: { user } } = await anonClient.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from('coordinators')
    .select('id')
    .eq('user_id', user.id)
    .in('id', ['ndsw75', 'g8rla2'])
    .single();

  return data?.id ?? null;
}

export async function GET() {
  const coordId = await getApproverCoordId();
  if (!coordId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const admin = createAdminClient();
  const { data } = await admin
    .from('coordinators')
    .select('id,name,email,phone,approved')
    .eq('approved', false)
    .order('created_at', { ascending: true });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const coordId = await getApproverCoordId();
  if (!coordId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { targetId, action } = await request.json() as {
    targetId: string; action: 'approve' | 'reject';
  };

  const admin = createAdminClient();
  if (action === 'approve') {
    await admin.from('coordinators').update({ approved: true }).eq('id', targetId);
  } else {
    await admin.from('coordinators').delete().eq('id', targetId);
  }
  return NextResponse.json({ ok: true });
}
