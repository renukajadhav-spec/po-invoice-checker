-- Check history: one row each time someone clicks Check.
-- Run once in Supabase → SQL Editor → New query → paste → Run.

create table public.check_history (
  id               bigint generated always as identity primary key,
  checked_at       timestamptz not null default now(),
  checked_by       uuid not null default auth.uid() references auth.users (id),
  checked_by_email text not null,
  po_no            text not null,
  invoice_no       text not null,
  invoice_date     date not null,
  vendor_name      text not null,
  passed           int  not null,
  total            int  not null,
  verdict          text not null,
  failed_checks    text[] not null default '{}'
);

-- Open the table to signed-in users only (new tables are not exposed automatically).
-- No update or delete is granted.
grant select, insert on public.check_history to authenticated;

-- Row Level Security: only the rules below are allowed
alter table public.check_history enable row level security;

-- Every signed-in user can see all history
create policy "Signed-in users read all history"
  on public.check_history for select
  to authenticated
  using (true);

-- Signed-in users can add rows, only as themselves
create policy "Signed-in users add their own checks"
  on public.check_history for insert
  to authenticated
  with check (checked_by = auth.uid());

-- No update or delete rule: history cannot be changed or removed from the app
