import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { applyPoint, INITIAL_SCORE, isBreakPoint, isSetPoint, isMatchPoint, isTBSideChange, isSuperTBSideChange } from '@/lib/score-engine'
import { applyPointToStats, applyBreakPointStats, emptyStats } from '@/lib/stats-engine'
import { pushBroadcastEvent } from '@/lib/broadcast-push'
import { advanceWinnerToNextRound } from '@/lib/bracket-advance'
import type { Score, PointType, ShotDirection, ScoringSystem } from '@/types'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = await params
  const supabase = await createServerSupabase()
  const service = createServiceSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await supabase.from('app_users').select('role').eq('id', user.id).single()
  if (!appUser) return NextResponse.json({ error: 'User not found' }, { status: 403 })

  const { data: match } = await service.from('matches').select('*').eq('id', matchId).single()
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  if (match.status !== 'in_progress') return NextResponse.json({ error: 'Match is not in progress' }, { status: 400 })

  if (appUser.role === 'judge' && match.judge_id !== user.id) {
    return NextResponse.json({ error: 'Not your match' }, { status: 403 })
  }

  const body = await req.json()
  const { winner_team, point_type, shot_direction }: {
    winner_team: 1 | 2; point_type: PointType; shot_direction: ShotDirection | null
  } = body

  if (!winner_team || !point_type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const scoreBefore: Score = match.score ?? INITIAL_SCORE((match.scoring_system ?? 'best_of_2_sets_super_tb') as ScoringSystem)
  const serverTeam: 1 | 2 = match.serving_team ?? winner_team

  // Check break point BEFORE applying the point
  const wasBreakPoint = isBreakPoint(scoreBefore, serverTeam)

  const scoreAfter = applyPoint(scoreBefore, winner_team)

  // Update stats
  let statsAfter = applyPointToStats(match.stats ?? emptyStats(), {
    winnerTeam: winner_team,
    serverTeam,
    pointType: point_type,
    shotDirection: shot_direction,
    scoreBefore,
  })

  // Wire break point stats
  if (wasBreakPoint) {
    statsAfter = applyBreakPointStats(statsAfter, serverTeam, true, winner_team)
  }

  // Sequence: use MAX to be more reliable than COUNT under concurrent writes
  const { data: maxRow } = await service
    .from('points')
    .select('sequence')
    .eq('match_id', matchId)
    .eq('is_undone', false)
    .order('sequence', { ascending: false })
    .limit(1)
    .single()

  const sequence = ((maxRow as any)?.sequence ?? 0) + 1

  // Derive set/game context for the point log
  const setNumber = (scoreBefore.sets?.length ?? 0) + 1
  const isTB = scoreBefore.tiebreak_active || scoreBefore.super_tiebreak_active
  const gameNumber = isTB
    ? -1  // tiebreak points are not numbered like regular games
    : (scoreBefore.current_set?.t1 ?? 0) + (scoreBefore.current_set?.t2 ?? 0) + 1

  await service.from('points').insert({
    match_id: matchId,
    sequence,
    set_number: setNumber,
    game_number: gameNumber,
    server_team: serverTeam,
    server_player_id: match.current_server_id,
    winner_team,
    winner_player_id: null,
    point_type,
    shot_direction: shot_direction ?? null,
    fault_type: null,
    is_break_point: wasBreakPoint,
    is_game_point: false,
    is_set_point: false,
    is_match_point: false,
    was_break_point_saved: wasBreakPoint && winner_team === serverTeam,
    score_before: scoreBefore,
    score_after: scoreAfter,
    stats_after: statsAfter,
    judge_id: user.id,
    is_undone: false,
  })

  // Determine next serving team (alternates on game change)
  let nextServingTeam: 1 | 2 = serverTeam
  const setChanged = (scoreAfter.sets?.length ?? 0) > (scoreBefore.sets?.length ?? 0)
  const gameChanged =
    scoreAfter.current_set?.t1 !== scoreBefore.current_set?.t1 ||
    scoreAfter.current_set?.t2 !== scoreBefore.current_set?.t2 ||
    setChanged ||
    (scoreAfter.super_tiebreak_active && !scoreBefore.super_tiebreak_active)

  if (gameChanged) {
    nextServingTeam = serverTeam === 1 ? 2 : 1
  }

  const matchFinished = scoreAfter.match_status === 'finished'

  // --- Build _context for judge notifications and broadcast ---
  let sideChange = false
  if (setChanged) {
    sideChange = true
  } else if (scoreAfter.tiebreak_active) {
    sideChange = isTBSideChange(scoreAfter.tiebreak_score)
  } else if (scoreAfter.super_tiebreak_active) {
    sideChange = isSuperTBSideChange(scoreAfter.tiebreak_score)
  } else if (gameChanged) {
    const totalGamesAfter = (scoreAfter.current_set?.t1 ?? 0) + (scoreAfter.current_set?.t2 ?? 0)
    sideChange = totalGamesAfter % 2 === 1
  }

  const notFinished = !matchFinished
  const _context = {
    golden_point:         notFinished && (scoreAfter.deuce === true),
    break_point:          notFinished && isBreakPoint(scoreAfter, nextServingTeam),
    set_point_t1:         notFinished && isSetPoint(scoreAfter, 1),
    set_point_t2:         notFinished && isSetPoint(scoreAfter, 2),
    match_point_t1:       isMatchPoint(scoreAfter, 1),
    match_point_t2:       isMatchPoint(scoreAfter, 2),
    serving_team_changed: gameChanged,
    new_serving_team:     nextServingTeam,
    side_change:          sideChange,
    new_set:              setChanged,
    new_tb:               scoreAfter.tiebreak_active && !scoreBefore.tiebreak_active,
    new_super_tb:         scoreAfter.super_tiebreak_active && !scoreBefore.super_tiebreak_active,
    match_finished:       matchFinished,
  }

  const { data: updatedMatch } = await service.from('matches').update({
    score: scoreAfter,
    stats: statsAfter,
    serving_team: nextServingTeam,
    status: matchFinished ? 'finished' : 'in_progress',
    finished_at: matchFinished ? new Date().toISOString() : null,
  }).eq('id', matchId).select('*').single()

  if (match.broadcast_active && updatedMatch) {
    const eventName = matchFinished ? 'match_finished' : 'point_scored'
    pushBroadcastEvent(updatedMatch.tournament_id, matchId, eventName, _context)
  }

  // Auto-advance del ganador al siguiente partido del cuadro cuando este
  // punto cierra el match (independiente del trigger SQL 018).
  if (matchFinished && updatedMatch) {
    try { await advanceWinnerToNextRound(service, matchId) } catch (e) { console.error('advance failed', e) }
  }

  return NextResponse.json({ ...updatedMatch, _context })
}
