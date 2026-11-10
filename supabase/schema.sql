-- Run this SQL in Supabase Dashboard > SQL Editor.
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income','expense')),
  title text not null,
  amount numeric(14,2) not null check (amount > 0),
  transaction_date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

alter table public.transactions enable row level security;

-- Family members must be invited/created in Supabase Authentication by the project owner.
-- Authenticated family accounts can view the shared family ledger.
drop policy if exists "Family members can view transactions" on public.transactions;
create policy "Family members can view transactions"
on public.transactions for select to authenticated using (true);

drop policy if exists "Family members can add transactions" on public.transactions;
create policy "Family members can add transactions"
on public.transactions for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Family members can delete transactions" on public.transactions;
create policy "Family members can delete transactions"
on public.transactions for delete to authenticated using (true);

-- Optional: allow updates to records created by the signed-in user.
drop policy if exists "Users can update own transactions" on public.transactions;
create policy "Users can update own transactions"
on public.transactions for update to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);
