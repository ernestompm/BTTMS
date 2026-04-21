import { NextRequest, NextResponse } from 'next/server'
import { buildBroadcastPayload } from '@/lib/broadcast-payload'

/**
 * GET /api/broadcast/export?tournament=<uuid>&match=<uuid>
 *
 * Canonical broadcast payload for vMix / CasparCG / OBS.
 * `?match=` optional — defaults to the tournament's broadcast_active match,
 * or the most recently started match in progress.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tournamentId = searchParams.get('tournament') ?? '00000000-0000-0000-0000-000000000001'
  const matchId = searchParams.get('match') ?? undefined

  const payload = await buildBroadcastPayload(tournamentId, matchId)
  if (!payload) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(payload)
}
