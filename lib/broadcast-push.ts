import { waitUntil } from '@vercel/functions'
import { createServiceSupabase } from './supabase-server'
import { buildBroadcastPayload, type PayloadMode } from './broadcast-payload'

// Eventos que disparan ADEMÁS un push al endpoint estático (cuando está
// configurado). Datos estructurales del torneo cambian raras veces.
const STATIC_TRIGGERS = new Set<string>([
  'broadcast_started',
  'judge_on_court',
  'players_on_court',
  'warmup_started',
  'match_started',
  'match_finished',
  'match_retired',
])

/**
 * Push del JSON canónico al endpoint configurado en el torneo.
 *
 * ARQUITECTURA DE DOBLE ENDPOINT (opcional):
 *   - broadcast_endpoint            → datos dinámicos (score, stats, tiempos)
 *     SIEMPRE recibe el evento.
 *   - broadcast_endpoint_static     → datos estáticos (tournament, teams,
 *     judge, weather, draw). Solo recibe en eventos STATIC_TRIGGERS.
 *
 * Si broadcast_endpoint_static NO está configurado: comportamiento legacy —
 * el endpoint principal recibe el payload full (todo junto, modo lite en
 * point_scored/point_undone para reducir latencia).
 *
 * En Vercel serverless usamos waitUntil para que la función no termine
 * antes de que el fetch al endpoint se complete.
 */
export function pushBroadcastEvent(
  tournamentId: string,
  matchId: string,
  event: string,
  extraContext?: Record<string, unknown>
): void {
  const promise = doPush(tournamentId, matchId, event, extraContext)
  promise.catch(() => {})
  try {
    waitUntil(promise)
  } catch {
    // waitUntil solo disponible en runtime Vercel. En dev local Node no
    // mata el proceso entre invocaciones, así que la promise corre igual.
  }
}

type LogRow = {
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
}

function emptyLog(tournamentId: string, matchId: string, event: string): LogRow {
  return {
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
}

async function doPush(
  tournamentId: string,
  matchId: string,
  event: string,
  extraContext?: Record<string, unknown>
): Promise<void> {
  const service = createServiceSupabase()

  const writeLog = async (row: LogRow) => {
    try { await service.from('broadcast_logs').insert(row) } catch {}
  }

  try {
    const { data: tournament } = await service
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single()

    if (!tournament) {
      const row = emptyLog(tournamentId, matchId, event)
      row.error = 'tournament_not_found'
      await writeLog(row)
      return
    }

    if (!tournament.broadcast_endpoint) {
      const row = emptyLog(tournamentId, matchId, event)
      row.error = 'no_endpoint_configured'
      await writeLog(row)
      return
    }

    const customHeaders: Record<string, string> =
      (tournament as any).broadcast_headers && typeof (tournament as any).broadcast_headers === 'object'
        ? (tournament as any).broadcast_headers
        : {}
    const apiKey = (tournament as any).broadcast_api_key as string | null

    const dynamicEndpoint = (tournament as any).broadcast_endpoint as string
    const dynamicMethod: 'POST' | 'PUT' =
      ((tournament as any).broadcast_method === 'PUT' ? 'PUT' : 'POST')

    const staticEndpoint = ((tournament as any).broadcast_endpoint_static ?? null) as string | null
    const staticMethod: 'POST' | 'PUT' =
      ((tournament as any).broadcast_method_static === 'POST' ? 'POST' : 'PUT')

    const hasSplit = !!staticEndpoint
    const shouldSendStatic = hasSplit && STATIC_TRIGGERS.has(event)

    // Construir los payloads necesarios. Si hay split, dynamic siempre.
    // Si no hay split, hacemos el legacy payload (lite/full) en un solo PUT.
    const tasks: Promise<void>[] = []

    if (hasSplit) {
      // Modo doble endpoint
      tasks.push(sendOne({
        service, writeLog,
        tournamentId, matchId, event, extraContext,
        endpoint: dynamicEndpoint, method: dynamicMethod, apiKey, customHeaders,
        mode: 'dynamic', kind: 'dynamic',
      }))
      if (shouldSendStatic) {
        tasks.push(sendOne({
          service, writeLog,
          tournamentId, matchId, event, extraContext,
          endpoint: staticEndpoint!, method: staticMethod, apiKey, customHeaders,
          mode: 'static', kind: 'static',
        }))
      }
    } else {
      // Modo legacy un solo endpoint con payload combinado
      const legacyMode: PayloadMode = (event === 'point_scored' || event === 'point_undone')
        ? 'lite' : 'full'
      tasks.push(sendOne({
        service, writeLog,
        tournamentId, matchId, event, extraContext,
        endpoint: dynamicEndpoint, method: dynamicMethod, apiKey, customHeaders,
        mode: legacyMode, kind: 'legacy',
      }))
    }

    await Promise.all(tasks)
  } catch (err: any) {
    const row = emptyLog(tournamentId, matchId, event)
    row.error = err?.message ?? 'unknown_error'
    await writeLog(row)
  }
}

interface SendOneOpts {
  service: any
  writeLog: (row: LogRow) => Promise<void>
  tournamentId: string
  matchId: string
  event: string
  extraContext?: Record<string, unknown>
  endpoint: string
  method: 'POST' | 'PUT'
  apiKey: string | null
  customHeaders: Record<string, string>
  mode: PayloadMode
  kind: 'static' | 'dynamic' | 'legacy'
}

async function sendOne(o: SendOneOpts): Promise<void> {
  const logRow = emptyLog(o.tournamentId, o.matchId, `${o.event}${o.kind === 'static' ? ':static' : o.kind === 'dynamic' ? ':dynamic' : ''}`)
  logRow.endpoint = o.endpoint
  logRow.method = o.method

  try {
    const payload = await buildBroadcastPayload(o.tournamentId, o.matchId, o.mode)
    if (!payload) {
      logRow.error = 'payload_build_failed'
      await o.writeLog(logRow)
      return
    }

    const body = JSON.stringify({
      ...payload,
      meta: {
        ...(payload as any).meta,
        event: o.event,
        context: o.extraContext ?? {},
      },
    })
    const headers = {
      'Content-Type': 'application/json',
      ...(o.apiKey ? { 'X-API-Key': o.apiKey } : {}),
      ...o.customHeaders,
    }
    logRow.payload_bytes = body.length

    // Hot-path (dynamic en point_scored/point_undone, o legacy lite):
    // timeout corto, sin retry. El próximo evento sincroniza igualmente.
    const isHotPath =
      (o.kind === 'dynamic' || o.kind === 'legacy') &&
      (o.event === 'point_scored' || o.event === 'point_undone')
    const fetchTimeoutMs = isHotPath ? 2000 : 5000

    const attempt = async () => {
      const started = Date.now()
      try {
        const res = await fetch(o.endpoint, {
          method: o.method, headers, body,
          signal: AbortSignal.timeout(fetchTimeoutMs),
          keepalive: true,
        })
        return { status: res.status, error: null as string | null, durationMs: Date.now() - started }
      } catch (err: any) {
        return { status: null as number | null, error: err?.message ?? 'fetch failed', durationMs: Date.now() - started }
      }
    }

    let result = await attempt()
    if (!isHotPath && (result.error || (result.status !== null && result.status >= 500))) {
      await new Promise((r) => setTimeout(r, 500))
      logRow.retries = 1
      result = await attempt()
    }

    logRow.status = result.status
    logRow.error = result.error
    logRow.duration_ms = result.durationMs
    logRow.ok = result.status !== null && result.status >= 200 && result.status < 300

    await o.writeLog(logRow)
  } catch (err: any) {
    logRow.error = err?.message ?? 'unknown_error'
    await o.writeLog(logRow)
  }
}
