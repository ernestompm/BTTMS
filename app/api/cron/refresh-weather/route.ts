import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { getWeather } from '@/lib/weather'

/**
 * Cron job: refresca weather_cache para todos los torneos con
 * venue_lat/venue_lng definidos. Programado vía vercel.json para
 * correr cada 10 minutos. También se puede llamar manualmente
 * (autenticado vía CRON_SECRET).
 *
 * Open-Meteo es gratis y sin API key. Solo coordenadas.
 */
export async function GET(req: NextRequest) {
  // Vercel pasa el header authorization con el CRON_SECRET en sus cron
  // jobs. En llamada manual se acepta también el secret por query.
  const authHeader = req.headers.get('authorization') ?? ''
  const querySecret = new URL(req.url).searchParams.get('secret') ?? ''
  const cronSecret = process.env.CRON_SECRET
  const isVercelCron = cronSecret && authHeader === `Bearer ${cronSecret}`
  const isAllowedManual = cronSecret && querySecret === cronSecret
  if (cronSecret && !isVercelCron && !isAllowedManual) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const service = createServiceSupabase()
  const { data: tournaments } = await service
    .from('tournaments')
    .select('id, venue_lat, venue_lng')
    .not('venue_lat', 'is', null)
    .not('venue_lng', 'is', null)

  if (!tournaments || tournaments.length === 0) {
    return NextResponse.json({ refreshed: 0, note: 'no tournaments with coords' })
  }

  let refreshed = 0
  const errors: Array<{ tournament_id: string, error: string }> = []

  for (const t of tournaments) {
    try {
      const data = await getWeather(
        Number((t as any).venue_lat),
        Number((t as any).venue_lng),
        `tournament:${(t as any).id}`,
      )
      if (data) {
        await service.from('weather_cache').upsert({
          tournament_id: (t as any).id,
          data,
          updated_at: new Date().toISOString(),
        })
        refreshed++
      } else {
        errors.push({ tournament_id: (t as any).id, error: 'open-meteo returned null' })
      }
    } catch (err: any) {
      errors.push({ tournament_id: (t as any).id, error: err?.message ?? 'unknown' })
    }
  }

  return NextResponse.json({
    refreshed,
    total: tournaments.length,
    errors: errors.length > 0 ? errors : undefined,
  })
}
