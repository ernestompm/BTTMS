import { waitUntil } from '@vercel/functions'
import { createServiceSupabase } from './supabase-server'
import { buildBroadcastPayload, type PayloadMode } from './broadcast-payload'

// Eventos de alta frecuencia → modo lite (mismo schema, sin
// stats_by_set/draw para reducir latencia). El resto va en full.
const LITE_EVENTS = new Set<string>([
  'point_scored',
  'point_undone',
])

/**
 * Push del JSON canónico al endpoint configurado en el torneo
 * (broadcast_endpoint, POST o PUT según broadcast_method).
 *
 * UN SOLO endpoint, UN SOLO payload. Schema v3.0 — mismo en todos
 * los eventos. Lite mode internamente reduce trabajo de DB sin
 * cambiar el schema (by_set queda [] y draw queda null).
 *
 * Vercel serverless: usamos waitUntil para que la promise no muera
 * al devolver la respuesta del API que disparó el push.
 *
 * Cada intento queda registrado en broadcast_logs.
 */
export function pushBroadcastEvent(
  tournamentId: string,
  matchId: string,
  event: string,
  extraContext?: Record<string, unknown>,
  options?: {
    /** Match pre-cargado con joins. Si se proporciona, el push no
     *  hace su propia SELECT — ahorra ~150ms en el hot-path. */
    preBuiltMatch?: any,
  },
): void {
  const promise = doPush(tournamentId, matchId, event, extraContext, options?.preBuiltMatch)
  promise.catch(() => {})
  try {
    waitUntil(promise)
  } catch {
    // waitUntil solo disponible en Vercel runtime. En dev local Node
    // mantiene la promise viva entre invocaciones.
  }
}

async function doPush(
  tournamentId: string,
  matchId: string,
  event: string,
  extraContext?: Record<string, unknown>,
  preBuiltMatch?: any,
): Promise<void> {
  const service = createServiceSupabase()

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

    const isLiteEvent = LITE_EVENTS.has(event)
    const mode: PayloadMode = isLiteEvent ? 'lite' : 'full'

    const payload = await buildBroadcastPayload(tournamentId, matchId, mode, preBuiltMatch)
    if (!payload) {
      logRow.error = 'payload_build_failed'
      await writeLog()
      return
    }

    const customHeaders: Record<string, string> =
      (tournament as any).broadcast_headers && typeof (tournament as any).broadcast_headers === 'object'
        ? (tournament as any).broadcast_headers
        : {}

    // event y context van dentro de meta — no contaminan la raíz del JSON
    const body = JSON.stringify({
      ...payload,
      meta: {
        ...(payload as any).meta,
        event,
        context: extraContext ?? {},
      },
    })
    const headers = {
      'Content-Type': 'application/json',
      ...(tournament.broadcast_api_key ? { 'X-API-Key': tournament.broadcast_api_key } : {}),
      ...customHeaders,
    }
    logRow.payload_bytes = body.length

    // Hot-path: timeout más corto, sin retry. El siguiente evento
    // (otro punto o transición) sincroniza si este falló.
    const fetchTimeoutMs = isLiteEvent ? 2000 : 5000

    const attempt = async () => {
      const started = Date.now()
      try {
        const res = await fetch(logRow.endpoint!, {
          method, headers, body, signal: AbortSignal.timeout(fetchTimeoutMs),
          keepalive: true,
        })
        return { status: res.status, error: null as string | null, durationMs: Date.now() - started }
      } catch (err: any) {
        return { status: null as number | null, error: err?.message ?? 'fetch failed', durationMs: Date.now() - started }
      }
    }

    let result = await attempt()
    // Retry solo en eventos full y solo en 5xx/network. En lite NO
    // reintentamos — el siguiente punto pisa el estado.
    if (!isLiteEvent && (result.error || (result.status !== null && result.status >= 500))) {
      await new Promise((r) => setTimeout(r, 500))
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
