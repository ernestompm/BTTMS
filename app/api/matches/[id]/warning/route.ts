import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { applyPoint, awardCurrentGame, INITIAL_SCORE } from '@/lib/score-engine'
import { pushBroadcastEvent } from '@/lib/broadcast-push'
import type { MatchWarnings, WarningEntry, WarningType, PenaltyLevel, ScoringSystem, Score } from '@/types'

/**
 * RFET Beach Tennis Code of Conduct (art. 27f-g) implementation.
 *
 * There are TWO separate escalation tracks, per ITF/RFET 2026 rules:
 *
 *   CODE VIOLATIONS (conduct, coaching, equipment_abuse, obscenity, other):
 *     1st offence  → warning
 *     2nd offence  → point penalty
 *     3rd offence  → game penalty
 *     4th+ offence → default (disqualification)
 *
 *   TIME VIOLATIONS (time — 20s between points rule):
 *     1st offence  → warning
 *     2nd+ offence → point penalty (does NOT escalate further)
 *
 * Each track is counted independently per team. `coaching` used to be mapped
 * to instant default in earlier versions — that was wrong: coaching is a
 * regular code violation and only reaches default through the escalation
 * ladder (unless a chair umpire issues an explicit default for severe
 * unsportsmanlike conduct, which is modeled by the `conduct` path too).
 */

const CODE_LADDER: PenaltyLevel[] = ['warning', 'point_penalty', 'game_penalty', 'default']
const TIME_VIOLATION_TYPES: WarningType[] = ['time']

function isTimeViolation(type: WarningType): boolean {
  return TIME_VIOLATION_TYPES.includes(type)
}

function nextPenaltyFor(type: WarningType, teamWarnings: WarningEntry[]): PenaltyLevel {
  if (isTimeViolation(type)) {
    const timeCount = teamWarnings.filter((w) => isTimeViolation(w.type)).length
    return timeCount === 0 ? 'warning' : 'point_penalty'
  }
  const codeCount = teamWarnings.filter((w) => !isTimeViolation(w.type)).length
  return CODE_LADDER[Math.min(codeCount, CODE_LADDER.length - 1)]
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = await params
  const supabase = await createServerSupabase()
  const service = createServiceSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await supabase.from('app_users').select('role').eq('id', user.id).single()
  if (!appUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const team: 1 | 2 = body.team
  const type: WarningType = body.type
  const note: string | undefined = body.note

  if (!team || !type) return NextResponse.json({ error: 'Missing team or type' }, { status: 400 })

  const { data: match } = await service.from('matches').select('*').eq('id', matchId).single()
  if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (appUser.role === 'judge' && match.judge_id !== user.id) {
    return NextResponse.json({ error: 'Not your match' }, { status: 403 })
  }

  const warnings: MatchWarnings = (match.warnings as MatchWarnings) ?? { t1: [], t2: [] }
  const teamKey = team === 1 ? 't1' : 't2'
  const opponentTeam: 1 | 2 = team === 1 ? 2 : 1

  const penalty: PenaltyLevel = nextPenaltyFor(type, warnings[teamKey])

  const entry: WarningEntry = { type, penalty, team, timestamp: new Date().toISOString(), note }
  warnings[teamKey] = [...warnings[teamKey], entry]

  const currentScore: Score = (match.score as Score)
    ?? INITIAL_SCORE((match.scoring_system ?? 'best_of_2_sets_super_tb') as ScoringSystem)

  let scoreUpdate: Partial<{ score: Score; status: string; serving_team: 1 | 2; finished_at: string | null }> = {}
  let penaltyPointsApplied = 0

  if (penalty === 'default') {
    // Immediate disqualification → walkover
    scoreUpdate = { status: 'walkover', finished_at: new Date().toISOString() }
  } else if (penalty === 'point_penalty') {
    const newScore = applyPoint(currentScore, opponentTeam)
    const gameChanged =
      newScore.current_set?.t1 !== currentScore.current_set?.t1 ||
      newScore.current_set?.t2 !== currentScore.current_set?.t2 ||
      (newScore.sets?.length ?? 0) > (currentScore.sets?.length ?? 0)
    const nextServing: 1 | 2 = gameChanged
      ? (match.serving_team === 1 ? 2 : 1)
      : (match.serving_team ?? opponentTeam)
    const matchFinished = newScore.match_status === 'finished'
    scoreUpdate = {
      score: newScore,
      serving_team: nextServing,
      status: matchFinished ? 'finished' : match.status,
      finished_at: matchFinished ? new Date().toISOString() : null,
    }
    penaltyPointsApplied = 1
  } else if (penalty === 'game_penalty') {
    const newScore = awardCurrentGame(currentScore, opponentTeam)
    const matchFinished = newScore.match_status === 'finished'
    scoreUpdate = {
      score: newScore,
      serving_team: (match.serving_team === 1 ? 2 : 1) as 1 | 2,
      status: matchFinished ? 'finished' : match.status,
      finished_at: matchFinished ? new Date().toISOString() : null,
    }
    penaltyPointsApplied = 1  // logged as a single "game awarded" point event
  }

  // Persist in points table for trace/undo consistency
  if (penaltyPointsApplied > 0 && scoreUpdate.score) {
    const { data: maxRow } = await service
      .from('points').select('sequence')
      .eq('match_id', matchId).eq('is_undone', false)
      .order('sequence', { ascending: false }).limit(1).single()
    const sequence = ((maxRow as any)?.sequence ?? 0) + 1
    await service.from('points').insert({
      match_id: matchId, sequence,
      set_number: (currentScore.sets?.length ?? 0) + 1,
      game_number: -1,
      server_team: match.serving_team ?? opponentTeam,
      server_player_id: match.current_server_id,
      winner_team: opponentTeam, winner_player_id: null,
      point_type: 'correction',
      shot_direction: null, fault_type: null,
      is_break_point: false, is_game_point: false,
      is_set_point: false, is_match_point: false,
      was_break_point_saved: false,
      score_before: currentScore, score_after: scoreUpdate.score,
      stats_after: match.stats, judge_id: user.id, is_undone: false,
    })
  }

  const { data: updatedMatch } = await service
    .from('matches')
    .update({ warnings, ...scoreUpdate })
    .eq('id', matchId)
    .select('*')
    .single()

  if (match.broadcast_active && updatedMatch) {
    pushBroadcastEvent(updatedMatch.tournament_id, matchId, 'warning_issued', {
      team, type, penalty, offender: team,
    })
  }

  return NextResponse.json(updatedMatch)
}
