import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

// One-time setup endpoint: creates the first super_admin user.
// Hardened: requiere SETUP_TOKEN (env var) si está definido. Esto
// protege contra el caso "app_users se vacía accidentalmente y
// cualquiera puede reclamarse super_admin".
export async function POST(req: NextRequest) {
  const service = createServiceSupabase()

  // Si está configurado SETUP_TOKEN, exige header Authorization Bearer.
  const expectedToken = process.env.SETUP_TOKEN
  if (expectedToken) {
    const authHeader = req.headers.get('authorization') ?? ''
    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'SETUP_TOKEN inválido o ausente' }, { status: 401 })
    }
  }

  // Check if any user exists
  const { count } = await service.from('app_users').select('*', { count: 'exact', head: true })
  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: 'Setup ya completado. Existen usuarios.' }, { status: 400 })
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
