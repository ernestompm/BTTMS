import { NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

/**
 * GET /api/auth/me
 * Devuelve el usuario autenticado actual con su rol de app_users.
 * Sirve para que el cliente pueda condicionar UI (p.ej. desactivar
 * "borrar" sobre uno mismo) sin tener que hacer joins en cada vista.
 */
export async function GET() {
  const supabase = await createServerSupabase()
  const service = createServiceSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ user: null }, { status: 200 })

  const { data: appUser } = await service.from('app_users')
    .select('id, email, full_name, role, is_active')
    .eq('id', user.id).single()

  return NextResponse.json({ user: appUser ?? null })
}
