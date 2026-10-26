-- Adds approval to check_history: any signed-in user can approve or reject a Ready check.
-- Run once in Supabase → SQL Editor → New query → paste → Run.
-- (A fresh setup with check_history.sql already has all of this.)

alter table public.check_history
  add column if not exists approval          text check (approval in ('Approved', 'Rejected')),  -- empty = waiting
  add column if not exists approved_by       uuid references auth.users (id),
  add column if not exists approved_by_email text,
  add column if not exists approved_at       timestamptz,
  add column if not exists approval_note     text;  -- reason, required for Rejected

-- Signed-in users may change ONLY these 5 columns; everything else in a row stays locked
grant update (approval, approved_by, approved_by_email, approved_at, approval_note)
  on public.check_history to authenticated;

-- Only Ready checks, only as yourself, and a Reject must have a reason
create policy "Signed-in users decide on Ready checks"
  on public.check_history for update
  to authenticated
  using (verdict = 'Ready for manager approval')
  with check (
    verdict = 'Ready for manager approval'
    and approved_by = auth.uid()
    and (approval = 'Approved'
         or (approval = 'Rejected' and length(trim(coalesce(approval_note, ''))) > 0))
  );
