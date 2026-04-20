import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: playerId } = await params
  const supabase = await createServerSupabase()
  const service = createServiceSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await supabase.from('app_users').select('role').eq('id', user.id).single()
  if (!['super_admin', 'tournament_director', 'staff'].includes(appUser?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: player } = await service.from('players').select('id, first_name, last_name').eq('id', playerId).single()
  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

  // Revoke any existing valid token for this player and create a fresh one
  await service.from('player_invite_tokens').delete().eq('player_id', playerId)

  const { data: tokenRow, error } = await service
    .from('player_invite_tokens')
    .insert({ player_id: playerId })
    .select('token, expires_at')
    .single()

  if (error || !tokenRow) return NextResponse.json({ error: 'Could not create token' }, { status: 500 })

  const origin = req.headers.get('origin') ?? req.headers.get('x-forwarded-host') ?? ''
  const base = origin.startsWith('http') ? origin : `https://${origin}`
  const link = `${base}/player-profile/${tokenRow.token}`

  return NextResponse.json({ link, expires_at: tokenRow.expires_at })
}
