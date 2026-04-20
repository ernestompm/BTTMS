import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceSupabase()
  const { data: appUser } = await service.from('app_users').select('role').eq('id', user.id).single()
  if (appUser?.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Delete in dependency order
  await service.from('points').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await service.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await service.from('draw_entries').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await service.from('groups').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await service.from('draws').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await service.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  return NextResponse.json({ success: true, message: 'Base de datos reseteada. Jugadores, cuadros, partidos y puntos eliminados.' })
}
