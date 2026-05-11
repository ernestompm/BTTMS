/**
 * Diccionarios de etiquetas en castellano para todos los enums del
 * sistema. Centraliza traducciones que antes estaban repetidas o
 * inconsistentes entre páginas.
 */

import { CATEGORY_LABELS as CATEGORY_LABELS_RAW } from '@/types'

// ── Estados del match ─────────────────────────────────────────────────────
export const MATCH_STATUS_LABELS = {
  scheduled:        'Programado',
  judge_on_court:   'Juez en pista',
  players_on_court: 'Jugadores en pista',
  warmup:           'Calentamiento',
  in_progress:      'En juego',
  suspended:        'Suspendido',
  finished:         'Finalizado',
  retired:          'Retirada',
  walkover:         'Walkover',
  bye:              'Bye',
} as const

export type MatchStatus = keyof typeof MATCH_STATUS_LABELS

export function statusLabel(status: string | null | undefined): string {
  if (!status) return '—'
  return (MATCH_STATUS_LABELS as Record<string, string>)[status] ?? status
}

/** Variante para Badge UI: success/danger/warning/outline/default. */
export function statusBadgeVariant(status: string | null | undefined):
  'success' | 'danger' | 'warning' | 'outline' | 'default' | 'info' {
  switch (status) {
    case 'in_progress':     return 'danger'
    case 'finished':        return 'success'
    case 'warmup':          return 'warning'
    case 'judge_on_court':
    case 'players_on_court':return 'info'
    case 'suspended':
    case 'retired':
    case 'walkover':        return 'outline'
    case 'bye':             return 'default'
    default:                return 'outline'
  }
}

// ── Rondas ─────────────────────────────────────────────────────────────────
export const ROUND_LABELS_FULL = {
  F:   'Final',
  SF:  'Semifinal',
  QF:  'Cuartos de Final',
  R16: 'Octavos de Final',
  R32: 'Dieciseisavos',
  R64: 'Treintaidosavos',
  RR:  'Fase de Grupos',
  GRP: 'Fase de Grupos',
  CON: 'Consolación',
  Q1:  'Clasificatoria 1',
  Q2:  'Clasificatoria 2',
} as const

export const ROUND_LABELS_SHORT = {
  F:   'Final',
  SF:  'Semi',
  QF:  'Cuartos',
  R16: 'Octavos',
  R32: '1/16',
  R64: '1/32',
  RR:  'Grupos',
  GRP: 'Grupos',
  CON: 'Consol.',
  Q1:  'Q1',
  Q2:  'Q2',
} as const

export function roundLabel(round: string | null | undefined, short = false): string {
  if (!round) return '—'
  const dict = short ? ROUND_LABELS_SHORT : ROUND_LABELS_FULL
  return (dict as Record<string, string>)[round] ?? round
}

// ── Categorías ─────────────────────────────────────────────────────────────
// Reexporta de types/index.ts pero con accessor tipado y fallback.
export function categoryLabel(category: string | null | undefined): string {
  if (!category) return '—'
  return (CATEGORY_LABELS_RAW as Record<string, string>)[category] ?? category
}

// ── Sistema de puntuación ──────────────────────────────────────────────────
export const SCORING_SYSTEM_LABELS = {
  best_of_2_sets_super_tb: 'Dobles · 2 sets + Super TB',
  '7_games_tb':            'Individual · 7 juegos + TB',
  best_of_3_sets_tb:       '3 sets con TB',
  short_sets:              'Sets cortos · 4 juegos + TB',
  pro_set:                 'Pro Set · 1 set largo',
  best_of_3_tiebreaks:     'Mejor de 3 tie-breaks',
} as const

export function scoringSystemLabel(system: string | null | undefined): string {
  if (!system) return '—'
  return (SCORING_SYSTEM_LABELS as Record<string, string>)[system] ?? system
}

// ── Toss / Sorteo ──────────────────────────────────────────────────────────
export const TOSS_CHOICE_LABELS = {
  serve:      'Sacar',
  receive:    'Restar',
  side_left:  'Lado izquierdo',
  side_right: 'Lado derecho',
} as const

export function tossChoiceLabel(choice: string | null | undefined): string {
  if (!choice) return '—'
  return (TOSS_CHOICE_LABELS as Record<string, string>)[choice] ?? choice
}

// ── Roles de usuario ───────────────────────────────────────────────────────
export const ROLE_LABELS = {
  super_admin:         'Super admin',
  tournament_director: 'Director',
  staff:               'Personal',
  judge:               'Árbitro',
  commentator:         'Comentarista',
} as const

export function roleLabel(role: string | null | undefined): string {
  if (!role) return '—'
  return (ROLE_LABELS as Record<string, string>)[role] ?? role
}
