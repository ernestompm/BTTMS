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

  // Mark as undone (append-only; if rule is still active this silently no-ops — user should apply 005_fixes.sql)
  await service.from('points').update({ is_undone: true }).eq('id', lastPoint.id)

  // After undoing, find the new "last" point to restore state from
  const { data: prevPoint } = await service.from('points')
    .select('*').eq('match_id', matchId).eq('is_undone', false)
    .order('sequence', { ascending: false }).limit(1).single()

  // Restore score: if there's still a prior point, use its score_after; otherwise use score_before of the undone point
  const restoredScore = prevPoint ? prevPoint.score_after : lastPoint.score_before

  // Restore stats from the per-point snapshot (stats_after added in migration 007)
  const restoredStats = prevPoint ? (prevPoint as any).stats_after : null

  // Restore serving_team from the server_team recorded on the undone point
  const restoredServingTeam = lastPoint.server_team ?? match.serving_team

  // Only restore status to 'in_progress' if the match was 'finished' (don't reopen suspended/walkover)
  const restoredStatus = match.status === 'finished' ? 'in_progress' : match.status

  const { data: updatedMatch } = await service.from('matches').update({
    score: restoredScore,
    stats: restoredStats,
    serving_team: restoredServingTeam,
    status: restoredStatus,
    finished_at: restoredStatus === 'in_progress' ? null : match.finished_at,
  }).eq('id', matchId).select('*').single()

  return NextResponse.json(updatedMatch)
}
