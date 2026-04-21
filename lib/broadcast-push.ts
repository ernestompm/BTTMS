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
 * Every attempt (success OR failure) is persisted to `broadcast_logs` for
 * audit. On 5xx / network errors we retry once after 1.5s; if that also
 * fails the error is logged and surfaced in the broadcast dashboard.
 *
 * Fails silently for the caller — broadcast must never block match scoring.
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

    const body = JSON.stringify({ ...payload, event, _context: extraContext ?? {} })
    const headers = {
      'Content-Type': 'application/json',
      ...(tournament.broadcast_api_key ? { 'X-API-Key': tournament.broadcast_api_key } : {}),
      ...customHeaders,
    }
    const endpoint = tournament.broadcast_endpoint as string

    const attempt = async (): Promise<{ status: number | null; error: string | null; durationMs: number }> => {
      const started = Date.now()
      try {
        const res = await fetch(endpoint, {
          method, headers, body, signal: AbortSignal.timeout(5000),
        })
        return { status: res.status, error: null, durationMs: Date.now() - started }
      } catch (err: any) {
        return { status: null, error: err?.message ?? 'fetch failed', durationMs: Date.now() - started }
      }
    }

    let retries = 0
    let result = await attempt()
    // Retry once on network error or 5xx
    if (result.error || (result.status !== null && result.status >= 500)) {
      await new Promise((r) => setTimeout(r, 1500))
      retries = 1
      result = await attempt()
    }

    const ok = result.status !== null && result.status >= 200 && result.status < 300
    try {
      await service.from('broadcast_logs').insert({
        tournament_id: tournamentId,
        match_id: matchId,
        event, endpoint, method,
        status: result.status,
        ok,
        error: result.error,
        retries,
        payload_bytes: body.length,
        duration_ms: result.durationMs,
      })
    } catch {
      // Logging failures are non-fatal — don't let them break anything
    }
  } catch {
    // Silently ignored — never block match scoring for broadcast failures
  }
}
