import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

const DEFAULT_ADDRESS = '925 Roselma Pl, Pleasanton CA 94566';

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, phone, address } = await req.json();

    if (!name?.trim())        return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
    if (!email?.trim())       return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    if (!password || password.length < 6)
                              return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });

    const admin = createAdminClient();

    // 1. Create the Supabase Auth user (server-side, service role key)
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      const msg = authError?.message ?? 'Failed to create user';
      if (msg.toLowerCase().includes('already')) {
        return NextResponse.json({ error: 'An account with that email already exists.' }, { status: 409 });
      }
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const userId  = authData.user.id;
    const coordId = crypto.randomUUID().replace(/-/g, '').slice(0, 8);

    // 2. Insert the coordinator row linked to the auth user
    const { error: dbError } = await admin
      .from('coordinators')
      .insert({
        id:              coordId,
        name:            name.trim(),
        email:           email.trim().toLowerCase(),
        phone:           (phone ?? '').replace(/\D/g, ''),
        address:         address?.trim() || DEFAULT_ADDRESS,
        signup_open_day: 15,
        user_id:         userId,
        approved:        false,
      });

    if (dbError) {
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ coordId, pending: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
