import { createServiceSupabase } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import { OperatorPanel } from '@/components/streaming/OperatorPanel'
import { getWeather } from '@/lib/weather'

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

  let { data: session } = await service.from('stream_sessions').select('*').eq('match_id', matchId).single()
  if (!session) {
    const { data: created } = await service.from('stream_sessions').insert({
      tournament_id: match.tournament_id, match_id: matchId, active: true,
    }).select('*').single()
    session = created
  }

  const { data: rules } = await service.from('stream_automation_rules')
    .select('*').eq('tournament_id', match.tournament_id).order('trigger_type')

  const { data: allMatches } = await service.from('matches')
    .select(`id, round, status, category, match_type, score, scheduled_at, match_number,
      court:courts(name),
      entry1:draw_entries!entry1_id(seed, player1:players!player1_id(last_name,nationality), player2:players!player2_id(last_name,nationality)),
      entry2:draw_entries!entry2_id(seed, player1:players!player1_id(last_name,nationality), player2:players!player2_id(last_name,nationality))`)
    .eq('tournament_id', match.tournament_id).eq('category', match.category).order('match_number')

  const mainSponsor = (tournament?.sponsors ?? []).find((s:any) => s.tier === 'main' || s.tier === 'principal') ?? (tournament?.sponsors ?? [])[0] ?? null
  const referee = (match as any).judge ? { full_name: (match as any).judge.full_name } : null

  let weather = null
  try {
    if (tournament?.venue_lat && tournament?.venue_lng) {
      weather = await getWeather(tournament.venue_lat, tournament.venue_lng, `t:${tournament.id}`)
    }
  } catch {}

  return (
    <OperatorPanel
      session={session as any}
      initialMatch={match as any}
      tournament={tournament as any}
      rules={(rules as any) ?? []}
      allMatches={(allMatches as any) ?? []}
      referee={referee}
      mainSponsor={mainSponsor}
      weather={weather}
    />
  )
}
