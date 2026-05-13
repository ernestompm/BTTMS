import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { pushBroadcastEvent } from '@/lib/broadcast-push'
import { applyPointToStats, applyBreakPointStats, emptyStats } from '@/lib/stats-engine'
import { INITIAL_SCORE } from '@/lib/score-engine'
import type { MatchStats, Score, ScoringSystem } from '@/types'

/**
 * POST /api/matches/[id]/undo
 *
 * Marca el último punto no anulado como is_undone=true y restaura el match
 * a su estado anterior. NOTA: requiere que las append-only rules de points
 * estén borradas (migración 022_ensure_points_mutable.sql).
 *
 * Estrategia robusta:
 *  1. Localiza el último punto activo.
 *  2. Lo marca como is_undone=true.
 *  3. RECOMPUTA score, stats y serving_team replayando todos los puntos
 *     restantes. NO depende de stats_after del penúltimo punto (que podría
 *     estar null en puntos viejos previos a la migración 007).
 *  4. Persiste todo y dispara broadcast push.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = await params
  const supabase = await createServerSupabase()
  const service = createServiceSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: appUser } = await supabase.from('app_users').select('role').eq('id', user.id).single()
  if (!appUser) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const { data: match } = await service.from('matches').select('*').eq('id', matchId).single()
  if (!match) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  if (appUser.role === 'judge' && match.judge_id !== user.id) {
    return NextResponse.json({ error: 'No es tu partido' }, { status: 403 })
  }

  // ── 1. Localiza el último punto activo ──
  const { data: lastPoint } = await service.from('points')
    .select('*').eq('match_id', matchId).eq('is_undone', false)
    .order('sequence', { ascending: false }).limit(1).maybeSingle()

  if (!lastPoint) return NextResponse.json({ error: 'No hay puntos para deshacer' }, { status: 400 })

  // ── 2. Marca el punto como undone ──
  // IMPORTANTE: si la migración 022 no se ha aplicado, este UPDATE es un
  // no-op silencioso (la regla no_update_points lo intercepta). Para
  // detectarlo, leemos el punto justo después y verificamos el flag.
  await service.from('points').update({ is_undone: true }).eq('id', (lastPoint as any).id)

  const { data: verify } = await service.from('points')
    .select('is_undone').eq('id', (lastPoint as any).id).single()
  if (!verify?.is_undone) {
    return NextResponse.json({
      error: 'No se pudo marcar el punto como deshecho. ¿Falta la migración 022_ensure_points_mutable.sql en la BD?',
      hint: 'Ejecuta esa migración en Supabase SQL Editor y vuelve a intentar.',
    }, { status: 500 })
  }

  // ── 3. Recomputa score + stats replayando TODOS los puntos restantes ──
  // En vez de fiarnos del stats_after del penúltimo punto (que puede ser
  // null en puntos viejos), replay desde cero. Coste: O(N) puntos, en
  // partidos reales <300 puntos así que <50ms.
  const { data: remainingPoints } = await service.from('points')
    .select('winner_team, server_team, point_type, shot_direction, score_before, score_after, is_break_point, was_break_point_saved')
    .eq('match_id', matchId).eq('is_undone', false)
    .order('sequence', { ascending: true })

  const scoringSystem = ((match as any).scoring_system ?? 'best_of_2_sets_super_tb') as ScoringSystem
  let restoredScore: Score = INITIAL_SCORE(scoringSystem)
  let restoredStats: MatchStats = emptyStats()

  if (remainingPoints && remainingPoints.length > 0) {
    // El score final ES el score_after del último punto restante (lo confiamos
    // porque score_after es determinista — no se modifica por reclasificación).
    const lastRemaining = remainingPoints[remainingPoints.length - 1]
    restoredScore = (lastRemaining as any).score_after as Score

    // Stats se recomputan replayando todos los puntos con su clasificación
    // actual. Esto refleja también cualquier classify-point que se hizo
    // entre medias y mantiene coherencia incluso si stats_after estaba
    // corrupto o nulo.
    for (const p of remainingPoints) {
      const pp = p as any
      restoredStats = applyPointToStats(restoredStats, {
        winnerTeam: pp.winner_team,
        serverTeam: pp.server_team,
        pointType: pp.point_type,
        shotDirection: pp.shot_direction,
        scoreBefore: pp.score_before,
      })
      if (pp.is_break_point) {
        restoredStats = applyBreakPointStats(restoredStats, pp.server_team, true, pp.winner_team)
      }
    }
  }

  // Serving_team se restaura al del punto deshecho — porque ese era el
  // que iba a sacar JUSTO ANTES de jugarse ese punto.
  const restoredServingTeam = (lastPoint as any).server_team ?? (match as any).serving_team

  // Si el partido había terminado, reabre a in_progress (el undo deshace
  // el punto final que cerró el match).
  const restoredStatus = (match as any).status === 'finished' ? 'in_progress' : (match as any).status

  // ── 4. Persiste y push ──
  const { data: updatedMatch } = await service.from('matches').update({
    score: restoredScore,
    stats: restoredStats,
    serving_team: restoredServingTeam,
    status: restoredStatus,
    finished_at: restoredStatus === 'in_progress' ? null : (match as any).finished_at,
  }).eq('id', matchId).select('*').single()

  if ((match as any).broadcast_active && updatedMatch) {
    pushBroadcastEvent((updatedMatch as any).tournament_id, matchId, 'point_undone', {
      restored_serving_team: restoredServingTeam,
      remaining_points: remainingPoints?.length ?? 0,
    })
  }

  return NextResponse.json(updatedMatch)
}
