import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { applyPointToStats, applyBreakPointStats, emptyStats } from '@/lib/stats-engine'

/**
 * GET /api/broadcast/debug-stats?match=<uuid>
 *
 * Diagnóstico del cálculo de stats por set. Devuelve:
 *  - Listado de set_numbers que aparecen en points
 *  - Conteo de puntos por set
 *  - Sample point del set para verificar que tiene los campos esperados
 *  - Resultado de computeStatsBySet (lo que devuelve a Singular)
 *  - Diferencia entre la stats acumulada (match.stats) y la suma de las
 *    stats por set (deberían cuadrar)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const matchId = searchParams.get('match')
  if (!matchId) return NextResponse.json({ error: 'missing match param' }, { status: 400 })

  const service = createServiceSupabase()

  const { data: match } = await service
    .from('matches')
    .select('id, status, score, stats')
    .eq('id', matchId)
    .single()
  if (!match) return NextResponse.json({ error: 'match not found' }, { status: 404 })

  const { data: points } = await service
    .from('points')
    .select('sequence, set_number, game_number, server_team, winner_team, point_type, shot_direction, score_before, is_break_point, is_undone, created_at')
    .eq('match_id', matchId)
    .order('sequence', { ascending: true })

  const all = (points ?? []) as any[]
  const active = all.filter(p => !p.is_undone)
  const undone = all.filter(p => p.is_undone)

  // Distribución de set_numbers
  const bySetCount = new Map<number, number>()
  const sampleBySet = new Map<number, any>()
  for (const p of active) {
    const n = p.set_number as number
    bySetCount.set(n, (bySetCount.get(n) ?? 0) + 1)
    if (!sampleBySet.has(n)) sampleBySet.set(n, p)
  }

  // Replay para cada set — réplica exacta de computeStatsBySet
  const bySetStats = new Map<number, any>()
  for (const p of active) {
    const n = p.set_number as number
    if (n == null) continue
    let stats = bySetStats.get(n) ?? emptyStats()
    try {
      stats = applyPointToStats(stats, {
        winnerTeam: p.winner_team,
        serverTeam: p.server_team,
        pointType: p.point_type,
        shotDirection: p.shot_direction,
        scoreBefore: p.score_before,
      })
      if (p.is_break_point) {
        stats = applyBreakPointStats(stats, p.server_team, true, p.winner_team)
      }
    } catch (err: any) {
      bySetStats.set(n, { _error: err?.message ?? 'apply failed', _stats_so_far: stats })
      continue
    }
    bySetStats.set(n, stats)
  }

  const result = Array.from(bySetStats.entries())
    .sort(([a], [b]) => a - b)
    .map(([set_number, stats]) => ({ set_number, stats }))

  return NextResponse.json({
    match_id: matchId,
    status: match.status,
    points_summary: {
      total_in_db: all.length,
      active: active.length,
      undone: undone.length,
      set_numbers_found: Array.from(bySetCount.entries())
        .sort(([a], [b]) => a - b)
        .map(([n, count]) => ({ set_number: n, points: count })),
    },
    sample_point_per_set: Object.fromEntries(
      Array.from(sampleBySet.entries()).sort(([a], [b]) => a - b)
    ),
    raw_match_stats_in_db: match.stats,
    computed_by_set_stats: result,
    note: 'Si un set aparece en set_numbers_found pero las stats son 0, hay un bug en applyPointToStats. Si NO aparece en set_numbers_found, el bug está en el setNumber asignado por point/route.ts.',
  })
}
