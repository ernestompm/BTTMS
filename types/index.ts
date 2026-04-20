export type UserRole = 'super_admin' | 'tournament_director' | 'staff' | 'judge'

export type TournamentStatus = 'draft' | 'active' | 'finished'

export type Category =
  | 'absolute_m' | 'absolute_f'
  | 'singles_m' | 'singles_f' | 'mixed'
  | 'u14_m' | 'u16_m' | 'u18_m'
  | 'u14_f' | 'u16_f' | 'u18_f'
  | 'vet30_m' | 'vet40_m' | 'vet50_m' | 'vet60_m'
  | 'vet30_f' | 'vet40_f' | 'vet50_f' | 'vet60_f'
  | 'mixed_vet30'

export type DrawType = 'single_elimination' | 'double_elimination' | 'round_robin' | 'group_stage'
export type DrawStatus = 'draft' | 'seeded' | 'in_progress' | 'finished'
export type MatchStatus = 'scheduled' | 'in_progress' | 'finished' | 'suspended' | 'walkover' | 'bye'
export type MatchType = 'singles' | 'doubles'
export type Round = 'QF' | 'SF' | 'F' | 'R32' | 'R16' | 'RR' | 'Q1' | 'Q2' | 'CON' | 'GRP'
export type ScoringSystem =
  | 'best_of_2_sets_super_tb'
  | '7_games_tb'
  | 'pro_set'
  | 'short_sets'
  | 'best_of_3_tiebreaks'
  | 'best_of_3_sets_tb'

export interface Sponsor {
  name: string
  logo_url: string
  tier: string
  display_order: number
}

export interface ScoreboardConfig {
  layout: 'horizontal_full' | 'vertical' | 'minimal' | 'stats_panel'
  colors: {
    background: string[]
    team1_accent: string
    team2_accent: string
    text_primary: string
    text_secondary: string
    serving_indicator: string
  }
  fonts: {
    score_family: string
    names_family: string
    score_size_multiplier: number
  }
  display: {
    show_player_photos: boolean
    show_flags: boolean
    show_rankings: boolean
    show_weather: boolean
    show_serve_indicator: boolean
    show_stats_bar: boolean
    show_court_name: boolean
    show_round: boolean
  }
  sponsors: {
    enabled: boolean
    rotation_interval_seconds: number
    display_zone: 'bottom' | 'top' | 'side'
  }
  logos: {
    tournament_logo_url: string
    rfet_logo_url: string
    sponsor_logos: string[]
  }
}

export interface Tournament {
  id: string
  name: string
  edition: number
  venue_name: string
  venue_city: string
  venue_lat: number
  venue_lng: number
  start_date: string
  end_date: string
  logo_url: string | null
  sponsors: Sponsor[]
  scoreboard_config: ScoreboardConfig
  broadcast_endpoint: string | null
  broadcast_api_key: string | null
  status: TournamentStatus
  created_at: string
}

export interface Player {
  id: string
  first_name: string
  last_name: string
  nationality: string
  birth_date: string | null
  birth_city: string | null
  age_manual: number | null
  height_cm: number | null
  laterality: 'right' | 'left' | 'ambidextrous' | null
  ranking_rfet: number | null
  ranking_itf: number | null
  photo_url: string | null
  bio: string | null
  social_instagram: string | null
  club: string | null
  federacion_autonomica: string | null
  titles: { name: string; year: number; category: string }[]
  created_at: string
}

export interface Draw {
  id: string
  tournament_id: string
  category: Category
  draw_type: DrawType
  size: number
  consolation: boolean
  consolation_type: 'full' | 'first_round_losers' | null
  qualifying_size: number
  status: DrawStatus
  structure: Record<string, unknown> | null
  created_at: string
}

export interface DrawEntry {
  id: string
  draw_id: string
  player1_id: string
  player2_id: string | null
  seed: number | null
  entry_type: 'direct' | 'qualifying' | 'wildcard_rfet' | 'wildcard_org' | 'territorial'
  territorial_fed: string | null
  ranking_sum: number | null
  draw_position: number | null
  status: 'confirmed' | 'withdrawn' | 'no_show'
  player1?: Player
  player2?: Player
}

export interface Group {
  id: string
  draw_id: string
  group_name: string
  entries: string[]
  standings: GroupStanding[]
}

export interface GroupStanding {
  entry_id: string
  played: number
  won: number
  lost: number
  sets_won: number
  sets_lost: number
  games_won: number
  games_lost: number
  points: number
}

export interface SetScore { t1: number; t2: number }

export interface Score {
  sets: SetScore[]
  current_set: SetScore
  current_game: SetScore
  deuce: boolean
  advantage_team: 1 | 2 | null
  tiebreak_active: boolean
  super_tiebreak_active: boolean
  tiebreak_score: SetScore
  sets_won: SetScore
  match_status: 'in_progress' | 'finished'
  winner_team?: 1 | 2
  scoring_system: ScoringSystem
}

export interface TeamStats {
  aces: number
  double_faults: number
  serve_faults: number
  serve_points_played: number
  serve_points_won: number
  serve_points_won_pct: number
  return_points_played: number
  return_points_won: number
  return_points_won_pct: number
  second_shot_points_won: number
  winners: number
  winners_forehand: number
  winners_backhand: number
  winners_volley: number
  winners_overhead: number
  unforced_errors: number
  unforced_errors_forehand: number
  unforced_errors_backhand: number
  unforced_errors_volley: number
  forced_errors_caused: number
  break_points_faced: number
  break_points_saved: number
  break_points_saved_pct: number
  break_points_won: number
  break_points_played_on_return: number
  break_points_won_pct: number
  game_points_faced: number
  game_points_saved: number
  set_points_faced: number
  set_points_saved: number
  match_points_faced: number
  match_points_saved: number
  max_points_streak: number
  current_points_streak: number
  max_games_streak: number
  total_points_won: number
  total_points_played: number
  total_points_won_pct: number
}

export interface MatchStats { t1: TeamStats; t2: TeamStats }

export interface Match {
  id: string
  tournament_id: string
  draw_id: string | null
  category: Category
  round: Round | null
  match_number: number | null
  match_type: MatchType
  court_id: string | null
  judge_id: string | null
  scheduled_at: string | null
  started_at: string | null
  finished_at: string | null
  entry1_id: string | null
  entry2_id: string | null
  status: MatchStatus
  toss_winner: 1 | 2 | null
  toss_choice: 'serve' | 'receive' | 'side_left' | 'side_right' | null
  serving_team: 1 | 2 | null
  current_server_id: string | null
  side_entry1: 'near' | 'far' | null
  score: Score | null
  stats: MatchStats | null
  broadcast_active: boolean
  net_height: '1.70' | '1.80' | null
  forbidden_zone_serving: 3.0 | 6.0 | null
  warnings: MatchWarnings | null
  notes: string | null
  entry1?: DrawEntry
  entry2?: DrawEntry
  court?: Court
  judge?: AppUser
  scoring_system?: ScoringSystem
}

export type PointType =
  | 'ace' | 'winner' | 'unforced_error' | 'forced_error'
  | 'double_fault' | 'serve_fault' | 'forbidden_zone' | 'foot_fault'
  | 'let_replay' | 'correction'

export type WarningType =
  | 'conduct' | 'time' | 'coaching' | 'equipment_abuse' | 'obscenity' | 'other'

export type PenaltyLevel = 'warning' | 'point_penalty' | 'game_penalty' | 'default'

export interface WarningEntry {
  type: WarningType
  penalty: PenaltyLevel
  team: 1 | 2
  timestamp: string
  note?: string
}

export interface MatchWarnings {
  t1: WarningEntry[]
  t2: WarningEntry[]
}

export type ShotDirection =
  | 'forehand' | 'backhand' | 'volley_fh' | 'volley_bh'
  | 'overhead' | 'lob' | 'serve'

export interface Point {
  id: string
  match_id: string
  sequence: number
  set_number: number
  game_number: number
  server_team: 1 | 2
  server_player_id: string | null
  winner_team: 1 | 2
  winner_player_id: string | null
  point_type: PointType
  shot_direction: ShotDirection | null
  fault_type: 'net' | 'out' | 'long' | 'foot_fault' | null
  is_break_point: boolean
  is_game_point: boolean
  is_set_point: boolean
  is_match_point: boolean
  was_break_point_saved: boolean
  score_before: Score
  score_after: Score
  created_at: string
  judge_id: string | null
  is_undone: boolean
}

export interface Court {
  id: string
  tournament_id: string
  name: string
  is_center_court: boolean
  scoreboard_url: string | null
  current_match_id: string | null
}

export interface AppUser {
  id: string
  email: string
  role: UserRole
  full_name: string
  phone: string | null
  tournament_id: string | null
  is_active: boolean
}

export interface WeatherData {
  location: string
  temperature_c: number
  feels_like_c: number
  humidity_pct: number
  wind_speed_kmh: number
  wind_direction: string
  wind_gusts_kmh: number
  precipitation_mm_last_hour: number
  rain_probability_pct: number
  uv_index: number
  cloud_cover_pct: number
  condition: string
  alerts: string[]
  forecast_next_3h: { hour: string; temp_c: number; rain_pct: number }[]
  updated_at: string
}

export const DEFAULT_TEAM_STATS: TeamStats = {
  aces: 0, double_faults: 0, serve_faults: 0,
  serve_points_played: 0, serve_points_won: 0, serve_points_won_pct: 0,
  return_points_played: 0, return_points_won: 0, return_points_won_pct: 0,
  second_shot_points_won: 0,
  winners: 0, winners_forehand: 0, winners_backhand: 0, winners_volley: 0, winners_overhead: 0,
  unforced_errors: 0, unforced_errors_forehand: 0, unforced_errors_backhand: 0, unforced_errors_volley: 0,
  forced_errors_caused: 0,
  break_points_faced: 0, break_points_saved: 0, break_points_saved_pct: 0,
  break_points_won: 0, break_points_played_on_return: 0, break_points_won_pct: 0,
  game_points_faced: 0, game_points_saved: 0,
  set_points_faced: 0, set_points_saved: 0,
  match_points_faced: 0, match_points_saved: 0,
  max_points_streak: 0, current_points_streak: 0, max_games_streak: 0,
  total_points_won: 0, total_points_played: 0, total_points_won_pct: 0,
}

export const DEFAULT_SCOREBOARD_CONFIG: ScoreboardConfig = {
  layout: 'horizontal_full',
  colors: {
    background: ['#0a0010', '#1a0020'],
    team1_accent: '#f31948',
    team2_accent: '#af005f',
    text_primary: '#ffffff',
    text_secondary: 'rgba(255,255,255,0.6)',
    serving_indicator: '#fc6f43',
  },
  fonts: { score_family: 'Barlow Condensed', names_family: 'Barlow', score_size_multiplier: 1.0 },
  display: {
    show_player_photos: true, show_flags: true, show_rankings: true,
    show_weather: true, show_serve_indicator: true, show_stats_bar: false,
    show_court_name: true, show_round: true,
  },
  sponsors: { enabled: true, rotation_interval_seconds: 10, display_zone: 'bottom' },
  logos: { tournament_logo_url: '', rfet_logo_url: '', sponsor_logos: [] },
}

export const CATEGORY_LABELS: Record<Category, string> = {
  absolute_m: 'Absoluto Masculino', absolute_f: 'Absoluto Femenino',
  singles_m: 'Individual Masculino', singles_f: 'Individual Femenino', mixed: 'Mixto',
  u14_m: 'Sub-14 Masc', u16_m: 'Sub-16 Masc', u18_m: 'Sub-18 Masc',
  u14_f: 'Sub-14 Fem', u16_f: 'Sub-16 Fem', u18_f: 'Sub-18 Fem',
  vet30_m: 'Veteranos +30M', vet40_m: 'Veteranos +40M', vet50_m: 'Veteranos +50M', vet60_m: 'Veteranos +60M',
  vet30_f: 'Veteranas +30F', vet40_f: 'Veteranas +40F', vet50_f: 'Veteranas +50F', vet60_f: 'Veteranas +60F',
  mixed_vet30: 'Mixto Veteranos +30',
}
