-- Seva Track - Manual Adjustments Migration
-- Run this in: Supabase Dashboard -> SQL Editor -> New Query
-- Run AFTER schema.sql and security.sql.

-- 1. MEMBER ADJUSTMENTS TABLE
-- Stores manual overrides to a member's contribution totals.
-- One row per member per coordinator. Positive or negative values.
CREATE TABLE IF NOT EXISTS member_adjustments (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coord_id               TEXT NOT NULL REFERENCES coordinators(id) ON DELETE CASCADE,
  member_phone           TEXT NOT NULL,
  member_name            TEXT NOT NULL,
  meal_bag_adjustment    INT  NOT NULL DEFAULT 0,
  nutritional_adjustment INT  NOT NULL DEFAULT 0,
  note                   TEXT,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(coord_id, member_phone)
);

-- 2. RLS: only the coordinator can read/write their own adjustments
ALTER TABLE member_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coordinator manage own adjustments"
  ON member_adjustments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM coordinators
      WHERE coordinators.id      = member_adjustments.coord_id
        AND coordinators.user_id = auth.uid()
    )
  );

-- 3. UPDATED MEMBER CONTRIBUTIONS VIEW
-- Adds manual adjustments on top of the auto-calculated totals.
CREATE OR REPLACE VIEW member_contributions AS
SELECT
  s.coord_id,
  s.member_name,
  s.member_phone,
  COUNT(*)                                                                    AS total_signups,
  COUNT(*) FILTER (WHERE s.status IN ('delivered', 'confirmed'))              AS total_delivered,
  COUNT(*) FILTER (WHERE s.status IN ('delivered', 'confirmed')
                   AND s.item_type IN ('meals', 'both'))                      AS meal_bag_deliveries,
  (COUNT(*) FILTER (WHERE s.status IN ('delivered', 'confirmed')
                   AND s.item_type IN ('meals', 'both')) * 20
    + COALESCE(ma.meal_bag_adjustment, 0))                                    AS total_meal_bags,
  (COUNT(*) FILTER (WHERE s.status IN ('delivered', 'confirmed')
                   AND s.item_type IN ('nutritional', 'both'))
    + COALESCE(ma.nutritional_adjustment, 0))                                 AS nutritional_deliveries,
  COALESCE(ma.meal_bag_adjustment, 0)                                         AS meal_bag_adjustment,
  COALESCE(ma.nutritional_adjustment, 0)                                      AS nutritional_adjustment,
  COALESCE(ma.note, '')                                                       AS adjustment_note,
  MIN(s.signed_up_at)                                                         AS first_signup,
  MAX(s.signed_up_at)                                                         AS last_signup
FROM signups s
LEFT JOIN member_adjustments ma
  ON ma.coord_id    = s.coord_id
 AND ma.member_phone = s.member_phone
GROUP BY
  s.coord_id, s.member_name, s.member_phone,
  ma.meal_bag_adjustment, ma.nutritional_adjustment, ma.note
ORDER BY total_meal_bags DESC;
