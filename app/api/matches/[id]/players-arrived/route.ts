import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { pushBroadcastEvent } from '@/lib/broadcast-push'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = await params
  const supabase = await createServerSupabase()
  const service = createServiceSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: match } = await service.from('matches').select('status,broadcast_active').eq('id', matchId).single()
  if (!match) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  if (match.status !== 'judge_on_court') return NextResponse.json({ error: 'Estado del partido no permite esta acción' }, { status: 400 })

  const { data: updated } = await service.from('matches').update({
    status: 'players_on_court',
    players_on_court_at: new Date().toISOString(),
  }).eq('id', matchId).select('*').single()

  if (match.broadcast_active && updated) {
    pushBroadcastEvent(updated.tournament_id, matchId, 'players_on_court')
  }

  return NextResponse.json(updated)
}
