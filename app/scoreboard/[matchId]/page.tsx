import { createServiceSupabase } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import { VenueScoreboard } from '@/components/scoreboard/venue-scoreboard'

export const dynamic = 'force-dynamic'

export default async function ScoreboardPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params
  const service = createServiceSupabase()

  const { data: match } = await service.from('matches')
    .select(`*, court:courts(*), entry1:draw_entries!entry1_id(*, player1:players!player1_id(*), player2:players!player2_id(*)), entry2:draw_entries!entry2_id(*, player1:players!player1_id(*), player2:players!player2_id(*))`)
    .eq('id', matchId)
    .single()

  if (!match) notFound()

  const { data: tournament } = await service.from('tournaments')
    .select('scoreboard_config, name, sponsors, logo_url, warmup_duration_seconds')
    .eq('id', match.tournament_id)
    .single()

  return (
    <VenueScoreboard
      initialMatch={match as any}
      config={tournament?.scoreboard_config as any}
      tournamentName={tournament?.name ?? ''}
      sponsors={tournament?.sponsors as any ?? []}
      warmupDuration={tournament?.warmup_duration_seconds ?? 300}
      weather={null}
    />
  )
}
