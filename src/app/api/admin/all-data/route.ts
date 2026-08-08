/**
 * GET /api/admin/all-data?cid=<coordId>
 * Returns ALL events + signups across every coordinator using the service-role
 * key (bypasses RLS). Restricted to the two approver coordinator IDs.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

const APPROVER_IDS = new Set(['ndsw75', 'g8rla2']);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cid = searchParams.get('cid') ?? '';

  if (!APPROVER_IDS.has(cid)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const admin = createAdminClient();

  const [{ data: events }, { data: signups }] = await Promise.all([
    admin.from('events').select('*').order('date', { ascending: true }),
    admin.from('signups').select('*').order('signed_up_at', { ascending: true }),
  ]);

  return NextResponse.json(
    { events: events ?? [], signups: signups ?? [] },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
