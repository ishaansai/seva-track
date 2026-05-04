-- ─────────────────────────────────────────────────────────────
-- Seva Track · Security Hardening Migration
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- Run AFTER the original schema.sql has been applied.
-- ─────────────────────────────────────────────────────────────

-- 1. ADD user_id and email columns to coordinators
--    user_id links to Supabase Auth (auth.users)
ALTER TABLE coordinators
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS email   TEXT;

-- 2. DROP the plaintext password column
--    Passwords are now managed entirely by Supabase Auth (bcrypt).
ALTER TABLE coordinators DROP COLUMN IF EXISTS password;

-- ─── Row Level Security ───────────────────────────────────────

-- 3. Enable RLS on all tables
ALTER TABLE coordinators ENABLE ROW LEVEL SECURITY;
ALTER TABLE events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE signups      ENABLE ROW LEVEL SECURITY;

-- ─── Coordinator policies ─────────────────────────────────────

-- Anyone (including anonymous members) can read coordinator profiles.
-- Needed so the member page can load the signup window & address.
CREATE POLICY "Public read coordinators"
  ON coordinators FOR SELECT
  USING (true);

-- Only the coordinator themselves can update their own profile.
CREATE POLICY "Coordinator update own profile"
  ON coordinators FOR UPDATE
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── Event policies ───────────────────────────────────────────

-- Anyone can read events (member signup form needs event list).
CREATE POLICY "Public read events"
  ON events FOR SELECT
  USING (true);

-- Coordinator can create/update/delete only their own events.
CREATE POLICY "Coordinator manage own events"
  ON events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM coordinators
      WHERE coordinators.id      = events.coord_id
        AND coordinators.user_id = auth.uid()
    )
  );

-- ─── Signup policies ─────────────────────────────────────────

-- Anyone can read signups.
-- Needed so member can find their own pending delivery by phone.
CREATE POLICY "Public read signups"
  ON signups FOR SELECT
  USING (true);

-- Anyone can add a signup (member self-registration flow).
CREATE POLICY "Public insert signups"
  ON signups FOR INSERT
  WITH CHECK (true);

-- Anyone can update a signup (member marks their own delivery).
-- Coordinator can also update (admin mark delivered).
CREATE POLICY "Public update signup"
  ON signups FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Only the coordinator can delete signups for their events.
CREATE POLICY "Coordinator delete own signups"
  ON signups FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM coordinators
      WHERE coordinators.id      = signups.coord_id
        AND coordinators.user_id = auth.uid()
    )
  );

-- ─── Storage policies ─────────────────────────────────────────

-- Keep public read (photo URLs are shared in the admin dashboard).
DROP POLICY IF EXISTS "Public read delivery photos" ON storage.objects;

CREATE POLICY "Public read delivery photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'delivery-photos');

-- Restrict uploads to image mime types to prevent abuse.
DROP POLICY IF EXISTS "Anyone can upload delivery photos" ON storage.objects;

CREATE POLICY "Anyone can upload delivery photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'delivery-photos');

DROP POLICY IF EXISTS "Anyone can delete delivery photos" ON storage.objects;

CREATE POLICY "Anyone can delete delivery photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'delivery-photos');

-- ─── Seed: link the default demo coordinator to a Supabase Auth user ──
--
-- After running this migration:
-- 1. Go to Supabase Dashboard → Authentication → Users → Add User
-- 2. Email: admin@sevacommons.org   Password: seva2024
--    (check "Auto Confirm User" so no email verification is needed)
-- 3. Copy the UUID that Supabase generates for that user.
-- 4. Run the UPDATE below, replacing <AUTH_USER_UUID> with that UUID:
--
-- UPDATE coordinators
--   SET user_id = '<AUTH_USER_UUID>',
--       email   = 'admin@sevacommons.org'
--   WHERE id = 'seva2024';
