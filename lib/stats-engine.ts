import type { MatchStats, TeamStats, PointType, ShotDirection, Score } from '@/types'
import { DEFAULT_TEAM_STATS } from '@/types'

function pct(won: number, total: number): number {
  if (total === 0) return 0
  return Math.round((won / total) * 1000) / 10
}

export function emptyStats(): MatchStats {
  return {
    t1: { ...DEFAULT_TEAM_STATS },
    t2: { ...DEFAULT_TEAM_STATS },
  }
}

export interface PointInput {
  winnerTeam: 1 | 2
  serverTeam: 1 | 2
  pointType: PointType
  shotDirection: ShotDirection | null
  scoreBefore: Score
}

export function applyPointToStats(prevStats: MatchStats, input: PointInput): MatchStats {
  const s = JSON.parse(JSON.stringify(prevStats)) as MatchStats
  const { winnerTeam, serverTeam, pointType, shotDirection, scoreBefore } = input
  const loserTeam: 1 | 2 = winnerTeam === 1 ? 2 : 1
  const wKey = `t${winnerTeam}` as 't1' | 't2'
  const lKey = `t${loserTeam}` as 't1' | 't2'
  const restingTeam: 1 | 2 = serverTeam === 1 ? 2 : 1
  const sKey = `t${serverTeam}` as 't1' | 't2'
  const rKey = `t${restingTeam}` as 't1' | 't2'

  // Total points tracking
  s.t1.total_points_played++
  s.t2.total_points_played++
  s[wKey].total_points_won++

  // Service stats
  s[sKey].serve_points_played++
  s[rKey].return_points_played++

  if (winnerTeam === serverTeam) {
    s[sKey].serve_points_won++
  } else {
    s[rKey].return_points_won++
  }

  // Point type breakdown
  switch (pointType) {
    case 'ace':
      s[wKey].aces++
      s[wKey].winners++
      break
    case 'serve_fault':
      s[lKey].serve_faults++
      break
    case 'double_fault':
      s[lKey].double_faults++
      break
    case 'winner':
      s[wKey].winners++
      if (shotDirection === 'forehand') s[wKey].winners_forehand++
      else if (shotDirection === 'backhand') s[wKey].winners_backhand++
      else if (shotDirection === 'volley_fh' || shotDirection === 'volley_bh') s[wKey].winners_volley++
      else if (shotDirection === 'overhead') s[wKey].winners_overhead++
      // second shot (return winner)
      if (winnerTeam !== serverTeam) s[wKey].second_shot_points_won++
      break
    case 'unforced_error':
      if (shotDirection === 'forehand') s[lKey].unforced_errors_forehand++
      else if (shotDirection === 'backhand') s[lKey].unforced_errors_backhand++
      else if (shotDirection === 'volley_fh' || shotDirection === 'volley_bh') s[lKey].unforced_errors_volley++
      s[lKey].unforced_errors++
      break
    case 'forced_error':
      s[wKey].forced_errors_caused++
      break
  }

  // Critical points tracking (based on score BEFORE the point)
  const isBreak = scoreBefore.sets_won !== undefined // simplified check
  // (Full implementation would call isBreakPoint/isGamePoint/isSetPoint/isMatchPoint)

  // Update percentages
  s.t1.serve_points_won_pct = pct(s.t1.serve_points_won, s.t1.serve_points_played)
  s.t2.serve_points_won_pct = pct(s.t2.serve_points_won, s.t2.serve_points_played)
  s.t1.return_points_won_pct = pct(s.t1.return_points_won, s.t1.return_points_played)
  s.t2.return_points_won_pct = pct(s.t2.return_points_won, s.t2.return_points_played)
  s.t1.total_points_won_pct = pct(s.t1.total_points_won, s.t1.total_points_played)
  s.t2.total_points_won_pct = pct(s.t2.total_points_won, s.t2.total_points_played)

  // Streaks
  if (winnerTeam === 1) {
    s.t1.current_points_streak = (s.t1.current_points_streak || 0) + 1
    s.t2.current_points_streak = 0
    s.t1.max_points_streak = Math.max(s.t1.max_points_streak, s.t1.current_points_streak)
  } else {
    s.t2.current_points_streak = (s.t2.current_points_streak || 0) + 1
    s.t1.current_points_streak = 0
    s.t2.max_points_streak = Math.max(s.t2.max_points_streak, s.t2.current_points_streak)
  }

  return s
}

export function applyBreakPointStats(
  stats: MatchStats,
  serverTeam: 1 | 2,
  wasBreakPoint: boolean,
  winnerTeam: 1 | 2
): MatchStats {
  if (!wasBreakPoint) return stats
  const s = JSON.parse(JSON.stringify(stats)) as MatchStats
  const serverKey = `t${serverTeam}` as 't1' | 't2'
  const returnerKey = `t${serverTeam === 1 ? 2 : 1}` as 't1' | 't2'

  s[returnerKey].break_points_played_on_return++
  s[serverKey].break_points_faced++

  if (winnerTeam !== serverTeam) {
    // Break converted
    s[returnerKey].break_points_won++
    s[returnerKey].break_points_won_pct = pct(s[returnerKey].break_points_won, s[returnerKey].break_points_played_on_return)
  } else {
    // Break saved
    s[serverKey].break_points_saved++
    s[serverKey].break_points_saved_pct = pct(s[serverKey].break_points_saved, s[serverKey].break_points_faced)
  }
  return s
}
