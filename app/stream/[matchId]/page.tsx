import { createServiceSupabase } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import { OperatorPanel } from '@/components/streaming/OperatorPanel'

export const dynamic = 'force-dynamic'

export default async function StreamOperatorPage({ params }: { params: Promise<{ matchId: string }> }) {
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

  const { data: tournament } = await service.from('tournaments').select('*').eq('id', match.tournament_id).single()

  // Session auto-provisioned
  let { data: session } = await service.from('stream_sessions').select('*').eq('match_id', matchId).single()
  if (!session) {
    const { data: created } = await service.from('stream_sessions').insert({
      tournament_id: match.tournament_id, match_id: matchId, active: true,
    }).select('*').single()
    session = created
  }

  const { data: rules } = await service.from('stream_automation_rules')
    .select('*').eq('tournament_id', match.tournament_id).order('trigger_type')

  const { data: recentMatches } = await service.from('matches')
    .select(`id, round, status, category, match_type, score,
      entry1:draw_entries!entry1_id(player1:players!player1_id(last_name), player2:players!player2_id(last_name)),
      entry2:draw_entries!entry2_id(player1:players!player1_id(last_name), player2:players!player2_id(last_name))`)
    .eq('tournament_id', match.tournament_id).eq('category', match.category).order('scheduled_at')

  return (
    <OperatorPanel
      session={session as any}
      initialMatch={match as any}
      tournament={tournament as any}
      rules={(rules as any) ?? []}
      recentMatches={(recentMatches as any) ?? []}
    />
  )
}
