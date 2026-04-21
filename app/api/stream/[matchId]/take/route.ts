import { NextRequest } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { checkStreamApiKey, jsonError } from '../_auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/stream/:matchId/take
 * TAKE atómico: todas las visibles de preview → programa, y limpia preview.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
  const auth = checkStreamApiKey(req); if (!auth.ok) return jsonError(auth.message, auth.status)
  const { matchId } = await params
  const svc = createServiceSupabase()
  const { data: session } = await svc.from('stream_sessions').select('id').eq('match_id', matchId).single()
  if (!session) return jsonError('No stream session for match', 404)
  const { error } = await svc.rpc('stream_take_preview', { p_session_id: session.id })
  if (error) return jsonError(error.message, 500)
  await svc.from('stream_events').insert({ session_id: session.id, kind: 'api_take', graphic: null })
  return Response.json({ ok: true })
}
