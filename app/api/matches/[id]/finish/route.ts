import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { pushBroadcastEvent } from '@/lib/broadcast-push'

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

  const { data: updatedMatch } = await service.from('matches').update({
    status: 'finished',
    finished_at: new Date().toISOString(),
    broadcast_active: false,
  }).eq('id', matchId).select('*').single()

  if (updatedMatch) {
    pushBroadcastEvent(updatedMatch.tournament_id, matchId, 'match_finished')
  }

  return NextResponse.json(updatedMatch)
}
