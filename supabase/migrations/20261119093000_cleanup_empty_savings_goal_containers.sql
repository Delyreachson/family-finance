-- Family Finance: remove an internal savings container when its final
-- contribution is deleted. The browser reuses one container per title/currency.
-- Existing user-facing Savings Goals UI and contribution calculations are unchanged.

create or replace function public.delete_savings_goal_contribution(p_contribution_id uuid)
returns void
language plpgsql
set search_path to ''
as $function$
declare
  v_contribution public.savings_goal_contributions%rowtype;
  v_goal public.savings_goals%rowtype;
begin
  select * into v_contribution
    from public.savings_goal_contributions
   where id = p_contribution_id
   for update;

  if not found then
    raise exception 'Savings contribution not found or access denied.';
  end if;

  select * into v_goal
    from public.savings_goals
   where id = v_contribution.goal_id
   for update;

  if not found then
    raise exception 'Savings goal not found or access denied.';
  end if;

  if v_contribution.expense_transaction_id is not null then
    delete from public.transactions
     where id = v_contribution.expense_transaction_id
       and transaction_type = 'expense'
       and category = 'SAVINGS';
  end if;

  delete from public.savings_goal_contributions
   where id = p_contribution_id;

  update public.savings_goals
     set saved_amount = greatest(0, coalesce(saved_amount, 0) - v_contribution.amount)
   where id = v_goal.id;

  -- The maximum NUMERIC(14,2) target is an internal container, not a real goal.
  -- Remove it only after its final contribution has been deleted.
  delete from public.savings_goals
   where id = v_goal.id
     and target_amount = 999999999999.99
     and not exists (
       select 1
         from public.savings_goal_contributions
        where goal_id = v_goal.id
     );
end;
$function$;
