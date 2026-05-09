import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

/**
 * GET /api/broadcast/debug-match?match=<uuid>
 *
 * Devuelve los campos de score CRUDOS tal como están en la BBDD, sin
 * defaults ni transformaciones. Útil para ver si match.score está
 * corrupto cuando el broadcast manda valores que no cuadran con la
 * realidad (ej. sets array poblado pero sets_won todo a cero).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const matchId = searchParams.get('match')
  if (!matchId) return NextResponse.json({ error: 'missing match' }, { status: 400 })

  const service = createServiceSupabase()

  const { data: match } = await service
    .from('matches')
    .select('id, status, scoring_system, score, stats, broadcast_active, started_at, finished_at')
    .eq('id', matchId)
    .single()

  if (!match) return NextResponse.json({ error: 'match not found' }, { status: 404 })

  // Último punto no anulado — el score_after de ese punto es la fuente
  // autorizada. Si match.score difiere → data corruption.
  const { data: lastPoint } = await service
    .from('points')
    .select('sequence, set_number, game_number, server_team, winner_team, score_before, score_after')
    .eq('match_id', matchId)
    .eq('is_undone', false)
    .order('sequence', { ascending: false })
    .limit(1)
    .single()

  const matchScore = (match.score ?? {}) as any
  const lastPointScore = (lastPoint?.score_after ?? {}) as any

  // Computa lo que sets_won DEBERÍA ser a partir de sets array
  const computedFromSets = (sets: any[]) => ({
    t1: (sets ?? []).filter((s: any) => (s?.t1 ?? 0) > (s?.t2 ?? 0)).length,
    t2: (sets ?? []).filter((s: any) => (s?.t2 ?? 0) > (s?.t1 ?? 0)).length,
  })

  return NextResponse.json({
    match_id: matchId,
    status: match.status,
    scoring_system: match.scoring_system,
    broadcast_active: match.broadcast_active,
    raw_match_score: match.score,
    raw_last_point_score_after: lastPoint?.score_after ?? null,
    last_point: lastPoint ? {
      sequence: lastPoint.sequence,
      set: lastPoint.set_number,
      game: lastPoint.game_number,
      server: lastPoint.server_team,
      winner: lastPoint.winner_team,
    } : null,
    diagnostics: {
      sets_won_in_match_score: matchScore.sets_won ?? null,
      sets_won_computed_from_match_sets: computedFromSets(matchScore.sets ?? []),
      sets_won_in_last_point: lastPointScore.sets_won ?? null,
      sets_won_computed_from_last_point_sets: computedFromSets(lastPointScore.sets ?? []),
      match_score_eq_last_point_score: JSON.stringify(match.score) === JSON.stringify(lastPoint?.score_after),
      // Si match.sets_won es null/0 y sets array tiene entradas → corrupción
      likely_corruption_in_match_score:
        (matchScore.sets?.length > 0)
        && (!matchScore.sets_won || (matchScore.sets_won.t1 === 0 && matchScore.sets_won.t2 === 0)),
    },
  })
}
