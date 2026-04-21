import { NextRequest } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { checkStreamApiKey, jsonError } from '../_auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/stream/:matchId/hide
 * Body: { "key": "<graphic_key>" }
 * Oculta gráfico en PROGRAMA.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
  const auth = checkStreamApiKey(req); if (!auth.ok) return jsonError(auth.message, auth.status)
  const { matchId } = await params
  const body = await req.json().catch(() => null) as { key?: string } | null
  if (!body?.key) return jsonError('Missing "key"')

  const svc = createServiceSupabase()
  const { data: session } = await svc.from('stream_sessions').select('id').eq('match_id', matchId).single()
  if (!session) return jsonError('No stream session for match', 404)

  const { error } = await svc.rpc('stream_patch_graphic', {
    p_session_id: session.id, p_key: body.key, p_patch: { visible: false },
  })
  if (error) return jsonError(error.message, 500)
  await svc.from('stream_events').insert({ session_id: session.id, kind: 'api_hide', graphic: body.key })
  return Response.json({ ok: true })
}
