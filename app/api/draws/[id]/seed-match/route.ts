import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { requireRole } from '@/lib/auth-helpers'

/**
 * POST /api/draws/[id]/seed-match
 *
 * Asigna parejas a un slot concreto del cuadro. Crea el match si no
 * existía, o actualiza las entries si ya estaba.
 *
 * Body: {
 *   round: 'R64'|'R32'|'R16'|'QF'|'SF'|'F',
 *   match_number: number,         // posición dentro de la ronda (1..N/2 partidos)
 *   entry1_id: string | null,
 *   entry2_id: string | null,
 * }
 *
 * Idempotente: re-llamar con los mismos valores reemplaza las entries
 * del slot sin duplicar matches. Si entry1_id Y entry2_id son null y
 * existía un match, se borra (limpia el slot).
 *
 * Solo super_admin / tournament_director.
 */

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['super_admin', 'tournament_director'])
  if (auth instanceof NextResponse) return auth

  const { id: drawId } = await params
  const body = await req.json().catch(() => ({})) as {
    round?: string
    match_number?: number
    entry1_id?: string | null
    entry2_id?: string | null
  }

  const { round, match_number, entry1_id = null, entry2_id = null } = body

  if (!round || typeof match_number !== 'number') {
    return NextResponse.json({ error: 'Falta round o match_number' }, { status: 400 })
  }

  // entry1 y entry2 no pueden ser la misma pareja
  if (entry1_id && entry2_id && entry1_id === entry2_id) {
    return NextResponse.json({ error: 'Las dos parejas del partido no pueden ser la misma.' }, { status: 400 })
  }

  const service = createServiceSupabase()

  // Carga el draw para sacar tournament_id, category y match_type
  const { data: draw } = await service.from('draws')
    .select('id, tournament_id, category, structure')
    .eq('id', drawId)
    .single()

  if (!draw) {
    return NextResponse.json({ error: 'Cuadro no encontrado' }, { status: 404 })
  }

  const matchType = (draw as any).structure?.match_type ?? 'doubles'
  const scoringSystem = (draw as any).structure?.scoring_system ?? 'best_of_2_sets_super_tb'

  // Verifica si ya existe un match en este slot
  const { data: existing } = await service.from('matches')
    .select('id, status')
    .eq('draw_id', drawId)
    .eq('round', round)
    .eq('match_number', match_number)
    .maybeSingle()

  // Si quedó vacío el slot (ambos null) y había un match → borrarlo
  if (entry1_id === null && entry2_id === null) {
    if (existing) {
      if (existing.status === 'in_progress' || existing.status === 'finished') {
        return NextResponse.json({
          error: `No se puede borrar un partido en estado «${existing.status}». Termínalo o anúlalo desde el detalle del partido.`,
        }, { status: 400 })
      }
      await service.from('matches').delete().eq('id', existing.id)
      return NextResponse.json({ deleted: true, slot: { round, match_number } })
    }
    return NextResponse.json({ noop: true, slot: { round, match_number } })
  }

  // Si existía, actualiza entries
  if (existing) {
    if (existing.status === 'in_progress' || existing.status === 'finished') {
      return NextResponse.json({
        error: `No se pueden cambiar las parejas de un partido en estado «${existing.status}».`,
      }, { status: 400 })
    }
    const { data: updated, error: updErr } = await service.from('matches')
      .update({ entry1_id, entry2_id })
      .eq('id', existing.id)
      .select('*')
      .single()
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
    return NextResponse.json({ updated: true, match: updated })
  }

  // Si no existía, crea match nuevo
  const { data: created, error: insErr } = await service.from('matches').insert({
    tournament_id: (draw as any).tournament_id,
    draw_id: drawId,
    category: (draw as any).category,
    round,
    match_number,
    match_type: matchType,
    entry1_id,
    entry2_id,
    scoring_system: scoringSystem,
    status: 'scheduled',
  }).select('*').single()

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  return NextResponse.json({ created: true, match: created })
}
