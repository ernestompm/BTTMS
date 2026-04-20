import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { applyPoint, INITIAL_SCORE } from '@/lib/score-engine'
import { applyPointToStats, emptyStats } from '@/lib/stats-engine'
import type { Score, PointType, ShotDirection, ScoringSystem } from '@/types'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = await params
  const supabase = await createServerSupabase()
  const service = createServiceSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await supabase.from('app_users').select('role').eq('id', user.id).single()
  if (!appUser) return NextResponse.json({ error: 'User not found' }, { status: 403 })

  // Fetch current match
  const { data: match } = await service.from('matches').select('*').eq('id', matchId).single()
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  if (match.status !== 'in_progress') return NextResponse.json({ error: 'Match is not in progress' }, { status: 400 })

  // Judge can only score their assigned match
  if (appUser.role === 'judge' && match.judge_id !== user.id) {
    return NextResponse.json({ error: 'Not your match' }, { status: 403 })
  }

  const body = await req.json()
  const { winner_team, point_type, shot_direction }: { winner_team: 1|2; point_type: PointType; shot_direction: ShotDirection|null } = body

  if (!winner_team || !point_type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const scoreBefore: Score = match.score ?? INITIAL_SCORE((match.scoring_system ?? 'best_of_2_sets_super_tb') as ScoringSystem)
  const scoreAfter = applyPoint(scoreBefore, winner_team)

  // Update stats
  const statsBefore = match.stats ?? emptyStats()
  const statsAfter = applyPointToStats(statsBefore, {
    winnerTeam: winner_team,
    serverTeam: match.serving_team ?? winner_team,
    pointType: point_type,
    shotDirection: shot_direction,
    scoreBefore,
  })

  // Get sequence number
  const { count } = await service.from('points').select('*', { count: 'exact', head: true }).eq('match_id', matchId).eq('is_undone', false)
  const sequence = (count ?? 0) + 1

  // Insert point log
  await service.from('points').insert({
    match_id: matchId,
    sequence,
    set_number: (scoreBefore.sets?.length ?? 0) + 1,
    game_number: (scoreBefore.current_set?.t1 ?? 0) + (scoreBefore.current_set?.t2 ?? 0) + 1,
    server_team: match.serving_team ?? winner_team,
    server_player_id: match.current_server_id,
    winner_team,
    winner_player_id: null,
    point_type,
    shot_direction: shot_direction ?? null,
    fault_type: null,
    is_break_point: false,
    is_game_point: false,
    is_set_point: false,
    is_match_point: false,
    was_break_point_saved: false,
    score_before: scoreBefore,
    score_after: scoreAfter,
    judge_id: user.id,
    is_undone: false,
  })

  // Determine next serving team (alternates on odd-numbered games in TB)
  let nextServingTeam = match.serving_team
  const prevSet = scoreBefore.current_set
  const newSet = scoreAfter.current_set
  const gameChanged = newSet.t1 !== prevSet.t1 || newSet.t2 !== prevSet.t2 ||
    (scoreAfter.sets?.length ?? 0) > (scoreBefore.sets?.length ?? 0)

  if (gameChanged && nextServingTeam) {
    nextServingTeam = nextServingTeam === 1 ? 2 : 1
  }

  const matchFinished = scoreAfter.match_status === 'finished'

  // Update match
  const { data: updatedMatch } = await service.from('matches').update({
    score: scoreAfter,
    stats: statsAfter,
    serving_team: nextServingTeam,
    status: matchFinished ? 'finished' : 'in_progress',
    finished_at: matchFinished ? new Date().toISOString() : null,
  }).eq('id', matchId).select('*').single()

  // Trigger broadcast if active
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
