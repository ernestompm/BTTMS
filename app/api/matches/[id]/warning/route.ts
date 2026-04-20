import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { applyPoint, INITIAL_SCORE } from '@/lib/score-engine'
import type { MatchWarnings, WarningEntry, WarningType, PenaltyLevel, ScoringSystem, Score } from '@/types'

const PENALTY_LEVELS: PenaltyLevel[] = ['warning', 'point_penalty', 'game_penalty', 'default']

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

  if (!team || !type) return NextResponse.json({ error: 'Missing team or type' }, { status: 400 })

  const { data: match } = await service.from('matches').select('*').eq('id', matchId).single()
  if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (appUser.role === 'judge' && match.judge_id !== user.id) {
    return NextResponse.json({ error: 'Not your match' }, { status: 403 })
  }

  const warnings: MatchWarnings = (match.warnings as MatchWarnings) ?? { t1: [], t2: [] }
  const teamKey = team === 1 ? 't1' : 't2'
  const opponentTeam: 1 | 2 = team === 1 ? 2 : 1
  const existingCount = warnings[teamKey].length

  // Coaching → immediate disqualification; others escalate per count
  const penalty: PenaltyLevel = type === 'coaching'
    ? 'default'
    : PENALTY_LEVELS[Math.min(existingCount, 3)]

  const entry: WarningEntry = { type, penalty, team, timestamp: new Date().toISOString() }
  warnings[teamKey] = [...warnings[teamKey], entry]

  let scoreUpdate: Partial<{ score: Score; status: string; serving_team: 1 | 2; finished_at: string | null }> = {}
  const currentScore: Score = (match.score as Score) ?? INITIAL_SCORE((match.scoring_system ?? 'best_of_2_sets_super_tb') as ScoringSystem)

  if (penalty === 'default') {
    scoreUpdate = { status: 'walkover', finished_at: new Date().toISOString() }
  } else if (penalty === 'point_penalty') {
    const newScore = applyPoint(currentScore, opponentTeam)
    const gameChanged =
      newScore.current_set?.t1 !== currentScore.current_set?.t1 ||
      newScore.current_set?.t2 !== currentScore.current_set?.t2 ||
      (newScore.sets?.length ?? 0) > (currentScore.sets?.length ?? 0)
    const nextServing: 1 | 2 = gameChanged ? (match.serving_team === 1 ? 2 : 1) : (match.serving_team ?? opponentTeam)
    const matchFinished = newScore.match_status === 'finished'
    scoreUpdate = {
      score: newScore,
      serving_team: nextServing,
      status: matchFinished ? 'finished' : match.status,
      finished_at: matchFinished ? new Date().toISOString() : null,
    }
  } else if (penalty === 'game_penalty') {
    // Award a full game to opponent by advancing score until current_set changes
    let tempScore = currentScore
    const prevSet = { t1: currentScore.current_set?.t1 ?? 0, t2: currentScore.current_set?.t2 ?? 0 }
    const prevSetsLen = currentScore.sets?.length ?? 0
    for (let i = 0; i < 12; i++) {
      tempScore = applyPoint(tempScore, opponentTeam)
      const newSet = { t1: tempScore.current_set?.t1 ?? 0, t2: tempScore.current_set?.t2 ?? 0 }
      if (
        newSet.t1 !== prevSet.t1 || newSet.t2 !== prevSet.t2 ||
        (tempScore.sets?.length ?? 0) > prevSetsLen ||
        tempScore.match_status === 'finished'
      ) break
    }
    const matchFinished = tempScore.match_status === 'finished'
    scoreUpdate = {
      score: tempScore,
      serving_team: (match.serving_team === 1 ? 2 : 1) as 1 | 2,
      status: matchFinished ? 'finished' : match.status,
      finished_at: matchFinished ? new Date().toISOString() : null,
    }
  }

  const { data: updatedMatch } = await service
    .from('matches')
    .update({ warnings, ...scoreUpdate })
    .eq('id', matchId)
    .select('*')
    .single()

  return NextResponse.json(updatedMatch)
}
