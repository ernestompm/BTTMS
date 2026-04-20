import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const service = createServiceSupabase()

  const { data: draw, error: drawError } = await service
    .from('draws')
    .select('*, entries:draw_entries(*, player1:players!player1_id(id,first_name,last_name,nationality,ranking_rfet), player2:players!player2_id(id,first_name,last_name,nationality,ranking_rfet))')
    .eq('id', id)
    .single()

  if (drawError || !draw) {
    return NextResponse.json({ error: 'Draw not found' }, { status: 404 })
  }

  const { data: matches } = await service
    .from('matches')
    .select('id, round, match_number, status, score, serving_team, entry1_id, entry2_id, scheduled_at, started_at, finished_at')
    .eq('draw_id', id)
    .order('match_number')

  return NextResponse.json({ draw, matches: matches ?? [] })
}
