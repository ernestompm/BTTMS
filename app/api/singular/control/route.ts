import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-helpers'

/**
 * POST /api/singular/control
 *
 * Proxy hacia la Control App REST API de Singular Live.
 * Endpoint Singular:
 *   POST https://app.singular.live/apiv2/controlapps/<token>/control
 *
 * Body que recibimos del cliente:
 *   {
 *     token: string,         // Control App ID de Singular (no se loggea entero)
 *     actions: Array<{
 *       subCompositionName?: string,
 *       state?: 'In' | 'Out',
 *       payload?: Record<string, any>,
 *     }>
 *   }
 *
 * Body que reenviamos a Singular: el array `actions` tal cual.
 *
 * El proxy existe por dos motivos:
 *   1. Centraliza permisos (solo super_admin / tournament_director).
 *   2. Evita CORS desde el navegador hacia app.singular.live.
 *   3. Permite loggear en consola la duración para depurar latencia.
 *
 * Solo se admiten verbos seguros (animateIn/Out + payload de valores).
 * No exponemos delete/replace de compositions.
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(['super_admin', 'tournament_director'])
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => ({})) as {
    token?: string
    actions?: Array<{ subCompositionName?: string; state?: string; payload?: any }>
  }

  const token = (body.token ?? '').trim()
  const actions = Array.isArray(body.actions) ? body.actions : []

  if (!token) return NextResponse.json({ error: 'Falta token de Singular' }, { status: 400 })
  if (actions.length === 0) return NextResponse.json({ error: 'Sin acciones' }, { status: 400 })

  // Sanitize: solo dejamos pasar campos conocidos para no abrir puertas.
  const safe = actions.map(a => {
    const out: any = {}
    if (typeof a.subCompositionName === 'string') out.subCompositionName = a.subCompositionName
    if (a.state === 'In' || a.state === 'Out') out.state = a.state
    if (a.payload && typeof a.payload === 'object') out.payload = a.payload
    return out
  }).filter(a => Object.keys(a).length > 0)

  if (safe.length === 0) return NextResponse.json({ error: 'Acciones inválidas' }, { status: 400 })

  const url = `https://app.singular.live/apiv2/controlapps/${encodeURIComponent(token)}/control`
  const started = Date.now()

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(safe),
      // No esperamos > 8s; en local Singular suele responder en <300ms.
      signal: AbortSignal.timeout(8000),
    })
    const duration = Date.now() - started
    const text = await res.text()
    let json: any = null
    try { json = text ? JSON.parse(text) : null } catch { /* keep raw text */ }

    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      duration_ms: duration,
      response: json ?? text,
    }, { status: res.ok ? 200 : 502 })
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      error: e?.name === 'TimeoutError' ? 'Timeout (8s) hablando con Singular' : (e?.message ?? 'Error de red'),
      duration_ms: Date.now() - started,
    }, { status: 504 })
  }
}
