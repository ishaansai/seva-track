import { createClient } from '@supabase/supabase-js';

// Fallback to placeholder values during `next build` server-side module
// evaluation — createClient is safe to call with a fake URL; no network
// requests happen until you actually run a query at runtime.
const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL     || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

// Browser / client-side Supabase client.
// Uses the anon key — all requests respect Row Level Security.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side admin client.
// Uses the service role key — bypasses RLS. Only call from API routes.
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local.');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
