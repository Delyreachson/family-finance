-- Family Finance: contribution history and safe income allocation for Savings Goals.
-- Apply this migration in the Delyreachson Supabase SQL Editor after merging the feature PR.

create table if not exists public.savings_goal_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.savings_goals(id) on delete cascade,
  amount numeric not null check (amount > 0),
  currency text not null check (currency in ('KHR', 'USD')),
  source_type text not null check (source_type in ('manual', 'income')),
  source_transaction_id uuid references public.transactions(id),
  contribution_date date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  constraint savings_goal_contributions_source_check
    check (
      (source_type = 'manual' and source_transaction_id is null)
      or (source_type = 'income' and source_transaction_id is not null)
    )
);

alter table public.savings_goal_contributions enable row level security;

drop policy if exists "Family owner only" on public.savings_goal_contributions;
create policy "Family owner only"
on public.savings_goal_contributions
for all
to authenticated
using ((select auth.uid()) = '4362d855-55f8-4ad8-b23a-7029f4579d97'::uuid)
with check ((select auth.uid()) = '4362d855-55f8-4ad8-b23a-7029f4579d97'::uuid);

-- New public tables are not automatically exposed to the Data API on current projects.
grant select, insert, update, delete on public.savings_goal_contributions to authenticated;

create or replace function public.add_savings_goal_contribution(
  p_goal_id uuid,
  p_amount numeric,
  p_source_type text,
  p_contribution_date date default current_date,
  p_source_transaction_id uuid default null,
  p_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_goal public.savings_goals%rowtype;
  v_income_amount numeric;
  v_income_type text;
  v_income_currency text;
  v_already_allocated numeric;
  v_contribution_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Contribution amount must be greater than zero.';
  end if;

  select * into v_goal
    from public.savings_goals
   where id = p_goal_id
   for update;

  if not found then
    raise exception 'Savings goal not found or access denied.';
  end if;

  if p_amount + coalesce(v_goal.saved_amount, 0) > v_goal.target_amount then
    raise exception 'Contribution exceeds the remaining savings goal amount.';
  end if;

  if p_source_type = 'income' then
    if p_source_transaction_id is null then
      raise exception 'Choose an income transaction.';
    end if;
    select amount, transaction_type, currency
      into v_income_amount, v_income_type, v_income_currency
      from public.transactions
     where id = p_source_transaction_id
     for update;
    if not found or v_income_type <> 'income' then
      raise exception 'The selected transaction is not an accessible income transaction.';
    end if;
    if v_income_currency <> v_goal.currency then
      raise exception 'Income and savings goal currencies must match.';
    end if;
    select coalesce(sum(amount), 0) into v_already_allocated
      from public.savings_goal_contributions
     where source_transaction_id = p_source_transaction_id;
    if v_already_allocated + p_amount > v_income_amount then
      raise exception 'The allocation is greater than the remaining amount of this income transaction.';
    end if;
  elsif p_source_type = 'manual' then
    if p_source_transaction_id is not null then
      raise exception 'Manual contributions cannot reference an income transaction.';
    end if;
  else
    raise exception 'Unsupported contribution source.';
  end if;

  insert into public.savings_goal_contributions (
    goal_id, amount, currency, source_type, source_transaction_id, contribution_date, note
  ) values (
    p_goal_id, p_amount, v_goal.currency, p_source_type, p_source_transaction_id,
    coalesce(p_contribution_date, current_date), nullif(trim(p_note), '')
  ) returning id into v_contribution_id;

  update public.savings_goals
     set saved_amount = coalesce(saved_amount, 0) + p_amount
   where id = p_goal_id;

  return v_contribution_id;
end;
$$;

revoke all on function public.add_savings_goal_contribution(uuid, numeric, text, date, uuid, text) from public;
revoke all on function public.add_savings_goal_contribution(uuid, numeric, text, date, uuid, text) from anon;
grant execute on function public.add_savings_goal_contribution(uuid, numeric, text, date, uuid, text) to authenticated;
