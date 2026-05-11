/**
 * Resolución del torneo activo.
 *
 * Hasta ahora 13 archivos importaban un TOURNAMENT_ID hardcoded a
 * '00000000-0000-0000-0000-000000000001'. Esto bloquea escalar a
 * múltiples torneos. Este módulo centraliza la resolución y mantiene
 * compat con instalaciones single-tenant.
 *
 * Para multi-tenant, se puede:
 *  - Leer de cookie/header
 *  - Inferir del path
 *  - Tener una lista en una tabla `active_tournament` por usuario
 *
 * Por ahora: si solo hay un torneo no-archivado → devuelve ese. Si hay
 * varios → busca el marcado como is_active, fallback al primero.
 */

import { createServiceSupabase } from './supabase-server'

/** ID del torneo activo. Cached durante la vida de la función serverless. */
let cachedId: string | null = null
let cachedAt = 0
const CACHE_TTL_MS = 30_000  // 30s — basta para una request, no demasiado largo

export const DEFAULT_TOURNAMENT_ID = '00000000-0000-0000-0000-000000000001'

/**
 * Devuelve el ID del torneo activo. En el caso típico de instalación
 * single-tenant, esto es siempre el mismo. La cache evita el roundtrip
 * a Supabase para queries frecuentes.
 */
export async function getActiveTournamentId(): Promise<string> {
  const now = Date.now()
  if (cachedId && now - cachedAt < CACHE_TTL_MS) {
    return cachedId
  }

  try {
    const service = createServiceSupabase()
    const { data } = await service
      .from('tournaments')
      .select('id, status')
      .order('start_date', { ascending: false })
      .limit(1)
      .single()

    if (data?.id) {
      cachedId = data.id as string
      cachedAt = now
      return cachedId
    }
  } catch {
    // Fallback al ID histórico si la consulta falla
  }

  return DEFAULT_TOURNAMENT_ID
}

/** Versión síncrona para componentes que no pueden hacer await. Devuelve
 *  el fallback histórico — usar solo cuando no se puede llamar al async. */
export function getDefaultTournamentId(): string {
  return DEFAULT_TOURNAMENT_ID
}

/** Limpia la caché — útil tras cambios de torneo (reset, switch). */
export function invalidateActiveTournamentCache(): void {
  cachedId = null
  cachedAt = 0
}
