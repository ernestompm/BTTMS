-- BTTMS v2.0 - Database Functions & Triggers
-- Ejecutar DESPUÉS de 002_rls.sql

-- ================================
-- Calcular net_height y forbidden_zone según categoría
-- ================================
create or replace function get_match_rules(cat text, mtype text)
returns jsonb
language plpgsql
as $$
declare
  net float := 1.70;
  zone float := 3.0;
begin
  -- Net height: 1.80 for absolute_m and vets, 1.70 rest
  if cat in ('absolute_m','vet30_m','vet40_m','vet50_m','vet60_m') then
    net := 1.80;
  end if;
  -- Forbidden zone: 6m for absolute_m and u18_m, 3m for rest
  if cat in ('absolute_m','u18_m') then
    zone := 6.0;
  end if;
  return jsonb_build_object('net_height', net::text, 'forbidden_zone_serving', zone);
end;
$$;

-- ================================
-- Trigger: set net_height and forbidden_zone on insert
-- ================================
create or replace function set_match_rules()
returns trigger
language plpgsql
as $$
declare
  rules jsonb;
begin
  rules := get_match_rules(NEW.category, NEW.match_type);
  NEW.net_height := rules->>'net_height';
  NEW.forbidden_zone_serving := (rules->>'forbidden_zone_serving')::float;
  return NEW;
end;
$$;

create trigger trg_set_match_rules
  before insert on matches
  for each row execute function set_match_rules();

-- ================================
-- Validate daily match limit (RFET Rule)
-- Returns: {valid: bool, player_id: uuid, count: int, limit: int}
-- ================================
create or replace function validate_daily_match_limit(
  p_tournament_id uuid,
  p_match_date date,
  p_entry1_id uuid,
  p_entry2_id uuid,
  p_exclude_match_id uuid default null
)
returns jsonb
language plpgsql
as $$
declare
  player_ids uuid[];
  pid uuid;
  match_count int;
  daily_limit int := 4;
  result jsonb := '{"valid": true}'::jsonb;
begin
  -- Collect all player IDs from both entries
  select array_agg(pid) into player_ids
  from (
    select player1_id as pid from draw_entries where id in (p_entry1_id, p_entry2_id)
    union
    select player2_id from draw_entries where id in (p_entry1_id, p_entry2_id) and player2_id is not null
  ) t;

  foreach pid in array coalesce(player_ids, '{}') loop
    select count(*) into match_count
    from matches m
    join draw_entries de on (de.id = m.entry1_id or de.id = m.entry2_id)
    where m.tournament_id = p_tournament_id
      and date(m.scheduled_at) = p_match_date
      and m.status not in ('walkover','bye')
      and (de.player1_id = pid or de.player2_id = pid)
      and (p_exclude_match_id is null or m.id != p_exclude_match_id);

    if match_count >= daily_limit then
      return jsonb_build_object(
        'valid', false,
        'player_id', pid,
        'count', match_count,
        'limit', daily_limit
      );
    end if;
  end loop;

  return '{"valid": true}'::jsonb;
end;
$$;

-- ================================
-- Get tournament stats summary
-- ================================
create or replace function get_tournament_stats(p_tournament_id uuid)
returns jsonb
language plpgsql
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'total_matches', count(*),
    'finished_matches', count(*) filter (where status = 'finished'),
    'in_progress', count(*) filter (where status = 'in_progress'),
    'scheduled', count(*) filter (where status = 'scheduled'),
    'total_points', (select count(*) from points p2 join matches m2 on p2.match_id = m2.id where m2.tournament_id = p_tournament_id and not p2.is_undone)
  )
  into result
  from matches
  where tournament_id = p_tournament_id;

  return result;
end;
$$;
