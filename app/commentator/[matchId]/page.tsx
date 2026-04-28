// ============================================================================
// /commentator/[matchId] — CIS · Centro de Información del Comentarista
// ============================================================================
// Server component que obtiene todos los datos necesarios para el comentario:
// match con score+stats, biografias completas de los 4 jugadores, cuadro de
// la categoria, partidos previos en el torneo, log reciente de puntos.
// Pasa todo a un client component que se suscribe a realtime y renderiza.
// ============================================================================

import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import { CommentatorCIS } from '@/components/commentator/cis'

export const dynamic = 'force-dynamic'

export default async function CommentatorMatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = createServiceSupabase()
  const { data: appUser } = await service.from('app_users').select('*').eq('id', user.id).single()
  if (!appUser) redirect('/login')

  // Match con todo lo necesario
  const { data: match } = await service.from('matches')
    .select(`*,
      court:courts(name),
      judge:app_users!judge_id(full_name),
      entry1:draw_entries!entry1_id(*, player1:players!player1_id(*), player2:players!player2_id(*)),
      entry2:draw_entries!entry2_id(*, player1:players!player1_id(*), player2:players!player2_id(*))
    `)
    .eq('id', matchId).single()
  if (!match) notFound()

  const { data: tournament } = await service.from('tournaments')
    .select('*').eq('id', (match as any).tournament_id).single()

  // Cuadro de la categoría — todos los partidos para visualizar bracket
  const { data: bracketMatches } = await service.from('matches')
    .select(`id, round, match_number, status, score,
      entry1:draw_entries!entry1_id(player1:players!player1_id(first_name,last_name), player2:players!player2_id(first_name,last_name)),
      entry2:draw_entries!entry2_id(player1:players!player1_id(first_name,last_name), player2:players!player2_id(first_name,last_name))
    `)
    .eq('tournament_id', (match as any).tournament_id)
    .eq('category', (match as any).category)
    .order('match_number', { ascending: true })

  // Partidos previos en este torneo (mismos jugadores) para hablar de
  // historial / racha
  const playerIds: string[] = []
  for (const e of [(match as any).entry1, (match as any).entry2]) {
    if (e?.player1?.id) playerIds.push(e.player1.id)
    if (e?.player2?.id) playerIds.push(e.player2.id)
  }
  const { data: previousMatches } = playerIds.length > 0 ? await service.from('matches')
    .select(`id, round, status, score, finished_at,
      entry1:draw_entries!entry1_id(player1:players!player1_id(id,first_name,last_name), player2:players!player2_id(id,first_name,last_name)),
      entry2:draw_entries!entry2_id(player1:players!player1_id(id,first_name,last_name), player2:players!player2_id(id,first_name,last_name))
    `)
    .eq('tournament_id', (match as any).tournament_id)
    .eq('status', 'finished')
    .neq('id', matchId)
    .order('finished_at', { ascending: false })
    .limit(20) : { data: [] as any }

  // Log de puntos reciente del partido (los últimos 50 no deshechos)
  const { data: pointLog } = await service.from('points')
    .select('*')
    .eq('match_id', matchId)
    .eq('is_undone', false)
    .order('sequence', { ascending: false })
    .limit(50)

  return (
    <CommentatorCIS
      currentUser={appUser as any}
      initialMatch={match as any}
      tournament={tournament as any}
      bracketMatches={(bracketMatches as any) ?? []}
      previousMatches={(previousMatches as any) ?? []}
      initialPointLog={(pointLog as any) ?? []}
    />
  )
}
