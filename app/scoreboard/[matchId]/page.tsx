import { createServerSupabase } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import { VenueScoreboard } from '@/components/scoreboard/venue-scoreboard'

export default async function ScoreboardPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params
  const supabase = await createServerSupabase()

  const { data: match } = await supabase.from('matches')
    .select(`*, court:courts(*), entry1:draw_entries!entry1_id(*, player1:players!player1_id(*), player2:players!player2_id(*)), entry2:draw_entries!entry2_id(*, player1:players!player1_id(*), player2:players!player2_id(*))`)
    .eq('id', matchId)
    .single()

  if (!match) notFound()

  // Get tournament config for scoreboard visual settings
  const { data: tournament } = await supabase.from('tournaments')
    .select('scoreboard_config, name, sponsors, logo_url')
    .eq('id', match.tournament_id)
    .single()

  // Get weather data if tournament has GPS coords
  let weather = null
  try {
    const { data: fullTournament } = await supabase.from('tournaments')
      .select('venue_lat, venue_lng, venue_city, id')
      .eq('id', match.tournament_id)
      .single()
    if (fullTournament?.venue_lat) {
      const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/weather/${fullTournament.id}`, { next: { revalidate: 300 } })
      if (res.ok) weather = await res.json()
    }
  } catch {}

  return (
    <VenueScoreboard
      initialMatch={match as any}
      config={tournament?.scoreboard_config as any}
      tournamentName={tournament?.name ?? ''}
      sponsors={tournament?.sponsors as any ?? []}
      weather={weather}
    />
  )
}
