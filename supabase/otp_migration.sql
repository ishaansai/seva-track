-- Seva Track · OTP Tokens Migration
-- Run in: Supabase Dashboard → SQL Editor → New Query

CREATE TABLE IF NOT EXISTS otp_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      TEXT NOT NULL,
  code       TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_tokens_phone ON otp_tokens(phone);

-- Only accessed via server-side admin client — no RLS needed
ALTER TABLE otp_tokens DISABLE ROW LEVEL SECURITY;

-- Auto-delete expired tokens after 1 hour to keep the table clean
-- (optional: requires pg_cron extension — skip if not available)
-- SELECT cron.schedule('delete-expired-otps', '0 * * * *',
--   'DELETE FROM otp_tokens WHERE expires_at < NOW() - interval ''1 hour''');
