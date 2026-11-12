-- IVAN OS 1.0 — initial schema
-- Every personal table carries user_id (FK to auth.users) and is protected by RLS.
-- Child tables use composite foreign keys (id, user_id) so a row can never
-- reference a parent that belongs to a different user.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '' check (char_length(full_name) <= 120),
  currency    text not null default 'COP' check (currency ~ '^[A-Z]{3}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Work & Schedule
-- ---------------------------------------------------------------------------
create table public.shift_templates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  kind        text not null check (kind in ('day', 'night', 'custom')),
  start_time  time not null,
  end_time    time not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id),
  check (start_time <> end_time)
);

create table public.shift_rotations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  -- Ordered cycle: [{ "kind": "day|night|custom|rest", "start_time": "06:00", "end_time": "14:00" }, ...]
  pattern     jsonb not null check (jsonb_typeof(pattern) = 'array' and jsonb_array_length(pattern) between 1 and 60),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id)
);

-- A shift is stored as a local calendar date plus wall-clock times.
-- When end_time <= start_time the shift ends on the following day (overnight).
create table public.work_shifts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  shift_date  date not null,
  kind        text not null check (kind in ('day', 'night', 'custom', 'rest')),
  start_time  time,
  end_time    time,
  label       text not null default '' check (char_length(label) <= 60),
  notes       text not null default '' check (char_length(notes) <= 1000),
  rotation_id uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id),
  foreign key (rotation_id, user_id) references public.shift_rotations (id, user_id) on delete set null (rotation_id),
  constraint work_shifts_times_check check (
    (kind = 'rest' and start_time is null and end_time is null)
    or (kind <> 'rest' and start_time is not null and end_time is not null and start_time <> end_time)
  )
);
create index work_shifts_user_date_idx on public.work_shifts (user_id, shift_date);
-- Only one rest-day marker per date.
create unique index work_shifts_one_rest_per_day on public.work_shifts (user_id, shift_date) where kind = 'rest';

-- ---------------------------------------------------------------------------
-- Projects (shared by Academic Center and Skill Development)
-- ---------------------------------------------------------------------------
create table public.projects (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 120),
  description   text not null default '' check (char_length(description) <= 2000),
  area          text not null check (area in ('academic', 'personal')),
  status        text not null default 'active' check (status in ('planned', 'active', 'paused', 'completed')),
  technologies  text[] not null default '{}',
  repo_url      text not null default '' check (repo_url = '' or repo_url ~* '^https?://'),
  due_date      date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, user_id)
);
create index projects_user_area_idx on public.projects (user_id, area);

-- ---------------------------------------------------------------------------
-- Academic Center
-- ---------------------------------------------------------------------------
create table public.academic_tasks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id    uuid,
  title         text not null check (char_length(title) between 1 and 160),
  description   text not null default '' check (char_length(description) <= 4000),
  course        text not null default '' check (char_length(course) <= 120),
  due_date      date not null,
  priority      text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  status        text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  foreign key (project_id, user_id) references public.projects (id, user_id) on delete set null (project_id),
  check ((status = 'completed') = (completed_at is not null))
);
create index academic_tasks_user_due_idx on public.academic_tasks (user_id, due_date);
create index academic_tasks_project_idx on public.academic_tasks (project_id);

-- ---------------------------------------------------------------------------
-- Skill Development
-- ---------------------------------------------------------------------------
create table public.skills (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 80),
  category       text not null check (category in ('programming', 'databases', 'architecture', 'web', 'devops', 'other')),
  current_level  smallint not null default 0 check (current_level between 0 and 10),
  target_level   smallint not null default 10 check (target_level between 1 and 10),
  notes          text not null default '' check (char_length(notes) <= 2000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (id, user_id)
);
create unique index skills_user_name_idx on public.skills (user_id, lower(name));

-- History of level changes, written by trigger; powers the evolution chart.
create table public.skill_level_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  skill_id   uuid not null,
  level      smallint not null check (level between 0 and 10),
  logged_at  timestamptz not null default now(),
  foreign key (skill_id, user_id) references public.skills (id, user_id) on delete cascade
);
create index skill_level_logs_skill_idx on public.skill_level_logs (skill_id, logged_at);

create or replace function public.log_skill_level()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.current_level is distinct from old.current_level then
    insert into public.skill_level_logs (user_id, skill_id, level)
    values (new.user_id, new.id, new.current_level);
  end if;
  return new;
end;
$$;

create trigger skills_log_level
  after insert or update of current_level on public.skills
  for each row execute function public.log_skill_level();

create table public.practice_sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  skill_id          uuid,
  project_id        uuid,
  session_date      date not null default current_date,
  duration_minutes  integer not null check (duration_minutes between 1 and 1440),
  kind              text not null default 'coding' check (kind in ('coding', 'study', 'course', 'reading', 'other')),
  notes             text not null default '' check (char_length(notes) <= 2000),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  foreign key (skill_id, user_id) references public.skills (id, user_id) on delete set null (skill_id),
  foreign key (project_id, user_id) references public.projects (id, user_id) on delete set null (project_id)
);
create index practice_sessions_user_date_idx on public.practice_sessions (user_id, session_date);
create index practice_sessions_skill_idx on public.practice_sessions (skill_id);
create index practice_sessions_project_idx on public.practice_sessions (project_id);

create table public.technologies (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 80),
  category     text not null check (category in ('programming', 'databases', 'architecture', 'web', 'devops', 'other')),
  proficiency  text not null default 'learning' check (proficiency in ('learning', 'comfortable', 'proficient')),
  learned_on   date,
  notes        text not null default '' check (char_length(notes) <= 2000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index technologies_user_name_idx on public.technologies (user_id, lower(name));

-- ---------------------------------------------------------------------------
-- Language Lab
-- ---------------------------------------------------------------------------
create table public.languages (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 60),
  current_level  text not null check (current_level in ('A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  target_level   text not null check (target_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  notes          text not null default '' check (char_length(notes) <= 2000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (id, user_id)
);
create unique index languages_user_name_idx on public.languages (user_id, lower(name));

create table public.language_sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  language_id       uuid not null,
  skill             text not null check (skill in ('listening', 'speaking', 'reading', 'writing')),
  session_date      date not null default current_date,
  duration_minutes  integer not null check (duration_minutes between 1 and 1440),
  notes             text not null default '' check (char_length(notes) <= 2000),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  foreign key (language_id, user_id) references public.languages (id, user_id) on delete cascade
);
create index language_sessions_user_date_idx on public.language_sessions (user_id, session_date);
create index language_sessions_language_idx on public.language_sessions (language_id);

-- ---------------------------------------------------------------------------
-- Financial Control
-- ---------------------------------------------------------------------------
create table public.debts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  creditor    text not null default '' check (char_length(creditor) <= 120),
  principal   numeric(14, 2) not null check (principal > 0),
  due_date    date,
  notes       text not null default '' check (char_length(notes) <= 2000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id)
);
create index debts_user_idx on public.debts (user_id);

create table public.savings_goals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 120),
  target_amount  numeric(14, 2) not null check (target_amount > 0),
  target_date    date,
  notes          text not null default '' check (char_length(notes) <= 2000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (id, user_id)
);
create index savings_goals_user_idx on public.savings_goals (user_id);

create table public.savings_contributions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id         uuid not null,
  amount          numeric(14, 2) not null check (amount > 0),
  contributed_on  date not null default current_date,
  notes           text not null default '' check (char_length(notes) <= 500),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (goal_id, user_id) references public.savings_goals (id, user_id) on delete cascade
);
create index savings_contributions_goal_idx on public.savings_contributions (goal_id);

-- A debt payment is an expense transaction with debt_id set: one source of
-- truth for both the monthly balance and the remaining debt.
create table public.financial_transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type         text not null check (type in ('income', 'expense')),
  amount       numeric(14, 2) not null check (amount > 0),
  category     text not null check (char_length(category) between 1 and 60),
  description  text not null default '' check (char_length(description) <= 500),
  occurred_on  date not null default current_date,
  debt_id      uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Deleting a debt keeps its payments as plain expenses so past balances do not change.
  foreign key (debt_id, user_id) references public.debts (id, user_id) on delete set null (debt_id),
  check (debt_id is null or type = 'expense')
);
create index financial_transactions_user_date_idx on public.financial_transactions (user_id, occurred_on);
create index financial_transactions_debt_idx on public.financial_transactions (debt_id) where debt_id is not null;

-- Payments can never exceed the debt principal, and the principal can never be
-- lowered below what has already been paid.
create or replace function public.check_debt_payment()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_principal numeric(14, 2);
  v_paid numeric(14, 2);
begin
  if new.debt_id is null then
    return new;
  end if;
  select principal into v_principal from public.debts where id = new.debt_id for update;
  select coalesce(sum(amount), 0) into v_paid
    from public.financial_transactions
    where debt_id = new.debt_id and id <> new.id;
  if v_paid + new.amount > v_principal then
    raise exception 'El pago supera el saldo pendiente de la deuda (pendiente: %)', v_principal - v_paid
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger financial_transactions_check_debt
  before insert or update of amount, debt_id on public.financial_transactions
  for each row execute function public.check_debt_payment();

create or replace function public.check_debt_principal()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_paid numeric(14, 2);
begin
  select coalesce(sum(amount), 0) into v_paid
    from public.financial_transactions where debt_id = new.id;
  if new.principal < v_paid then
    raise exception 'El monto de la deuda no puede ser menor que lo ya pagado (%)', v_paid
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger debts_check_principal
  before update of principal on public.debts
  for each row execute function public.check_debt_principal();

-- Derived balances. security_invoker makes the views obey the caller's RLS.
create view public.debt_balances with (security_invoker = true) as
select
  d.id,
  d.user_id,
  d.name,
  d.creditor,
  d.principal,
  d.due_date,
  d.notes,
  d.created_at,
  coalesce(sum(t.amount), 0)::numeric(14, 2)               as paid,
  (d.principal - coalesce(sum(t.amount), 0))::numeric(14, 2) as remaining
from public.debts d
left join public.financial_transactions t on t.debt_id = d.id
group by d.id;

create view public.savings_goal_progress with (security_invoker = true) as
select
  g.id,
  g.user_id,
  g.name,
  g.target_amount,
  g.target_date,
  g.notes,
  g.created_at,
  coalesce(sum(c.amount), 0)::numeric(14, 2) as saved
from public.savings_goals g
left join public.savings_contributions c on c.goal_id = g.id
group by g.id;

create view public.monthly_balances with (security_invoker = true) as
select
  user_id,
  date_trunc('month', occurred_on)::date                                        as month,
  coalesce(sum(amount) filter (where type = 'income'), 0)::numeric(14, 2)       as income,
  coalesce(sum(amount) filter (where type = 'expense'), 0)::numeric(14, 2)      as expense,
  (coalesce(sum(amount) filter (where type = 'income'), 0)
   - coalesce(sum(amount) filter (where type = 'expense'), 0))::numeric(14, 2)  as balance
from public.financial_transactions
group by user_id, date_trunc('month', occurred_on);

-- ---------------------------------------------------------------------------
-- Goals & habits
-- ---------------------------------------------------------------------------
create table public.goals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title          text not null check (char_length(title) between 1 and 160),
  area           text not null default 'personal' check (area in ('work', 'academic', 'skills', 'languages', 'finance', 'personal')),
  unit           text not null default '' check (char_length(unit) <= 30),
  target_value   numeric(12, 2) not null check (target_value > 0),
  current_value  numeric(12, 2) not null default 0 check (current_value >= 0),
  due_date       date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index goals_user_idx on public.goals (user_id);

create table public.habits (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 80),
  target_per_week  smallint not null default 7 check (target_per_week between 1 and 7),
  archived         boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (id, user_id)
);
create index habits_user_idx on public.habits (user_id);

create table public.habit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id    uuid not null,
  log_date    date not null default current_date,
  created_at  timestamptz not null default now(),
  foreign key (habit_id, user_id) references public.habits (id, user_id) on delete cascade,
  unique (habit_id, log_date)
);
create index habit_logs_user_date_idx on public.habit_logs (user_id, log_date);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'shift_templates', 'shift_rotations', 'work_shifts', 'projects', 'academic_tasks',
    'skills', 'practice_sessions', 'technologies', 'languages', 'language_sessions', 'debts',
    'savings_goals', 'savings_contributions', 'financial_transactions', 'goals', 'habits'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_set_updated_at', t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

do $$
declare
  t text;
begin
  foreach t in array array[
    'shift_templates', 'shift_rotations', 'work_shifts', 'projects', 'academic_tasks', 'skills',
    'practice_sessions', 'technologies', 'languages', 'language_sessions', 'debts', 'savings_goals',
    'savings_contributions', 'financial_transactions', 'goals', 'habits', 'habit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t || '_delete_own', t);
  end loop;
end;
$$;

-- skill_level_logs is written only by trigger; users may read their own rows.
alter table public.skill_level_logs enable row level security;
create policy skill_level_logs_select_own on public.skill_level_logs for select to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Privileges: nothing for anon; authenticated is limited by RLS above.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon, public;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, delete on public.profiles from authenticated;
revoke insert, update, delete on public.skill_level_logs from authenticated;
revoke insert, update, delete on public.debt_balances, public.savings_goal_progress, public.monthly_balances from authenticated;
