import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

const ALLOWED_ROLES = ['super_admin', 'tournament_director', 'staff', 'judge', 'commentator'] as const

async function requireAdmin() {
  const supabase = await createServerSupabase()
  const service = createServiceSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado', status: 401 as const }
  const { data: appUser } = await service.from('app_users').select('role').eq('id', user.id).single()
  if (!appUser || !['super_admin', 'tournament_director'].includes(appUser.role)) {
    return { error: 'Sin permisos', status: 403 as const }
  }
  return { user, appUser, service }
}

/**
 * PATCH /api/users/[id]
 * Edita un usuario. Acepta campos opcionales:
 *   - full_name, role, phone, is_active
 *   - email (cambia también en Supabase Auth)
 *   - password (resetea en Supabase Auth — campo opcional, no obligatorio)
 *
 * Reglas:
 *   - Solo super_admin / tournament_director (vía requireAdmin).
 *   - Un usuario NO puede degradarse su propio rol de super_admin
 *     (evita lockout accidental).
 *   - tournament_director NO puede tocar a un super_admin (jerarquía).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id: targetId } = await params
  const body = await req.json().catch(() => ({})) as {
    full_name?: string
    role?: string
    phone?: string | null
    is_active?: boolean
    email?: string
    password?: string
  }

  // Cargar target para checks de jerarquía y self-modify
  const { data: target } = await auth.service
    .from('app_users').select('id, role, email').eq('id', targetId).single()
  if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  // Jerarquía: tournament_director no puede tocar a super_admin
  if (auth.appUser.role === 'tournament_director' && (target as any).role === 'super_admin') {
    return NextResponse.json({ error: 'No puedes editar a un Super Admin' }, { status: 403 })
  }

  // Anti-lockout: no permitir auto-degradar/desactivar al propio super_admin
  const isSelf = auth.user.id === targetId
  if (isSelf) {
    if (body.role && body.role !== (target as any).role && (target as any).role === 'super_admin') {
      return NextResponse.json({ error: 'No puedes cambiar tu propio rol de Super Admin' }, { status: 400 })
    }
    if (body.is_active === false) {
      return NextResponse.json({ error: 'No puedes desactivar tu propia cuenta' }, { status: 400 })
    }
  }

  // Validar role si viene
  if (body.role && !ALLOWED_ROLES.includes(body.role as any)) {
    return NextResponse.json({ error: `Rol inválido. Permitidos: ${ALLOWED_ROLES.join(', ')}` }, { status: 400 })
  }

  // ── Cambios en Supabase Auth (email/password) ──
  if (body.email || body.password) {
    const updates: any = {}
    if (body.email) updates.email = body.email.trim().toLowerCase()
    if (body.password) updates.password = body.password
    const { error: authErr } = await auth.service.auth.admin.updateUserById(targetId, updates)
    if (authErr) {
      return NextResponse.json({ error: `Auth: ${authErr.message}` }, { status: 500 })
    }
  }

  // ── Cambios en app_users ──
  const dbUpdates: any = {}
  if (typeof body.full_name === 'string') dbUpdates.full_name = body.full_name.trim()
  if (typeof body.role === 'string')      dbUpdates.role = body.role
  if (body.phone !== undefined)           dbUpdates.phone = body.phone ?? null
  if (typeof body.is_active === 'boolean') dbUpdates.is_active = body.is_active
  if (body.email)                          dbUpdates.email = body.email.trim().toLowerCase()

  if (Object.keys(dbUpdates).length === 0) {
    return NextResponse.json({ ok: true, noop: true })
  }

  const { data: updated, error: dbErr } = await auth.service.from('app_users')
    .update(dbUpdates).eq('id', targetId).select('*').single()
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, user: updated })
}

/**
 * DELETE /api/users/[id]
 * Borra el usuario tanto de app_users como de Supabase Auth.
 *
 * Reglas:
 *   - Solo super_admin / tournament_director.
 *   - NUNCA borrarse a uno mismo.
 *   - tournament_director NO puede borrar a un super_admin.
 *   - Si el usuario es juez_id de algún match, no se borra (FK lo
 *     impide o se desreferencia con SET NULL según el schema). Por
 *     ahora confiamos en lo que diga la BD.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id: targetId } = await params
  if (auth.user.id === targetId) {
    return NextResponse.json({ error: 'No puedes borrar tu propia cuenta' }, { status: 400 })
  }

  const { data: target } = await auth.service
    .from('app_users').select('role, full_name').eq('id', targetId).single()
  if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  if (auth.appUser.role === 'tournament_director' && (target as any).role === 'super_admin') {
    return NextResponse.json({ error: 'No puedes borrar a un Super Admin' }, { status: 403 })
  }

  // Borrado en cascada: primero app_users (la FK match.judge_id queda
  // en SET NULL según schema), luego auth.users.
  const { error: dbErr } = await auth.service.from('app_users').delete().eq('id', targetId)
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  const { error: authErr } = await auth.service.auth.admin.deleteUser(targetId)
  if (authErr) {
    // app_users ya fue borrado — esto es inconsistente pero recuperable
    // dejando el huérfano en Auth. Reportamos para que el operador lo
    // limpie a mano si hace falta.
    return NextResponse.json({
      error: `app_users borrado pero falló al limpiar Supabase Auth: ${authErr.message}`,
      partial: true,
    }, { status: 500 })
  }

  return NextResponse.json({ ok: true, deleted_id: targetId, deleted_name: (target as any).full_name })
}
