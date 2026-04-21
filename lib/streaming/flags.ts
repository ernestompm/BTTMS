// ============================================================================
// Derived live flags (scorebug banner)
// ============================================================================
// Priority: match_point > championship_point > set_point > break_point
// Golden point (deuce in beach tennis 40-40) is NOT surfaced as a banner —
// the user wants the scorebug to simply display 40-40 in those situations.
// ============================================================================

import type { Score } from '@/types'

export interface LiveFlag {
  kind: 'match_point' | 'championship_point' | 'set_point' | 'break_point' | null
  team?: 1 | 2
  label: string
}

const NONE: LiveFlag = { kind: null, label: '' }

export function deriveLiveFlag(
  score: Score | null,
  opts: { isFinal?: boolean; servingTeam?: 1|2|null } = {},
): LiveFlag {
  if (!score || score.match_status === 'finished') return NONE
  const mp = isMatchPoint(score)
  if (mp) return { kind: opts.isFinal ? 'championship_point' : 'match_point', team: mp, label: opts.isFinal ? 'PUNTO DE CAMPEONATO' : 'PUNTO DE PARTIDO' }
  const sp = isSetPoint(score)
  if (sp) return { kind: 'set_point', team: sp, label: 'PUNTO DE SET' }
  const bp = isBreakPoint(score, opts.servingTeam ?? null)
  if (bp) return { kind: 'break_point', team: bp, label: 'PUNTO DE BREAK' }
  return NONE
}

function pts(score: Score, team: 1|2): number {
  const k = `t${team}` as 't1'|'t2'
  if (score.super_tiebreak_active || score.tiebreak_active) return score.tiebreak_score[k] ?? 0
  return score.current_game[k] ?? 0
}

function targetGamePoints(score: Score): number {
  if (score.super_tiebreak_active) return 10
  if (score.tiebreak_active) return 7
  return 4 // 0,15,30,40 -> win at 4
}

function isBreakPoint(score: Score, servingTeam: 1|2|null): 1|2|null {
  if (!servingTeam) return null
  if (score.super_tiebreak_active || score.tiebreak_active) return null
  const rec = servingTeam === 1 ? 2 : 1
  // Beach tennis: golden point means one point away for the receiver when
  // the scoreline is 40-A (A=anything 0..2) or 40-40 (golden point itself).
  const myPts = pts(score, rec), srvPts = pts(score, servingTeam)
  const target = targetGamePoints(score)
  if (myPts >= target - 1 && srvPts < target) return rec
  return null
}

function isSetPoint(score: Score): 1|2|null {
  if (score.super_tiebreak_active) return null
  for (const team of [1,2] as const) {
    const k = `t${team}` as 't1'|'t2'
    const opp = team===1 ? 't2' : 't1'
    if (score.tiebreak_active) {
      if (score.tiebreak_score[k] >= 6 && score.tiebreak_score[k] >= score.tiebreak_score[opp]) return team
      continue
    }
    const myPts = pts(score, team)
    const target = targetGamePoints(score)
    if (myPts >= target - 1) {
      const myGames = score.current_set[k] ?? 0
      const oppGames = score.current_set[opp] ?? 0
      if (myGames >= 5 && myGames >= oppGames) return team
    }
  }
  return null
}

function isMatchPoint(score: Score): 1|2|null {
  const setsToWin = 2
  for (const team of [1,2] as const) {
    const k = `t${team}` as 't1'|'t2'
    const opp = team===1 ? 't2' : 't1'
    if (score.super_tiebreak_active) {
      const target = targetGamePoints(score)
      if (score.tiebreak_score[k] >= target - 1 && score.tiebreak_score[k] >= score.tiebreak_score[opp]) return team
      continue
    }
    const sp = isSetPoint(score)
    if (sp === team && (score.sets_won[k] ?? 0) >= setsToWin - 1) return team
  }
  return null
}
