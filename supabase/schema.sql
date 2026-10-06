create extension if not exists pgcrypto;

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  target_date date,
  is_long_term boolean not null default false,
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  title text not null,
  notes text,
  is_important boolean not null default false,
  deadline timestamptz,
  urgent_before_days integer not null default 7 check (urgent_before_days >= 0),
  is_long_term boolean not null default false,
  urgency_override text not null default 'auto' check (urgency_override in ('auto','urgent','later')),
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists goals_user_id_idx on public.goals(user_id);
create index if not exists tasks_user_id_idx on public.tasks(user_id);
create index if not exists tasks_goal_id_idx on public.tasks(goal_id);

alter table public.goals enable row level security;
alter table public.tasks enable row level security;

revoke all on table public.goals from anon, authenticated;
revoke all on table public.tasks from anon, authenticated;
grant select, insert, update, delete on table public.goals to authenticated;
grant select, insert, update, delete on table public.tasks to authenticated;

drop policy if exists "goals_select_own" on public.goals;
drop policy if exists "goals_insert_own" on public.goals;
drop policy if exists "goals_update_own" on public.goals;
drop policy if exists "goals_delete_own" on public.goals;
drop policy if exists "tasks_select_own" on public.tasks;
drop policy if exists "tasks_insert_own" on public.tasks;
drop policy if exists "tasks_update_own" on public.tasks;
drop policy if exists "tasks_delete_own" on public.tasks;

create policy "goals_select_own" on public.goals
for select to authenticated using ((select auth.uid()) = user_id);

create policy "goals_insert_own" on public.goals
for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "goals_update_own" on public.goals
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "goals_delete_own" on public.goals
for delete to authenticated using ((select auth.uid()) = user_id);

create policy "tasks_select_own" on public.tasks
for select to authenticated using ((select auth.uid()) = user_id);

create policy "tasks_insert_own" on public.tasks
for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "tasks_update_own" on public.tasks
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "tasks_delete_own" on public.tasks
for delete to authenticated using ((select auth.uid()) = user_id);
