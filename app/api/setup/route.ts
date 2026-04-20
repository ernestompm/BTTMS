import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

// One-time setup endpoint: creates the first super_admin user
// Only works if no users exist yet
export async function POST(req: NextRequest) {
  const service = createServiceSupabase()

  // Check if any user exists
  const { count } = await service.from('app_users').select('*', { count: 'exact', head: true })
  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: 'Setup already completed. Users exist.' }, { status: 400 })
  }

  const body = await req.json()
  const { email, password, full_name } = body

  if (!email || !password || !full_name) {
    return NextResponse.json({ error: 'email, password and full_name are required' }, { status: 400 })
  }

  // Create auth user
  const { data: authUser, error: authError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !authUser.user) {
    return NextResponse.json({ error: authError?.message ?? 'Failed to create auth user' }, { status: 500 })
  }

  // Create app user record
  const { error: dbError } = await service.from('app_users').insert({
    id: authUser.user.id,
    email,
    role: 'super_admin',
    full_name,
    is_active: true,
  })

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: `Super admin created: ${email}` })
}
