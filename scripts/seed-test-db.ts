/**
 * Seed the TEST database with a coordinator account and sample events.
 * Run with: npm run seed:test
 *
 * Prerequisites:
 *   1. Create a new Supabase project at supabase.com (name it "seva-track-test")
 *   2. Run supabase/schema.sql, security.sql, adjustments.sql, members.sql,
 *      notify.sql, otp_migration.sql in its SQL editor (in that order)
 *   3. Fill in .env.local with the TEST project credentials
 *   4. Run this script: npm run seed:test
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TEST_EMAIL        = process.env.TEST_COORD_EMAIL    ?? 'test@sevatrack.test';
const TEST_PASSWORD     = process.env.TEST_COORD_PASSWORD ?? 'testpassword123';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌  Missing env vars. Make sure .env.local exists and has NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  console.log('🌱  Seeding test database…');
  console.log(`   URL: ${SUPABASE_URL}`);

  // 1. Create test coordinator auth user
  console.log('\n1. Creating test coordinator auth user…');
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  });

  let userId: string;
  if (authError?.message?.toLowerCase().includes('already')) {
    console.log('   ℹ️  Auth user already exists — fetching…');
    const { data: { users } } = await admin.auth.admin.listUsers();
    const existing = users.find(u => u.email === TEST_EMAIL);
    if (!existing) throw new Error('Could not find existing test user');
    userId = existing.id;
  } else if (authError) {
    throw new Error(`Auth user creation failed: ${authError.message}`);
  } else {
    userId = authData.user!.id;
    console.log(`   ✅  Created auth user: ${TEST_EMAIL}`);
  }

  // 2. Create coordinator profile
  console.log('\n2. Creating coordinator profile…');
  const coordId = 'test01';
  const { error: coordError } = await admin.from('coordinators').upsert({
    id:              coordId,
    name:            'Test Coordinator',
    email:           TEST_EMAIL,
    phone:           '5551234567',
    address:         '123 Test St, Pleasanton CA 94566',
    signup_open_day: 1,
    user_id:         userId,
    approved:        true,
  }, { onConflict: 'id' });

  if (coordError) throw new Error(`Coordinator upsert failed: ${coordError.message}`);
  console.log(`   ✅  Coordinator profile: id=${coordId}`);

  // 3. Create sample events (one past, two upcoming)
  console.log('\n3. Creating sample events…');
  const today = new Date();
  const dates = [
    // Past event (for testing history/stats)
    new Date(today.getFullYear(), today.getMonth() - 1, 15).toISOString().slice(0, 10),
    // Upcoming events (for testing signup flow)
    new Date(today.getFullYear(), today.getMonth() + 1,  8).toISOString().slice(0, 10),
    new Date(today.getFullYear(), today.getMonth() + 1, 22).toISOString().slice(0, 10),
  ];

  for (const date of dates) {
    const { error } = await admin.from('events').insert({
      coord_id:          coordId,
      date,
      meal_bag_slots:    7,
      nutritional_slots: 3,
      drop_off_start:    '18:00',
      drop_off_end:      '21:00',
      drop_off_location: '123 Test St, Pleasanton CA 94566',
      note:              'Test event — safe to delete',
    });
    if (error && !error.message.includes('duplicate')) {
      console.warn(`   ⚠️  Event ${date}: ${error.message}`);
    } else {
      console.log(`   ✅  Event: ${date}`);
    }
  }

  // 4. Create sample signups on the past event
  console.log('\n4. Creating sample signups on past event…');
  const { data: pastEvent } = await admin
    .from('events').select('id').eq('coord_id', coordId).eq('date', dates[0]).single();

  if (pastEvent) {
    const sampleSignups = [
      { member_name: 'Priya Sharma',   member_phone: '5550000001', item_type: 'meals',       status: 'confirmed' },
      { member_name: 'Raj Patel',      member_phone: '5550000002', item_type: 'nutritional', status: 'delivered' },
      { member_name: 'Anita Verma',    member_phone: '5550000003', item_type: 'both',         status: 'confirmed' },
      { member_name: 'Suresh Kumar',   member_phone: '5550000004', item_type: 'meals',       status: 'pending'   },
    ];
    for (const s of sampleSignups) {
      const { error } = await admin.from('signups').upsert({
        ...s, event_id: pastEvent.id, coord_id: coordId,
      }, { onConflict: 'event_id,member_phone' });
      if (error) console.warn(`   ⚠️  Signup ${s.member_name}: ${error.message}`);
      else console.log(`   ✅  Signup: ${s.member_name} (${s.item_type}, ${s.status})`);
    }
  }

  console.log('\n✅  Seed complete!');
  console.log(`\n   Login at http://localhost:3000/admin`);
  console.log(`   Email:    ${TEST_EMAIL}`);
  console.log(`   Password: ${TEST_PASSWORD}`);
  console.log('\n   Run tests: npm test');
}

run().catch(err => {
  console.error('\n❌  Seed failed:', err.message);
  process.exit(1);
});
