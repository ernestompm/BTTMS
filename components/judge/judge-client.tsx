'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { TossScreen } from './toss-screen'
import { PointModal } from './point-modal'
import type { Match, PointType, ShotDirection } from '@/types'

interface Props {
  initialMatch: Match & { entry1: any; entry2: any; court: any }
  userId: string
}

function tennisPoint(value: number | undefined, deuce: boolean | undefined, adv: 1 | 2 | null | undefined, team: 1 | 2): string {
  if (deuce) {
    if (adv === team) return 'ADV'
    if (adv && adv !== team) return '—'
    return '40'
  }
  return ['0', '15', '30', '40'][value ?? 0] ?? '0'
}

export function JudgeClient({ initialMatch }: Props) {
  const supabase = createClient()
  const [match, setMatch] = useState(initialMatch)
  const [showToss, setShowToss] = useState(initialMatch.status === 'scheduled')
  const [showPointModal, setShowPointModal] = useState<1 | 2 | null>(null)
  const [saving, setSaving] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  // Realtime subscription
  useEffect(() => {
    const channel = supabase.channel(`match-${match.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${match.id}` },
        (payload) => setMatch((prev) => ({ ...prev, ...payload.new }))
      ).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [match.id])

  // Elapsed timer
  useEffect(() => {
    if (match.status !== 'in_progress' || !match.started_at) return
    const startMs = new Date(match.started_at).getTime()
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startMs) / 1000)), 1000)
    return () => clearInterval(interval)
  }, [match.status, match.started_at])

  function fmt(secs: number) {
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  }

  async function handleTossComplete(tossData: any) {
    setSaving(true)
    const res = await fetch(`/api/matches/${match.id}/start`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tossData),
    })
    if (res.ok) {
      const updated = await res.json()
      setMatch((m) => ({ ...m, ...updated }))
      setShowToss(false)
    }
    setSaving(false)
  }

  async function handlePointWon(winnerTeam: 1 | 2, pointType: PointType, shotDirection: ShotDirection | null) {
    setShowPointModal(null)
    setSaving(true)
    const res = await fetch(`/api/matches/${match.id}/point`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ winner_team: winnerTeam, point_type: pointType, shot_direction: shotDirection }),
    })
    if (res.ok) {
      const updated = await res.json()
      setMatch((m) => ({ ...m, ...updated }))
    }
    setSaving(false)
  }

  async function handleUndo() {
    if (!confirm('¿Deshacer el último punto?')) return
    setSaving(true)
    const res = await fetch(`/api/matches/${match.id}/undo`, { method: 'POST' })
    if (res.ok) {
      const updated = await res.json()
      setMatch((m) => ({ ...m, ...updated }))
    }
    setSaving(false)
  }

  async function handleFinish() {
    if (!confirm('¿Finalizar el partido?')) return
    setSaving(true)
    await fetch(`/api/matches/${match.id}/finish`, { method: 'POST' })
    setSaving(false)
  }

  const isFinished = match.status === 'finished'

  if (showToss) return <TossScreen match={match} onComplete={handleTossComplete} saving={saving} />

  const score = match.score as any
  const t1Name = ((match.entry1 as any)?.player1?.last_name ?? '—').toUpperCase()
  const t2Name = ((match.entry2 as any)?.player1?.last_name ?? '—').toUpperCase()
  const t1Partner = (match.entry1 as any)?.player2?.last_name
  const t2Partner = (match.entry2 as any)?.player2?.last_name
  const setsWon1 = score?.sets_won?.t1 ?? 0
  const setsWon2 = score?.sets_won?.t2 ?? 0
  const game1 = tennisPoint(score?.current_game?.t1, score?.deuce, score?.advantage_team, 1)
  const game2 = tennisPoint(score?.current_game?.t2, score?.deuce, score?.advantage_team, 2)

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-950 select-none overflow-hidden">

      {/* ─── TOP BAR ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`w-3 h-3 rounded-full flex-shrink-0 ${isFinished ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
          <span className="text-white font-medium text-base truncate">{match.court?.name ?? '—'}</span>
          <span className="text-gray-500 text-sm">· {match.round}</span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-gray-300 font-mono text-base">{fmt(elapsed)}</span>
          <button onClick={handleUndo} disabled={saving}
            className="h-10 px-4 bg-gray-800 hover:bg-gray-700 active:scale-95 rounded-lg text-yellow-400 font-bold text-sm transition-transform border border-gray-700">
            ↩ Deshacer
          </button>
          <button onClick={handleFinish} disabled={saving}
            className="h-10 px-4 bg-gray-800 hover:bg-red-900 active:scale-95 rounded-lg text-gray-300 hover:text-red-300 font-bold text-sm transition-transform border border-gray-700">
            Fin
          </button>
        </div>
      </div>

      {/* ─── TEAMS + SCORE COMPACTO ───────────────────────────── */}
      <div className="flex-shrink-0">
        {/* Team 1 */}
        <div className={`flex items-center justify-between px-5 py-3 border-b border-gray-800 ${match.serving_team === 1 ? 'bg-gray-900' : 'bg-black'}`}>
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {match.serving_team === 1 && <span className="w-3 h-3 rounded-full bg-brand-orange serving-pulse flex-shrink-0" />}
            <div className="min-w-0">
              <p className="text-white font-bold text-xl leading-tight truncate">{t1Name}</p>
              {t1Partner && <p className="text-gray-400 text-base leading-tight truncate">{t1Partner.toUpperCase()}</p>}
            </div>
          </div>
          <div className="flex items-baseline gap-5 flex-shrink-0">
            <span className="text-white font-score font-black text-3xl tabular-nums">{setsWon1}</span>
            <span className="text-brand-red font-score font-black text-4xl tabular-nums w-16 text-right">{game1}</span>
          </div>
        </div>
        {/* Team 2 */}
        <div className={`flex items-center justify-between px-5 py-3 border-b border-gray-800 ${match.serving_team === 2 ? 'bg-gray-900' : 'bg-black'}`}>
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {match.serving_team === 2 && <span className="w-3 h-3 rounded-full bg-brand-orange serving-pulse flex-shrink-0" />}
            <div className="min-w-0">
              <p className="text-white font-bold text-xl leading-tight truncate">{t2Name}</p>
              {t2Partner && <p className="text-gray-400 text-base leading-tight truncate">{t2Partner.toUpperCase()}</p>}
            </div>
          </div>
          <div className="flex items-baseline gap-5 flex-shrink-0">
            <span className="text-white font-score font-black text-3xl tabular-nums">{setsWon2}</span>
            <span className="text-brand-red font-score font-black text-4xl tabular-nums w-16 text-right">{game2}</span>
          </div>
        </div>
      </div>

      {/* ─── BIG POINT BUTTONS (fill rest of screen) ─────────── */}
      {isFinished ? (
        <div className="flex-1 flex items-center justify-center bg-green-900/20 p-8">
          <div className="text-center">
            <p className="text-green-400 font-score font-black text-5xl mb-3">✓ FINALIZADO</p>
            <p className="text-gray-400 text-lg mb-6">Ganador: Equipo {match.score?.winner_team ?? '?'}</p>
            <a href="/judge" className="inline-block bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-xl text-lg">
              ← Volver
            </a>
          </div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-2 gap-1 bg-gray-900 min-h-0">
          <button onClick={() => setShowPointModal(1)} disabled={saving}
            className="bg-sky-500 hover:bg-sky-400 active:bg-sky-600 disabled:opacity-50 text-white font-black font-score flex items-center justify-center transition-colors">
            <div className="text-center">
              <div className="text-3xl opacity-90 tracking-widest">PUNTO</div>
              <div className="text-6xl mt-1 leading-none">{t1Name}</div>
              {t1Partner && <div className="text-xl opacity-80 mt-1">+ {t1Partner.toUpperCase()}</div>}
            </div>
          </button>
          <button onClick={() => setShowPointModal(2)} disabled={saving}
            className="bg-sky-500 hover:bg-sky-400 active:bg-sky-600 disabled:opacity-50 text-white font-black font-score flex items-center justify-center transition-colors">
            <div className="text-center">
              <div className="text-3xl opacity-90 tracking-widest">PUNTO</div>
              <div className="text-6xl mt-1 leading-none">{t2Name}</div>
              {t2Partner && <div className="text-xl opacity-80 mt-1">+ {t2Partner.toUpperCase()}</div>}
            </div>
          </button>
        </div>
      )}

      {/* Point modal */}
      {showPointModal !== null && (
        <PointModal
          winnerTeam={showPointModal}
          servingTeam={match.serving_team ?? 1}
          onSelect={handlePointWon}
          onClose={() => setShowPointModal(null)}
        />
      )}
    </div>
  )
}
