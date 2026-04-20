import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = await params
  const supabase = await createServerSupabase()
  const service = createServiceSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await supabase.from('app_users').select('role').eq('id', user.id).single()
  if (!appUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: match } = await service.from('matches').select('*').eq('id', matchId).single()
  if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (appUser.role === 'judge' && match.judge_id !== user.id) {
    return NextResponse.json({ error: 'Not your match' }, { status: 403 })
  }

  // Find last non-undone point
  const { data: lastPoint } = await service.from('points')
    .select('*').eq('match_id', matchId).eq('is_undone', false)
    .order('sequence', { ascending: false }).limit(1).single()

  if (!lastPoint) return NextResponse.json({ error: 'No points to undo' }, { status: 400 })

  // Mark as undone (append-only rule prevents delete)
  await service.from('points').update({ is_undone: true }).eq('id', lastPoint.id)

  // Restore score and stats from score_before
  const { data: prevPoint } = await service.from('points')
    .select('*').eq('match_id', matchId).eq('is_undone', false)
    .order('sequence', { ascending: false }).limit(1).single()

  const restoredScore = prevPoint ? prevPoint.score_after : lastPoint.score_before

  const { data: updatedMatch } = await service.from('matches').update({
    score: restoredScore,
    serving_team: restoredScore.serving_team ?? match.serving_team,
    status: 'in_progress',
    finished_at: null,
  }).eq('id', matchId).select('*').single()

  return NextResponse.json(updatedMatch)
}
