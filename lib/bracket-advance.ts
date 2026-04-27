// ============================================================================
// Bracket auto-advance — JS fallback (no depende del trigger SQL 018)
// ============================================================================
// Replica la logica del trigger advance_match_winner del SQL en JavaScript
// para ejecutarse desde los endpoints de finish/retire/walkover. Asi
// funciona aunque la migracion 018 no este aplicada en la base de datos.
//
// Pairing standard: match N -> match CEIL(N/2) de la siguiente ronda.
//   * N impar -> entry1
//   * N par   -> entry2
// (R16 m1+m2 -> QF m1, R16 m3+m4 -> QF m2, ...)
//
// Idempotente: si el slot del siguiente match ya esta lleno, no lo
// machaca (asi no destruye una asignacion manual del director).
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'

const NEXT_ROUND: Record<string, string | null> = {
  R32: 'R16',
  R16: 'QF',
  QF:  'SF',
  SF:  'F',
  F:   null,
}

export async function advanceWinnerToNextRound(
  service: SupabaseClient,
  matchId: string,
): Promise<{ advanced: boolean, reason?: string }> {
  // 1. Re-leer el match con todo lo que necesitamos
  const { data: m, error } = await service.from('matches').select('*').eq('id', matchId).single()
  if (error || !m) return { advanced: false, reason: 'match not found' }

  // 2. Solo avanzamos cuando el partido esta cerrado
  if (!['finished', 'walkover', 'retired'].includes(m.status)) {
    return { advanced: false, reason: 'match not closed' }
  }

  // 3. Pre-conditions: pertenecer a un cuadro y tener match_number
  if (!m.draw_id || !m.match_number) {
    return { advanced: false, reason: 'no draw_id or match_number' }
  }

  const nextRound = NEXT_ROUND[m.round]
  if (!nextRound) return { advanced: false, reason: 'no next round (final?)' }

  // 4. Determinar el entry ganador
  let winnerEntry: string | null = null
  if (m.score && typeof m.score === 'object' && 'winner_team' in m.score) {
    const wt = (m.score as any).winner_team as 1 | 2 | null
    if (wt === 1) winnerEntry = m.entry1_id
    else if (wt === 2) winnerEntry = m.entry2_id
  }
  if (!winnerEntry && m.retired_team) {
    // Quien NO se retira es el ganador
    winnerEntry = m.retired_team === 1 ? m.entry2_id : m.entry1_id
  }
  if (!winnerEntry) return { advanced: false, reason: 'no winner determined' }

  // 5. Calcular slot destino
  const nextNumber = Math.ceil(m.match_number / 2)
  const slot: 'entry1_id' | 'entry2_id' = m.match_number % 2 === 1 ? 'entry1_id' : 'entry2_id'

  // 6. Buscar el siguiente match (mismo draw_id + round + match_number)
  const { data: nextMatch } = await service.from('matches')
    .select('*')
    .eq('draw_id', m.draw_id)
    .eq('round', nextRound)
    .eq('match_number', nextNumber)
    .maybeSingle()

  if (nextMatch) {
    // Solo rellenar el slot si esta vacio (no machacar lo asignado a mano)
    if (!(nextMatch as any)[slot]) {
      await service.from('matches').update({ [slot]: winnerEntry }).eq('id', nextMatch.id)
      return { advanced: true }
    }
    return { advanced: false, reason: 'slot already filled' }
  }

  // 7. Si el siguiente match no existe todavia, lo creamos con el ganador colocado
  const newMatch: Record<string, any> = {
    tournament_id: m.tournament_id,
    draw_id: m.draw_id,
    category: m.category,
    round: nextRound,
    match_number: nextNumber,
    match_type: m.match_type,
    status: 'scheduled',
    scoring_system: m.scoring_system,
    entry1_id: slot === 'entry1_id' ? winnerEntry : null,
    entry2_id: slot === 'entry2_id' ? winnerEntry : null,
  }
  // Pasar net_height / forbidden_zone_serving si existen para mantener config
  if ((m as any).net_height != null) newMatch.net_height = (m as any).net_height
  if ((m as any).forbidden_zone_serving != null) newMatch.forbidden_zone_serving = (m as any).forbidden_zone_serving

  const { error: insErr } = await service.from('matches').insert(newMatch)
  if (insErr) return { advanced: false, reason: `insert failed: ${insErr.message}` }
  return { advanced: true }
}
