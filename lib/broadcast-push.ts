import { createServiceSupabase } from './supabase-server'
import { buildBroadcastPayload } from './broadcast-payload'

/**
 * Fire-and-forget push to the tournament's configured broadcast endpoint.
 *
 * Called from point / warning / retire / finish routes after the DB has been
 * updated. The payload is the canonical one produced by
 * `/api/broadcast/export`, with an added `event` field so consumers (vMix,
 * CasparCG, OBS) can route/animate graphics based on what just happened.
 *
 * Fails silently — broadcast must never block match scoring.
 */
export async function pushBroadcastEvent(
  tournamentId: string,
  matchId: string,
  event: string,
  extraContext?: Record<string, unknown>
): Promise<void> {
  try {
    const service = createServiceSupabase()
    // Select * so we don't 400 on installs where migration 013 hasn't run
    const { data: tournament } = await service
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single()
    if (!tournament?.broadcast_endpoint) return

    const payload = await buildBroadcastPayload(tournamentId, matchId)
    if (!payload) return

    const method: 'POST' | 'PUT' =
      ((tournament as any).broadcast_method === 'PUT' ? 'PUT' : 'POST')
    const customHeaders: Record<string, string> =
      (tournament as any).broadcast_headers && typeof (tournament as any).broadcast_headers === 'object'
        ? (tournament as any).broadcast_headers
        : {}

    await fetch(tournament.broadcast_endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(tournament.broadcast_api_key ? { 'X-API-Key': tournament.broadcast_api_key } : {}),
        ...customHeaders,
      },
      body: JSON.stringify({ ...payload, event, _context: extraContext ?? {} }),
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    // Silently ignored — never block match scoring for broadcast failures
  }
}
