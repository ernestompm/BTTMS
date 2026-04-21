// ============================================================================
// Derived flags surfaced in scorebug / stats
// ============================================================================

import type { Score } from '@/types'

export interface LiveFlag {
  kind: 'match_point' | 'championship_point' | 'set_point' | 'break_point' | 'golden_point' | null
  team?: 1 | 2
  label: string
}

/**
 * Infer the most important current flag from the live Score.
 * match_point > championship_point > set_point > break_point > golden_point
 * championship_point === match point in a final (caller passes isFinal).
 */
export function deriveLiveFlag(score: Score | null, opts: { isFinal?: boolean, servingTeam?: 1|2|null } = {}): LiveFlag {
  if (!score || score.match_status === 'finished') return { kind: null, label: '' }
  const mp = isMatchPoint(score)
  if (mp) return {
    kind: opts.isFinal ? 'championship_point' : 'match_point',
    team: mp,
    label: opts.isFinal ? 'PUNTO DE CAMPEONATO' : 'PUNTO DE PARTIDO',
  }
  const sp = isSetPoint(score)
  if (sp) return { kind: 'set_point', team: sp, label: 'PUNTO DE SET' }
  const bp = isBreakPoint(score, opts.servingTeam ?? null)
  if (bp) return { kind: 'break_point', team: bp, label: 'BOLA DE BREAK' }
  if (score.deuce) return { kind: 'golden_point', label: 'PUNTO DE ORO' }
  return { kind: null, label: '' }
}

function pts(score: Score, team: 1|2): number {
  const k = `t${team}` as 't1'|'t2'
  if (score.super_tiebreak_active || score.tiebreak_active) return score.tiebreak_score[k] ?? 0
  return score.current_game[k] ?? 0
}

function targetGamePoints(score: Score): number {
  if (score.super_tiebreak_active) return 10
  if (score.tiebreak_active) return 7
  return 4 // 0,15,30,40 -> next wins at 4
}

function isBreakPoint(score: Score, servingTeam: 1|2|null): 1|2|null {
  if (!servingTeam) return null
  if (score.super_tiebreak_active || score.tiebreak_active) return null
  const rec = servingTeam === 1 ? 2 : 1
  const myPts = pts(score, rec)
  const srvPts = pts(score, servingTeam)
  const target = targetGamePoints(score)
  // One point away from winning as receiver: pts==3 and serving<3 (break via deuce golden or before)
  if (score.deuce) return null // no advantage in beach tennis; golden point is separate
  if (myPts >= target - 1 && srvPts < target - (score.deuce ? 0 : 1)) return rec
  return null
}

function isSetPoint(score: Score): 1|2|null {
  // Simple heuristic: team leads in current_set by >=1 and has game point, OR tiebreak >= 5 and leads by >=1
  if (score.super_tiebreak_active) return null
  for (const team of [1,2] as const) {
    const k = `t${team}` as 't1'|'t2'
    const myPts = pts(score, team)
    const target = targetGamePoints(score)
    if (score.tiebreak_active) {
      const opp = team===1 ? 't2' : 't1'
      if (score.tiebreak_score[k] >= 6 && score.tiebreak_score[k] >= score.tiebreak_score[opp as 't1'|'t2']) return team
    } else if (myPts >= target - 1) {
      // Game point + games enough to win set (>=5 usually)
      const myGames = score.current_set[k] ?? 0
      const oppGames = score.current_set[team===1?'t2':'t1'] ?? 0
      if (myGames >= 5 && myGames >= oppGames) return team
    }
  }
  return null
}

function isMatchPoint(score: Score): 1|2|null {
  // Super TB: at 9 with lead, or generally at (target-1) with lead.
  const setsToWin = (score.sets_won.t1 + score.sets_won.t2) >= 1 ? 2 : 2
  for (const team of [1,2] as const) {
    const myPts = pts(score, team)
    const target = targetGamePoints(score)
    const k = `t${team}` as 't1'|'t2'
    if (score.super_tiebreak_active) {
      const opp = team===1 ? 't2' : 't1'
      if (score.tiebreak_score[k] >= target - 1 && score.tiebreak_score[k] >= score.tiebreak_score[opp as 't1'|'t2']) return team
    } else {
      // Near set point + one set ahead → match point
      const sp = isSetPoint(score)
      if (sp === team && (score.sets_won[k] ?? 0) >= setsToWin - 1) return team
    }
  }
  return null
}
