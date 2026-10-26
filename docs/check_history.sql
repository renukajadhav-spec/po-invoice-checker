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
  failed_checks    text[] not null default '{}',
  details          jsonb,  -- each check's name and reasons: [{"name": "Items", "issues": ["..."]}]
  po_data          jsonb,  -- the PO as reviewed in step 2: { header, items }
  invoice_data     jsonb,  -- the invoice as reviewed in step 2: { header, items }
  rechecked_from   bigint references public.check_history (id),  -- the row this check re-checks
  approval          text check (approval in ('Approved', 'Rejected')),  -- empty = waiting
  approved_by       uuid references auth.users (id),
  approved_by_email text,
  approved_at       timestamptz,
  approval_note     text  -- reason, required for Rejected
);

-- Open the table to signed-in users only (new tables are not exposed automatically).
-- Rows can be read and added; only the 5 approval columns can be changed; nothing can be deleted.
grant select, insert on public.check_history to authenticated;
grant update (approval, approved_by, approved_by_email, approved_at, approval_note)
  on public.check_history to authenticated;

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

-- Signed-in users can approve or reject Ready checks, only as themselves; a Reject needs a reason
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

-- No delete rule: history cannot be removed from the app
