'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { TossScreen } from './toss-screen'
import { PointModal } from './point-modal'
import { WarningModal } from './warning-modal'
import { isBreakPoint, isSetPoint, isMatchPoint } from '@/lib/score-engine'
import type { Match, PointType, ShotDirection, MatchWarnings, WarningType, Score } from '@/types'

interface TimerConfig { warmup: number; sideChange: number; setBreak: number }

interface Props {
  initialMatch: Match & { entry1: any; entry2: any; court: any }
  userId: string
  timerConfig: TimerConfig
  advancedStats: boolean
}

interface Toast { id: number; msg: string; color: 'yellow' | 'orange' | 'red' | 'blue' | 'green' | 'teal' | 'gray' | 'purple' | 'amber' }

// ── helpers ───────────────────────────────────────────────────────
function fmtTime(secs: number) {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function fmtMed(secs: number) { return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` }

function gameScore(score: any, team: 1 | 2): string {
  if (!score) return '0'
  if (score.super_tiebreak_active) return String(score.tiebreak_score?.[`t${team}`] ?? 0)
  if (score.tiebreak_active) return String(score.tiebreak_score?.[`t${team}`] ?? 0)
  if (score.deuce) return '40'
  const pts: number = score.current_game?.[`t${team}`] ?? 0
  return (['0', '15', '30', '40'][pts]) ?? '0'
}

function teamLabel(entry: any): { main: string; partner: string | null } {
  if (!entry) return { main: '—', partner: null }
  return {
    main: entry.player1 ? `${entry.player1.last_name}`.toUpperCase() : '—',
    partner: entry.player2 ? `${entry.player2.last_name}`.toUpperCase() : null,
  }
}

const PENALTY_NEXT_LABEL = ['ADVERTENCIA', 'PUNTO', 'JUEGO', 'DESCALIFIC.']
const WARNING_TYPE_LABELS: Record<string, string> = {
  conduct: 'Conducta', time: 'Tiempo', coaching: 'Coaching',
  equipment_abuse: 'Material', obscenity: 'Lenguaje', other: 'Otra',
}
const PENALTY_LEVEL_LABELS: Record<string, string> = {
  warning: 'Advertencia', point_penalty: 'Punto', game_penalty: 'Juego', default: 'Descalificación',
}
const TOAST_COLORS: Record<Toast['color'], { bg: string; text: string; border: string }> = {
  yellow: { bg: 'bg-yellow-900/95', text: 'text-yellow-200', border: 'border-yellow-600' },
  orange: { bg: 'bg-orange-900/95', text: 'text-orange-200', border: 'border-orange-600' },
  red:    { bg: 'bg-red-900/95',    text: 'text-red-200',    border: 'border-red-600'    },
  blue:   { bg: 'bg-blue-900/95',   text: 'text-blue-200',   border: 'border-blue-600'   },
  green:  { bg: 'bg-green-900/95',  text: 'text-green-200',  border: 'border-green-600'  },
  teal:   { bg: 'bg-teal-900/95',   text: 'text-teal-200',   border: 'border-teal-600'   },
  gray:   { bg: 'bg-gray-800/95',   text: 'text-gray-200',   border: 'border-gray-600'   },
  purple: { bg: 'bg-purple-900/95', text: 'text-purple-200', border: 'border-purple-600' },
  amber:  { bg: 'bg-amber-900/95',  text: 'text-amber-200',  border: 'border-amber-600'  },
}

// ── Countdown hook ─────────────────────────────────────────────────
function useCountdown(initial: number, onDone?: () => void) {
  const [secs, setSecs] = useState(initial)
  const [running, setRunning] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function start(from?: number) {
    if (timerRef.current) clearInterval(timerRef.current)
    setSecs(from ?? initial)
    setRunning(true)
    timerRef.current = setInterval(() => {
      setSecs((s) => {
        if (s <= 1) { clearInterval(timerRef.current!); setRunning(false); onDone?.(); return 0 }
        return s - 1
      })
    }, 1000)
  }

  function stop() { if (timerRef.current) clearInterval(timerRef.current); setRunning(false) }
  function reset(to?: number) { stop(); setSecs(to ?? initial) }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  return { secs, running, start, stop, reset }
}

// ── Retire modal ───────────────────────────────────────────────────
function RetireModal({ t1Name, t2Name, onConfirm, onClose }: {
  t1Name: string; t2Name: string
  onConfirm: (team: 1 | 2, reason: string) => void
  onClose: () => void
}) {
  const [team, setTeam] = useState<1 | 2 | null>(null)
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 z-50 bg-gray-950/95 flex flex-col justify-end md:justify-center p-4">
      <div className="bg-gray-900 rounded-3xl border border-gray-700 overflow-hidden max-w-lg w-full mx-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <p className="text-white font-black font-score text-xl">RETIRADA / LESIÓN</p>
          <button onClick={onClose} className="w-10 h-10 bg-gray-800 hover:bg-gray-700 rounded-xl flex items-center justify-center text-gray-400 hover:text-white transition-colors">
            <span className="text-xl font-black">✕</span>
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">¿Qué equipo se retira?</p>
            <div className="grid grid-cols-2 gap-3">
              {([1, 2] as const).map((t) => (
                <button key={t} onClick={() => setTeam(t)}
                  className={`py-4 px-4 rounded-xl font-bold text-sm transition-colors border ${team === t ? 'bg-brand-red border-brand-red text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'}`}>
                  <span className="block text-xs text-gray-400 mb-0.5">Equipo {t}</span>
                  {t === 1 ? t1Name : t2Name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">Motivo (opcional)</p>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Lesión, enfermedad..."
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-gray-500" />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold transition-colors">Cancelar</button>
            <button onClick={() => team && onConfirm(team, reason)} disabled={!team}
              className="flex-1 py-3 rounded-xl font-black font-score transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-white bg-red-800 hover:bg-red-700">
              CONFIRMAR RETIRADA
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Break overlay (side change / set break) ────────────────────────
function BreakOverlay({ title, subtitle, secs, onDismiss }: {
  title: string; subtitle: string; secs: number; onDismiss: () => void
}) {
  return (
    <div className="fixed inset-0 z-40 bg-gray-950/97 flex flex-col items-center justify-center gap-4">
      <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">{subtitle}</p>
      <p className="font-score font-black text-8xl tabular-nums text-white leading-none">{fmtMed(secs)}</p>
      <p className="text-white font-black font-score text-2xl uppercase tracking-wide">{title}</p>
      <button onClick={onDismiss}
        className="mt-6 px-8 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-gray-300 font-bold text-sm transition-colors">
        Continuar ahora →
      </button>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────
export function JudgeClient({ initialMatch, userId, timerConfig, advancedStats }: Props) {
  const supabase = createClient()
  const [match, setMatch] = useState(initialMatch)
  const [classifyModal, setClassifyModal] = useState<{ team: 1 | 2; servingTeam: 1 | 2 } | null>(null)
  const [showWarningModal, setShowWarningModal] = useState(false)
  const [showRetireModal, setShowRetireModal] = useState(false)
  const [showMedical, setShowMedical] = useState(false)
  const [showMedTeamSelector, setShowMedTeamSelector] = useState(false)
  const [medTeam, setMedTeam] = useState<1 | 2 | null>(null)
  const [letFlash, setLetFlash] = useState(false)
  const [saving, setSaving] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [breakMode, setBreakMode] = useState<'side_change' | 'set_break' | null>(null)
  const toastId = useRef(0)
  const lastPointRef = useRef(0)

  const warmupTimer    = useCountdown(timerConfig.warmup)
  const medTimer       = useCountdown(180, () => setShowMedical(false))
  const sideChangeTimer = useCountdown(timerConfig.sideChange, () => setBreakMode(null))
  const setBreakTimer  = useCountdown(timerConfig.setBreak, () => setBreakMode(null))

  // ── realtime ─────────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel(`match-${match.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${match.id}` },
        (p) => setMatch((m) => ({ ...m, ...p.new })))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [match.id])

  // ── match elapsed timer ───────────────────────────────────────
  useEffect(() => {
    if (match.status !== 'in_progress' || !match.started_at) return
    const t0 = new Date(match.started_at).getTime()
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000)
    return () => clearInterval(id)
  }, [match.status, match.started_at])

  // ── auto-start warmup countdown when entering warmup state ────
  useEffect(() => {
    if (match.status === 'warmup' && !warmupTimer.running) {
      const base = match.warmup_started_at ? new Date(match.warmup_started_at).getTime() : Date.now()
      const elapsed_warmup = Math.floor((Date.now() - base) / 1000)
      const remaining = Math.max(0, timerConfig.warmup - elapsed_warmup)
      if (remaining > 0) warmupTimer.start(remaining)
    }
  }, [match.status])

  // ── toasts ────────────────────────────────────────────────────
  function addToast(msg: string, color: Toast['color']) {
    const id = ++toastId.current
    setToasts((t) => [...t, { id, msg, color }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000)
  }
  function dismissToast(id: number) { setToasts((t) => t.filter((x) => x.id !== id)) }

  // ── computed ──────────────────────────────────────────────────
  const score = match.score as any
  const scoreTyped = match.score as Score | null
  const warnings: MatchWarnings = match.warnings ?? { t1: [], t2: [] }
  const t1 = teamLabel(match.entry1)
  const t2 = teamLabel(match.entry2)
  const setsWon1 = score?.sets_won?.t1 ?? 0
  const setsWon2 = score?.sets_won?.t2 ?? 0
  const curSet1 = score?.current_set?.t1 ?? 0
  const curSet2 = score?.current_set?.t2 ?? 0
  const game1 = gameScore(score, 1)
  const game2 = gameScore(score, 2)
  const pastSets: { t1: number; t2: number }[] = score?.sets ?? []
  const isTB = score?.tiebreak_active
  const isSuperTB = score?.super_tiebreak_active
  const serving: 1 | 2 = (match.serving_team ?? 1) as 1 | 2
  const stats = match.stats as any
  const winnerTeam = match.score?.winner_team
  const warnCount1 = warnings.t1.length
  const warnCount2 = warnings.t2.length

  const isInProgress = match.status === 'in_progress'
  const isFinished   = match.status === 'finished' || match.status === 'retired' || match.status === 'walkover'

  const ctxGolden  = isInProgress && !!score?.deuce && !isTB && !isSuperTB
  const ctxBreak   = isInProgress && !!scoreTyped && isBreakPoint(scoreTyped, serving)
  const ctxSetT1   = isInProgress && !!scoreTyped && isSetPoint(scoreTyped, 1)
  const ctxSetT2   = isInProgress && !!scoreTyped && isSetPoint(scoreTyped, 2)
  const ctxMatchT1 = isInProgress && !!scoreTyped && isMatchPoint(scoreTyped, 1)
  const ctxMatchT2 = isInProgress && !!scoreTyped && isMatchPoint(scoreTyped, 2)
  const hasCtx     = ctxGolden || ctxBreak || ctxSetT1 || ctxSetT2 || ctxMatchT1 || ctxMatchT2

  const t1Label = `${t1.main}${t1.partner ? ` / ${t1.partner}` : ''}`
  const t2Label = `${t2.main}${t2.partner ? ` / ${t2.partner}` : ''}`

  // ── API helpers ───────────────────────────────────────────────
  async function post(path: string, body?: any) {
    const res = await fetch(`/api/matches/${match.id}/${path}`, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    if (res.ok) { const u = await res.json(); setMatch((m) => ({ ...m, ...u })) }
    return res
  }

  async function handleArrive()         { setSaving(true); await post('arrive');           setSaving(false) }
  async function handlePlayersArrived() { setSaving(true); await post('players-arrived');  setSaving(false) }
  async function handleWarmupComplete() { setSaving(true); await post('warmup-complete');  warmupTimer.stop(); setSaving(false) }

  async function handleTossComplete(data: any) {
    setSaving(true)
    const res = await fetch(`/api/matches/${match.id}/start`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    })
    if (res.ok) { const u = await res.json(); setMatch((m) => ({ ...m, ...u })) }
    setSaving(false)
  }

  async function handleImmediatePoint(wt: 1 | 2) {
    const now = Date.now()
    if (now - lastPointRef.current < 600) return
    lastPointRef.current = now

    const servingTeamAtPress = (match.serving_team ?? 1) as 1 | 2

    const res = await fetch(`/api/matches/${match.id}/point`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ winner_team: wt, point_type: 'winner', shot_direction: null }),
    })
    if (res.ok) {
      const u = await res.json()
      const ctx = u._context ?? {}
      setMatch((m) => ({ ...m, ...u }))

      // Show classification panel after score is updated (non-blocking)
      if (advancedStats) {
        setClassifyModal({ team: wt, servingTeam: servingTeamAtPress })
      }

      if (ctx.match_finished) addToast('PARTIDO FINALIZADO', 'green')

      if (ctx.side_change && !ctx.match_finished) {
        addToast('↔ CAMBIO DE LADO', 'blue')
        setBreakMode('side_change')
        sideChangeTimer.start()
      }
      if (ctx.new_super_tb) addToast('SUPER TIEBREAK', 'amber')
      else if (ctx.new_tb) addToast('TIEBREAK', 'blue')
      else if (ctx.new_set && !ctx.match_finished) {
        addToast('NUEVO SET', 'teal')
        if (!ctx.side_change) { setBreakMode('set_break'); setBreakTimer.start() }
      }

      if (ctx.match_point_t1 || ctx.match_point_t2) {
        addToast(`PARTIDO · ${ctx.match_point_t1 ? t1.main : t2.main}`, 'red')
      } else if (ctx.set_point_t1 || ctx.set_point_t2) {
        addToast(`SET · ${ctx.set_point_t1 ? t1.main : t2.main}`, 'orange')
      } else if (ctx.golden_point) {
        addToast('PUNTO DE ORO', 'yellow')
      } else if (ctx.break_point) {
        addToast('PUNTO DE BREAK', 'purple')
      }
    }
  }

  async function handleClassifyPoint(pt: PointType, sd: ShotDirection | null) {
    setClassifyModal(null)
    await fetch(`/api/matches/${match.id}/classify-point`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ point_type: pt, shot_direction: sd }),
    })
  }

  async function handleUndo() {
    if (!confirm('¿Deshacer el último punto?')) return
    setSaving(true); await post('undo'); setSaving(false)
  }

  async function handleFinish() {
    if (!confirm('¿Finalizar el partido?')) return
    setSaving(true); await post('finish'); setSaving(false)
  }

  async function handleWarning(team: 1 | 2, type: WarningType) {
    setShowWarningModal(false); setSaving(true)
    await post('warning', { team, type }); setSaving(false)
  }

  async function handleRetire(team: 1 | 2, reason: string) {
    setShowRetireModal(false); setSaving(true)
    await post('retire', { team, reason }); setSaving(false)
  }

  function handleLet() { setLetFlash(true); setTimeout(() => setLetFlash(false), 1800) }

  function openMedical(team: 1 | 2) {
    setMedTeam(team); setShowMedTeamSelector(false); setShowMedical(true)
    medTimer.start(180)
  }
  function stopMedical() { medTimer.stop(); setShowMedical(false); setMedTeam(null) }

  // ── STATE SCREENS ─────────────────────────────────────────────

  // Scheduled: judge not yet on court
  if (match.status === 'scheduled') {
    return (
      <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center gap-8 p-8">
        <div className="text-center">
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-2">Partido</p>
          <p className="text-white font-black font-score text-2xl">{t1Label}</p>
          <p className="text-gray-500 text-lg my-1">vs</p>
          <p className="text-white font-black font-score text-2xl">{t2Label}</p>
          {(match as any).court && <p className="text-gray-500 text-sm mt-3">{(match as any).court.name}</p>}
        </div>
        <button onClick={handleArrive} disabled={saving}
          className="w-full max-w-sm h-20 rounded-2xl font-black font-score text-2xl text-white disabled:opacity-50 active:scale-95 transition-transform"
          style={{ background: 'linear-gradient(90deg,#f31948,#fc6f43)' }}>
          {saving ? '...' : '🏃 ESTOY EN LA PISTA'}
        </button>
        <p className="text-gray-600 text-xs text-center">Pulsa cuando llegues a la pista asignada</p>
      </div>
    )
  }

  // Judge on court: waiting for players
  if (match.status === 'judge_on_court') {
    const arrivedAt = match.judge_on_court_at
      ? new Date(match.judge_on_court_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
      : null
    return (
      <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center gap-8 p-8">
        <div className="text-center">
          <span className="inline-block w-3 h-3 rounded-full bg-green-500 mb-4" />
          <p className="text-green-400 text-xs font-bold uppercase tracking-widest mb-1">Juez en la pista{arrivedAt ? ` · ${arrivedAt}` : ''}</p>
          <p className="text-white font-black font-score text-2xl">{t1Label}</p>
          <p className="text-gray-500 text-lg my-1">vs</p>
          <p className="text-white font-black font-score text-2xl">{t2Label}</p>
        </div>
        <div className="w-full max-w-sm space-y-3">
          <button onClick={handlePlayersArrived} disabled={saving}
            className="w-full h-20 rounded-2xl font-black font-score text-xl text-white disabled:opacity-50 active:scale-95 transition-transform"
            style={{ background: 'linear-gradient(90deg,#f31948,#fc6f43)' }}>
            {saving ? '...' : '✓ JUGADORES EN LA PISTA'}
          </button>
          <button onClick={handleRetire.bind(null, 1, 'No presentación')} className="w-full py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 font-bold text-sm transition-colors">
            No presentación / W.O.
          </button>
        </div>
        <p className="text-gray-600 text-xs text-center">Confirma cuando ambas parejas estén en pista</p>
      </div>
    )
  }

  // Players on court → TossScreen
  if (match.status === 'players_on_court') {
    return <TossScreen match={match} onComplete={handleTossComplete} saving={saving} />
  }

  // Warmup countdown
  if (match.status === 'warmup') {
    return (
      <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center gap-6 p-8">
        <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Calentamiento</p>
        <p className="text-white font-black font-score text-2xl text-center">{t1Label}</p>
        <p className="text-gray-500 text-base">vs</p>
        <p className="text-white font-black font-score text-2xl text-center">{t2Label}</p>
        <p className={`font-score font-black text-9xl tabular-nums leading-none mt-4 ${warmupTimer.secs <= 30 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
          {fmtMed(warmupTimer.secs)}
        </p>
        <p className="text-gray-600 text-sm">Tiempo de calentamiento · {fmtMed(timerConfig.warmup)} total</p>
        <button onClick={handleWarmupComplete} disabled={saving}
          className="mt-4 w-full max-w-sm h-20 rounded-2xl font-black font-score text-2xl text-white disabled:opacity-50 active:scale-95 transition-transform"
          style={{ background: 'linear-gradient(90deg,#f31948,#fc6f43)' }}>
          {saving ? '...' : 'INICIAR PARTIDO →'}
        </button>
        <div className="flex gap-3 mt-2">
          <button onClick={() => setShowRetireModal(true)} className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-red-900/50 text-gray-400 hover:text-red-300 font-bold text-xs transition-colors">
            Retirada / Lesión
          </button>
        </div>
        {showRetireModal && (
          <RetireModal t1Name={t1Label} t2Name={t2Label} onConfirm={handleRetire} onClose={() => setShowRetireModal(false)} />
        )}
      </div>
    )
  }

  // ── FINISHED / RETIRED / WALKOVER screen ──────────────────────
  if (isFinished) {
    const isRetired = match.status === 'retired'
    const retiredTeamName = isRetired
      ? (match.retired_team === 1 ? t1Label : t2Label)
      : null
    return (
      <div className="fixed inset-0 flex flex-col bg-gray-950 select-none overflow-hidden">
        <TopBar match={match} elapsed={elapsed} saving={saving} onFinish={handleFinish} isFinished />

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isRetired ? (
            <div className="bg-red-900/20 rounded-2xl border border-red-800/40 p-6 text-center">
              <p className="text-red-400 text-xs font-bold uppercase tracking-widest mb-3">Retirada / Lesión</p>
              <p className="text-white font-black font-score text-3xl">{retiredTeamName}</p>
              <p className="text-gray-400 mt-2 text-sm">{match.retire_reason || 'Sin motivo especificado'}</p>
              <p className="text-gray-500 text-xs mt-1">· {fmtTime(elapsed)}</p>
            </div>
          ) : (
            <div className="bg-green-900/20 rounded-2xl border border-green-800/40 p-6 text-center">
              <p className="text-green-400 text-xs font-bold uppercase tracking-widest mb-3">Partido finalizado</p>
              <p className="text-white font-black font-score text-4xl leading-tight">{winnerTeam === 1 ? t1.main : t2.main}</p>
              {(winnerTeam === 1 ? t1.partner : t2.partner) && (
                <p className="text-white font-black font-score text-4xl leading-tight">{winnerTeam === 1 ? t1.partner : t2.partner}</p>
              )}
              <p className="text-gray-400 mt-2">gana el partido · {fmtTime(elapsed)}</p>
            </div>
          )}

          <Scoreboard t1={t1} t2={t2} pastSets={pastSets} setsWon1={setsWon1} setsWon2={setsWon2} isSuperTB={isSuperTB} score={score} winnerTeam={winnerTeam} />

          {stats && stats.t1 && stats.t2 && <StatsTable t1={t1} t2={t2} stats={stats} />}

          {(warnings.t1.length + warnings.t2.length > 0) && <WarningLog warnings={warnings} />}
        </div>

        <div className="flex-shrink-0 flex gap-px bg-gray-800">
          <button onClick={handleUndo} disabled={saving}
            className="flex-1 bg-yellow-950 hover:bg-yellow-900 disabled:opacity-40 py-5 flex items-center justify-center gap-2 font-bold text-yellow-400 transition-colors">
            ↩ Deshacer último punto
          </button>
          <Link href="/judge" className="flex-1 py-5 flex items-center justify-center gap-2 font-black font-score text-white text-lg"
            style={{ background: 'linear-gradient(90deg,#f31948,#fc6f43)' }}>
            ✓ CONFIRMAR
          </Link>
        </div>
      </div>
    )
  }

  // ── IN PROGRESS ───────────────────────────────────────────────
  return (
    <div className="fixed inset-0 flex flex-col bg-gray-950 select-none overflow-hidden">

      <TopBar match={match} elapsed={elapsed} saving={saving} onFinish={handleFinish} isFinished={false} />

      {/* Classic scoreboard */}
      <div className="flex-shrink-0 bg-gray-900 border-b border-gray-700">
        <div className="flex items-center px-3 pt-1.5 pb-0">
          <div className="flex-1" />
          <div className="w-10 text-center text-gray-600 text-[10px] font-bold uppercase tracking-wider">SETS</div>
          {pastSets.map((_, i) => (
            <div key={i} className="w-9 text-center text-gray-700 text-[10px] font-bold uppercase tracking-wider">S{i + 1}</div>
          ))}
          <div className="w-11 text-center text-gray-600 text-[10px] font-bold uppercase tracking-wider">JUE</div>
          <div className="w-7" />
        </div>

        {([1, 2] as const).map((t) => {
          const name = t === 1 ? t1 : t2
          const sw = t === 1 ? setsWon1 : setsWon2
          const cs = t === 1 ? curSet1 : curSet2
          const isServing = serving === t
          const wc = t === 1 ? warnCount1 : warnCount2
          return (
            <div key={t} className={`flex items-center px-3 py-2 gap-0 ${t === 2 ? 'border-t border-gray-800' : ''}`}>
              <div className="flex-1 min-w-0 pr-2">
                <p className="text-white font-bold text-base leading-tight truncate">{name.main}</p>
                {name.partner && <p className="text-white font-bold text-base leading-tight truncate">{name.partner}</p>}
              </div>
              <div className="w-10 text-center font-score font-black text-2xl text-white tabular-nums">{sw}</div>
              {pastSets.map((s, i) => (
                <div key={i} className="w-9 text-center font-score font-bold text-lg text-gray-500 tabular-nums">
                  {t === 1 ? s.t1 : s.t2}
                </div>
              ))}
              <div className="w-11 text-center font-score font-black text-2xl text-gray-300 tabular-nums">{cs}</div>
              <div className="w-7 flex flex-col items-center gap-1">
                {isServing && <span className="w-2.5 h-2.5 rounded-full bg-orange-400 serving-pulse" />}
                {wc > 0 && <span className="text-yellow-500 text-xs font-bold">⚠{wc}</span>}
              </div>
            </div>
          )
        })}

        {(isTB || isSuperTB) && (
          <div className={`text-center text-xs font-bold uppercase tracking-widest py-1 border-t border-gray-800 ${isSuperTB ? 'text-amber-400 bg-amber-950/30' : 'text-blue-400 bg-blue-950/30'}`}>
            {isSuperTB ? 'Super Tiebreak' : 'Tiebreak'}
          </div>
        )}

        {hasCtx && (
          <div className="flex gap-2 justify-center px-3 py-2 border-t border-gray-800 flex-wrap">
            {ctxGolden  && <span className="px-3 py-0.5 rounded-full bg-yellow-900/70 border border-yellow-600 text-yellow-300 text-xs font-bold uppercase tracking-widest">Punto de Oro</span>}
            {ctxBreak   && <span className="px-3 py-0.5 rounded-full bg-purple-900/70 border border-purple-600 text-purple-300 text-xs font-bold uppercase tracking-widest">Punto de Break</span>}
            {(ctxSetT1 || ctxSetT2) && !ctxMatchT1 && !ctxMatchT2 && (
              <span className="px-3 py-0.5 rounded-full bg-orange-900/70 border border-orange-600 text-orange-300 text-xs font-bold uppercase tracking-widest">
                Punto de Set · {ctxSetT1 ? t1.main : t2.main}
              </span>
            )}
            {(ctxMatchT1 || ctxMatchT2) && (
              <span className="px-3 py-0.5 rounded-full bg-red-900/70 border border-red-600 text-red-300 text-xs font-bold uppercase tracking-widest">
                Partido · {ctxMatchT1 ? t1.main : t2.main}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Point buttons */}
      <div className="flex-1 flex min-h-0 relative">
        {([1, 2] as const).map((t) => {
          const isServing = serving === t
          const name = t === 1 ? t1 : t2
          const g = t === 1 ? game1 : game2
          const wc = t === 1 ? warnCount1 : warnCount2
          const nextL = PENALTY_NEXT_LABEL[Math.min(wc, 3)]
          return (
            <button key={t} onClick={() => handleImmediatePoint(t)}
              className={`flex-1 flex flex-col items-center justify-center gap-3 transition-all active:brightness-75 relative overflow-hidden ${t === 1 ? 'border-r border-gray-800' : ''}`}
              style={{ background: isServing ? 'rgba(100,45,0,0.38)' : '#111827' }}>

              {isServing && <div className="absolute top-0 left-0 right-0 h-1.5 bg-orange-500" />}

              <span className={`font-score font-black tabular-nums leading-none ${(isTB || isSuperTB) ? 'text-6xl' : 'text-8xl'} text-white`}>{g}</span>

              <div className="flex flex-col items-center gap-1">
                <p className="text-white font-black font-score text-3xl leading-tight text-center px-3">{name.main}</p>
                {name.partner && <p className="text-white font-black font-score text-3xl leading-tight text-center px-3">{name.partner}</p>}
              </div>

              {isServing && (
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-400 serving-pulse" />
                  <span className="text-orange-400 text-sm font-bold uppercase tracking-widest">SAQUE</span>
                </div>
              )}

              {wc > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-yellow-900/40 border border-yellow-700/50">
                  <span className="text-yellow-400 font-bold text-sm">⚠ {wc}</span>
                  <span className="text-gray-400 text-xs">→ sig. {nextL}</span>
                </div>
              )}
            </button>
          )
        })}

        {/* Toasts */}
        {toasts.length > 0 && (
          <div className="absolute top-3 left-0 right-0 flex flex-col items-center gap-2 px-4 pointer-events-none z-20">
            {toasts.map((toast) => {
              const c = TOAST_COLORS[toast.color]
              return (
                <div key={toast.id}
                  className={`pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-2xl border font-black font-score text-lg uppercase tracking-widest shadow-xl ${c.bg} ${c.text} ${c.border}`}>
                  <span className="flex-1">{toast.msg}</span>
                  <button onClick={() => dismissToast(toast.id)} className="opacity-60 hover:opacity-100 text-base font-bold pl-2">✕</button>
                </div>
              )
            })}
          </div>
        )}

        {/* LET flash */}
        {letFlash && (
          <div className="absolute inset-0 bg-blue-900/96 flex flex-col items-center justify-center z-10 pointer-events-none">
            <p className="font-score font-black text-8xl text-blue-200 tracking-widest leading-none">LET</p>
            <p className="text-blue-300 text-2xl font-semibold mt-3">Repetir punto</p>
          </div>
        )}

        {/* Medical team selector */}
        {showMedTeamSelector && (
          <div className="absolute inset-0 bg-gray-950/96 flex flex-col items-center justify-center z-10 gap-5 p-8">
            <p className="text-white text-2xl font-black font-score">¿Tiempo médico para quién?</p>
            {([1, 2] as const).map((t) => {
              const name = t === 1 ? t1 : t2
              return (
                <button key={t} onClick={() => openMedical(t)}
                  className="w-full max-w-xs min-h-[80px] bg-gray-800 hover:bg-teal-900 border border-gray-700 hover:border-teal-600 rounded-2xl text-white font-black font-score text-2xl flex flex-col items-center justify-center gap-1 px-4 py-4 transition-colors active:scale-95">
                  <span className="text-xs text-gray-400 font-normal font-sans uppercase tracking-widest">Equipo {t}</span>
                  <span>{name.main}</span>
                  {name.partner && <span>{name.partner}</span>}
                </button>
              )
            })}
            <button onClick={() => setShowMedTeamSelector(false)} className="text-gray-500 hover:text-gray-300 text-sm mt-2">Cancelar</button>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="flex-shrink-0 grid grid-cols-5 gap-px bg-gray-800">
        <button onClick={handleUndo} disabled={saving}
          className="bg-yellow-950 hover:bg-yellow-900 active:bg-yellow-800 disabled:opacity-40 h-24 flex flex-col items-center justify-center gap-2 transition-colors">
          <span className="text-yellow-400 text-3xl leading-none">↩</span>
          <span className="text-yellow-400 font-bold text-xs tracking-wide">DESHACER</span>
        </button>
        <button onClick={handleLet}
          className="bg-blue-950 hover:bg-blue-900 active:bg-blue-800 h-24 flex flex-col items-center justify-center gap-2 transition-colors">
          <span className="text-blue-400 text-3xl leading-none">↺</span>
          <span className="text-blue-400 font-bold text-xs tracking-wide">LET</span>
        </button>
        <button onClick={() => !showMedical && setShowMedTeamSelector(true)} disabled={showMedical}
          className="bg-teal-950 hover:bg-teal-900 active:bg-teal-800 disabled:opacity-40 h-24 flex flex-col items-center justify-center gap-2 transition-colors">
          <span className="text-teal-400 text-3xl leading-none">✚</span>
          <span className="text-teal-400 font-bold text-xs tracking-wide">MÉDICO</span>
        </button>
        <button onClick={() => setShowWarningModal(true)} disabled={saving}
          className="bg-orange-950 hover:bg-orange-900 active:bg-orange-800 disabled:opacity-40 h-24 flex flex-col items-center justify-center gap-2 transition-colors">
          <span className="text-orange-400 text-3xl leading-none">⚠</span>
          <span className="text-orange-400 font-bold text-xs tracking-wide">SANCIÓN</span>
        </button>
        <button onClick={() => setShowRetireModal(true)}
          className="bg-red-950 hover:bg-red-900 active:bg-red-800 h-24 flex flex-col items-center justify-center gap-2 transition-colors">
          <span className="text-red-400 text-3xl leading-none">🏳</span>
          <span className="text-red-400 font-bold text-xs tracking-wide">RETIRADA</span>
        </button>
      </div>

      {/* Classification panel (non-blocking — score already saved) */}
      {classifyModal !== null && advancedStats && (
        <PointModal
          winnerTeam={classifyModal.team}
          servingTeam={classifyModal.servingTeam}
          onClassify={handleClassifyPoint}
          onDismiss={() => setClassifyModal(null)}
        />
      )}
      {showWarningModal && (
        <WarningModal warnings={warnings} team1Name={t1Label} team2Name={t2Label}
          onConfirm={handleWarning} onClose={() => setShowWarningModal(false)} />
      )}
      {showRetireModal && (
        <RetireModal t1Name={t1Label} t2Name={t2Label}
          onConfirm={handleRetire} onClose={() => setShowRetireModal(false)} />
      )}

      {/* Medical overlay — fixed to cover everything */}
      {showMedical && (
        <div className="fixed inset-0 z-50 bg-teal-950/97 flex flex-col items-center justify-center">
          <p className="text-teal-300 text-xs font-bold uppercase tracking-widest mb-1">Tiempo médico</p>
          {medTeam && (
            <p className="text-teal-400 text-sm font-bold mb-4">
              Equipo {medTeam}: {medTeam === 1 ? t1Label : t2Label}
            </p>
          )}
          <p className={`font-score font-black text-9xl tabular-nums leading-none mb-2 ${medTimer.secs <= 30 ? 'text-red-400' : 'text-white'}`}>
            {fmtMed(medTimer.secs)}
          </p>
          <p className="text-gray-500 text-sm mb-8">3 min · RFET art. 27b</p>
          <button onClick={stopMedical} className="bg-teal-800 hover:bg-teal-700 text-white font-bold px-8 py-3.5 rounded-xl text-base transition-colors">
            Finalizar tiempo médico
          </button>
        </div>
      )}

      {/* Break overlays (side change / set break) */}
      {breakMode === 'side_change' && (
        <BreakOverlay title="Cambio de Lado" subtitle="Descanso" secs={sideChangeTimer.secs}
          onDismiss={() => { sideChangeTimer.stop(); setBreakMode(null) }} />
      )}
      {breakMode === 'set_break' && (
        <BreakOverlay title="Descanso entre Sets" subtitle="Nuevo set" secs={setBreakTimer.secs}
          onDismiss={() => { setBreakTimer.stop(); setBreakMode(null) }} />
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────
function TopBar({ match, elapsed, saving, onFinish, isFinished }: any) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 flex-shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isFinished ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
        <span className="text-white font-semibold truncate text-sm">{match.court?.name ?? '—'}</span>
        {match.round && <span className="text-gray-500 text-sm flex-shrink-0">· {match.round}</span>}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-gray-300 font-mono tabular-nums text-sm">{fmtTime(elapsed)}</span>
        {!isFinished && (
          <button onClick={onFinish} disabled={saving}
            className="h-8 px-3 bg-gray-800 hover:bg-red-900/50 rounded-lg text-gray-400 hover:text-red-300 font-bold text-xs border border-gray-700 transition-colors">
            FIN
          </button>
        )}
      </div>
    </div>
  )
}

function Scoreboard({ t1, t2, pastSets, setsWon1, setsWon2, isSuperTB, score, winnerTeam }: any) {
  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
      <p className="text-gray-400 text-xs uppercase tracking-widest mb-3">Resultado</p>
      <div className="flex text-xs text-gray-600 uppercase tracking-widest mb-2">
        <span className="flex-1 text-right pr-4">{t1.main}{t1.partner ? `/${t1.partner}` : ''}</span>
        <span className="w-16 text-center" />
        <span className="flex-1 pl-4">{t2.main}{t2.partner ? `/${t2.partner}` : ''}</span>
      </div>
      {pastSets.map((s: any, i: number) => (
        <div key={i} className="flex items-center py-2 border-t border-gray-800/60">
          <span className={`flex-1 font-score font-black text-3xl tabular-nums text-right pr-4 ${winnerTeam === 1 && s.t1 > s.t2 ? 'text-white' : 'text-gray-500'}`}>{s.t1}</span>
          <span className="w-16 text-center text-gray-500 text-xs">Set {i + 1}</span>
          <span className={`flex-1 font-score font-black text-3xl tabular-nums pl-4 ${winnerTeam === 2 && s.t2 > s.t1 ? 'text-white' : 'text-gray-500'}`}>{s.t2}</span>
        </div>
      ))}
      {isSuperTB && (
        <div className="flex items-center py-2 border-t border-gray-800/60">
          <span className={`flex-1 font-score font-black text-3xl tabular-nums text-right pr-4 ${winnerTeam === 1 ? 'text-white' : 'text-gray-500'}`}>{score?.tiebreak_score?.t1 ?? 0}</span>
          <span className="w-16 text-center text-amber-600 text-xs">Super TB</span>
          <span className={`flex-1 font-score font-black text-3xl tabular-nums pl-4 ${winnerTeam === 2 ? 'text-white' : 'text-gray-500'}`}>{score?.tiebreak_score?.t2 ?? 0}</span>
        </div>
      )}
    </div>
  )
}

function StatsTable({ t1, t2, stats }: any) {
  const s1 = stats.t1, s2 = stats.t2
  const rows = [
    { label: '% Puntos al saque',  v1: `${s1.serve_points_won_pct}%`,    v2: `${s2.serve_points_won_pct}%`    },
    { label: '% Puntos al resto',  v1: `${s1.return_points_won_pct}%`,   v2: `${s2.return_points_won_pct}%`   },
    { label: 'Racha actual',        v1: String(s1.current_points_streak),  v2: String(s2.current_points_streak)  },
    { label: 'Mayor racha',         v1: String(s1.max_points_streak),      v2: String(s2.max_points_streak)      },
    { label: 'Puntos totales',      v1: String(s1.total_points_won),       v2: String(s2.total_points_won)       },
    { label: 'ACEs',                v1: String(s1.aces),                   v2: String(s2.aces)                   },
    { label: 'Faltas saque',        v1: String(s1.serve_faults),           v2: String(s2.serve_faults)           },
    { label: 'Winners',             v1: String(s1.winners),                v2: String(s2.winners)                },
    { label: 'Err. no forz.',       v1: String(s1.unforced_errors),        v2: String(s2.unforced_errors)        },
  ]
  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
      <p className="text-gray-400 text-xs uppercase tracking-widest mb-3">Estadísticas</p>
      {rows.map(({ label, v1, v2 }) => (
        <div key={label} className="flex items-center py-2 border-b border-gray-800/40 last:border-0">
          <span className="w-16 text-right font-score font-bold text-lg text-white tabular-nums">{v1}</span>
          <span className="flex-1 text-center text-gray-500 text-xs px-2">{label}</span>
          <span className="w-16 text-left font-score font-bold text-lg text-white tabular-nums">{v2}</span>
        </div>
      ))}
    </div>
  )
}

function WarningLog({ warnings }: { warnings: MatchWarnings }) {
  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
      <p className="text-gray-400 text-xs uppercase tracking-widest mb-3">Sanciones</p>
      {[...warnings.t1, ...warnings.t2]
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .map((w, i) => (
          <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-800/40 last:border-0">
            <span className="text-yellow-400 text-lg flex-shrink-0">⚠</span>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-bold">
                {({ conduct: 'Conducta', time: 'Tiempo', coaching: 'Coaching', equipment_abuse: 'Material', obscenity: 'Lenguaje', other: 'Otra' } as any)[w.type]} · Equipo {w.team}
              </p>
              <p className="text-gray-400 text-xs">
                {({ warning: 'Advertencia', point_penalty: 'Punto', game_penalty: 'Juego', default: 'Descalificación' } as any)[w.penalty]}
              </p>
            </div>
            <span className="text-gray-600 text-xs flex-shrink-0">
              {new Date(w.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
    </div>
  )
}
