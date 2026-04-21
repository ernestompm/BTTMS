import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { pushBroadcastEvent } from '@/lib/broadcast-push'

const MAX_SIGNATURE_BYTES = 200_000  // ~150 KB of base64 → plenty for a PNG signature
const MAX_NOTES_LENGTH = 2000

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

  // Body is optional: legacy calls with no body still close the match.
  // New calls include signature_data_url + notes when the chair umpire signs.
  let signatureDataUrl: string | null = null
  let notes: string | null = null
  try {
    const text = await req.text()
    if (text) {
      const body = JSON.parse(text) as { signature_data_url?: string; notes?: string }
      if (typeof body?.signature_data_url === 'string' && body.signature_data_url.startsWith('data:image/')) {
        if (body.signature_data_url.length > MAX_SIGNATURE_BYTES) {
          return NextResponse.json({ error: 'signature too large' }, { status: 413 })
        }
        signatureDataUrl = body.signature_data_url
      }
      if (typeof body?.notes === 'string') notes = body.notes.slice(0, MAX_NOTES_LENGTH)
    }
  } catch {}

  const update: Record<string, any> = {
    status: 'finished',
    finished_at: match.finished_at ?? new Date().toISOString(),
    broadcast_active: false,
  }
  if (signatureDataUrl) {
    update.judge_signature_url = signatureDataUrl
    update.signed_at = new Date().toISOString()
    update.signed_by = user.id
  }
  if (notes !== null) update.judge_notes = notes

  const { data: updatedMatch } = await service.from('matches').update(update)
    .eq('id', matchId).select('*').single()

  if (updatedMatch) {
    pushBroadcastEvent(updatedMatch.tournament_id, matchId, 'match_finished')
  }

  return NextResponse.json(updatedMatch)
}
