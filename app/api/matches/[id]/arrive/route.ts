import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

function isValidFullName(name: string | null | undefined): boolean {
  if (!name) return false
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.length >= 2 && parts.every(p => p.length >= 2)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = await params
  const supabase = await createServerSupabase()
  const service = createServiceSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { judge_name?: string }
  const judgeName = (body?.judge_name ?? '').trim()
  if (!isValidFullName(judgeName)) {
    return NextResponse.json({ error: 'Nombre y apellidos obligatorios (mínimo 2 palabras de 2+ caracteres)' }, { status: 400 })
  }

  const { data: match } = await service.from('matches').select('status,judge_id').eq('id', matchId).single()
  if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (match.status !== 'scheduled') return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

  const { data: updated } = await service.from('matches').update({
    status: 'judge_on_court',
    judge_on_court_at: new Date().toISOString(),
    judge_name: judgeName,
  }).eq('id', matchId).select('*').single()

  return NextResponse.json(updated)
}
