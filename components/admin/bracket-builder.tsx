'use client'

import { useEffect, useMemo, useState } from 'react'

/**
 * BracketBuilder — generador interactivo del cuadro.
 *
 * Muestra los slots de UNA ronda (configurable) y permite asignar
 * parejas a cada slot con un selector. Cada cambio crea o actualiza
 * el match correspondiente vía /api/draws/[id]/seed-match.
 *
 * Selector de ronda inicial: el director puede elegir desde qué ronda
 * empezar (útil si hay pocas parejas y se quiere arrancar en QF o SF
 * directamente sin jugar la primera ronda).
 *
 * Las rondas posteriores se rellenan automáticamente cuando se
 * completa el match anterior (advanceWinnerToNextRound).
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

// Catálogo de rondas disponibles. matchCount = partidos en esa ronda
// (= parejas/2). Orden de la más temprana a la más tardía del cuadro.
const ROUND_OPTIONS: { value: string, label: string, matchCount: number, totalEntries: number }[] = [
  { value: 'R64', label: 'R64 · Treintaidosavos', matchCount: 32, totalEntries: 64 },
  { value: 'R32', label: 'R32 · Dieciseisavos',   matchCount: 16, totalEntries: 32 },
  { value: 'R16', label: 'R16 · Octavos',         matchCount: 8,  totalEntries: 16 },
  { value: 'QF',  label: 'QF · Cuartos',          matchCount: 4,  totalEntries: 8 },
  { value: 'SF',  label: 'SF · Semifinales',      matchCount: 2,  totalEntries: 4 },
  { value: 'F',   label: 'F · Final',             matchCount: 1,  totalEntries: 2 },
]

/** Detecta una ronda razonable por defecto:
 *   - Si ya existen matches en alguna ronda, elige esa.
 *   - Si no, elige la mejor según el número de parejas inscritas.
 */
function defaultRound(drawSize: number, entriesCount: number, existingMatches: SlotMatch[]): string {
  if (existingMatches.length > 0) {
    // Encuentra la ronda más temprana presente
    for (const opt of ROUND_OPTIONS) {
      if (existingMatches.some(m => m.round === opt.value)) return opt.value
    }
  }
  // Inferir por inscritos — la ronda donde encaja sin demasiados byes
  if (entriesCount > 32) return 'R64'
  if (entriesCount > 16) return 'R32'
  if (entriesCount > 8) return 'R16'
  if (entriesCount > 4) return 'QF'
  if (entriesCount > 2) return 'SF'
  if (entriesCount > 0) return 'F'
  // Fallback por drawSize
  if (drawSize <= 16) return 'R16'
  if (drawSize <= 32) return 'R32'
  return 'R64'
}

export function BracketBuilder({ drawId, drawSize, entries, existingMatches }: BracketBuilderProps) {
  // Ronda activa (la que se está editando)
  const [round, setRound] = useState<string>(() =>
    defaultRound(drawSize, entries.length, existingMatches)
  )

  const opt = ROUND_OPTIONS.find(o => o.value === round) ?? ROUND_OPTIONS[1]
  const matchCount = opt.matchCount
  const slots = useMemo(() => Array.from({ length: matchCount }, (_, i) => i + 1), [matchCount])

  // Mapa match_number → match existente PARA LA RONDA ACTIVA
  const matchBySlot = useMemo(() => {
    const m = new Map<number, SlotMatch>()
    for (const match of existingMatches) {
      if (match.round === round) m.set(match.match_number, match)
    }
    return m
  }, [existingMatches, round])

  // Estado local: edits por slot. Reset cuando cambia la ronda activa.
  const [localState, setLocalState] = useState<Record<number, { entry1_id: string | null, entry2_id: string | null }>>({})
  useEffect(() => {
    const init: Record<number, { entry1_id: string | null, entry2_id: string | null }> = {}
    for (const slot of slots) {
      const m = matchBySlot.get(slot)
      init[slot] = { entry1_id: m?.entry1_id ?? null, entry2_id: m?.entry2_id ?? null }
    }
    setLocalState(init)
  }, [round, matchCount, existingMatches.length])

  const [saving, setSaving] = useState<number | null>(null)
  const [savedFlash, setSavedFlash] = useState<number | null>(null)
  const [error, setError] = useState<{ slot: number, msg: string } | null>(null)

  // Set de entry_ids usadas en algún slot de ESTA ronda
  const usedEntryIds = useMemo(() => {
    const set = new Set<string>()
    for (const [_, state] of Object.entries(localState)) {
      if (state.entry1_id) set.add(state.entry1_id)
      if (state.entry2_id) set.add(state.entry2_id)
    }
    return set
  }, [localState])

  // Entries usadas en OTRAS rondas (también las filtramos del picker para
  // que una pareja no aparezca en QF y en SF a la vez).
  const usedInOtherRounds = useMemo(() => {
    const set = new Set<string>()
    for (const m of existingMatches) {
      if (m.round === round) continue
      if (m.entry1_id) set.add(m.entry1_id)
      if (m.entry2_id) set.add(m.entry2_id)
    }
    return set
  }, [existingMatches, round])

  async function persistSlot(slot: number, entry1_id: string | null, entry2_id: string | null) {
    setError(null)
    setSaving(slot)
    try {
      const res = await fetch(`/api/draws/${drawId}/seed-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          round,
          match_number: slot,
          entry1_id,
          entry2_id,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError({ slot, msg: data.error ?? 'Error desconocido' })
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
      persistSlot(slot, next.entry1_id, next.entry2_id)
      return { ...s, [slot]: next }
    })
  }

  const usedTotal = usedEntryIds.size + usedInOtherRounds.size
  const remainingEntries = entries.length - usedTotal

  // Resumen de cuántos slots tienen partidos en otras rondas
  const otherRoundsSummary = useMemo(() => {
    const counts = new Map<string, number>()
    for (const m of existingMatches) {
      if (m.round !== round) counts.set(m.round, (counts.get(m.round) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .sort((a, b) => {
        const ai = ROUND_OPTIONS.findIndex(o => o.value === a[0])
        const bi = ROUND_OPTIONS.findIndex(o => o.value === b[0])
        return ai - bi
      })
  }, [existingMatches, round])

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-white font-semibold">
            🎯 Generador del cuadro
          </h2>
          <p className="text-gray-500 text-xs mt-1">
            Selecciona la ronda de partida y asigna parejas a cada slot.
            Las rondas posteriores se rellenan solas al cerrar cada partido.
          </p>
        </div>
        <div className="text-right">
          <p className="text-emerald-400 text-sm font-bold">{usedTotal}/{entries.length}</p>
          <p className="text-gray-500 text-xs">parejas asignadas · {remainingEntries} libres</p>
        </div>
      </div>

      {/* Selector de ronda — controla qué ronda se está editando */}
      <div className="flex items-center gap-3 flex-wrap bg-gray-950/50 border border-gray-800 rounded-xl p-3">
        <label className="text-gray-400 text-xs font-bold uppercase tracking-widest">
          Ronda de partida
        </label>
        <select
          value={round}
          onChange={(e) => setRound(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-brand-red"
        >
          {ROUND_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>
              {o.label} — {o.matchCount} partidos · {o.totalEntries} parejas
            </option>
          ))}
        </select>
        <span className="text-gray-600 text-xs">
          Editando <strong className="text-gray-300">{opt.label.split(' · ')[0]}</strong> con {matchCount} slots
        </span>
      </div>

      {/* Aviso si hay partidos en otras rondas */}
      {otherRoundsSummary.length > 0 && (
        <div className="bg-blue-950/30 border border-blue-900/50 rounded-xl px-4 py-2 text-xs text-blue-300">
          ℹ️ Ya hay partidos en otras rondas: {otherRoundsSummary.map(([r, n]) => `${r} (${n})`).join(' · ')}.
          Las parejas usadas allí no aparecen aquí.
        </div>
      )}

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
                usedHere={usedEntryIds}
                usedElsewhere={usedInOtherRounds}
                disabled={locked || isSaving}
                onChange={(id) => updateSlot(slot, 'a', id)}
                placeholder="Pareja A"
              />

              <span className="text-gray-500 text-xs flex-shrink-0">vs</span>

              <EntryPicker
                value={state.entry2_id}
                entries={entries}
                usedHere={usedEntryIds}
                usedElsewhere={usedInOtherRounds}
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
        Los cambios se guardan automáticamente al seleccionar. Los slots
        en ámbar tienen partido ya en juego o finalizado — no se pueden
        cambiar desde aquí.
      </p>
    </div>
  )
}

// ── EntryPicker — select con dos categorías de "usadas" ───────────────
function EntryPicker({
  value,
  entries,
  usedHere,
  usedElsewhere,
  disabled,
  onChange,
  placeholder,
}: {
  value: string | null
  entries: Entry[]
  usedHere: Set<string>          // usadas en otros slots de la ronda activa
  usedElsewhere: Set<string>     // usadas en slots de otras rondas
  disabled?: boolean
  onChange: (id: string | null) => void
  placeholder: string
}) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled}
      className="flex-1 min-w-0 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-red disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <option value="">— {placeholder} —</option>
      {entries
        // La actualmente seleccionada SIEMPRE visible; las usadas en otras
        // partes (esta ronda u otras) se filtran salvo que ya sea esta.
        .filter(e => e.id === value || (!usedHere.has(e.id) && !usedElsewhere.has(e.id)))
        .map(e => {
          const seedLabel = e.seed ? `(${e.seed}) ` : ''
          const p1 = e.player1 ? `${e.player1.first_name ?? ''} ${e.player1.last_name ?? ''}`.trim() : ''
          const p2 = e.player2 ? `${e.player2.first_name ?? ''} ${e.player2.last_name ?? ''}`.trim() : ''
          const label = p1 && p2 ? `${p1} / ${p2}` : p1 || p2 || '?'
          return (
            <option key={e.id} value={e.id}>
              {seedLabel}{label}
            </option>
          )
        })}
    </select>
  )
}
