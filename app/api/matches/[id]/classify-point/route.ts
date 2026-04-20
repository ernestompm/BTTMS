import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import type { PointType, ShotDirection } from '@/types'

// Updates the point_type of the last registered point (non-blocking stats refinement).
// The score is already computed and saved by POST /point — this only refines the classification.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = await params
  const supabase = await createServerSupabase()
  const service = createServiceSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await supabase.from('app_users').select('role').eq('id', user.id).single()
  if (!appUser) return NextResponse.json({ error: 'User not found' }, { status: 403 })

  const body = await req.json()
  const { point_type, shot_direction }: { point_type: PointType; shot_direction: ShotDirection | null } = body

  if (!point_type) return NextResponse.json({ error: 'Missing point_type' }, { status: 400 })

  const { data: lastPoint } = await service
    .from('points')
    .select('id, match_id')
    .eq('match_id', matchId)
    .eq('is_undone', false)
    .order('sequence', { ascending: false })
    .limit(1)
    .single()

  if (!lastPoint) return NextResponse.json({ error: 'No point found' }, { status: 404 })

  await service.from('points').update({
    point_type,
    shot_direction: shot_direction ?? null,
  }).eq('id', lastPoint.id)

  return NextResponse.json({ ok: true })
}
