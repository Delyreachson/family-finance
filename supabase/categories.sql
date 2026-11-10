-- Family Finance: shared income/expense categories
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  transaction_type text not null check (transaction_type in ('income','expense')),
  name text not null check (length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (transaction_type, name)
);
alter table public.categories enable row level security;
drop policy if exists "Authenticated users can view categories" on public.categories;
create policy "Authenticated users can view categories" on public.categories for select to authenticated using (true);
drop policy if exists "Authenticated users can add categories" on public.categories;
create policy "Authenticated users can add categories" on public.categories for insert to authenticated with check (true);
drop policy if exists "Authenticated users can update categories" on public.categories;
create policy "Authenticated users can update categories" on public.categories for update to authenticated using (true) with check (true);
drop policy if exists "Authenticated users can delete categories" on public.categories;
create policy "Authenticated users can delete categories" on public.categories for delete to authenticated using (true);
insert into public.categories (transaction_type,name) values
('income','ប្រាក់ខែ'),('income','អាជីវកម្ម'),('income','ប្រាក់រង្វាន់'),('income','ចំណូលបន្ថែម'),('income','ការវិនិយោគ'),('income','ផ្សេងៗ'),
('expense','ម្ហូបអាហារ'),('expense','សាំង/ប្រេង'),('expense','ទឹកភ្លើង'),('expense','ការសិក្សា'),('expense','សុខភាព'),('expense','ទិញសម្ភារៈ'),('expense','ធ្វើដំណើរ'),('expense','ផ្សេងៗ')
on conflict (transaction_type,name) do nothing;
do $$ begin
  alter publication supabase_realtime add table public.categories;
exception when duplicate_object then null;
end $$;
