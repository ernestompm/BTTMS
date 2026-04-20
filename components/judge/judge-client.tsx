'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { TossScreen } from './toss-screen'
import { ScoreDisplay } from './score-display'
import { PointModal } from './point-modal'
import type { Match, Score, PointType, ShotDirection } from '@/types'

interface Props {
  initialMatch: Match & { entry1: any; entry2: any; court: any }
  userId: string
}

export function JudgeClient({ initialMatch, userId }: Props) {
  const supabase = createClient()
  const [match, setMatch] = useState(initialMatch)
  const [showToss, setShowToss] = useState(initialMatch.status === 'scheduled')
  const [showPointModal, setShowPointModal] = useState<1 | 2 | null>(null)
  const [saving, setSaving] = useState(false)
  const [lastAction, setLastAction] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [countdown, setCountdown] = useState<number | null>(null)

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

  function formatElapsed(secs: number) {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  }

  async function handleTossComplete(tossData: any) {
    setSaving(true)
    const res = await fetch(`/api/matches/${match.id}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tossData),
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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ winner_team: winnerTeam, point_type: pointType, shot_direction: shotDirection }),
    })
    if (res.ok) {
      const updated = await res.json()
      setMatch((m) => ({ ...m, ...updated }))
      setLastAction(`Punto Eq.${winnerTeam} (${pointType.replace('_', ' ')})`)
      // Start 20s countdown between points
      setCountdown(20)
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
      setLastAction('Punto deshecho')
    }
    setSaving(false)
  }

  async function handleFinish() {
    if (!confirm('¿Finalizar el partido?')) return
    setSaving(true)
    await fetch(`/api/matches/${match.id}/finish`, { method: 'POST' })
    setSaving(false)
  }

  // 20s countdown between points
  useEffect(() => {
    if (countdown === null || countdown <= 0) return
    const t = setTimeout(() => setCountdown((c) => (c ?? 1) - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const isFinished = match.status === 'finished'

  if (showToss) {
    return <TossScreen match={match} onComplete={handleTossComplete} saving={saving} />
  }

  return (
    <div className="min-h-screen bg-[#111111] flex flex-col select-none overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-gray-800/50">
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${isFinished ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
          <span className="text-gray-300 text-base font-medium">{match.court?.name}</span>
          <span className="text-gray-500 text-base">{match.round}</span>
        </div>
        <div className="flex items-center gap-4">
          {countdown !== null && countdown > 0 && (
            <span className="text-brand-orange text-base font-score font-bold">{countdown}s</span>
          )}
          <span className="text-gray-300 text-base font-mono">{formatElapsed(elapsed)}</span>
          {saving && <span className="text-gray-600 text-sm">guardando…</span>}
        </div>
      </div>

      {/* Match finished banner */}
      {isFinished && (
        <div className="bg-green-900/30 border-b border-green-800 px-4 py-2 text-center">
          <p className="text-green-300 font-bold font-score">
            PARTIDO FINALIZADO · Ganador: Equipo {match.score?.winner_team ?? '?'}
          </p>
        </div>
      )}

      {/* Teams + Score */}
      <div className="flex-1 flex flex-col">
        {/* Team 1 */}
        <div className="flex-1 flex items-center justify-between px-6 py-5 border-b border-gray-800/30">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            {match.serving_team === 1 && (
              <span className="mt-2 w-4 h-4 rounded-full bg-brand-orange serving-pulse flex-shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-white font-bold text-2xl leading-tight truncate">
                {(match.entry1 as any)?.player1?.first_name} {(match.entry1 as any)?.player1?.last_name}
              </p>
              {(match.entry1 as any)?.player2 && (
                <p className="text-gray-300 text-xl leading-tight truncate">
                  {(match.entry1 as any)?.player2?.first_name} {(match.entry1 as any)?.player2?.last_name}
                </p>
              )}
            </div>
          </div>
          <div className="text-right ml-4">
            <span className="text-7xl font-score font-black text-white leading-none">
              {match.score?.sets_won?.t1 ?? 0}
            </span>
          </div>
        </div>

        {/* Center scoreboard */}
        <ScoreDisplay score={match.score} servingTeam={match.serving_team} />

        {/* Team 2 */}
        <div className="flex-1 flex items-center justify-between px-6 py-5 border-t border-gray-800/30">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            {match.serving_team === 2 && (
              <span className="mt-2 w-4 h-4 rounded-full bg-brand-orange serving-pulse flex-shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-white font-bold text-2xl leading-tight truncate">
                {(match.entry2 as any)?.player1?.first_name} {(match.entry2 as any)?.player1?.last_name}
              </p>
              {(match.entry2 as any)?.player2 && (
                <p className="text-gray-300 text-xl leading-tight truncate">
                  {(match.entry2 as any)?.player2?.first_name} {(match.entry2 as any)?.player2?.last_name}
                </p>
              )}
            </div>
          </div>
          <div className="text-right ml-4">
            <span className="text-7xl font-score font-black text-white leading-none">
              {match.score?.sets_won?.t2 ?? 0}
            </span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      {!isFinished && (
        <div className="px-5 pb-5 space-y-4">
          {/* Main point buttons - HUGE for outdoor tablet */}
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => setShowPointModal(1)} disabled={saving}
              className="h-32 bg-brand-red hover:bg-red-500 active:scale-95 disabled:opacity-50 rounded-2xl font-black text-white text-3xl font-score transition-transform shadow-xl leading-tight">
              PUNTO<br />EQUIPO 1
            </button>
            <button onClick={() => setShowPointModal(2)} disabled={saving}
              className="h-32 bg-brand-pink hover:bg-pink-500 active:scale-95 disabled:opacity-50 rounded-2xl font-black text-white text-3xl font-score transition-transform shadow-xl leading-tight">
              PUNTO<br />EQUIPO 2
            </button>
          </div>

          {/* Utility buttons - fewer, bigger */}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={handleUndo} disabled={saving}
              className="h-16 bg-gray-800 hover:bg-gray-700 active:scale-95 rounded-2xl text-white text-lg font-bold transition-transform border border-gray-700">
              ↩ Deshacer
            </button>
            <button onClick={handleFinish} disabled={saving}
              className="h-16 bg-gray-800 hover:bg-red-900 active:scale-95 rounded-2xl text-gray-300 hover:text-red-300 text-lg font-bold transition-transform border border-gray-700">
              Finalizar partido
            </button>
          </div>

          {lastAction && (
            <p className="text-center text-gray-500 text-sm">{lastAction}</p>
          )}
        </div>
      )}

      {isFinished && (
        <div className="px-4 pb-4">
          <a href="/judge" className="block text-center bg-gray-800 text-gray-300 py-3 rounded-xl text-sm">
            ← Volver a mis partidos
          </a>
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
