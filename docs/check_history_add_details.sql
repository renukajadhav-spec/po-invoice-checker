-- Adds the details column to check_history: each check's name and its reasons.
-- Run once in Supabase → SQL Editor → New query → paste → Run.
-- (A fresh setup with check_history.sql already has this column.)

alter table public.check_history add column if not exists details jsonb;
