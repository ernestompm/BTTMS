import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const service = createServiceSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await supabase.from('app_users').select('role').eq('id', user.id).single()
  if (!appUser || !['super_admin','tournament_director'].includes(appUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { email, password, full_name, role, phone, tournament_id } = await req.json()

  if (!email || !password || !full_name || !role) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data: authUser, error: authError } = await service.auth.admin.createUser({
    email, password, email_confirm: true,
  })

  if (authError || !authUser.user) {
    return NextResponse.json({ error: authError?.message ?? 'Auth error' }, { status: 500 })
  }

  const { error: dbError } = await service.from('app_users').insert({
    id: authUser.user.id, email, role, full_name, phone: phone ?? null,
    tournament_id: tournament_id ?? null, is_active: true,
  })

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
