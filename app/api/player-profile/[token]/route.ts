import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

const PLAYER_SELF_FIELDS = [
  'birth_date', 'birth_city', 'age_manual', 'height_cm',
  'laterality', 'bio', 'social_instagram', 'club',
  'federacion_autonomica', 'photo_url',
]

async function resolveToken(token: string) {
  const service = createServiceSupabase()
  const { data } = await service
    .from('player_invite_tokens')
    .select('id, player_id, expires_at, used_at')
    .eq('token', token)
    .single()
  if (!data) return null
  if (new Date(data.expires_at) < new Date()) return null
  return data
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const service = createServiceSupabase()

  const tokenRow = await resolveToken(token)
  if (!tokenRow) return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 404 })

  const { data: player } = await service.from('players').select('*').eq('id', tokenRow.player_id).single()
  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

  return NextResponse.json({ player, expires_at: tokenRow.expires_at, used_at: tokenRow.used_at })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const service = createServiceSupabase()

  const tokenRow = await resolveToken(token)
  if (!tokenRow) return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 404 })

  const body = await req.json()
  const update: Record<string, unknown> = {}
  for (const key of PLAYER_SELF_FIELDS) {
    if (key in body) update[key] = body[key]
  }

  const { error } = await service.from('players').update(update).eq('id', tokenRow.player_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await service.from('player_invite_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', tokenRow.id)

  return NextResponse.json({ ok: true })
}
