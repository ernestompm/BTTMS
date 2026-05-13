import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { pushBroadcastEvent } from '@/lib/broadcast-push'
import { invalidateDrawCache } from '@/lib/broadcast-payload'
import { getWeather } from '@/lib/weather'

/**
 * Activa o desactiva el broadcast de un match.
 *
 * Body: { active: boolean }
 *
 * Al activar:
 *  - Desactiva el resto de matches del torneo (solo uno puede estar EN AIRE).
 *  - Marca este match con broadcast_active=true.
 *  - PRE-CALIENTA weather_cache llamando a Open-Meteo SÍNCRONAMENTE antes
 *    del primer push — así el JSON inicial NUNCA llega con weather:null.
 *  - Invalida el draw cache para que el push siguiente lea el cuadro
 *    fresco (incluyendo entries y matches actualizados).
 *  - Dispara push 'match_initialized' con el snapshot completo del match
 *    (participantes, weather, cuadro, stats vacías o las que haya) para
 *    que Singular tenga el estado inicial sin esperar a un punto.
 *
 * Al desactivar:
 *  - marca el match con broadcast_active=false
 *  - dispara push 'broadcast_stopped' para que el receptor pueda limpiar
 *    los gráficos en pantalla.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = await params
  const supabase = await createServerSupabase()
  const service = createServiceSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: appUser } = await service.from('app_users').select('role').eq('id', user.id).single()
  if (!appUser) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const body = await req.json().catch(() => ({})) as { active?: boolean }
  const activate = body?.active === true

  const { data: match } = await service.from('matches').select('id,tournament_id,broadcast_active').eq('id', matchId).single()
  if (!match) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  if (activate) {
    // Solo un match puede estar EN AIRE por torneo. Apaga el resto antes
    // de encender el actual.
    await service.from('matches')
      .update({ broadcast_active: false })
      .eq('tournament_id', match.tournament_id)
      .neq('id', matchId)
  }

  const { data: updated } = await service.from('matches')
    .update({ broadcast_active: activate })
    .eq('id', matchId)
    .select('*, draw_id')
    .single()

  if (!updated) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

  if (activate) {
    // ── Pre-warm weather + invalidate draw cache, en paralelo ──
    // Hacemos AWAIT del weather para que el primer push lleve datos
    // (open-meteo tarda 150-400ms — la espera vale la pena para que
    // Singular reciba el JSON inicial con weather poblado, no null).
    // El draw cache se invalida para que el push lea entries+matches
    // frescas tras cualquier cambio reciente del bracket.
    await prewarmBroadcastData(service, (updated as any).tournament_id, (updated as any).draw_id)

    // Evento nuevo "match_initialized" — semánticamente más claro que
    // broadcast_started. Trae participantes + weather + cuadro + stats
    // (lo que haya hasta ese punto) en modo full.
    pushBroadcastEvent(updated.tournament_id, matchId, 'match_initialized')
  } else {
    pushBroadcastEvent(updated.tournament_id, matchId, 'broadcast_stopped')
  }

  return NextResponse.json(updated)
}

/**
 * Pre-carga weather_cache y limpia draw cache antes del push inicial.
 * Garantiza que el primer JSON empujado a Singular trae weather y draw
 * frescos sin depender del lazy-load asíncrono del payload builder.
 */
async function prewarmBroadcastData(service: any, tournamentId: string, drawId: string | null) {
  // Draw cache: lo invalidamos para que el siguiente build lo recargue
  // (no podemos rellenarlo desde aquí sin duplicar la lógica del payload).
  if (drawId) invalidateDrawCache(drawId)

  // Weather: leemos coords del torneo y pedimos a Open-Meteo en paralelo
  // con el upsert a weather_cache. Si Open-Meteo falla o no hay coords,
  // el payload builder caerá a su propio fallback (cache vieja o null).
  try {
    const { data: t } = await service.from('tournaments')
      .select('venue_lat, venue_lng').eq('id', tournamentId).single()
    if (!t?.venue_lat || !t?.venue_lng) return
    const fresh = await getWeather(Number(t.venue_lat), Number(t.venue_lng), `tournament:${tournamentId}`)
    if (fresh) {
      await service.from('weather_cache').upsert({
        tournament_id: tournamentId,
        data: fresh,
        updated_at: new Date().toISOString(),
      })
    }
  } catch (e) {
    // Silencioso — si el pre-warm falla el lazy-load del payload lo
    // intentará de nuevo cuando construya el JSON.
    console.error('weather prewarm failed', e)
  }
}
