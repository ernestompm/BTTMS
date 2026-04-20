-- BTTMS v2.0 - Row Level Security
-- Ejecutar DESPUÉS de 001_schema.sql

-- Habilitar RLS en todas las tablas
alter table tournaments enable row level security;
alter table players enable row level security;
alter table app_users enable row level security;
alter table courts enable row level security;
alter table draws enable row level security;
alter table draw_entries enable row level security;
alter table groups enable row level security;
alter table matches enable row level security;
alter table points enable row level security;

-- ================================
-- Función helper: obtener rol del usuario actual
-- ================================
create or replace function get_user_role()
returns text
language sql
stable
as $$
  select role from app_users where id = auth.uid()
$$;

create or replace function get_user_tournament_id()
returns uuid
language sql
stable
as $$
  select tournament_id from app_users where id = auth.uid()
$$;

-- ================================
-- TOURNAMENTS - RLS
-- ================================
create policy "tournaments_public_read" on tournaments
  for select using (true);

create policy "tournaments_admin_write" on tournaments
  for all using (
    get_user_role() in ('super_admin', 'tournament_director')
    and (get_user_role() = 'super_admin' or id = get_user_tournament_id())
  );

-- ================================
-- PLAYERS - RLS
-- ================================
create policy "players_public_read" on players
  for select using (true);

create policy "players_staff_write" on players
  for insert with check (get_user_role() in ('super_admin','tournament_director','staff'));

create policy "players_staff_update" on players
  for update using (get_user_role() in ('super_admin','tournament_director','staff'));

-- ================================
-- APP_USERS - RLS
-- ================================
create policy "users_self_read" on app_users
  for select using (
    id = auth.uid()
    or get_user_role() in ('super_admin','tournament_director')
  );

create policy "users_admin_write" on app_users
  for all using (get_user_role() in ('super_admin','tournament_director'));

-- ================================
-- COURTS - RLS
-- ================================
create policy "courts_public_read" on courts
  for select using (true);

create policy "courts_staff_write" on courts
  for all using (
    get_user_role() in ('super_admin','tournament_director','staff')
    and (get_user_role() = 'super_admin' or tournament_id = get_user_tournament_id())
  );

-- ================================
-- DRAWS - RLS
-- ================================
create policy "draws_public_read" on draws
  for select using (true);

create policy "draws_director_write" on draws
  for all using (
    get_user_role() in ('super_admin','tournament_director')
    and (get_user_role() = 'super_admin' or tournament_id = get_user_tournament_id())
  );

-- ================================
-- DRAW_ENTRIES - RLS
-- ================================
create policy "entries_public_read" on draw_entries
  for select using (true);

create policy "entries_staff_write" on draw_entries
  for all using (get_user_role() in ('super_admin','tournament_director','staff'));

-- ================================
-- GROUPS - RLS
-- ================================
create policy "groups_public_read" on groups
  for select using (true);

create policy "groups_staff_write" on groups
  for all using (get_user_role() in ('super_admin','tournament_director','staff'));

-- ================================
-- MATCHES - RLS
-- ================================
create policy "matches_public_read" on matches
  for select using (true);

create policy "matches_staff_write" on matches
  for insert with check (get_user_role() in ('super_admin','tournament_director','staff'));

create policy "matches_staff_update" on matches
  for update using (
    get_user_role() in ('super_admin','tournament_director','staff')
    or (get_user_role() = 'judge' and judge_id = auth.uid())
  );

-- ================================
-- POINTS - RLS (append-only)
-- ================================
create policy "points_public_read" on points
  for select using (true);

create policy "points_judge_insert" on points
  for insert with check (
    get_user_role() in ('super_admin','tournament_director','staff','judge')
    and (
      get_user_role() != 'judge'
      or exists (
        select 1 from matches m where m.id = match_id and m.judge_id = auth.uid()
      )
    )
  );
-- No UPDATE, no DELETE policies (handled by rules in schema)
