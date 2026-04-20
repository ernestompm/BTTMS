-- BTTMS v2.0 - Seed data inicial
-- Ejecutar DESPUÉS de 003_functions.sql
-- IMPORTANTE: Crear el usuario admin en Supabase Auth PRIMERO,
-- luego reemplazar el UUID de abajo con el ID real del usuario

-- Crear torneo de demostración
insert into tournaments (
  id, name, edition, venue_name, venue_city,
  venue_lat, venue_lng, start_date, end_date, status,
  scoreboard_config, sponsors
) values (
  '00000000-0000-0000-0000-000000000001',
  'Campeonato de España de Tenis Playa 2026',
  2026,
  'Parque del Mediterráneo',
  'Marbella',
  36.5097, -4.8855,
  '2026-06-15', '2026-06-22',
  'draft',
  '{
    "layout": "horizontal_full",
    "colors": {
      "background": ["#0a0010", "#1a0020"],
      "team1_accent": "#f31948",
      "team2_accent": "#af005f",
      "text_primary": "#ffffff",
      "text_secondary": "rgba(255,255,255,0.6)",
      "serving_indicator": "#fc6f43"
    },
    "fonts": {
      "score_family": "Barlow Condensed",
      "names_family": "Barlow",
      "score_size_multiplier": 1.0
    },
    "display": {
      "show_player_photos": true,
      "show_flags": true,
      "show_rankings": true,
      "show_weather": true,
      "show_serve_indicator": true,
      "show_stats_bar": false,
      "show_court_name": true,
      "show_round": true
    },
    "sponsors": {
      "enabled": true,
      "rotation_interval_seconds": 10,
      "display_zone": "bottom"
    },
    "logos": {
      "tournament_logo_url": "",
      "rfet_logo_url": "",
      "sponsor_logos": []
    }
  }'::jsonb,
  '[{"name": "RFET", "logo_url": "", "tier": "title", "display_order": 1}, {"name": "Mapfre", "logo_url": "", "tier": "sponsor", "display_order": 2}]'::jsonb
) on conflict (id) do nothing;

-- Crear pistas de demostración
insert into courts (tournament_id, name, is_center_court) values
  ('00000000-0000-0000-0000-000000000001', 'Pista Central', true),
  ('00000000-0000-0000-0000-000000000001', 'Pista 2', false),
  ('00000000-0000-0000-0000-000000000001', 'Pista 3', false),
  ('00000000-0000-0000-0000-000000000001', 'Pista 4', false)
on conflict do nothing;

-- Nota: El usuario super_admin se crea via /api/setup después del primer deploy
-- Los jugadores y partidos de demo se crean desde el panel de administración
