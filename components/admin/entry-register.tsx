'use client'
// ============================================================================
// EntryRegister — inscribir jugadores/parejas en un cuadro
// ============================================================================
// Pieza intermedia entre "crear jugador" y "crear partido". El sistema
// trabaja con draw_entries (inscripciones) como unidad: un partido enfrenta
// dos draw_entries, no dos jugadores sueltos. Para que un jugador aparezca
// en el formulario de "Nuevo partido" hay que inscribirlo primero en un
// cuadro a traves de este componente.
//
// - Dobles : dos selects de jugador → forma una pareja
// - Indiv. : un select de jugador → entrada individual
// - Filtra jugadores ya inscritos en el cuadro
// - Opcional: seed (cabeza de serie)
// ============================================================================

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface Player {
  id: string
  first_name: string
  last_name: string
  nationality: string | null
  ranking_rfet: number | null
}

interface Props {
  drawId: string
  drawSize: number
  matchType: 'singles' | 'doubles'
  /** IDs de jugadores ya inscritos (para filtrarlos del select) */
  existingPlayerIds: string[]
  /** Numero de inscripciones actuales (para mostrar "X / size") */
  currentCount: number
}

export function EntryRegister({ drawId, drawSize, matchType, existingPlayerIds, currentCount }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [players, setPlayers] = useState<Player[]>([])
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [seed, setSeed] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('players')
      .select('id, first_name, last_name, nationality, ranking_rfet')
      .order('last_name')
      .then(({ data }) => setPlayers((data as Player[]) ?? []))
  }, [])

  const isDoubles = matchType === 'doubles'
  const full = currentCount >= drawSize
  const available = players.filter((p) => !existingPlayerIds.includes(p.id))
  // Para que el segundo select no permita el mismo jugador que el primero
  const availableForP2 = available.filter((p) => p.id !== p1)
  const availableForP1 = available.filter((p) => p.id !== p2)

  function playerLabel(p: Player) {
    const parts = [`${p.first_name} ${p.last_name}`]
    if (p.nationality) parts.push(p.nationality)
    if (p.ranking_rfet) parts.push(`#${p.ranking_rfet}`)
    return parts.join(' · ')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSuccess('')
    if (!p1) { setError('Selecciona el primer jugador'); return }
    if (isDoubles && !p2) { setError('Selecciona el segundo jugador (es dobles)'); return }
    if (full) { setError(`El cuadro está completo (${drawSize} plazas)`); return }

    setSaving(true)
    const seedInt = seed ? parseInt(seed, 10) : null
    const seedClean = (seedInt && !Number.isNaN(seedInt) && seedInt > 0) ? seedInt : null

    // Calcular ranking_sum si los dos jugadores tienen RFET
    const player1 = players.find((x) => x.id === p1)
    const player2 = isDoubles ? players.find((x) => x.id === p2) : null
    const rankingSum = (player1?.ranking_rfet && (!isDoubles || player2?.ranking_rfet))
      ? (player1.ranking_rfet + (player2?.ranking_rfet ?? 0))
      : null

    const { error: e1 } = await supabase.from('draw_entries').insert({
      draw_id: drawId,
      player1_id: p1,
      player2_id: isDoubles ? p2 : null,
      seed: seedClean,
      entry_type: 'direct',
      ranking_sum: rankingSum,
      status: 'confirmed',
    })

    setSaving(false)
    if (e1) { setError(e1.message); return }
    setSuccess(isDoubles ? '✓ Pareja inscrita' : '✓ Jugador inscrito')
    setP1(''); setP2(''); setSeed('')
    setTimeout(() => setSuccess(''), 2500)
    router.refresh()
  }

  const sc = "w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-red disabled:opacity-50"

  return (
    <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800 space-y-4">
      <div>
        <h3 className="text-white font-semibold">
          Inscribir {isDoubles ? 'pareja' : 'jugador'}
          <span className="text-gray-500 text-xs font-normal ml-2">
            {currentCount} / {drawSize} plazas ocupadas
          </span>
        </h3>
        <p className="text-gray-400 text-xs mt-1">
          {isDoubles
            ? 'Una pareja = dos jugadores. Una vez inscrita, podrás usarla al crear un partido del cuadro.'
            : 'Un jugador individual. Una vez inscrito, podrás usarlo al crear un partido del cuadro.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className={`grid gap-3 ${isDoubles ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{isDoubles ? 'Jugador 1' : 'Jugador'}</label>
            <select value={p1} onChange={(e) => setP1(e.target.value)} className={sc} disabled={full}>
              <option value="">— Selecciona un jugador —</option>
              {availableForP1.map((p) => <option key={p.id} value={p.id}>{playerLabel(p)}</option>)}
            </select>
          </div>
          {isDoubles && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Jugador 2</label>
              <select value={p2} onChange={(e) => setP2(e.target.value)} className={sc} disabled={full || !p1}>
                <option value="">— Selecciona el compañero —</option>
                {availableForP2.map((p) => <option key={p.id} value={p.id}>{playerLabel(p)}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Cabeza de serie (seed) — opcional</label>
            <input
              type="number" min="1" max={drawSize}
              value={seed} onChange={(e) => setSeed(e.target.value)}
              placeholder="Sin seed"
              className={sc} disabled={full}
            />
          </div>
          <div className="flex items-center justify-end gap-3">
            <button type="submit" disabled={saving || full || !p1 || (isDoubles && !p2)}
              className="bg-brand-red hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors whitespace-nowrap">
              {saving ? 'Inscribiendo…' : `+ Inscribir ${isDoubles ? 'pareja' : 'jugador'}`}
            </button>
          </div>
        </div>

        {success && <div className="text-green-400 text-sm">{success}</div>}
        {error && <div className="bg-red-900/30 border border-red-700 rounded-xl px-3 py-2 text-red-300 text-xs">✗ {error}</div>}
        {full && <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-xl px-3 py-2 text-yellow-200 text-xs">Cuadro completo — para inscribir más, primero borra alguna inscripción.</div>}
        {available.length === 0 && !full && (
          <div className="bg-blue-900/30 border border-blue-700/50 rounded-xl px-3 py-2 text-blue-200 text-xs">
            No quedan jugadores libres para inscribir. <a href="/dashboard/players/new" className="underline font-semibold">Crear un jugador nuevo →</a>
          </div>
        )}
      </form>
    </div>
  )
}
