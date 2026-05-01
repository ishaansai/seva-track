-- notify.sql
-- Adds the notify_on_signup preference column to coordinators.
-- Run this once in the Supabase SQL editor.

ALTER TABLE coordinators
  ADD COLUMN IF NOT EXISTS notify_on_signup BOOLEAN NOT NULL DEFAULT false;
