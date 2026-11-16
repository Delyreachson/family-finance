-- Keep savings contribution history actions atomic with their linked expense and goal totals.
create or replace function public.update_savings_goal_contribution(
  p_contribution_id uuid,
  p_amount numeric,
  p_contribution_date date,
  p_note text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_contribution public.savings_goal_contributions%rowtype;
  v_goal public.savings_goals%rowtype;
  v_income_amount numeric;
  v_allocated numeric;
  v_note text := nullif(trim(p_note), '');
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Contribution amount must be greater than zero.';
  end if;

  select * into v_contribution
    from public.savings_goal_contributions
   where id = p_contribution_id
   for update;
  if not found then raise exception 'Savings contribution not found or access denied.'; end if;

  select * into v_goal
    from public.savings_goals
   where id = v_contribution.goal_id
   for update;
  if not found then raise exception 'Savings goal not found or access denied.'; end if;

  if coalesce(v_goal.saved_amount, 0) - v_contribution.amount + p_amount > v_goal.target_amount then
    raise exception 'Contribution exceeds the remaining savings goal amount.';
  end if;

  if v_contribution.source_type = 'income' then
    select amount into v_income_amount
      from public.transactions
     where id = v_contribution.source_transaction_id
       and transaction_type = 'income'
     for update;
    if not found then raise exception 'The linked income transaction is unavailable.'; end if;
    select coalesce(sum(amount), 0) into v_allocated
      from public.savings_goal_contributions
     where source_transaction_id = v_contribution.source_transaction_id
       and id <> p_contribution_id;
    if v_allocated + p_amount > v_income_amount then
      raise exception 'The allocation is greater than the remaining amount of this income transaction.';
    end if;
  end if;

  if v_contribution.expense_transaction_id is not null then
    update public.transactions
       set amount = p_amount,
           transaction_date = coalesce(p_contribution_date, current_date),
           description = coalesce(v_note, 'សន្សំ៖ ' || v_goal.title)
     where id = v_contribution.expense_transaction_id
       and transaction_type = 'expense'
       and category = 'SAVINGS';
    if not found then raise exception 'The linked savings expense transaction could not be updated.'; end if;
  end if;

  update public.savings_goal_contributions
     set amount = p_amount,
         contribution_date = coalesce(p_contribution_date, current_date),
         note = v_note
   where id = p_contribution_id;

  update public.savings_goals
     set saved_amount = greatest(0, coalesce(saved_amount, 0) - v_contribution.amount + p_amount)
   where id = v_goal.id;
end;
$$;

create or replace function public.delete_savings_goal_contribution(p_contribution_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_contribution public.savings_goal_contributions%rowtype;
  v_goal public.savings_goals%rowtype;
begin
  select * into v_contribution
    from public.savings_goal_contributions
   where id = p_contribution_id
   for update;
  if not found then raise exception 'Savings contribution not found or access denied.'; end if;

  select * into v_goal
    from public.savings_goals
   where id = v_contribution.goal_id
   for update;
  if not found then raise exception 'Savings goal not found or access denied.'; end if;

  if v_contribution.expense_transaction_id is not null then
    delete from public.transactions
     where id = v_contribution.expense_transaction_id
       and transaction_type = 'expense'
       and category = 'SAVINGS';
  end if;

  delete from public.savings_goal_contributions where id = p_contribution_id;
  update public.savings_goals
     set saved_amount = greatest(0, coalesce(saved_amount, 0) - v_contribution.amount)
   where id = v_goal.id;
end;
$$;

revoke all on function public.update_savings_goal_contribution(uuid, numeric, date, text) from public, anon;
revoke all on function public.delete_savings_goal_contribution(uuid) from public, anon;
grant execute on function public.update_savings_goal_contribution(uuid, numeric, date, text) to authenticated;
grant execute on function public.delete_savings_goal_contribution(uuid) to authenticated;
