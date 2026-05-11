import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { requireAuth, requireStaff } from '@/lib/auth-helpers'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // GDPR: bio + club + federación son datos personales — exige login.
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const service = createServiceSupabase()
  const { data, error } = await service.from('players').select('*').eq('id', id).single()
  if (error || !data) return NextResponse.json({ error: 'Jugador no encontrado' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const service = createServiceSupabase()
  const body = await req.json()
  const { data, error } = await service.from('players').update(body).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
