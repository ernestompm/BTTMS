import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const service = createServiceSupabase()
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')

  let query = service.from('players').select('*').order('last_name')
  if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)

  const { data, error } = await query.limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const service = createServiceSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await supabase.from('app_users').select('role').eq('id', user.id).single()
  if (!appUser || !['super_admin','tournament_director','staff'].includes(appUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { data, error } = await service.from('players').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
