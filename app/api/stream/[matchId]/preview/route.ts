import { NextRequest } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { checkStreamApiKey, jsonError } from '../_auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/stream/:matchId/preview
 * Body: { "key": "<graphic_key>", "data"?: <any> }
 * Carga gráfico en PREVIEW (se ve en /overlay/:matchId/preview).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
  const auth = checkStreamApiKey(req); if (!auth.ok) return jsonError(auth.message, auth.status)
  const { matchId } = await params
  const body = await req.json().catch(() => null) as { key?: string, data?: any } | null
  if (!body?.key) return jsonError('Missing "key"')

  const svc = createServiceSupabase()
  const { data: session } = await svc.from('stream_sessions').select('id').eq('match_id', matchId).single()
  if (!session) return jsonError('No stream session for match', 404)

  const { error } = await svc.rpc('stream_patch_preview', {
    p_session_id: session.id, p_key: body.key, p_patch: { visible: true, data: body.data ?? null },
  })
  if (error) return jsonError(error.message, 500)
  await svc.from('stream_events').insert({ session_id: session.id, kind: 'api_preview', graphic: body.key, payload: { data: body.data ?? null } })
  return Response.json({ ok: true })
}

/**
 * DELETE /api/stream/:matchId/preview
 * Vacía preview.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
  const auth = checkStreamApiKey(req); if (!auth.ok) return jsonError(auth.message, auth.status)
  const { matchId } = await params
  const svc = createServiceSupabase()
  const { data: session } = await svc.from('stream_sessions').select('id').eq('match_id', matchId).single()
  if (!session) return jsonError('No stream session for match', 404)
  const { error } = await svc.rpc('stream_clear_preview', { p_session_id: session.id })
  if (error) return jsonError(error.message, 500)
  await svc.from('stream_events').insert({ session_id: session.id, kind: 'api_preview_clear', graphic: null })
  return Response.json({ ok: true })
}
