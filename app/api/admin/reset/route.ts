import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceSupabase()
  const { data: appUser } = await service.from('app_users').select('role').eq('id', user.id).single()
  if (appUser?.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Delete in dependency order, checking each step
  const steps: Array<[string, () => Promise<{ error: any }>]> = [
    ['points',       () => service.from('points').delete().neq('id', '00000000-0000-0000-0000-000000000000')],
    ['matches',      () => service.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000')],
    ['draw_entries', () => service.from('draw_entries').delete().neq('id', '00000000-0000-0000-0000-000000000000')],
    ['groups',       () => service.from('groups').delete().neq('id', '00000000-0000-0000-0000-000000000000')],
    ['draws',        () => service.from('draws').delete().neq('id', '00000000-0000-0000-0000-000000000000')],
    ['players',      () => service.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000')],
  ]

  for (const [name, fn] of steps) {
    const { error } = await fn()
    if (error) {
      return NextResponse.json({
        error: `Error borrando ${name}: ${error.message}`,
        needs_sql_fix: name === 'points' || name === 'matches',
      }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
