import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

const APPROVERS = ['ndsw75', 'g8rla2'];

export async function GET(request: Request) {
  const coordId = new URL(request.url).searchParams.get('coordId');
  if (!coordId || !APPROVERS.includes(coordId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from('coordinators')
    .select('id,name,email,phone,approved')
    .eq('approved', false)
    .order('created_at', { ascending: true });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const { coordId, targetId, action } = await request.json() as {
    coordId: string; targetId: string; action: 'approve' | 'reject';
  };
  if (!coordId || !APPROVERS.includes(coordId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  const admin = createAdminClient();
  if (action === 'approve') {
    await admin.from('coordinators').update({ approved: true }).eq('id', targetId);
  } else {
    await admin.from('coordinators').delete().eq('id', targetId);
  }
  return NextResponse.json({ ok: true });
}
