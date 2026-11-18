-- Family Finance: add indexes for the four verified foreign-key columns.
--
-- Verified against the live Delyreachson public schema on 2026-11-18:
--   savings_goal_contributions.goal_id
--   savings_goal_contributions.source_transaction_id
--   savings_goal_contributions.expense_transaction_id
--   transactions.member_id
--
-- The existing schema had no indexes on these foreign-key columns.
-- These indexes support joins/lookups and avoid full scans when referenced
-- rows are updated or deleted. Existing primary-key and transaction indexes
-- are left unchanged.
--
-- This migration changes schema metadata only. It does not insert, update,
-- or delete family records. Review before applying it in Supabase.

create index if not exists idx_savings_goal_contributions_goal_id
  on public.savings_goal_contributions (goal_id);

create index if not exists idx_savings_goal_contributions_source_transaction_id
  on public.savings_goal_contributions (source_transaction_id);

create index if not exists idx_savings_goal_contributions_expense_transaction_id
  on public.savings_goal_contributions (expense_transaction_id);

create index if not exists idx_transactions_member_id
  on public.transactions (member_id);
