import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceSupabase()
  const { data: appUser } = await service.from('app_users').select('role').eq('id', user.id).single()
  if (appUser?.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const FAKE_ID = '00000000-0000-0000-0000-000000000000'
  const tables = ['points', 'matches', 'draw_entries', 'groups', 'draws', 'players'] as const

  for (const name of tables) {
    const { error } = await service.from(name).delete().neq('id', FAKE_ID)
    if (error) {
      return NextResponse.json({
        error: `Error borrando ${name}: ${error.message}`,
        needs_sql_fix: name === 'points' || name === 'matches',
      }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
