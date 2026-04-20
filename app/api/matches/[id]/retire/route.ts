import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = await params
  const supabase = await createServerSupabase()
  const service = createServiceSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await service.from('app_users').select('role').eq('id', user.id).single()
  if (!appUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: match } = await service.from('matches').select('status,judge_id').eq('id', matchId).single()
  if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (appUser.role === 'judge' && match.judge_id !== user.id) {
    return NextResponse.json({ error: 'Not your match' }, { status: 403 })
  }

  const validStatuses = ['in_progress', 'warmup', 'players_on_court', 'judge_on_court']
  if (!validStatuses.includes(match.status)) {
    return NextResponse.json({ error: 'Cannot retire a match in this state' }, { status: 400 })
  }

  const { team, reason } = await req.json()
  if (team !== 1 && team !== 2) return NextResponse.json({ error: 'Invalid team' }, { status: 400 })

  const { data: updated } = await service.from('matches').update({
    status: 'retired',
    retired_team: team,
    retire_reason: reason ?? null,
    finished_at: new Date().toISOString(),
  }).eq('id', matchId).select('*').single()

  return NextResponse.json(updated)
}
