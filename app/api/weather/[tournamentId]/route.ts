import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { getWeather } from '@/lib/weather'

export async function GET(req: NextRequest, { params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params
  const service = createServiceSupabase()

  const { data: tournament } = await service.from('tournaments')
    .select('venue_lat, venue_lng, venue_city').eq('id', tournamentId).single()

  if (!tournament?.venue_lat || !tournament?.venue_lng) {
    return NextResponse.json({ error: 'No GPS coordinates' }, { status: 400 })
  }

  const weather = await getWeather(tournament.venue_lat, tournament.venue_lng, tournamentId)
  if (!weather) return NextResponse.json({ error: 'Weather unavailable' }, { status: 503 })

  weather.location = tournament.venue_city ?? weather.location
  return NextResponse.json(weather, { headers: { 'Cache-Control': 'public, max-age=300' } })
}
