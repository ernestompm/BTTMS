import { NextRequest } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { checkStreamApiKey, jsonError } from '../_auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/stream/:matchId/state
 * Devuelve { graphics, preview_graphics, updated_at, session_id }.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
  const auth = checkStreamApiKey(req); if (!auth.ok) return jsonError(auth.message, auth.status)
  const { matchId } = await params
  const svc = createServiceSupabase()
  const { data: session } = await svc.from('stream_sessions').select('id').eq('match_id', matchId).single()
  if (!session) return jsonError('No stream session for match', 404)
  const { data: state, error } = await svc.from('stream_state')
    .select('session_id, graphics, preview_graphics, updated_at')
    .eq('session_id', session.id).single()
  if (error) return jsonError(error.message, 500)
  return Response.json({ ok: true, ...state })
}
