-- Members table: volunteers the coordinator wants to blast-notify when signups open
CREATE TABLE IF NOT EXISTS members (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  coord_id    TEXT NOT NULL REFERENCES coordinators(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Coordinators can only see/manage their own members
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coord_own_members" ON members
  USING (coord_id = current_setting('app.coord_id', true));
