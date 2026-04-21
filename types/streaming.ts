// ============================================================================
// Streaming Graphics — shared types
// ============================================================================

export type GraphicKey =
  | 'tournament_intro'
  | 'venue_card'
  | 'match_presentation'
  | 'player_bio'
  | 'referee_lower_third'
  | 'stats_panel'
  | 'scorebug'
  | 'big_scoreboard'
  | 'results_grid'
  | 'coin_toss'

export interface GraphicState<T = any> {
  visible: boolean
  data?: T | null
  since?: string
}

export type GraphicsMap = Partial<Record<GraphicKey, GraphicState>>

// ─── Per-graphic data payloads ───────────────────────────────────────────────

export interface PlayerBioData {
  player_id: string
  team?: 1 | 2
}

export interface StatsPanelData {
  scope: 'set_1' | 'set_2' | 'set_3' | 'match' | 'auto'
}

export interface CoinTossData {
  winner_team: 1 | 2
  choice: 'serve' | 'receive' | 'side_left' | 'side_right'
}

export interface ResultsGridData {
  category?: string
  highlight_match_id?: string
}

// ─── Session + state ─────────────────────────────────────────────────────────

export interface StreamSession {
  id: string
  tournament_id: string
  match_id: string
  active: boolean
  automation_enabled: boolean
  operator_notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface StreamState {
  session_id: string
  graphics: GraphicsMap
  theme: any | null
  updated_at: string
}

// ─── Automation ──────────────────────────────────────────────────────────────

export type TriggerType =
  | `match_status:${'scheduled'|'judge_on_court'|'players_on_court'|'warmup'|'in_progress'|'suspended'|'finished'|'retired'|'walkover'}`
  | 'game_end'
  | 'set_end'
  | 'match_end'
  | 'toss_set'
  | 'first_point'
  | 'manual'

export interface AutomationAction {
  type: 'show' | 'hide' | 'toggle'
  graphic: GraphicKey
  delay_ms?: number    // fire this action after delay_ms from trigger
  hold_ms?: number     // informational; operator/rule chain uses hide actions
  data?: any           // payload to set on the graphic
}

export interface AutomationRule {
  id: string
  tournament_id: string
  name: string
  trigger_type: TriggerType
  actions: AutomationAction[]
  enabled: boolean
  created_at: string
}

// ─── Event log ───────────────────────────────────────────────────────────────

export interface StreamEvent {
  id: string
  session_id: string
  kind: 'manual_show'|'manual_hide'|'auto_trigger'|'auto_action'|'error'
  graphic: GraphicKey | null
  payload: any
  created_by: string | null
  created_at: string
}
