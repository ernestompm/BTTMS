'use client'

import { useMemo, useState } from 'react'

/**
 * BracketBuilder — generador interactivo del cuadro.
 *
 * Muestra los slots de la PRIMERA RONDA del cuadro (R16/R32/R64 según
 * tamaño) y permite asignar parejas a cada slot con un selector. Cada
 * cambio crea o actualiza el match correspondiente vía
 * /api/draws/[id]/seed-match.
 *
 * Las rondas posteriores (QF, SF, F) se rellenan automáticamente
 * cuando se completa el match anterior (advanceWinnerToNextRound).
 *
 * No permite cambiar parejas en matches en juego o finalizados.
 */

interface Entry {
  id: string
  seed: number | null
  player1?: { first_name?: string, last_name?: string, ranking_rfet?: number | null } | null
  player2?: { first_name?: string, last_name?: string } | null
}

interface SlotMatch {
  id: string
  match_number: number
  round: string
  status: string
  entry1_id: string | null
  entry2_id: string | null
}

interface BracketBuilderProps {
  drawId: string
  drawSize: number
  entries: Entry[]
  existingMatches: SlotMatch[]
}

function teamLabel(e?: Entry | null): string {
  if (!e) return ''
  const p1 = e.player1 ? `${e.player1.first_name ?? ''} ${e.player1.last_name ?? ''}`.trim() : ''
  const p2 = e.player2 ? `${e.player2.first_name ?? ''} ${e.player2.last_name ?? ''}`.trim() : ''
  if (p1 && p2) return `${p1} / ${p2}`
  return p1 || p2 || '?'
}

/** Para un cuadro de N plazas, la primera ronda tiene N/2 partidos. */
function firstRoundFor(size: number): { round: string, matchCount: number } {
  if (size <= 16) return { round: 'R16', matchCount: 8 }
  if (size <= 32) return { round: 'R32', matchCount: 16 }
  return { round: 'R64', matchCount: 32 }
}

export function BracketBuilder({ drawId, drawSize, entries, existingMatches }: BracketBuilderProps) {
  const { round: firstRound, matchCount } = firstRoundFor(drawSize)
  const slots = useMemo(() => Array.from({ length: matchCount }, (_, i) => i + 1), [matchCount])
  const entriesById = useMemo(() => {
    const m = new Map<string, Entry>()
    for (const e of entries) m.set(e.id, e)
    return m
  }, [entries])

  // Mapa match_number → match existente para la primera ronda
  const matchBySlot = useMemo(() => {
    const m = new Map<number, SlotMatch>()
    for (const match of existingMatches) {
      if (match.round === firstRound) m.set(match.match_number, match)
    }
    return m
  }, [existingMatches, firstRound])

  // Estado local: edits pendientes por slot (slot → { e1, e2 }).
  // Cuando el usuario cambia un selector, persistimos al backend en
  // un debounce corto (idempotente).
  const [localState, setLocalState] = useState<Record<number, { entry1_id: string | null, entry2_id: string | null }>>(() => {
    const init: Record<number, { entry1_id: string | null, entry2_id: string | null }> = {}
    for (const slot of slots) {
      const m = matchBySlot.get(slot)
      init[slot] = { entry1_id: m?.entry1_id ?? null, entry2_id: m?.entry2_id ?? null }
    }
    return init
  })

  const [saving, setSaving] = useState<number | null>(null)
  const [savedFlash, setSavedFlash] = useState<number | null>(null)
  const [error, setError] = useState<{ slot: number, msg: string } | null>(null)

  // Set de entry_ids ya usados en otros slots — para deshabilitar
  // en los pickers y evitar que el director asigne la misma pareja
  // dos veces.
  const usedEntryIds = useMemo(() => {
    const set = new Set<string>()
    for (const [_, state] of Object.entries(localState)) {
      if (state.entry1_id) set.add(state.entry1_id)
      if (state.entry2_id) set.add(state.entry2_id)
    }
    return set
  }, [localState])

  async function persistSlot(slot: number, entry1_id: string | null, entry2_id: string | null) {
    setError(null)
    setSaving(slot)
    try {
      const res = await fetch(`/api/draws/${drawId}/seed-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          round: firstRound,
          match_number: slot,
          entry1_id,
          entry2_id,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError({ slot, msg: data.error ?? 'Error desconocido' })
        // Revert local state to what was before
        const original = matchBySlot.get(slot)
        setLocalState(s => ({ ...s, [slot]: { entry1_id: original?.entry1_id ?? null, entry2_id: original?.entry2_id ?? null } }))
      } else {
        setSavedFlash(slot)
        setTimeout(() => setSavedFlash(s => s === slot ? null : s), 1500)
      }
    } catch (e: any) {
      setError({ slot, msg: e?.message ?? 'Error de red' })
    }
    setSaving(null)
  }

  function updateSlot(slot: number, side: 'a' | 'b', entryId: string | null) {
    setLocalState(s => {
      const cur = s[slot] ?? { entry1_id: null, entry2_id: null }
      const next = {
        ...cur,
        ...(side === 'a' ? { entry1_id: entryId } : { entry2_id: entryId }),
      }
      // Lanza el persist tras actualizar el state local (no usamos cur viejo)
      persistSlot(slot, next.entry1_id, next.entry2_id)
      return { ...s, [slot]: next }
    })
  }

  const remainingEntries = entries.length - usedEntryIds.size

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-white font-semibold">
            🎯 Generador del cuadro · {firstRound}
            <span className="text-gray-500 text-sm font-normal ml-2">({matchCount} partidos)</span>
          </h2>
          <p className="text-gray-500 text-xs mt-1">
            Selecciona la pareja A y la pareja B de cada slot. Las rondas
            posteriores (QF, SF, F) se rellenan solas al cerrar cada partido.
          </p>
        </div>
        <div className="text-right">
          <p className="text-emerald-400 text-sm font-bold">{usedEntryIds.size}/{entries.length}</p>
          <p className="text-gray-500 text-xs">parejas colocadas · {remainingEntries} libres</p>
        </div>
      </div>

      {/* Tabla compacta de slots */}
      <div className="space-y-2">
        {slots.map(slot => {
          const state = localState[slot] ?? { entry1_id: null, entry2_id: null }
          const m = matchBySlot.get(slot)
          const locked = m && (m.status === 'in_progress' || m.status === 'finished')
          const isSaving = saving === slot
          const flashed = savedFlash === slot
          const errored = error?.slot === slot

          return (
            <div
              key={slot}
              className={`flex items-center gap-2 p-3 rounded-xl border transition-colors ${
                locked
                  ? 'bg-amber-950/30 border-amber-900/50'
                  : flashed
                    ? 'bg-emerald-950/30 border-emerald-700'
                    : errored
                      ? 'bg-red-950/30 border-red-800'
                      : 'bg-gray-800/50 border-gray-700'
              }`}
            >
              <span className="text-gray-600 text-xs font-mono w-10 flex-shrink-0 text-center">
                #{String(slot).padStart(2, '0')}
              </span>

              <EntryPicker
                value={state.entry1_id}
                entries={entries}
                usedEntryIds={usedEntryIds}
                disabled={locked || isSaving}
                onChange={(id) => updateSlot(slot, 'a', id)}
                placeholder="Pareja A"
              />

              <span className="text-gray-500 text-xs flex-shrink-0">vs</span>

              <EntryPicker
                value={state.entry2_id}
                entries={entries}
                usedEntryIds={usedEntryIds}
                disabled={locked || isSaving}
                onChange={(id) => updateSlot(slot, 'b', id)}
                placeholder="Pareja B"
              />

              <div className="flex-shrink-0 w-16 text-right text-xs">
                {isSaving && <span className="text-gray-400">…</span>}
                {flashed && <span className="text-emerald-400">✓</span>}
                {locked && <span className="text-amber-400 font-bold uppercase tracking-wider">{m.status === 'finished' ? 'FIN' : 'EN JUEGO'}</span>}
                {errored && <span className="text-red-400" title={error.msg}>✗</span>}
              </div>
            </div>
          )
        })}
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-800 rounded-xl px-4 py-2 text-red-300 text-sm">
          Slot #{String(error.slot).padStart(2, '0')}: {error.msg}
        </div>
      )}

      <p className="text-gray-600 text-xs">
        Los cambios se guardan automáticamente al seleccionar. Los slots en
        ámbar tienen un partido ya en juego o finalizado — no se pueden
        cambiar desde aquí.
      </p>
    </div>
  )
}

// ── EntryPicker — select con buscador inline ─────────────────────────────
function EntryPicker({
  value,
  entries,
  usedEntryIds,
  disabled,
  onChange,
  placeholder,
}: {
  value: string | null
  entries: Entry[]
  usedEntryIds: Set<string>
  disabled?: boolean
  onChange: (id: string | null) => void
  placeholder: string
}) {
  const current = entries.find(e => e.id === value)
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled}
      className="flex-1 min-w-0 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-red disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <option value="">— {placeholder} —</option>
      {/* La pareja actualmente seleccionada en este slot SIEMPRE
          aparece, aunque esté en usedEntryIds (es su slot). */}
      {entries
        .filter(e => e.id === value || !usedEntryIds.has(e.id))
        .map(e => {
          const seedLabel = e.seed ? `(${e.seed}) ` : ''
          return (
            <option key={e.id} value={e.id}>
              {seedLabel}{teamLabel(e)}
            </option>
          )
        })}
    </select>
  )
}
