import { NextRequest } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { checkStreamApiKey, jsonError } from '../_auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/stream/:matchId/stop
 * STOP: oculta todos los gráficos de programa Y limpia preview.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
  const auth = checkStreamApiKey(req); if (!auth.ok) return jsonError(auth.message, auth.status)
  const { matchId } = await params
  const svc = createServiceSupabase()
  const { data: session } = await svc.from('stream_sessions').select('id').eq('match_id', matchId).single()
  if (!session) return jsonError('No stream session for match', 404)
  const [a, b] = await Promise.all([
    svc.rpc('stream_hide_all',      { p_session_id: session.id }),
    svc.rpc('stream_clear_preview', { p_session_id: session.id }),
  ])
  if (a.error) return jsonError(a.error.message, 500)
  if (b.error) return jsonError(b.error.message, 500)
  await svc.from('stream_events').insert({ session_id: session.id, kind: 'api_stop', graphic: null })
  return Response.json({ ok: true })
}
