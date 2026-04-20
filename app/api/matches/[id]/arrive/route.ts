import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = await params
  const supabase = await createServerSupabase()
  const service = createServiceSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: match } = await service.from('matches').select('status,judge_id').eq('id', matchId).single()
  if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (match.status !== 'scheduled') return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

  const { data: updated } = await service.from('matches').update({
    status: 'judge_on_court',
    judge_on_court_at: new Date().toISOString(),
  }).eq('id', matchId).select('*').single()

  return NextResponse.json(updated)
}
