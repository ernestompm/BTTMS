// ============================================================================
// POST /api/matches/[id]/advance
// ============================================================================
// Endpoint que dispara el auto-advance del ganador al siguiente partido del
// cuadro (mismo logica que el trigger SQL 018, pero en JS para que funcione
// independientemente de la migracion). Lo llamamos despues de cerrar un
// partido manualmente desde el editor de resultados.
// ============================================================================

import { NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { advanceWinnerToNextRound } from '@/lib/bracket-advance'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = await params
  const supabase = await createServerSupabase()
  const service = createServiceSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await service.from('app_users').select('role').eq('id', user.id).single()
  if (!appUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  // Solo admin/director pueden mover gente entre rondas
  if (!['super_admin', 'tournament_director'].includes(appUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const result = await advanceWinnerToNextRound(service, matchId)
  return NextResponse.json(result)
}
