import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { applyPoint, INITIAL_SCORE, isBreakPoint } from '@/lib/score-engine'
import { applyPointToStats, applyBreakPointStats, emptyStats } from '@/lib/stats-engine'
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
  const gameChanged =
    scoreAfter.current_set?.t1 !== scoreBefore.current_set?.t1 ||
    scoreAfter.current_set?.t2 !== scoreBefore.current_set?.t2 ||
    (scoreAfter.sets?.length ?? 0) > (scoreBefore.sets?.length ?? 0) ||
    (scoreAfter.super_tiebreak_active && !scoreBefore.super_tiebreak_active)

  if (gameChanged) {
    nextServingTeam = serverTeam === 1 ? 2 : 1
  }

  const matchFinished = scoreAfter.match_status === 'finished'

  const { data: updatedMatch } = await service.from('matches').update({
    score: scoreAfter,
    stats: statsAfter,
    serving_team: nextServingTeam,
    status: matchFinished ? 'finished' : 'in_progress',
    finished_at: matchFinished ? new Date().toISOString() : null,
  }).eq('id', matchId).select('*').single()

  if (match.broadcast_active) {
    triggerBroadcast(matchId, 'point_scored', updatedMatch).catch(() => {})
  }

  return NextResponse.json(updatedMatch)
}

async function triggerBroadcast(matchId: string, event: string, matchData: any) {
  const service = createServiceSupabase()
  const { data: tournament } = await service.from('tournaments')
    .select('broadcast_endpoint, broadcast_api_key, name, sponsors')
    .eq('id', matchData.tournament_id).single()

  if (!tournament?.broadcast_endpoint) return

  const payload = {
    meta: { version: '2.0', event, tournament_id: matchData.tournament_id, match_id: matchId, timestamp: new Date().toISOString() },
    match: { id: matchId, status: matchData.status, score: matchData.score, serving_team: matchData.serving_team },
    stats: matchData.stats,
    tournament: { name: tournament.name, sponsor_logos: tournament.sponsors },
  }

  await fetch(tournament.broadcast_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': tournament.broadcast_api_key ?? '' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000),
  }).catch(() => {})
}
