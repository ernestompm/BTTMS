'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { Score, ScoringSystem } from '@/types'
import { categoryLabel, roundLabel } from '@/types'

interface Props {
  match: any
}

interface SetInput {
  t1: string
  t2: string
  tb_t1?: string // tiebreak scores for display (optional; if provided, used as tiebreak_score)
  tb_t2?: string
}

function teamLabel(entry: any, doubles: boolean): string {
  if (!entry) return '—'
  const a = entry.player1 ? `${entry.player1.first_name} ${entry.player1.last_name}` : ''
  const b = doubles && entry.player2 ? ` / ${entry.player2.first_name} ${entry.player2.last_name}` : ''
  return (a + b) || '—'
}

function winnerFromSets(sets: SetInput[], system: ScoringSystem): { winner: 1 | 2 | null, setsWon: { t1: number, t2: number }, reason: string } {
  let w1 = 0, w2 = 0
  const toWin = system === '7_games_tb' || system === 'pro_set' ? 1 : 2
  for (const s of sets) {
    const a = parseInt(s.t1, 10), b = parseInt(s.t2, 10)
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue
    if (a === b) continue
    if (a > b) w1++; else w2++
    if (w1 >= toWin) return { winner: 1, setsWon: { t1: w1, t2: w2 }, reason: `Gana equipo 1 por ${w1}-${w2}` }
    if (w2 >= toWin) return { winner: 2, setsWon: { t1: w1, t2: w2 }, reason: `Gana equipo 2 por ${w2}-${w1}` }
  }
  return { winner: null, setsWon: { t1: w1, t2: w2 }, reason: 'Resultado incompleto (no hay ganador todavía)' }
}

export function MatchResultEditor({ match }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const isDoubles = match.match_type === 'doubles'
  const system: ScoringSystem = (match.scoring_system as ScoringSystem) ?? (isDoubles ? 'best_of_2_sets_super_tb' : '7_games_tb')

  // Inicializa sets desde el score existente o 2-3 filas vacías
  const initialSets: SetInput[] = useMemo(() => {
    const src = (match.score?.sets ?? []) as Array<{ t1:number, t2:number }>
    const arr: SetInput[] = src.map(s => ({ t1: String(s.t1), t2: String(s.t2) }))
    while (arr.length < 3) arr.push({ t1:'', t2:'' })
    return arr
  }, [match.id])

  const [sets, setSets] = useState<SetInput[]>(initialSets)
  const [retiredTeam, setRetiredTeam] = useState<'' | '1' | '2'>((match.retired_team ? String(match.retired_team) : '') as any)
  const [retireReason, setRetireReason] = useState<string>(match.retire_reason ?? '')
  const [walkoverTeam, setWalkoverTeam] = useState<'' | '1' | '2'>('') // equipo que NO se presenta
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { winner, setsWon, reason } = useMemo(() => winnerFromSets(sets, system), [sets, system])

  function setSetCell(idx: number, team: 1 | 2, value: string) {
    setSets(s => {
      const next = [...s]
      const cur = { ...(next[idx] ?? { t1:'', t2:'' }) }
      if (team === 1) cur.t1 = value; else cur.t2 = value
      next[idx] = cur
      return next
    })
  }

  async function save(finishMatch: boolean) {
    setError(null); setSaved(null); setSaving(true)
    try {
      const validSets = sets.filter(s => s.t1 !== '' && s.t2 !== '').map(s => ({ t1: parseInt(s.t1,10), t2: parseInt(s.t2,10) }))

      if (retiredTeam || walkoverTeam) {
        const retired = retiredTeam ? parseInt(retiredTeam, 10) as 1|2 : null
        const wo = walkoverTeam ? parseInt(walkoverTeam, 10) as 1|2 : null
        // walkover: gana el contrario
        const winnerTeam: 1|2 = wo ? ((wo === 1 ? 2 : 1) as 1|2) : (retired ? ((retired === 1 ? 2 : 1) as 1|2) : 1)
        const newScore: Score = {
          sets: validSets,
          current_set: { t1: 0, t2: 0 },
          current_game: { t1: 0, t2: 0 },
          deuce: false, advantage_team: null,
          tiebreak_active: false, super_tiebreak_active: false,
          tiebreak_score: { t1: 0, t2: 0 },
          sets_won: { t1: validSets.filter(s => s.t1 > s.t2).length, t2: validSets.filter(s => s.t2 > s.t1).length },
          match_status: 'finished', winner_team: winnerTeam,
          scoring_system: system,
        }
        const patch: any = {
          score: newScore,
          status: wo ? 'walkover' : 'retired',
          finished_at: match.finished_at ?? new Date().toISOString(),
          retired_team: retired,
          retire_reason: retireReason || (wo ? 'No presentación' : null),
        }
        const { error: e } = await supabase.from('matches').update(patch).eq('id', match.id)
        if (e) throw e
        // Auto-advance al siguiente partido del cuadro
        try { await fetch(`/api/matches/${match.id}/advance`, { method: 'POST' }) } catch {}
      } else {
        if (finishMatch && winner === null) {
          throw new Error('No se puede finalizar: aún no hay un ganador claro con los sets introducidos.')
        }
        const newScore: Score = {
          sets: validSets,
          current_set: { t1: 0, t2: 0 },
          current_game: { t1: 0, t2: 0 },
          deuce: false, advantage_team: null,
          tiebreak_active: false, super_tiebreak_active: false,
          tiebreak_score: { t1: 0, t2: 0 },
          sets_won: { t1: setsWon.t1, t2: setsWon.t2 },
          match_status: finishMatch && winner ? 'finished' : 'in_progress',
          ...(finishMatch && winner ? { winner_team: winner } : {}),
          scoring_system: system,
        }
        const patch: any = {
          score: newScore,
          ...(finishMatch && winner ? { status: 'finished', finished_at: match.finished_at ?? new Date().toISOString() } : {}),
        }
        const { error: e } = await supabase.from('matches').update(patch).eq('id', match.id)
        if (e) throw e
        // Si el partido se ha cerrado, avanzar el ganador
        if (finishMatch && winner) {
          try { await fetch(`/api/matches/${match.id}/advance`, { method: 'POST' }) } catch {}
        }
      }
      setSaved('Guardado correctamente')
      router.refresh()
      setTimeout(() => router.push(`/dashboard/matches/${match.id}`), 800)
    } catch (e:any) {
      setError(e?.message ?? String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5 fade-in max-w-3xl">
      <div className="flex items-center gap-3 text-sm">
        <Link href={`/dashboard/matches/${match.id}`} className="text-gray-400 hover:text-white">← Partido</Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-white font-score">Editar resultado</h1>
        <p className="text-gray-400 text-sm mt-1">
          {categoryLabel(match.category)} · {roundLabel(match.round)} · {isDoubles ? 'Dobles' : 'Individual'}
        </p>
      </div>

      {/* Equipos */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-2">
        <div className="flex items-center gap-3">
          <span className="w-2 h-5 bg-brand-red rounded" />
          <span className="text-white font-medium">EQ.1</span>
          <span className="text-gray-300">{teamLabel(match.entry1, isDoubles)}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-2 h-5 bg-brand-pink rounded" />
          <span className="text-white font-medium">EQ.2</span>
          <span className="text-gray-300">{teamLabel(match.entry2, isDoubles)}</span>
        </div>
      </div>

      {/* Sets */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold">Sets</h2>
          <div className="text-xs text-gray-500">Sistema: <code className="text-gray-300">{system}</code></div>
        </div>
        <div className="grid grid-cols-[80px_1fr_1fr] gap-3 items-center">
          <div/>
          <div className="text-xs text-gray-500 uppercase tracking-widest text-center">Eq.1</div>
          <div className="text-xs text-gray-500 uppercase tracking-widest text-center">Eq.2</div>
          {sets.map((s, i) => (
            <>
              <div key={`lab${i}`} className="text-gray-400 text-sm font-medium">Set {i+1}</div>
              <input key={`t1-${i}`} inputMode="numeric" type="number" min={0} max={99}
                value={s.t1} onChange={(e) => setSetCell(i, 1, e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-center text-lg font-score font-bold focus:outline-none focus:border-brand-red"/>
              <input key={`t2-${i}`} inputMode="numeric" type="number" min={0} max={99}
                value={s.t2} onChange={(e) => setSetCell(i, 2, e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-center text-lg font-score font-bold focus:outline-none focus:border-brand-red"/>
            </>
          ))}
        </div>
        <div className="text-sm">
          {winner
            ? <p className="text-green-400">✓ {reason} <span className="text-gray-500">(sets {setsWon.t1}-{setsWon.t2})</span></p>
            : <p className="text-amber-400">⚠ {reason}</p>}
        </div>
      </div>

      {/* Abandono / walkover */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-white font-bold">Abandono o no presentación (opcional)</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-widest block mb-1">Abandonó</label>
            <select value={retiredTeam} onChange={(e) => { setRetiredTeam(e.target.value as any); if (e.target.value) setWalkoverTeam('') }}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-red">
              <option value="">— ninguno —</option>
              <option value="1">Equipo 1 abandonó</option>
              <option value="2">Equipo 2 abandonó</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-widest block mb-1">Walkover (W.O.)</label>
            <select value={walkoverTeam} onChange={(e) => { setWalkoverTeam(e.target.value as any); if (e.target.value) setRetiredTeam('') }}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-red">
              <option value="">— ninguno —</option>
              <option value="1">Equipo 1 no se presenta</option>
              <option value="2">Equipo 2 no se presenta</option>
            </select>
          </div>
        </div>
        {(retiredTeam || walkoverTeam) && (
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-widest block mb-1">Motivo</label>
            <input value={retireReason} onChange={(e) => setRetireReason(e.target.value)}
              placeholder={walkoverTeam ? 'No presentación' : 'Lesión, mareo...'}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-red"/>
          </div>
        )}
      </div>

      {/* Errores / guardar */}
      {error && <div className="bg-red-950/40 border border-red-900/50 text-red-300 rounded-xl p-3 text-sm">{error}</div>}
      {saved && <div className="bg-green-950/40 border border-green-900/50 text-green-300 rounded-xl p-3 text-sm">{saved}</div>}

      <div className="flex items-center justify-end gap-2">
        <Link href={`/dashboard/matches/${match.id}`} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancelar</Link>
        <button onClick={() => save(false)} disabled={saving}
          className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors">
          Guardar sin finalizar
        </button>
        <button onClick={() => save(true)} disabled={saving || (!winner && !retiredTeam && !walkoverTeam)}
          className="bg-brand-red hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors">
          {saving ? 'Guardando...' : 'Finalizar partido'}
        </button>
      </div>

      <p className="text-gray-600 text-xs">
        El ganador se calcula automáticamente a partir de los sets. Si el partido pertenece a un cuadro de eliminación,
        el director de torneo puede avanzar al ganador a la siguiente ronda desde la pantalla de cuadros.
      </p>
    </div>
  )
}
