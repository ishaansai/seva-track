-- ─────────────────────────────────────────────────────────────
-- Seva Track  ·  Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────

-- 1. COORDINATORS
CREATE TABLE IF NOT EXISTS coordinators (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  password      TEXT NOT NULL,
  phone         TEXT NOT NULL DEFAULT '',
  address       TEXT NOT NULL DEFAULT '',
  -- Signup window: opens on this day-of-month each month (default 15 = 3rd week)
  signup_open_day   INT NOT NULL DEFAULT 15,
  -- Admin can override exact open/close dates for the current window
  signup_open_override  DATE,
  signup_close_override DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. EVENTS
CREATE TABLE IF NOT EXISTS events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coord_id          TEXT NOT NULL REFERENCES coordinators(id) ON DELETE CASCADE,
  date              DATE NOT NULL,
  meal_bag_slots    INT  NOT NULL DEFAULT 7,
  nutritional_slots INT  NOT NULL DEFAULT 3,
  drop_off_start    TIME NOT NULL DEFAULT '18:00',
  drop_off_end      TIME NOT NULL DEFAULT '21:00',
  drop_off_location TEXT NOT NULL DEFAULT '',
  note              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. SIGNUPS
CREATE TABLE IF NOT EXISTS signups (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  coord_id          TEXT NOT NULL REFERENCES coordinators(id) ON DELETE CASCADE,
  member_name       TEXT NOT NULL,
  member_phone      TEXT NOT NULL,
  item_type         TEXT NOT NULL CHECK (item_type IN ('meals', 'nutritional', 'both')),
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered')),
  delivery_photo_url TEXT,
  delivered_at      TIMESTAMPTZ,
  added_by_admin    BOOLEAN NOT NULL DEFAULT FALSE,
  signed_up_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One signup per member per event
  UNIQUE(event_id, member_phone)
);

-- 4. DISABLE ROW LEVEL SECURITY (simple demo — add RLS later for production hardening)
ALTER TABLE coordinators DISABLE ROW LEVEL SECURITY;
ALTER TABLE events       DISABLE ROW LEVEL SECURITY;
ALTER TABLE signups      DISABLE ROW LEVEL SECURITY;

-- 5. MEMBER CONTRIBUTIONS VIEW
-- Shows total meal bags and deliveries per member per coordinator
CREATE OR REPLACE VIEW member_contributions AS
SELECT
  coord_id,
  member_name,
  member_phone,
  COUNT(*)                                                          AS total_signups,
  COUNT(*) FILTER (WHERE status = 'delivered')                      AS total_delivered,
  COUNT(*) FILTER (WHERE status = 'delivered'
                     AND item_type IN ('meals', 'both'))            AS meal_bag_deliveries,
  COUNT(*) FILTER (WHERE status = 'delivered'
                     AND item_type IN ('meals', 'both')) * 25       AS total_meal_bags,
  COUNT(*) FILTER (WHERE status = 'delivered'
                     AND item_type IN ('nutritional', 'both'))      AS nutritional_deliveries,
  MIN(signed_up_at)                                                 AS first_signup,
  MAX(signed_up_at)                                                 AS last_signup
FROM signups
GROUP BY coord_id, member_name, member_phone
ORDER BY total_meal_bags DESC;

-- 6. SEED DEFAULT COORDINATOR (Anupama – Pleasanton)
INSERT INTO coordinators (id, name, password, phone, address)
VALUES (
  'seva2024',
  'Seva Commons – Pleasanton',
  'seva2024',
  '9258904273',
  '925 Roselma Pl, Pleasanton CA 94566'
) ON CONFLICT (id) DO NOTHING;

-- 7. STORAGE BUCKET for delivery photos
-- Run this separately in Supabase Dashboard → Storage → New Bucket
-- Name: delivery-photos, Public: true
-- OR run via SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES ('delivery-photos', 'delivery-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload/read from delivery-photos bucket
CREATE POLICY IF NOT EXISTS "Public read delivery photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'delivery-photos');

CREATE POLICY IF NOT EXISTS "Anyone can upload delivery photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'delivery-photos');
