/**
 * RFET Beach Tennis Score Engine v2.0
 * Reglas RFET 2026 - Campeonato de España de Tenis Playa
 *
 * Diferencias clave respecto al tenis:
 * - Solo 1 intento de saque (sin segundo servicio)
 * - Zona prohibida: 6m absoluto_m/u18_m, 3m resto
 * - Red: 1.80m absoluto_m/vets, 1.70m resto
 * - Dobles: mejor de 2 sets + Super TB a 10 si 1-1
 * - Individual: 7 juegos con TB si empate a 6
 * - TB: cambio de lado al 1er punto y luego cada 4
 * - Super TB: cambio de lado al llegar a 5 puntos
 */

import type { Score, ScoringSystem, Category } from '@/types'

export const INITIAL_SCORE = (system: ScoringSystem): Score => ({
  sets: [],
  current_set: { t1: 0, t2: 0 },
  current_game: { t1: 0, t2: 0 },
  deuce: false,
  advantage_team: null,
  tiebreak_active: false,
  super_tiebreak_active: false,
  tiebreak_score: { t1: 0, t2: 0 },
  sets_won: { t1: 0, t2: 0 },
  match_status: 'in_progress',
  scoring_system: system,
})

// Points display names
const GAME_POINTS = ['0', '15', '30', '40']

export function getGameDisplay(score: Score, team: 1 | 2): string {
  if (score.super_tiebreak_active) {
    return String(score.tiebreak_score[`t${team}` as 't1' | 't2'])
  }
  if (score.tiebreak_active) {
    return String(score.tiebreak_score[`t${team}` as 't1' | 't2'])
  }
  if (score.deuce) return 'ORO'  // Punto de Oro (no advantage in beach tennis)
  const pts = score.current_game[`t${team}` as 't1' | 't2']
  return GAME_POINTS[pts] ?? '0'
}

export function getScoringSystem(category: Category, matchType: 'singles' | 'doubles'): ScoringSystem {
  if (matchType === 'singles') return '7_games_tb'
  if (category === 'absolute_m' || category === 'absolute_f') return 'best_of_2_sets_super_tb'
  return 'best_of_2_sets_super_tb'
}

function getSetsToWin(system: ScoringSystem): number {
  if (system === 'best_of_3_sets_tb' || system === 'best_of_3_tiebreaks') return 2
  if (system === 'best_of_2_sets_super_tb') return 2
  return 1
}

function getGamesForSet(system: ScoringSystem): number {
  if (system === '7_games_tb') return 7
  if (system === 'short_sets') return 4
  return 6
}

/** Apply a point won by winnerTeam. Returns new Score (immutable). */
export function applyPoint(prev: Score, winnerTeam: 1 | 2): Score {
  const s = structuredClone(prev)
  const loserTeam: 1 | 2 = winnerTeam === 1 ? 2 : 1
  const wKey = `t${winnerTeam}` as 't1' | 't2'
  const lKey = `t${loserTeam}` as 't1' | 't2'

  // --- SUPER TIE-BREAK ---
  if (s.super_tiebreak_active) {
    s.tiebreak_score[wKey]++
    const wPts = s.tiebreak_score[wKey]
    const lPts = s.tiebreak_score[lKey]
    if (wPts >= 10 && wPts - lPts >= 2) {
      s.sets_won[wKey]++
      s.match_status = 'finished'
      s.winner_team = winnerTeam
    }
    return s
  }

  // --- REGULAR TIE-BREAK ---
  if (s.tiebreak_active) {
    s.tiebreak_score[wKey]++
    const wPts = s.tiebreak_score[wKey]
    const lPts = s.tiebreak_score[lKey]
    if (wPts >= 7 && wPts - lPts >= 2) {
      // Winner wins the set
      s.current_set[wKey]++
      return finishSet(s, winnerTeam, loserTeam)
    }
    return s
  }

  // --- REGULAR GAME ---

  if (s.deuce) {
    // Beach tennis: Punto de Oro — no advantage, next point wins the game (RFET art. 27)
    return winGame(s, winnerTeam, loserTeam)
  }

  // Normal scoring (0-3)
  s.current_game[wKey]++
  const wPts = s.current_game[wKey]
  const lPts = s.current_game[lKey]

  if (wPts === 3 && lPts === 3) {
    // Deuce
    s.deuce = true
    s.current_game = { t1: 3, t2: 3 }
    return s
  }

  if (wPts >= 4) {
    if (lPts >= 3) {
      s.deuce = true
      s.current_game = { t1: 3, t2: 3 }
    } else {
      return winGame(s, winnerTeam, loserTeam)
    }
  }

  return s
}

function winGame(s: Score, winner: 1 | 2, loser: 1 | 2): Score {
  const wKey = `t${winner}` as 't1' | 't2'
  const lKey = `t${loser}` as 't1' | 't2'
  const system = s.scoring_system

  // Reset game
  s.current_game = { t1: 0, t2: 0 }
  s.deuce = false
  s.advantage_team = null

  s.current_set[wKey]++
  const wGames = s.current_set[wKey]
  const lGames = s.current_set[lKey]
  const gamesForSet = getGamesForSet(system)

  // Check for tiebreak
  if (system === '7_games_tb') {
    if (wGames === 7 && lGames <= 6) return finishSet(s, winner, loser)
    if (wGames === 7 && lGames === 7) {
      // Shouldn't happen (TB at 6-6), just in case
      return startTiebreak(s)
    }
    if (wGames === 6 && lGames === 6) return startTiebreak(s)
    return s
  }

  if (wGames >= gamesForSet && wGames - lGames >= 2) {
    return finishSet(s, winner, loser)
  }

  if (system === 'short_sets' && wGames === 4 && lGames === 4) {
    return startTiebreak(s)
  }

  if (system !== 'short_sets' && wGames === 6 && lGames === 6) {
    return startTiebreak(s)
  }

  return s
}

function startTiebreak(s: Score): Score {
  s.tiebreak_active = true
  s.tiebreak_score = { t1: 0, t2: 0 }
  return s
}

function finishSet(s: Score, winner: 1 | 2, loser: 1 | 2): Score {
  const wKey = `t${winner}` as 't1' | 't2'
  const system = s.scoring_system

  // Save set score
  s.sets.push({ t1: s.current_set.t1, t2: s.current_set.t2 })
  s.sets_won[wKey]++

  // Reset
  s.current_set = { t1: 0, t2: 0 }
  s.current_game = { t1: 0, t2: 0 }
  s.tiebreak_active = false
  s.tiebreak_score = { t1: 0, t2: 0 }
  s.deuce = false
  s.advantage_team = null

  // In best-of-2: 1-1 triggers Super TB before checking sets-to-win
  if (system === 'best_of_2_sets_super_tb' && s.sets_won.t1 === 1 && s.sets_won.t2 === 1) {
    s.super_tiebreak_active = true
    s.tiebreak_score = { t1: 0, t2: 0 }
    return s
  }

  const setsToWin = getSetsToWin(system)
  if (s.sets_won[wKey] >= setsToWin) {
    s.match_status = 'finished'
    s.winner_team = winner
  }

  return s
}

/** Check if current point situation is break point (server = sacador, winner restador would break) */
export function isBreakPoint(score: Score, servingTeam: 1 | 2): boolean {
  if (score.tiebreak_active || score.super_tiebreak_active) return false
  const restingTeam: 1 | 2 = servingTeam === 1 ? 2 : 1
  const rKey = `t${restingTeam}` as 't1' | 't2'
  const sKey = `t${servingTeam}` as 't1' | 't2'

  if (score.deuce && score.advantage_team === restingTeam) return true
  if (score.deuce && score.advantage_team === null) return false // deuce but no adv
  const rPts = score.current_game[rKey]
  const sPts = score.current_game[sKey]
  return (rPts === 3 && sPts < 3)
}

export function isGamePoint(score: Score, servingTeam: 1 | 2): boolean {
  if (score.tiebreak_active || score.super_tiebreak_active) {
    const wKey = `t${servingTeam}` as 't1' | 't2'
    const lKey = `t${servingTeam === 1 ? 2 : 1}` as 't1' | 't2'
    const wPts = score.tiebreak_score[wKey]
    const lPts = score.tiebreak_score[lKey]
    return wPts >= 6 && wPts - lPts >= 1
  }
  const sKey = `t${servingTeam}` as 't1' | 't2'
  const rKey = `t${servingTeam === 1 ? 2 : 1}` as 't1' | 't2'
  if (score.deuce && score.advantage_team === servingTeam) return true
  const sPts = score.current_game[sKey]
  const rPts = score.current_game[rKey]
  return sPts === 3 && rPts < 3
}

export function isSetPoint(score: Score, servingTeam: 1 | 2): boolean {
  if (!isGamePoint(score, servingTeam)) return false
  const wKey = `t${servingTeam}` as 't1' | 't2'
  const lKey = `t${servingTeam === 1 ? 2 : 1}` as 't1' | 't2'
  const wGames = score.current_set[wKey]
  const lGames = score.current_set[lKey]
  const gamesForSet = getGamesForSet(score.scoring_system)
  return (wGames + 1 >= gamesForSet && (wGames + 1) - lGames >= 2) ||
    (score.tiebreak_active && score.tiebreak_score[wKey] >= 6 && score.tiebreak_score[wKey] - score.tiebreak_score[lKey] >= 1)
}

/** True if checkTeam is one point away from winning the match */
export function isMatchPoint(score: Score, checkTeam: 1 | 2): boolean {
  const wKey = `t${checkTeam}` as 't1' | 't2'
  const lKey = `t${checkTeam === 1 ? 2 : 1}` as 't1' | 't2'

  if (score.super_tiebreak_active) {
    const w = score.tiebreak_score[wKey], l = score.tiebreak_score[lKey]
    return w >= 9 && w > l  // next point → ≥10 with margin ≥2
  }

  const setsToWin = getSetsToWin(score.scoring_system)
  if (score.sets_won[wKey] + 1 < setsToWin) return false
  return isSetPoint(score, checkTeam)
}

// Exported for tests
export function scoreFromScratch(system: ScoringSystem): Score {
  return INITIAL_SCORE(system)
}

/** Determine next server in doubles TB (rotates every 2 points) */
export function getTBServer(tiebreakScore: { t1: number; t2: number }, initialServingTeam: 1 | 2): 1 | 2 {
  const total = tiebreakScore.t1 + tiebreakScore.t2
  const changes = Math.floor(total / 2)
  return changes % 2 === 0 ? initialServingTeam : (initialServingTeam === 1 ? 2 : 1)
}

/** Check if a side change is needed in TB (after 1st point, then every 4) */
export function isTBSideChange(tiebreakScore: { t1: number; t2: number }): boolean {
  const total = tiebreakScore.t1 + tiebreakScore.t2
  if (total === 1) return true
  return total > 1 && (total - 1) % 4 === 0
}

/** Check if a side change is needed in Super TB (at 5 points) */
export function isSuperTBSideChange(tiebreakScore: { t1: number; t2: number }): boolean {
  const total = tiebreakScore.t1 + tiebreakScore.t2
  const max = Math.max(tiebreakScore.t1, tiebreakScore.t2)
  return max === 5 && total > 0
}
