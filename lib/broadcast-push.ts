import { waitUntil } from '@vercel/functions'
import { createServiceSupabase } from './supabase-server'
import { buildBroadcastPayload } from './broadcast-payload'

/**
 * Push del JSON canónico al endpoint configurado en el torneo
 * (broadcast_endpoint), ya sea POST o PUT (broadcast_method).
 *
 * Importante: en Vercel serverless, las funciones terminan al devolver
 * la respuesta y matan cualquier promesa fire-and-forget que tenga work
 * pendiente. Por eso envolvemos el trabajo en `waitUntil` — Vercel
 * garantiza que la promesa se completa después de la respuesta sin
 * bloquearla.
 *
 * En entornos sin waitUntil (dev local, Node directo) la promesa sigue
 * corriendo en el event loop sin perder nada.
 *
 * Cada intento queda registrado en `broadcast_logs` — incluso los
 * fallos tempranos (sin endpoint configurado, payload vacío) — para
 * que el dashboard de broadcast surface qué pasó.
 */
export function pushBroadcastEvent(
  tournamentId: string,
  matchId: string,
  event: string,
  extraContext?: Record<string, unknown>
): void {
  const promise = doPush(tournamentId, matchId, event, extraContext)
  // Catch defensivo para que si waitUntil falla, no haya unhandled rejection
  promise.catch(() => {})
  try {
    waitUntil(promise)
  } catch {
    // waitUntil solo está disponible en runtime de Vercel.
    // En dev local la promesa corre igualmente — Node no mata el proceso.
  }
}

async function doPush(
  tournamentId: string,
  matchId: string,
  event: string,
  extraContext?: Record<string, unknown>
): Promise<void> {
  const service = createServiceSupabase()

  // Log row se rellena progresivamente y se inserta SIEMPRE — incluso
  // en early returns — para que el dashboard pueda surface por qué no
  // llegó el push al endpoint.
  const logRow: {
    tournament_id: string
    match_id: string
    event: string
    endpoint: string | null
    method: string | null
    status: number | null
    ok: boolean
    error: string | null
    retries: number
    payload_bytes: number
    duration_ms: number
  } = {
    tournament_id: tournamentId,
    match_id: matchId,
    event,
    endpoint: null,
    method: null,
    status: null,
    ok: false,
    error: null,
    retries: 0,
    payload_bytes: 0,
    duration_ms: 0,
  }

  const writeLog = async () => {
    try { await service.from('broadcast_logs').insert(logRow) } catch {}
  }

  try {
    const { data: tournament } = await service
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single()

    if (!tournament) {
      logRow.error = 'tournament_not_found'
      await writeLog()
      return
    }

    if (!tournament.broadcast_endpoint) {
      logRow.error = 'no_endpoint_configured'
      await writeLog()
      return
    }

    const method: 'POST' | 'PUT' =
      ((tournament as any).broadcast_method === 'PUT' ? 'PUT' : 'POST')
    logRow.endpoint = tournament.broadcast_endpoint as string
    logRow.method = method

    const payload = await buildBroadcastPayload(tournamentId, matchId)
    if (!payload) {
      logRow.error = 'payload_build_failed'
      await writeLog()
      return
    }

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
    logRow.payload_bytes = body.length

    const attempt = async () => {
      const started = Date.now()
      try {
        const res = await fetch(logRow.endpoint!, {
          method, headers, body, signal: AbortSignal.timeout(5000),
        })
        return { status: res.status, error: null as string | null, durationMs: Date.now() - started }
      } catch (err: any) {
        return { status: null as number | null, error: err?.message ?? 'fetch failed', durationMs: Date.now() - started }
      }
    }

    let result = await attempt()
    // Reintenta una vez en error de red o 5xx
    if (result.error || (result.status !== null && result.status >= 500)) {
      await new Promise((r) => setTimeout(r, 1500))
      logRow.retries = 1
      result = await attempt()
    }

    logRow.status = result.status
    logRow.error = result.error
    logRow.duration_ms = result.durationMs
    logRow.ok = result.status !== null && result.status >= 200 && result.status < 300

    await writeLog()
  } catch (err: any) {
    logRow.error = err?.message ?? 'unknown_error'
    await writeLog()
  }
}
