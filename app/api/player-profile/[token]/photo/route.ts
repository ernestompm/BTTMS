import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const service = createServiceSupabase()

  // Validate token
  const { data: tokenRow } = await service
    .from('player_invite_tokens')
    .select('id, player_id, expires_at')
    .eq('token', token)
    .single()

  if (!tokenRow || new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 404 })
  }

  const formData = await req.formData()
  const file = formData.get('photo') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${tokenRow.player_id}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await service.storage
    .from('player-photos')
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = service.storage.from('player-photos').getPublicUrl(path)

  // Cache-bust the URL so the browser doesn't show the old photo
  const url = `${publicUrl}?t=${Date.now()}`
  return NextResponse.json({ url })
}
