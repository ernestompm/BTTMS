// ============================================================================
// Streaming command layer — operator/overlay shared API
// ============================================================================
// All mutations go through here so automation + manual buttons use a single
// surface. Writes through Supabase RPC (stream_patch_graphic) for atomicity.
// ============================================================================

import { createClient } from '@/lib/supabase'
import type { GraphicKey, GraphicsMap } from '@/types/streaming'
import { GRAPHICS } from './catalog'

const supabase = () => createClient()

export interface ShowOptions {
  data?: any
  /** hide any graphics listed as exclusive for this one */
  enforceExclusive?: boolean
}

/** Patch a single graphic slot. Atomic via RPC. */
export async function patchGraphic(sessionId: string, key: GraphicKey, patch: any) {
  const { error } = await supabase().rpc('stream_patch_graphic', {
    p_session_id: sessionId, p_key: key, p_patch: patch,
  })
  if (error) throw error
}

export async function showGraphic(sessionId: string, key: GraphicKey, opts: ShowOptions = {}) {
  // Exclusive hide: send a single UPDATE touching multiple keys.
  const meta = GRAPHICS[key]
  if (opts.enforceExclusive !== false && meta.exclusive?.length) {
    const { data: s } = await supabase().from('stream_state').select('graphics').eq('session_id', sessionId).single()
    const current: GraphicsMap = (s?.graphics as any) ?? {}
    const next: GraphicsMap = { ...current }
    for (const k of meta.exclusive) {
      next[k] = { ...(next[k] ?? {}), visible: false }
    }
    next[key] = { ...(next[key] ?? {}), visible: true, data: opts.data ?? next[key]?.data ?? null, since: new Date().toISOString() }
    const { error } = await supabase().from('stream_state').update({ graphics: next }).eq('session_id', sessionId)
    if (error) throw error
    return
  }
  await patchGraphic(sessionId, key, { visible: true, data: opts.data ?? null })
}

export async function hideGraphic(sessionId: string, key: GraphicKey) {
  await patchGraphic(sessionId, key, { visible: false })
}

export async function toggleGraphic(sessionId: string, key: GraphicKey, data?: any) {
  const { data: s } = await supabase().from('stream_state').select('graphics').eq('session_id', sessionId).single()
  const cur = ((s?.graphics as any) ?? {})[key]?.visible ? false : true
  if (cur) await showGraphic(sessionId, key, { data })
  else     await hideGraphic(sessionId, key)
}

export async function hideAll(sessionId: string) {
  const { error } = await supabase().rpc('stream_hide_all', { p_session_id: sessionId })
  if (error) throw error
}

export async function logEvent(sessionId: string, kind: string, graphic: GraphicKey | null, payload: any = null) {
  await supabase().from('stream_events').insert({ session_id: sessionId, kind, graphic, payload })
}
