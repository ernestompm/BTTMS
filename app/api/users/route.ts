import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

async function requireAdmin() {
  const supabase = await createServerSupabase()
  const service = createServiceSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const { data: appUser } = await service.from('app_users').select('role').eq('id', user.id).single()
  if (!appUser || !['super_admin', 'tournament_director'].includes(appUser.role)) {
    return { error: 'Forbidden', status: 403 as const }
  }
  return { user, service }
}

export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await auth.service
    .from('app_users')
    .select('*')
    .order('role')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: data ?? [] })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { email, password, full_name, role, phone, tournament_id } = await req.json()
  if (!email || !password || !full_name || !role) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data: authUser, error: authError } = await auth.service.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (authError || !authUser.user) {
    return NextResponse.json({ error: authError?.message ?? 'Auth error' }, { status: 500 })
  }

  const { error: dbError } = await auth.service.from('app_users').insert({
    id: authUser.user.id, email, role, full_name, phone: phone ?? null,
    tournament_id: tournament_id ?? null, is_active: true,
  })
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
