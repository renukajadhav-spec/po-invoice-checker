-- Adds what Re-check needs to check_history:
--   po_data, invoice_data: the PO and invoice as reviewed in step 2 (header details + item lines)
--   rechecked_from: the id of the history row this check re-checks (empty for a normal check)
-- Run once in Supabase → SQL Editor → New query → paste → Run.
-- (A fresh setup with check_history.sql already has these columns.)

alter table public.check_history
  add column if not exists po_data        jsonb,
  add column if not exists invoice_data   jsonb,
  add column if not exists rechecked_from bigint references public.check_history (id);
