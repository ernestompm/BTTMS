-- BTTMS v2.0 - Schema completo
-- Ejecutar en Supabase SQL Editor

-- Habilitar extensiones
create extension if not exists "uuid-ossp";

-- ================================
-- TOURNAMENTS
-- ================================
create table if not exists tournaments (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  edition integer,
  venue_name text,
  venue_city text,
  venue_lat float,
  venue_lng float,
  start_date date,
  end_date date,
  logo_url text,
  sponsors jsonb default '[]'::jsonb,
  scoreboard_config jsonb default '{}'::jsonb,
  broadcast_endpoint text,
  broadcast_api_key text,
  correction_pin text default '0000',
  status text not null default 'draft' check (status in ('draft','active','finished')),
  created_at timestamptz default now()
);

-- ================================
-- PLAYERS
-- ================================
create table if not exists players (
  id uuid primary key default uuid_generate_v4(),
  first_name text not null,
  last_name text not null,
  nationality char(3),
  birth_date date,
  birth_city text,
  height_cm integer,
  laterality text check (laterality in ('right','left','ambidextrous')),
  ranking_rfet integer,
  ranking_itf integer,
  photo_url text,
  bio text,
  social_instagram text,
  titles jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

-- ================================
-- USERS (linked to Supabase Auth)
-- ================================
create table if not exists app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('super_admin','tournament_director','staff','judge')),
  full_name text not null default '',
  phone text,
  tournament_id uuid references tournaments(id) on delete set null,
  is_active boolean default true
);

-- ================================
-- COURTS
-- ================================
create table if not exists courts (
  id uuid primary key default uuid_generate_v4(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name text not null,
  is_center_court boolean default false,
  scoreboard_url text,
  current_match_id uuid
);

-- ================================
-- DRAWS
-- ================================
create table if not exists draws (
  id uuid primary key default uuid_generate_v4(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  category text not null,
  draw_type text not null check (draw_type in ('single_elimination','double_elimination','round_robin','group_stage')),
  size integer not null default 16,
  consolation boolean default false,
  consolation_type text check (consolation_type in ('full','first_round_losers')),
  qualifying_size integer default 0,
  status text not null default 'draft' check (status in ('draft','seeded','in_progress','finished')),
  structure jsonb,
  created_at timestamptz default now()
);

-- ================================
-- DRAW ENTRIES
-- ================================
create table if not exists draw_entries (
  id uuid primary key default uuid_generate_v4(),
  draw_id uuid not null references draws(id) on delete cascade,
  player1_id uuid not null references players(id),
  player2_id uuid references players(id),
  seed integer,
  entry_type text not null default 'direct' check (entry_type in ('direct','qualifying','wildcard_rfet','wildcard_org','territorial')),
  territorial_fed text,
  ranking_sum integer,
  draw_position integer,
  status text not null default 'confirmed' check (status in ('confirmed','withdrawn','no_show'))
);

-- ================================
-- GROUPS
-- ================================
create table if not exists groups (
  id uuid primary key default uuid_generate_v4(),
  draw_id uuid not null references draws(id) on delete cascade,
  group_name text not null,
  entries uuid[] default '{}',
  standings jsonb default '[]'::jsonb
);

-- ================================
-- MATCHES
-- ================================
create table if not exists matches (
  id uuid primary key default uuid_generate_v4(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  draw_id uuid references draws(id) on delete set null,
  category text not null,
  round text,
  match_number integer,
  match_type text not null default 'doubles' check (match_type in ('singles','doubles')),
  court_id uuid references courts(id) on delete set null,
  judge_id uuid references app_users(id) on delete set null,
  scheduled_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  entry1_id uuid references draw_entries(id) on delete set null,
  entry2_id uuid references draw_entries(id) on delete set null,
  status text not null default 'scheduled' check (status in ('scheduled','in_progress','finished','suspended','walkover','bye')),
  toss_winner integer check (toss_winner in (1,2)),
  toss_choice text check (toss_choice in ('serve','receive','side_left','side_right')),
  serving_team integer check (serving_team in (1,2)),
  current_server_id uuid references players(id) on delete set null,
  side_entry1 text check (side_entry1 in ('near','far')),
  score jsonb,
  stats jsonb,
  broadcast_active boolean default false,
  net_height text check (net_height in ('1.70','1.80')),
  forbidden_zone_serving float,
  scoring_system text not null default 'best_of_2_sets_super_tb',
  notes text,
  created_at timestamptz default now()
);

-- ================================
-- POINTS (append-only log)
-- ================================
create table if not exists points (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid not null references matches(id) on delete cascade,
  sequence integer not null,
  set_number integer not null,
  game_number integer not null,
  server_team integer not null check (server_team in (1,2)),
  server_player_id uuid references players(id) on delete set null,
  winner_team integer not null check (winner_team in (1,2)),
  winner_player_id uuid references players(id) on delete set null,
  point_type text not null check (point_type in ('ace','winner','unforced_error','forced_error','double_fault','serve_fault','let_replay','correction')),
  shot_direction text check (shot_direction in ('forehand','backhand','volley_fh','volley_bh','overhead','lob','serve')),
  fault_type text check (fault_type in ('net','out','long','foot_fault')),
  is_break_point boolean default false,
  is_game_point boolean default false,
  is_set_point boolean default false,
  is_match_point boolean default false,
  was_break_point_saved boolean default false,
  score_before jsonb not null,
  score_after jsonb not null,
  created_at timestamptz default now(),
  judge_id uuid references app_users(id) on delete set null,
  is_undone boolean default false
);

-- Prevent UPDATE/DELETE on points (append-only)
create or replace rule no_update_points as on update to points do instead nothing;
create or replace rule no_delete_points as on delete to points do instead nothing;

-- ================================
-- INDEXES
-- ================================
create index if not exists idx_matches_tournament on matches(tournament_id);
create index if not exists idx_matches_judge on matches(judge_id);
create index if not exists idx_matches_status on matches(status);
create index if not exists idx_points_match on points(match_id);
create index if not exists idx_points_sequence on points(match_id, sequence);
create index if not exists idx_draw_entries_draw on draw_entries(draw_id);
create index if not exists idx_app_users_role on app_users(role);
create index if not exists idx_draws_tournament on draws(tournament_id);
