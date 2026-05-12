import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { applyPointToStats, applyBreakPointStats, emptyStats } from '@/lib/stats-engine'
import { pushBroadcastEvent } from '@/lib/broadcast-push'
import type { PointType, ShotDirection, Score, MatchStats } from '@/types'

/**
 * PATCH /api/matches/[id]/classify-point
 * Body: { point_type, shot_direction? }
 *
 * Reclasifica el ÚLTIMO punto registrado y recomputa match.stats con la
 * nueva clasificación. Esto es la pareja del POST /point: cuando el
 * árbitro pulsa quién gana, el punto entra como 'rally' (neutro) y las
 * stats solo cuentan en totales. Si después se abre el modal y se elige
 * un tipo concreto (winner, unforced_error, etc.), aquí ajustamos las
 * stats con el delta correcto en vez de quedarnos con el 'rally' inicial.
 *
 * Algoritmo:
 *  1. Cargar el último punto no anulado.
 *  2. Cargar el penúltimo punto para sacar el stats baseline (sus
 *     stats_after) — si no hay, partimos de emptyStats().
 *  3. Re-aplicar applyPointToStats sobre ese baseline con el nuevo
 *     point_type y shot_direction.
 *  4. Re-aplicar applyBreakPointStats si el punto era break point.
 *  5. Persistir las stats nuevas tanto en match.stats como en
 *     points.stats_after del punto reclasificado.
 *
 * Trade-off: solo permite reclasificar el ÚLTIMO punto. Reclasificar
 * uno anterior obligaría a replayear todos los puntos posteriores, lo
 * que casi nadie va a usar y complica el endpoint.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = await params
  const supabase = await createServerSupabase()
  const service = createServiceSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: appUser } = await supabase.from('app_users').select('role').eq('id', user.id).single()
  if (!appUser) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 403 })

  const body = await req.json()
  const { point_type, shot_direction }: { point_type: PointType; shot_direction: ShotDirection | null } = body

  if (!point_type) return NextResponse.json({ error: 'Missing point_type' }, { status: 400 })

  // ── 1. Último punto del match (no anulado) ──
  const { data: lastPoint } = await service
    .from('points')
    .select('id, match_id, sequence, winner_team, server_team, score_before, is_break_point')
    .eq('match_id', matchId)
    .eq('is_undone', false)
    .order('sequence', { ascending: false })
    .limit(1)
    .single()

  if (!lastPoint) return NextResponse.json({ error: 'No point found' }, { status: 404 })

  // ── 2. Stats baseline = stats_after del punto inmediatamente anterior ──
  const { data: prevPoint } = await service
    .from('points')
    .select('stats_after')
    .eq('match_id', matchId)
    .eq('is_undone', false)
    .lt('sequence', (lastPoint as any).sequence)
    .order('sequence', { ascending: false })
    .limit(1)
    .maybeSingle()

  const baselineStats: MatchStats = ((prevPoint as any)?.stats_after as MatchStats) ?? emptyStats()
  const scoreBefore = (lastPoint as any).score_before as Score
  const winnerTeam = (lastPoint as any).winner_team as 1 | 2
  const serverTeam = (lastPoint as any).server_team as 1 | 2

  // ── 3. Re-aplicar las stats con el NUEVO point_type ──
  let statsAfter = applyPointToStats(baselineStats, {
    winnerTeam,
    serverTeam,
    pointType: point_type,
    shotDirection: shot_direction ?? null,
    scoreBefore,
  })

  // ── 4. Break point se preserva del punto original ──
  if ((lastPoint as any).is_break_point) {
    statsAfter = applyBreakPointStats(statsAfter, serverTeam, true, winnerTeam)
  }

  // ── 5. Persistir: punto + match en paralelo ──
  await Promise.all([
    service.from('points').update({
      point_type,
      shot_direction: shot_direction ?? null,
      stats_after: statsAfter,
    }).eq('id', (lastPoint as any).id),
    service.from('matches').update({
      stats: statsAfter,
    }).eq('id', matchId),
  ])

  // ── 6. Push a Singular para que las gráficas vean las stats actualizadas
  //      sin esperar al siguiente punto. Si el match no está en broadcast
  //      activo, pushBroadcastEvent es no-op. waitUntil garantiza que la
  //      promise no muera al devolver la respuesta.
  const { data: mForBroadcast } = await service.from('matches')
    .select('tournament_id, broadcast_active').eq('id', matchId).single()
  if (mForBroadcast?.broadcast_active) {
    pushBroadcastEvent(
      (mForBroadcast as any).tournament_id, matchId,
      'point_reclassified',
      { point_type, shot_direction: shot_direction ?? null },
    )
  }

  return NextResponse.json({ ok: true, stats: statsAfter })
}
