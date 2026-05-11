import { NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from './supabase-server'
import type { AppUser } from '@/types'

/**
 * Helpers de autenticación para rutas API.
 * Centralizan los patrones que antes se repetían en cada route.ts.
 */

export type Role = 'super_admin' | 'tournament_director' | 'staff' | 'judge' | 'commentator'

const STAFF_ROLES: Role[] = ['super_admin', 'tournament_director', 'staff']
const ALL_ROLES: Role[] = ['super_admin', 'tournament_director', 'staff', 'judge', 'commentator']

/**
 * Devuelve el usuario autenticado o un NextResponse 401/403.
 * Uso típico:
 *   const auth = await requireRole(['super_admin', 'tournament_director', 'staff'])
 *   if (auth instanceof NextResponse) return auth
 *   // auth.user disponible
 */
export async function requireRole(roles: Role[] = ALL_ROLES) {
  const supabase = await createServerSupabase()
  const service = createServiceSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data: appUser } = await service.from('app_users').select('*').eq('id', user.id).single()
  if (!appUser) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 403 })
  }

  if (!roles.includes(appUser.role as Role)) {
    return NextResponse.json({ error: 'Sin permisos para esta acción' }, { status: 403 })
  }

  return { user, appUser: appUser as AppUser }
}

/** Atajo: requiere staff (admin, director, staff). */
export const requireStaff = () => requireRole(STAFF_ROLES)

/** Atajo: requiere cualquier usuario autenticado. */
export const requireAuth = () => requireRole(ALL_ROLES)
