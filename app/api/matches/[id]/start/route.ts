import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { INITIAL_SCORE } from '@/lib/score-engine'
import { emptyStats } from '@/lib/stats-engine'
import type { ScoringSystem } from '@/types'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = await params
  const supabase = await createServerSupabase()
  const service = createServiceSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await service.from('app_users').select('role').eq('id', user.id).single()
  if (!appUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: match } = await service.from('matches').select('*').eq('id', matchId).single()
  if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (appUser.role === 'judge' && match.judge_id !== user.id) {
    return NextResponse.json({ error: 'Not your match' }, { status: 403 })
  }

  const body = await req.json()
  const { toss_winner, toss_choice, serving_team, side_entry1, current_server_id } = body

  // Judge can override scoring system at match start; otherwise use the value stored on the match
  const system = (body.scoring_system ?? match.scoring_system ?? 'best_of_2_sets_super_tb') as ScoringSystem
  const initialScore = INITIAL_SCORE(system)
  const initialStats = emptyStats()

  const { data: updatedMatch } = await service.from('matches').update({
    status: 'in_progress',
    started_at: new Date().toISOString(),
    toss_winner: toss_winner ?? null,
    toss_choice: toss_choice ?? null,
    serving_team: serving_team ?? 1,
    side_entry1: side_entry1 ?? 'near',
    current_server_id: current_server_id ?? null,
    scoring_system: system,
    score: initialScore,
    stats: initialStats,
  }).eq('id', matchId).select('*').single()

  return NextResponse.json(updatedMatch)
}
