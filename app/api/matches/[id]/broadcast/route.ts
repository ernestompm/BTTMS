import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { pushBroadcastEvent } from '@/lib/broadcast-push'

/**
 * Activa o desactiva el broadcast de un match.
 *
 * Body: { active: boolean }
 *
 * Al activar:
 *  - desactiva el resto de matches del torneo (solo uno puede estar EN AIRE)
 *  - marca este match con broadcast_active=true
 *  - dispara push 'broadcast_started' con el snapshot actual del match
 *    para que vMix/CasparCG/OBS reciban el estado inicial sin esperar a
 *    que pase algo (un punto, etc.)
 *
 * Al desactivar:
 *  - marca el match con broadcast_active=false
 *  - dispara push 'broadcast_stopped' para que el receptor pueda limpiar
 *    los gráficos en pantalla.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = await params
  const supabase = await createServerSupabase()
  const service = createServiceSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: appUser } = await service.from('app_users').select('role').eq('id', user.id).single()
  if (!appUser) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const body = await req.json().catch(() => ({})) as { active?: boolean }
  const activate = body?.active === true

  const { data: match } = await service.from('matches').select('id,tournament_id,broadcast_active').eq('id', matchId).single()
  if (!match) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  if (activate) {
    // Solo un match puede estar EN AIRE por torneo. Apaga el resto antes
    // de encender el actual.
    await service.from('matches')
      .update({ broadcast_active: false })
      .eq('tournament_id', match.tournament_id)
      .neq('id', matchId)
  }

  const { data: updated } = await service.from('matches')
    .update({ broadcast_active: activate })
    .eq('id', matchId)
    .select('*')
    .single()

  if (!updated) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

  // Dispara push inmediato — al activar, manda el snapshot actual; al
  // desactivar, manda un evento para que el receptor pueda limpiar.
  // No bloquea la respuesta (fire-and-forget).
  if (activate) {
    pushBroadcastEvent(updated.tournament_id, matchId, 'broadcast_started')
  } else {
    pushBroadcastEvent(updated.tournament_id, matchId, 'broadcast_stopped')
  }

  return NextResponse.json(updated)
}
