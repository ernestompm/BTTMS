'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { TossScreen } from './toss-screen'
import { PointModal } from './point-modal'
import { WarningModal } from './warning-modal'
import type { Match, PointType, ShotDirection, MatchWarnings, WarningType } from '@/types'

interface Props {
  initialMatch: Match & { entry1: any; entry2: any; court: any }
  userId: string
}

function tennisPoint(value: number | undefined, deuce: boolean | undefined, adv: 1 | 2 | null | undefined, team: 1 | 2): string {
  if (deuce) {
    if (adv === team) return 'ADV'
    if (adv && adv !== team) return '40'
    return 'DUC'
  }
  return ['0', '15', '30', '40'][value ?? 0] ?? '0'
}

function fmt(secs: number) {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function fmtMed(secs: number) {
  const m = Math.floor(secs / 60), s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function teamLabel(entry: any): { main: string; partner: string | null } {
  const main = entry?.player1 ? `${entry.player1.last_name}`.toUpperCase() : '—'
  const partner = entry?.player2 ? `${entry.player2.last_name}`.toUpperCase() : null
  return { main, partner }
}

export function JudgeClient({ initialMatch, userId }: Props) {
  const supabase = createClient()
  const [match, setMatch] = useState(initialMatch)
  const [showToss, setShowToss] = useState(initialMatch.status === 'scheduled')
  const [showPointModal, setShowPointModal] = useState<1 | 2 | null>(null)
  const [showWarningModal, setShowWarningModal] = useState(false)
  const [showMedical, setShowMedical] = useState(false)
  const [medSecs, setMedSecs] = useState(180)
  const [letFlash, setLetFlash] = useState(false)
  const [saving, setSaving] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const medTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Realtime
  useEffect(() => {
    const channel = supabase.channel(`match-${match.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${match.id}` },
        (payload) => setMatch((prev) => ({ ...prev, ...payload.new }))
      ).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [match.id])

  // Match timer
  useEffect(() => {
    if (match.status !== 'in_progress' || !match.started_at) return
    const startMs = new Date(match.started_at).getTime()
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startMs) / 1000)), 1000)
    return () => clearInterval(interval)
  }, [match.status, match.started_at])

  // Medical countdown
  useEffect(() => () => { if (medTimer.current) clearInterval(medTimer.current) }, [])

  function startMedical() {
    setMedSecs(180)
    setShowMedical(true)
    medTimer.current = setInterval(() => {
      setMedSecs((s) => {
        if (s <= 1) { clearInterval(medTimer.current!); return 0 }
        return s - 1
      })
    }, 1000)
  }

  function stopMedical() {
    if (medTimer.current) clearInterval(medTimer.current)
    setShowMedical(false)
  }

  function handleLet() {
    setLetFlash(true)
    setTimeout(() => setLetFlash(false), 1800)
  }

  async function handleTossComplete(tossData: any) {
    setSaving(true)
    const res = await fetch(`/api/matches/${match.id}/start`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tossData),
    })
    if (res.ok) { const u = await res.json(); setMatch((m) => ({ ...m, ...u })); setShowToss(false) }
    setSaving(false)
  }

  async function handlePointWon(winnerTeam: 1 | 2, pointType: PointType, shotDirection: ShotDirection | null) {
    setShowPointModal(null)
    setSaving(true)
    const res = await fetch(`/api/matches/${match.id}/point`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ winner_team: winnerTeam, point_type: pointType, shot_direction: shotDirection }),
    })
    if (res.ok) { const u = await res.json(); setMatch((m) => ({ ...m, ...u })) }
    setSaving(false)
  }

  async function handleUndo() {
    if (!confirm('¿Deshacer el último punto?')) return
    setSaving(true)
    const res = await fetch(`/api/matches/${match.id}/undo`, { method: 'POST' })
    if (res.ok) { const u = await res.json(); setMatch((m) => ({ ...m, ...u })) }
    setSaving(false)
  }

  async function handleFinish() {
    if (!confirm('¿Finalizar el partido?')) return
    setSaving(true)
    const res = await fetch(`/api/matches/${match.id}/finish`, { method: 'POST' })
    if (res.ok) { const u = await res.json(); setMatch((m) => ({ ...m, ...u })) }
    setSaving(false)
  }

  async function handleWarning(team: 1 | 2, type: WarningType) {
    setShowWarningModal(false)
    setSaving(true)
    const res = await fetch(`/api/matches/${match.id}/warning`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team, type }),
    })
    if (res.ok) { const u = await res.json(); setMatch((m) => ({ ...m, ...u })) }
    setSaving(false)
  }

  if (showToss) return <TossScreen match={match} onComplete={handleTossComplete} saving={saving} />

  const score = match.score as any
  const warnings: MatchWarnings = match.warnings ?? { t1: [], t2: [] }
  const t1 = teamLabel(match.entry1)
  const t2 = teamLabel(match.entry2)
  const setsWon1 = score?.sets_won?.t1 ?? 0
  const setsWon2 = score?.sets_won?.t2 ?? 0
  const game1 = tennisPoint(score?.current_game?.t1, score?.deuce, score?.advantage_team, 1)
  const game2 = tennisPoint(score?.current_game?.t2, score?.deuce, score?.advantage_team, 2)
  const isFinished = match.status === 'finished'
  const serving = match.serving_team

  // Current set score
  const curSet1 = score?.current_set?.t1 ?? 0
  const curSet2 = score?.current_set?.t2 ?? 0
  const pastSets: { t1: number; t2: number }[] = score?.sets ?? []

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-950 select-none overflow-hidden">

      {/* ── TOP BAR ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isFinished ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
          <span className="text-white font-medium text-sm truncate">{match.court?.name ?? '—'}</span>
          {match.round && <span className="text-gray-500 text-xs">· {match.round}</span>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-gray-400 font-mono text-sm tabular-nums">{fmt(elapsed)}</span>
          {!isFinished && (
            <button onClick={handleFinish} disabled={saving}
              className="h-8 px-3 bg-gray-800 hover:bg-red-900/50 rounded-lg text-gray-400 hover:text-red-300 font-bold text-xs border border-gray-700 transition-colors">
              FIN
            </button>
          )}
        </div>
      </div>

      {/* ── TEAM ROWS ──────────────────────────────────────────── */}
      {[1, 2].map((t) => {
        const isServing = serving === t
        const name = t === 1 ? t1 : t2
        const setsWon = t === 1 ? setsWon1 : setsWon2
        const gameScore = t === 1 ? game1 : game2
        const warnCount = t === 1 ? warnings.t1.length : warnings.t2.length
        const lastPenalty = t === 1 ? warnings.t1[warnings.t1.length - 1]?.penalty : warnings.t2[warnings.t2.length - 1]?.penalty
        return (
          <div key={t}
            className={`flex items-center px-4 py-2.5 border-b border-gray-800 flex-shrink-0 ${isServing ? 'bg-gray-900' : 'bg-black'}`}
            style={isServing ? { borderTop: '2px solid #fc6f43' } : {}}>
            {/* Serving indicator */}
            <div className="w-4 flex-shrink-0 flex items-center justify-center mr-2">
              {isServing && <span className="w-2.5 h-2.5 rounded-full bg-brand-orange serving-pulse" />}
            </div>
            {/* Names */}
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-base leading-tight truncate">{name.main}</p>
              {name.partner && <p className="text-gray-400 text-sm leading-tight truncate">{name.partner}</p>}
            </div>
            {/* Warning badge */}
            {warnCount > 0 && (
              <div className={`flex-shrink-0 mx-2 px-2 py-0.5 rounded-lg text-xs font-bold border ${lastPenalty === 'default' ? 'bg-red-900/60 border-red-700 text-red-300' : lastPenalty === 'game_penalty' ? 'bg-red-900/40 border-red-800 text-red-400' : lastPenalty === 'point_penalty' ? 'bg-orange-900/40 border-orange-800 text-orange-400' : 'bg-yellow-900/40 border-yellow-800 text-yellow-400'}`}>
                ⚠ {warnCount}
              </div>
            )}
            {/* Score */}
            <div className="flex items-baseline gap-3 flex-shrink-0">
              {/* Past sets */}
              <div className="flex gap-1">
                {pastSets.map((s: any, i: number) => (
                  <span key={i} className="text-gray-500 font-score font-bold text-sm tabular-nums w-4 text-center">{t === 1 ? s.t1 : s.t2}</span>
                ))}
                {/* Current set */}
                <span className="text-gray-300 font-score font-bold text-sm tabular-nums w-4 text-center">{t === 1 ? curSet1 : curSet2}</span>
              </div>
              <span className={`font-score font-black text-3xl tabular-nums w-14 text-right ${isServing ? 'text-white' : 'text-gray-400'}`}>
                {gameScore}
              </span>
            </div>
          </div>
        )
      })}

      {/* ── MAIN AREA (point buttons / finished screen) ─────────── */}
      {isFinished ? (
        <div className="flex-1 flex items-center justify-center p-6 bg-green-900/10">
          <div className="text-center">
            <p className="text-green-400 font-score font-black text-5xl mb-2">✓ FINALIZADO</p>
            <p className="text-gray-400 text-base mb-6">
              Ganador: Equipo {match.score?.winner_team ?? '?'}
            </p>
            <Link href="/judge" className="inline-block bg-gray-800 hover:bg-gray-700 text-white px-8 py-3 rounded-xl font-bold text-base transition-colors">
              ← Volver
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 relative">

          {/* Two equal point buttons */}
          <div className="flex-1 grid grid-rows-2 gap-px bg-gray-800 min-h-0">
            {[1, 2].map((t) => {
              const isServing = serving === t
              const name = t === 1 ? t1 : t2
              return (
                <button key={t}
                  onClick={() => !saving && setShowPointModal(t as 1 | 2)}
                  disabled={saving}
                  className="bg-gray-900 hover:bg-gray-800 active:bg-gray-700 disabled:opacity-60 transition-colors flex items-center justify-center w-full h-full"
                  style={isServing ? { borderLeft: '4px solid #fc6f43' } : { borderLeft: '4px solid transparent' }}>
                  <div className="text-center px-6">
                    <p className="text-gray-500 text-xs font-semibold uppercase tracking-[0.25em] mb-1">Punto</p>
                    <p className="text-white font-black font-score text-4xl leading-tight">{name.main}</p>
                    {name.partner && (
                      <p className="text-gray-400 font-bold font-score text-xl mt-0.5">/ {name.partner}</p>
                    )}
                    {isServing && (
                      <p className="text-brand-orange text-xs font-semibold mt-1.5 uppercase tracking-widest">● Saque</p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Medical timeout overlay */}
          {showMedical && (
            <div className="absolute inset-0 bg-teal-950/95 flex flex-col items-center justify-center z-10">
              <p className="text-teal-300 font-semibold uppercase tracking-widest text-xs mb-3">Tiempo médico</p>
              <p className={`font-score font-black text-8xl tabular-nums mb-2 ${medSecs <= 30 ? 'text-red-400' : 'text-white'}`}>
                {fmtMed(medSecs)}
              </p>
              <p className="text-gray-400 text-sm mb-8">3 minutos reglamentarios · RFET 2026 art. 27b</p>
              <button onClick={stopMedical}
                className="bg-teal-800 hover:bg-teal-700 text-white font-bold px-8 py-3 rounded-xl transition-colors">
                Finalizar tiempo médico
              </button>
            </div>
          )}

          {/* LET flash overlay */}
          {letFlash && (
            <div className="absolute inset-0 bg-blue-900/95 flex flex-col items-center justify-center z-10 pointer-events-none">
              <p className="text-blue-200 font-score font-black text-7xl tracking-widest">LET</p>
              <p className="text-blue-300 text-xl font-semibold mt-2">Repetir punto</p>
            </div>
          )}
        </div>
      )}

      {/* ── BOTTOM ACTION BAR ──────────────────────────────────── */}
      {!isFinished && (
        <div className="flex-shrink-0 grid grid-cols-4 gap-px bg-gray-800 border-t border-gray-800">
          {/* DESHACER */}
          <button onClick={handleUndo} disabled={saving}
            className="bg-yellow-900/50 hover:bg-yellow-900 active:bg-yellow-800 disabled:opacity-40 transition-colors py-4 flex flex-col items-center justify-center gap-1">
            <span className="text-yellow-400 text-xl">↩</span>
            <span className="text-yellow-400 font-bold text-xs tracking-wide">DESHACER</span>
          </button>

          {/* LET */}
          <button onClick={handleLet}
            className="bg-blue-900/40 hover:bg-blue-900 active:bg-blue-800 transition-colors py-4 flex flex-col items-center justify-center gap-1">
            <span className="text-blue-400 text-xl">↺</span>
            <span className="text-blue-400 font-bold text-xs tracking-wide">LET</span>
          </button>

          {/* MÉDICO */}
          <button onClick={startMedical} disabled={showMedical}
            className="bg-teal-900/40 hover:bg-teal-900 active:bg-teal-800 disabled:opacity-40 transition-colors py-4 flex flex-col items-center justify-center gap-1">
            <span className="text-teal-400 text-xl">✚</span>
            <span className="text-teal-400 font-bold text-xs tracking-wide">MÉDICO</span>
          </button>

          {/* SANCIÓN */}
          <button onClick={() => setShowWarningModal(true)} disabled={saving}
            className="bg-orange-900/40 hover:bg-orange-900 active:bg-orange-800 disabled:opacity-40 transition-colors py-4 flex flex-col items-center justify-center gap-1">
            <span className="text-orange-400 text-xl">⚠</span>
            <span className="text-orange-400 font-bold text-xs tracking-wide">SANCIÓN</span>
          </button>
        </div>
      )}

      {/* Modals */}
      {showPointModal !== null && (
        <PointModal
          winnerTeam={showPointModal}
          servingTeam={match.serving_team ?? 1}
          onSelect={handlePointWon}
          onClose={() => setShowPointModal(null)}
        />
      )}

      {showWarningModal && (
        <WarningModal
          warnings={warnings}
          team1Name={`${t1.main}${t1.partner ? ` / ${t1.partner}` : ''}`}
          team2Name={`${t2.main}${t2.partner ? ` / ${t2.partner}` : ''}`}
          onConfirm={handleWarning}
          onClose={() => setShowWarningModal(false)}
        />
      )}
    </div>
  )
}
