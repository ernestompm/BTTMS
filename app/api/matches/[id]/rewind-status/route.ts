import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { pushBroadcastEvent } from '@/lib/broadcast-push'

/**
 * POST /api/matches/[id]/rewind-status
 *
 * Deshace el avance de estado del match. Útil cuando el juez se equivoca
 * (toss mal, jugadores aún no en pista, identificación errónea...). El
 * flujo es:
 *
 *   scheduled  ← judge_on_court  ← players_on_court  ← warmup
 *
 * No se permite retroceder desde 'in_progress', 'finished', 'retired',
 * 'walkover' — esos estados ya tienen puntos registrados y rebobinarlos
 * sería destructivo. Para esos casos hay /undo (punto individual).
 *
 * Auth: juez asignado al match o admin.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = await params
  const supabase = await createServerSupabase()
  const service = createServiceSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await service.from('app_users').select('role').eq('id', user.id).single()
  if (!appUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: match } = await service.from('matches').select('*').eq('id', matchId).single()
  if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (appUser.role === 'judge' && match.judge_id !== user.id) {
    return NextResponse.json({ error: 'Not your match' }, { status: 403 })
  }

  let update: Record<string, any> = {}
  let broadcastEvent: string = 'status_rewound'

  switch (match.status) {
    case 'judge_on_court':
      // Vuelve a scheduled: limpia datos de identificación del juez.
      update = {
        status: 'scheduled',
        judge_on_court_at: null,
        judge_name: null,
      }
      broadcastEvent = 'judge_on_court_undone'
      break

    case 'players_on_court':
      // Vuelve a judge_on_court: jugadores aún no estaban en pista.
      update = {
        status: 'judge_on_court',
        players_on_court_at: null,
      }
      broadcastEvent = 'players_on_court_undone'
      break

    case 'warmup':
      // Vuelve a players_on_court: deshace el sorteo y reinicia el score.
      // Se vuelve a mostrar la TossScreen para rehacerlo desde cero.
      update = {
        status: 'players_on_court',
        warmup_started_at: null,
        toss_winner: null,
        toss_choice: null,
        serving_team: null,
        side_entry1: null,
        current_server_id: null,
        score: null,
        stats: null,
      }
      broadcastEvent = 'warmup_undone'
      break

    case 'scheduled':
      return NextResponse.json({ error: 'Already at first state (scheduled)' }, { status: 400 })

    default:
      // in_progress / finished / retired / walkover — no se puede retroceder
      // sin destruir puntos. Si necesitas resetear el match completo, usa
      // un endpoint de admin distinto.
      return NextResponse.json({
        error: `Cannot rewind from status "${match.status}". Use /undo for individual points, or contact admin.`,
      }, { status: 400 })
  }

  const { data: updated } = await service
    .from('matches')
    .update(update)
    .eq('id', matchId)
    .select('*')
    .single()

  if (match.broadcast_active && updated) {
    pushBroadcastEvent(updated.tournament_id, matchId, broadcastEvent, {
      from_status: match.status,
      to_status: update.status,
    })
  }

  return NextResponse.json(updated)
}
