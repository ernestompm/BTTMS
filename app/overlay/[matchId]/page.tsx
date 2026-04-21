import { createServiceSupabase } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import { OverlayStage } from '@/components/streaming/OverlayStage'

export const dynamic = 'force-dynamic'

/**
 * /overlay/[matchId]
 * Alpha-channel graphics output for vMix. Transparent background.
 * Pages itself to a given session for the match; if no session exists, one is
 * auto-provisioned so the URL always resolves.
 */
export default async function OverlayPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params
  const service = createServiceSupabase()

  const { data: match } = await service.from('matches')
    .select(`
      *,
      court:courts(*),
      judge:app_users!judge_id(full_name),
      entry1:draw_entries!entry1_id(*, player1:players!player1_id(*), player2:players!player2_id(*)),
      entry2:draw_entries!entry2_id(*, player1:players!player1_id(*), player2:players!player2_id(*))
    `)
    .eq('id', matchId).single()

  if (!match) notFound()

  // Tournament + sponsors
  const { data: tournament } = await service.from('tournaments').select('*').eq('id', match.tournament_id).single()

  // All matches (for results grid), narrowed to same category + category draws
  const { data: allMatches } = await service.from('matches')
    .select(`id, round, status, category, match_type, score, entry1:draw_entries!entry1_id(player1:players!player1_id(last_name), player2:players!player2_id(last_name)), entry2:draw_entries!entry2_id(player1:players!player1_id(last_name), player2:players!player2_id(last_name))`)
    .eq('tournament_id', match.tournament_id)
    .eq('category', match.category)
    .order('scheduled_at')

  // Ensure a stream session exists
  let { data: session } = await service.from('stream_sessions').select('*').eq('match_id', matchId).single()
  if (!session) {
    const { data: created } = await service.from('stream_sessions').insert({
      tournament_id: match.tournament_id, match_id: matchId, active: true,
    }).select('*').single()
    session = created
  }

  const mainSponsor = (tournament?.sponsors ?? []).find((s:any) => s.tier === 'main' || s.tier === 'principal') ?? (tournament?.sponsors ?? [])[0] ?? null
  const referee = (match as any).judge ? { full_name: (match as any).judge.full_name } : null

  return (
    <OverlayStage
      sessionId={session!.id}
      initialMatch={match as any}
      tournament={tournament as any}
      allMatches={(allMatches as any) ?? []}
      referee={referee}
      mainSponsor={mainSponsor}
    />
  )
}
