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

// ── helpers ───────────────────────────────────────────────────────
function fmtTime(secs: number) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function fmtMed(secs: number) {
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
}

function gameScore(score: any, team: 1 | 2): string {
  if (!score) return '0'
  if (score.super_tiebreak_active) return String(score.tiebreak_score?.[`t${team}`] ?? 0)
  if (score.tiebreak_active) return String(score.tiebreak_score?.[`t${team}`] ?? 0)
  const pts: number = score.current_game?.[`t${team}`] ?? 0
  const deuce: boolean = score.deuce
  const adv: 1 | 2 | null = score.advantage_team
  if (deuce) { if (adv === team) return 'ADV'; if (adv && adv !== team) return '40'; return 'DUC' }
  return (['0', '15', '30', '40'][pts]) ?? '0'
}

function teamLabel(entry: any): { main: string; partner: string | null } {
  if (!entry) return { main: '—', partner: null }
  const m = entry.player1 ? `${entry.player1.last_name}`.toUpperCase() : '—'
  const p = entry.player2 ? `${entry.player2.last_name}`.toUpperCase() : null
  return { main: m, partner: p }
}

const PENALTY_NEXT_LABEL = ['ADVERTENCIA', 'PUNTO', 'JUEGO', 'DESCALIFIC.']
const WARNING_TYPE_LABELS: Record<string, string> = {
  conduct: 'Conducta', time: 'Tiempo', coaching: 'Coaching',
  equipment_abuse: 'Material', obscenity: 'Lenguaje', other: 'Otra',
}
const PENALTY_LEVEL_LABELS: Record<string, string> = {
  warning: 'Advertencia', point_penalty: 'Punto', game_penalty: 'Juego', default: 'Descalificación',
}

// ── component ─────────────────────────────────────────────────────
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

  // ── realtime ──────────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel(`match-${match.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${match.id}` },
        (p) => setMatch((m) => ({ ...m, ...p.new })))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [match.id])

  // ── match timer ───────────────────────────────────────────────
  useEffect(() => {
    if (match.status !== 'in_progress' || !match.started_at) return
    const t0 = new Date(match.started_at).getTime()
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000)
    return () => clearInterval(id)
  }, [match.status, match.started_at])

  // ── medical timer cleanup ─────────────────────────────────────
  useEffect(() => () => { if (medTimer.current) clearInterval(medTimer.current) }, [])

  // ── computed ──────────────────────────────────────────────────
  const score = match.score as any
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
  const isFinished = match.status === 'finished'
  const serving = match.serving_team
  const stats = match.stats as any
  const winnerTeam = match.score?.winner_team

  // ── actions ───────────────────────────────────────────────────
  async function handleTossComplete(data: any) {
    setSaving(true)
    const res = await fetch(`/api/matches/${match.id}/start`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    })
    if (res.ok) { setMatch((m) => ({ ...m, ...await res.json() })); setShowToss(false) }
    setSaving(false)
  }

  async function handlePointWon(wt: 1 | 2, pt: PointType, sd: ShotDirection | null) {
    setShowPointModal(null); setSaving(true)
    const res = await fetch(`/api/matches/${match.id}/point`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ winner_team: wt, point_type: pt, shot_direction: sd }),
    })
    if (res.ok) setMatch((m) => ({ ...m, ...await res.json() }))
    setSaving(false)
  }

  async function handleUndo() {
    if (!confirm('¿Deshacer el último punto?')) return
    setSaving(true)
    const res = await fetch(`/api/matches/${match.id}/undo`, { method: 'POST' })
    if (res.ok) setMatch((m) => ({ ...m, ...await res.json() }))
    setSaving(false)
  }

  async function handleFinish() {
    if (!confirm('¿Finalizar el partido?')) return
    setSaving(true)
    const res = await fetch(`/api/matches/${match.id}/finish`, { method: 'POST' })
    if (res.ok) setMatch((m) => ({ ...m, ...await res.json() }))
    setSaving(false)
  }

  async function handleWarning(team: 1 | 2, type: WarningType) {
    setShowWarningModal(false); setSaving(true)
    const res = await fetch(`/api/matches/${match.id}/warning`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team, type }),
    })
    if (res.ok) setMatch((m) => ({ ...m, ...await res.json() }))
    setSaving(false)
  }

  function handleLet() { setLetFlash(true); setTimeout(() => setLetFlash(false), 1800) }

  function startMedical() {
    setMedSecs(180); setShowMedical(true)
    medTimer.current = setInterval(() => {
      setMedSecs((s) => { if (s <= 1) { clearInterval(medTimer.current!); return 0 } return s - 1 })
    }, 1000)
  }

  function stopMedical() { clearInterval(medTimer.current!); setShowMedical(false) }

  if (showToss) return <TossScreen match={match} onComplete={handleTossComplete} saving={saving} />

  const warnCount1 = warnings.t1.length
  const warnCount2 = warnings.t2.length
  const nextWarnLabel1 = PENALTY_NEXT_LABEL[Math.min(warnCount1, 3)]
  const nextWarnLabel2 = PENALTY_NEXT_LABEL[Math.min(warnCount2, 3)]

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-950 select-none overflow-hidden">

      {/* ── TOP BAR ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isFinished ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
          <span className="text-white font-semibold truncate">{match.court?.name ?? '—'}</span>
          {match.round && <span className="text-gray-500 text-sm flex-shrink-0">· {match.round}</span>}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-gray-300 font-mono tabular-nums">{fmtTime(elapsed)}</span>
          {!isFinished && (
            <button onClick={handleFinish} disabled={saving}
              className="h-8 px-3 bg-gray-800 hover:bg-red-900/50 rounded-lg text-gray-400 hover:text-red-300 font-bold text-xs border border-gray-700 transition-colors">
              FIN
            </button>
          )}
        </div>
      </div>

      {/* ── SCORE STRIP ──────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-black border-b border-gray-800 px-3 py-4">
        {(isTB || isSuperTB) && (
          <p className={`text-center text-xs font-bold uppercase tracking-widest mb-1 ${isSuperTB ? 'text-amber-400' : 'text-blue-400'}`}>
            {isSuperTB ? 'Super Tiebreak' : 'Tiebreak'}
          </p>
        )}
        <div className="flex items-center gap-2">

          {/* T1: sets-won + past sets + current set */}
          <div className="flex items-center gap-2 flex-1 justify-start">
            <span className="text-4xl font-black font-score text-white tabular-nums leading-none">{setsWon1}</span>
            <div className="flex flex-col items-center gap-0.5">
              {pastSets.map((s, i) => (
                <span key={i} className="text-xs text-gray-600 font-score leading-none tabular-nums">{s.t1}</span>
              ))}
              <span className="text-2xl font-bold text-gray-300 font-score leading-none tabular-nums">{curSet1}</span>
            </div>
          </div>

          {/* Game scores — HUGE center */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className={`font-black font-score tabular-nums leading-none transition-colors ${serving === 1 ? 'text-white text-6xl' : 'text-gray-500 text-5xl'}`}>
              {game1}
            </span>
            <span className="text-gray-700 text-xl font-light">–</span>
            <span className={`font-black font-score tabular-nums leading-none transition-colors ${serving === 2 ? 'text-white text-6xl' : 'text-gray-500 text-5xl'}`}>
              {game2}
            </span>
          </div>

          {/* T2: current set + past sets + sets-won */}
          <div className="flex items-center gap-2 flex-1 justify-end">
            <div className="flex flex-col items-center gap-0.5">
              {pastSets.map((s, i) => (
                <span key={i} className="text-xs text-gray-600 font-score leading-none tabular-nums">{s.t2}</span>
              ))}
              <span className="text-2xl font-bold text-gray-300 font-score leading-none tabular-nums">{curSet2}</span>
            </div>
            <span className="text-4xl font-black font-score text-white tabular-nums leading-none">{setsWon2}</span>
          </div>
        </div>
      </div>

      {/* ── MAIN AREA ────────────────────────────────────────────── */}
      {isFinished ? (

        /* ── ACTA ──────────────────────────────────────────────── */
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Winner card */}
          <div className="bg-green-900/20 rounded-2xl border border-green-800/40 p-6 text-center">
            <p className="text-green-400 text-xs font-bold uppercase tracking-widest mb-3">Partido finalizado</p>
            <p className="text-white font-black font-score text-4xl leading-tight">
              {winnerTeam === 1 ? t1.main : t2.main}
            </p>
            {(winnerTeam === 1 ? t1.partner : t2.partner) && (
              <p className="text-white font-black font-score text-4xl leading-tight">
                {winnerTeam === 1 ? t1.partner : t2.partner}
              </p>
            )}
            <p className="text-gray-400 mt-2">gana el partido · {fmtTime(elapsed)}</p>
          </div>

          {/* Set scores */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
            <p className="text-gray-400 text-xs uppercase tracking-widest mb-3">Resultado</p>
            <div className="flex text-xs text-gray-600 uppercase tracking-widest mb-2">
              <span className="flex-1 text-right pr-4">{t1.main}{t1.partner ? `/${t1.partner}` : ''}</span>
              <span className="w-16 text-center"></span>
              <span className="flex-1 pl-4">{t2.main}{t2.partner ? `/${t2.partner}` : ''}</span>
            </div>
            {pastSets.map((s, i) => (
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

          {/* Stats */}
          {stats && stats.t1 && stats.t2 && (() => {
            const s1 = stats.t1; const s2 = stats.t2
            const rows = [
              { label: '% Puntos al saque', v1: `${s1.serve_points_won_pct}%`, v2: `${s2.serve_points_won_pct}%` },
              { label: '% Puntos al resto', v1: `${s1.return_points_won_pct}%`, v2: `${s2.return_points_won_pct}%` },
              { label: 'Racha actual', v1: String(s1.current_points_streak), v2: String(s2.current_points_streak) },
              { label: 'Mayor racha', v1: String(s1.max_points_streak), v2: String(s2.max_points_streak) },
              { label: 'Puntos totales', v1: String(s1.total_points_won), v2: String(s2.total_points_won) },
              { label: 'ACEs', v1: String(s1.aces), v2: String(s2.aces) },
              { label: 'Faltas de saque', v1: String(s1.serve_faults), v2: String(s2.serve_faults) },
              { label: 'Winners', v1: String(s1.winners), v2: String(s2.winners) },
              { label: 'Errores no forz.', v1: String(s1.unforced_errors), v2: String(s2.unforced_errors) },
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
          })()}

          {/* Warning log */}
          {(warnings.t1.length + warnings.t2.length > 0) && (
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
              <p className="text-gray-400 text-xs uppercase tracking-widest mb-3">Sanciones</p>
              {[...warnings.t1, ...warnings.t2]
                .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                .map((w, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-800/40 last:border-0">
                    <span className="text-yellow-400 text-lg flex-shrink-0">⚠</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-bold">{WARNING_TYPE_LABELS[w.type]} · Equipo {w.team}</p>
                      <p className="text-gray-400 text-xs">{PENALTY_LEVEL_LABELS[w.penalty]}</p>
                    </div>
                    <span className="text-gray-600 text-xs flex-shrink-0">
                      {new Date(w.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>

      ) : (

        /* ── POINT BUTTONS ─────────────────────────────────────── */
        <div className="flex-1 flex min-h-0 relative">

          {[1, 2].map((t) => {
            const isServing = serving === t
            const name = t === 1 ? t1 : t2
            const wc = t === 1 ? warnCount1 : warnCount2
            const nextL = t === 1 ? nextWarnLabel1 : nextWarnLabel2
            return (
              <button key={t}
                onClick={() => !saving && setShowPointModal(t as 1 | 2)}
                disabled={saving}
                className={`flex-1 flex flex-col items-center justify-center transition-all disabled:opacity-50 active:brightness-75 relative overflow-hidden ${t === 1 ? 'border-r border-gray-800' : ''}`}
                style={{ background: isServing ? 'rgba(100,45,0,0.38)' : '#111827' }}>

                {/* Serving top stripe */}
                {isServing && (
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-orange-500" />
                )}

                <div className="flex flex-col items-center gap-2 px-4 max-w-full">
                  {/* Both player names — EQUAL size, EQUAL weight */}
                  <p className="text-white font-black font-score text-4xl leading-tight text-center">{name.main}</p>
                  {name.partner && (
                    <p className="text-white font-black font-score text-4xl leading-tight text-center">{name.partner}</p>
                  )}

                  {/* Serving badge */}
                  {isServing ? (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="w-3 h-3 rounded-full bg-orange-400 serving-pulse" />
                      <span className="text-orange-400 text-sm font-bold uppercase tracking-widest">SAQUE</span>
                    </div>
                  ) : <div className="h-5" />}

                  {/* Warning status */}
                  {wc > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-yellow-900/40 border border-yellow-700/50 mt-1">
                      <span className="text-yellow-400 font-bold text-sm">⚠ {wc}</span>
                      <span className="text-gray-400 text-xs">→ sig. {nextL}</span>
                    </div>
                  )}
                </div>
              </button>
            )
          })}

          {/* Medical overlay */}
          {showMedical && (
            <div className="absolute inset-0 bg-teal-950/96 flex flex-col items-center justify-center z-10">
              <p className="text-teal-300 text-xs font-bold uppercase tracking-widest mb-2">Tiempo médico</p>
              <p className={`font-score font-black text-9xl tabular-nums leading-none mb-2 ${medSecs <= 30 ? 'text-red-400' : 'text-white'}`}>
                {fmtMed(medSecs)}
              </p>
              <p className="text-gray-500 text-sm mb-8">3 min · RFET art. 27b</p>
              <button onClick={stopMedical}
                className="bg-teal-800 hover:bg-teal-700 text-white font-bold px-8 py-3.5 rounded-xl text-base transition-colors">
                Finalizar tiempo médico
              </button>
            </div>
          )}

          {/* LET flash */}
          {letFlash && (
            <div className="absolute inset-0 bg-blue-900/96 flex flex-col items-center justify-center z-10 pointer-events-none">
              <p className="font-score font-black text-8xl text-blue-200 tracking-widest leading-none">LET</p>
              <p className="text-blue-300 text-2xl font-semibold mt-3">Repetir punto</p>
            </div>
          )}
        </div>
      )}

      {/* ── BOTTOM BAR ───────────────────────────────────────────── */}
      {isFinished ? (
        <div className="flex-shrink-0 flex gap-px bg-gray-800">
          <button onClick={handleUndo} disabled={saving}
            className="flex-1 bg-yellow-950 hover:bg-yellow-900 disabled:opacity-40 py-5 flex items-center justify-center gap-2 font-bold text-yellow-400 transition-colors">
            ↩ Deshacer último punto
          </button>
          <Link href="/judge"
            className="flex-1 py-5 flex items-center justify-center gap-2 font-black font-score text-white text-lg transition-opacity"
            style={{ background: 'linear-gradient(90deg,#f31948,#fc6f43)' }}>
            ✓ CONFIRMAR
          </Link>
        </div>
      ) : (
        <div className="flex-shrink-0 grid grid-cols-4 gap-px bg-gray-800">
          <button onClick={handleUndo} disabled={saving}
            className="bg-yellow-950 hover:bg-yellow-900 active:bg-yellow-800 disabled:opacity-40 h-20 flex flex-col items-center justify-center gap-1.5 transition-colors">
            <span className="text-yellow-400 text-2xl leading-none">↩</span>
            <span className="text-yellow-400 font-bold text-xs tracking-wide">DESHACER</span>
          </button>
          <button onClick={handleLet}
            className="bg-blue-950 hover:bg-blue-900 active:bg-blue-800 h-20 flex flex-col items-center justify-center gap-1.5 transition-colors">
            <span className="text-blue-400 text-2xl leading-none">↺</span>
            <span className="text-blue-400 font-bold text-xs tracking-wide">LET</span>
          </button>
          <button onClick={startMedical} disabled={showMedical}
            className="bg-teal-950 hover:bg-teal-900 active:bg-teal-800 disabled:opacity-40 h-20 flex flex-col items-center justify-center gap-1.5 transition-colors">
            <span className="text-teal-400 text-2xl leading-none">✚</span>
            <span className="text-teal-400 font-bold text-xs tracking-wide">MÉDICO</span>
          </button>
          <button onClick={() => setShowWarningModal(true)} disabled={saving}
            className="bg-orange-950 hover:bg-orange-900 active:bg-orange-800 disabled:opacity-40 h-20 flex flex-col items-center justify-center gap-1.5 transition-colors">
            <span className="text-orange-400 text-2xl leading-none">⚠</span>
            <span className="text-orange-400 font-bold text-xs tracking-wide">SANCIÓN</span>
          </button>
        </div>
      )}

      {/* ── MODALS ───────────────────────────────────────────────── */}
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
