'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Persistent FIFO queue of point submissions that couldn't reach the
 * server (offline, timeout, 5xx). Survives page reloads via localStorage
 * so a judge who crashes mid-game loses nothing. On reconnect the queue
 * is drained serially — the scoring engine is deterministic, so replaying
 * the same sequence of point-winners on the server yields the same score.
 */
export interface QueuedPoint {
  id: string           // client-side id (unique)
  matchId: string
  winnerTeam: 1 | 2
  pointType: string
  shotDirection: string | null
  queuedAt: string     // ISO timestamp
  attempts: number
}

const STORAGE_KEY = 'bttms_point_queue_v1'

function loadAll(): QueuedPoint[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveAll(q: QueuedPoint[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(q)) } catch {}
}

export function useOfflineQueue(matchId: string) {
  const [queue, setQueue] = useState<QueuedPoint[]>([])
  const [draining, setDraining] = useState(false)
  const drainingRef = useRef(false)

  // Load persisted queue for this match on mount
  useEffect(() => {
    const all = loadAll().filter((p) => p.matchId === matchId)
    setQueue(all)
  }, [matchId])

  const persist = useCallback((updater: (prev: QueuedPoint[]) => QueuedPoint[]) => {
    const all = loadAll()
    const others = all.filter((p) => p.matchId !== matchId)
    const mine = all.filter((p) => p.matchId === matchId)
    const next = updater(mine)
    saveAll([...others, ...next])
    setQueue(next)
  }, [matchId])

  const enqueue = useCallback((p: Omit<QueuedPoint, 'id' | 'queuedAt' | 'attempts' | 'matchId'>) => {
    const entry: QueuedPoint = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      matchId,
      queuedAt: new Date().toISOString(),
      attempts: 0,
      ...p,
    }
    persist((prev) => [...prev, entry])
    return entry
  }, [matchId, persist])

  const clear = useCallback(() => persist(() => []), [persist])

  /**
   * Drain the queue by submitting each point in FIFO order. Caller supplies
   * `submit` (wraps the fetch) and `onDrained(state)` to resync from server
   * after the queue is empty. Returns true if fully drained, false if it
   * hit a still-failing item (left in the queue for the next attempt).
   */
  const drain = useCallback(async (
    submit: (p: QueuedPoint) => Promise<{ ok: true; result: any } | { ok: false }>,
    onDrained?: () => Promise<void> | void,
  ): Promise<boolean> => {
    if (drainingRef.current) return false
    drainingRef.current = true
    setDraining(true)
    try {
      let pending = loadAll().filter((p) => p.matchId === matchId)
      while (pending.length > 0) {
        const [head, ...rest] = pending
        const res = await submit(head)
        if (res.ok) {
          // Drop head from storage and keep draining
          persist(() => rest)
          pending = rest
        } else {
          // Leave head in queue with bumped attempt count
          persist(() => [{ ...head, attempts: head.attempts + 1 }, ...rest])
          return false
        }
      }
      if (onDrained) await onDrained()
      return true
    } finally {
      drainingRef.current = false
      setDraining(false)
    }
  }, [matchId, persist])

  return { queue, enqueue, clear, drain, draining, count: queue.length }
}
