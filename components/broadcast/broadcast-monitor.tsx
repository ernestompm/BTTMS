'use client'
// ============================================================================
// BroadcastMonitor — Dashboard de monitorización del PUT a Singular.
// ============================================================================
// Permite verificar de un vistazo que:
//   1) El partido activo está emitiendo (broadcast_active = true)
//   2) Los PUT/POST hacia Singular están llegando con 2xx
//   3) El marcador y stats que se envían cuadran con lo que el árbitro marca
//
// Layout en 4 cuadrantes (responsive):
//
//   ┌─────────────────────────────┬──────────────────────────────┐
//   │ MIRROR del marcador en vivo │  Salud del endpoint           │
//   │ (lo que ven los gráficos)   │  - estado/última PUT/avg/%    │
//   ├─────────────────────────────┼──────────────────────────────┤
//   │ Stats compactas en vivo     │  Panel control Singular (TBD)│
//   ├─────────────────────────────┴──────────────────────────────┤
//   │ Log de envíos en vivo  ·  JSON payload preview             │
//   └────────────────────────────────────────────────────────────┘
// ============================================================================

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Score } from '@/types'

interface Tournament {
  id: string
  name: string
  broadcast_endpoint?: string | null
  broadcast_method?: string | null
}

interface Props {
  tournament: Tournament | null
  initialMatches: any[]
  initialLogs: any[]
}

type LogRow = {
  id?: string
  created_at: string
  event: string
  endpoint?: string
  method?: string
  status?: number | null
  ok?: boolean
  retries?: number
  error?: string | null
  match_id?: string | null
  duration_ms?: number | null
}

export function BroadcastMonitor({ tournament, initialMatches, initialLogs }: Props) {
  const supabase = createClient()
  const [matches, setMatches] = useState<any[]>(initialMatches)
  const [logs, setLogs] = useState<LogRow[]>(initialLogs)
  const [activeMatchId, setActiveMatchId] = useState<string | null>(
    initialMatches.find((m) => m.broadcast_active)?.id ?? null
  )
  const [activeMatch, setActiveMatch] = useState<any | null>(null)
  const [payload, setPayload] = useState<any | null>(null)
  const [loadingPayload, setLoadingPayload] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const tournamentId = tournament?.id

  // ── Realtime: matches (so broadcast_active flips reflect immediately) ──
  useEffect(() => {
    if (!tournamentId) return
    const ch = supabase.channel(`bmon-matches-${tournamentId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${tournamentId}` },
        () => reloadMatches()
      ).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [tournamentId])

  // ── Realtime: broadcast_logs (every PUT appears live) ──
  useEffect(() => {
    if (!tournamentId) return
    const ch = supabase.channel(`bmon-logs-${tournamentId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'broadcast_logs', filter: `tournament_id=eq.${tournamentId}` },
        (p) => setLogs((l) => [p.new as LogRow, ...l].slice(0, 200))
      ).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [tournamentId])

  // ── Realtime: el match seleccionado (score, stats, status, serving…) ──
  useEffect(() => {
    if (!activeMatchId) { setActiveMatch(null); return }
    loadActiveMatch(activeMatchId)
    const ch = supabase.channel(`bmon-match-${activeMatchId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${activeMatchId}` },
        (p) => setActiveMatch((m: any) => ({ ...m, ...(p.new as any) }))
      ).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [activeMatchId])

  // ── Cada vez que el match cambia, refrescar el preview JSON ──
  useEffect(() => {
    if (!activeMatchId || !autoRefresh) return
    loadPayload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMatchId, autoRefresh, activeMatch?.score?.sets_won, activeMatch?.score?.current_game, activeMatch?.score?.current_set])

  async function reloadMatches() {
    if (!tournamentId) return
    const { data } = await supabase.from('matches')
      .select(`id, status, scheduled_at, round, category, match_type, broadcast_active,
        court:courts(name),
        entry1:draw_entries!entry1_id(player1:players!player1_id(first_name,last_name), player2:players!player2_id(first_name,last_name)),
        entry2:draw_entries!entry2_id(player1:players!player1_id(first_name,last_name), player2:players!player2_id(first_name,last_name))`)
      .eq('tournament_id', tournamentId)
      .in('status', ['in_progress', 'scheduled', 'warmup', 'judge_on_court', 'players_on_court'])
      .order('scheduled_at', { ascending: true })
    setMatches((data as any) ?? [])
  }

  async function loadActiveMatch(id: string) {
    const { data } = await supabase.from('matches')
      .select(`*,
        court:courts(name),
        entry1:draw_entries!entry1_id(player1:players!player1_id(first_name,last_name,nationality), player2:players!player2_id(first_name,last_name,nationality)),
        entry2:draw_entries!entry2_id(player1:players!player1_id(first_name,last_name,nationality), player2:players!player2_id(first_name,last_name,nationality))`)
      .eq('id', id).single()
    if (data) setActiveMatch(data as any)
  }

  async function loadPayload() {
    if (!activeMatchId || !tournamentId) return
    setLoadingPayload(true)
    try {
      const res = await fetch(`/api/broadcast/export?tournament=${tournamentId}&match=${activeMatchId}`)
      const data = res.ok ? await res.json() : null
      setPayload(data)
    } catch {
      setPayload(null)
    }
    setLoadingPayload(false)
  }

  async function toggleBroadcast(matchId: string, activate: boolean) {
    try {
      const res = await fetch(`/api/matches/${matchId}/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: activate }),
      })
      if (!res.ok) return
      if (activate) setActiveMatchId(matchId)
      reloadMatches()
    } catch {}
  }

  // ── Health metrics: ventana últimas 50 entradas del log ──
  const health = useMemo(() => computeHealth(logs.slice(0, 50)), [logs])

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-gray-950/95 backdrop-blur border-b border-gray-800">
        <div className="max-w-[1700px] mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white">📡 Broadcast Monitor</h1>
            <p className="text-[11px] text-gray-500 truncate">{tournament?.name ?? '—'}</p>
          </div>
          <div className="flex-1" />
          <HealthPill health={health}/>
          <a href="/broadcast" className="text-xs text-gray-400 hover:text-white px-2 py-1.5 rounded-lg bg-gray-900 border border-gray-800">
            ⚙ Configuración endpoint
          </a>
        </div>

        {/* Match selector strip */}
        <div className="max-w-[1700px] mx-auto px-4 pb-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-[10px] uppercase tracking-widest text-gray-600 flex-shrink-0">Emitiendo:</span>
            {matches.length === 0 && <span className="text-xs text-gray-600">No hay partidos disponibles</span>}
            {matches.map(m => {
              const t1 = teamShortName(m.entry1)
              const t2 = teamShortName(m.entry2)
              const isActive = m.broadcast_active
              const isSelected = m.id === activeMatchId
              return (
                <button
                  key={m.id}
                  onClick={() => setActiveMatchId(m.id)}
                  className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    isSelected
                      ? 'bg-purple-700/30 border-purple-500 text-white'
                      : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'
                  }`}>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"/>}
                  <span>{t1} vs {t2}</span>
                  <span className="text-[10px] text-gray-500">· {m.round ?? m.category}</span>
                  {!isActive && isSelected && (
                    <span
                      onClick={(e) => { e.stopPropagation(); toggleBroadcast(m.id, true) }}
                      className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-red-700 hover:bg-red-600 text-white">
                      EN AIRE
                    </span>
                  )}
                  {isActive && (
                    <span
                      onClick={(e) => { e.stopPropagation(); toggleBroadcast(m.id, false) }}
                      className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300">
                      CORTAR
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </header>

      <main className="max-w-[1700px] mx-auto px-4 py-4 space-y-4">
        {/* Fila 1: Mirror + Health */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
          <ScoreMirror match={activeMatch}/>
          <EndpointHealthCard health={health} tournament={tournament}/>
        </div>

        {/* Fila 2: Previews en iframes — venue (por matchId) + Singular (URL fija configurable) */}
        <LivePreviews activeMatchId={activeMatchId}/>

        {/* Fila 3: Stats live + Singular control */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
          <LiveStats match={activeMatch}/>
          <SingularControlPanel match={activeMatch}/>
        </div>

        {/* Fila 4: Log + Preview JSON */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <LogPanel logs={logs} activeMatchId={activeMatchId}/>
          <PayloadPreview payload={payload} loading={loadingPayload} autoRefresh={autoRefresh}
            onToggleAuto={() => setAutoRefresh(a => !a)} onRefresh={loadPayload}
            tournament={tournament}/>
        </div>
      </main>
    </div>
  )
}

// ─── HEALTH (computed from logs) ───────────────────────────────────────────
function computeHealth(window: LogRow[]) {
  if (window.length === 0) {
    return { state: 'idle' as const, count: 0, okCount: 0, successPct: 0, avgMs: null as number | null, lastTs: null as Date | null, lastOk: null as boolean | null, lastError: null as string | null }
  }
  let ok = 0, durSum = 0, durN = 0
  for (const l of window) {
    if (l.ok) ok++
    if (typeof l.duration_ms === 'number') { durSum += l.duration_ms; durN++ }
  }
  const last = window[0]
  const lastTs = last?.created_at ? new Date(last.created_at) : null
  const successPct = Math.round((ok / window.length) * 100)
  const ageMs = lastTs ? Date.now() - lastTs.getTime() : Infinity
  const state: 'ok' | 'warn' | 'fail' | 'stale' | 'idle' =
    successPct >= 95 && ageMs < 60_000 ? 'ok'
    : successPct >= 70 && ageMs < 120_000 ? 'warn'
    : ageMs > 180_000 ? 'stale'
    : 'fail'
  return {
    state, count: window.length, okCount: ok, successPct,
    avgMs: durN > 0 ? Math.round(durSum / durN) : null,
    lastTs, lastOk: last.ok ?? null, lastError: last.error ?? null,
  }
}

function HealthPill({ health }: { health: ReturnType<typeof computeHealth> }) {
  const cfg = {
    ok:    { bg: 'bg-emerald-700/30', border: 'border-emerald-500', text: 'text-emerald-300', dot: 'bg-emerald-400', label: 'ON AIR · OK' },
    warn:  { bg: 'bg-amber-700/30',   border: 'border-amber-500',   text: 'text-amber-300',   dot: 'bg-amber-400',   label: 'INESTABLE' },
    fail:  { bg: 'bg-red-700/30',     border: 'border-red-500',     text: 'text-red-300',     dot: 'bg-red-400',     label: 'FALLA' },
    stale: { bg: 'bg-gray-700/30',    border: 'border-gray-600',    text: 'text-gray-300',    dot: 'bg-gray-400',    label: 'SIN ENVÍOS' },
    idle:  { bg: 'bg-gray-800/40',    border: 'border-gray-700',    text: 'text-gray-400',    dot: 'bg-gray-500',    label: 'EN REPOSO' },
  }[health.state]
  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-bold uppercase tracking-widest ${cfg.bg} ${cfg.border} ${cfg.text}`}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot} ${health.state === 'ok' ? 'animate-pulse' : ''}`}/>
      {cfg.label}
      {health.count > 0 && <span className="text-[10px] opacity-70 font-mono">{health.successPct}% · {health.avgMs ?? '—'}ms</span>}
    </span>
  )
}

// ─── ENDPOINT HEALTH CARD ──────────────────────────────────────────────────
function EndpointHealthCard({ health, tournament }: { health: ReturnType<typeof computeHealth>, tournament: Tournament | null }) {
  const lastWhen = health.lastTs ? timeAgo(health.lastTs) : '—'
  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">📡 Salud del endpoint</h3>
      <div className="space-y-2 text-sm">
        <Row label="Endpoint" value={
          <span className="font-mono text-[10px] text-gray-300 truncate block max-w-[220px]" title={tournament?.broadcast_endpoint ?? ''}>
            {tournament?.broadcast_endpoint || <span className="text-gray-600">— sin configurar —</span>}
          </span>
        }/>
        <Row label="Método" value={<span className="font-mono text-[11px] text-gray-300">{tournament?.broadcast_method ?? 'POST'}</span>}/>
        <Row label="Último envío" value={
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${health.lastOk ? 'bg-emerald-400' : 'bg-red-400'}`}/>
            <span className="text-gray-300 text-xs">{lastWhen}</span>
          </span>
        }/>
        <Row label="Éxito (50)" value={
          <span className="font-mono text-xs">
            <span className={health.successPct >= 95 ? 'text-emerald-400' : health.successPct >= 70 ? 'text-amber-400' : 'text-red-400'}>
              {health.okCount}/{health.count}
            </span>
            <span className="text-gray-500"> · {health.successPct}%</span>
          </span>
        }/>
        <Row label="Latencia media" value={<span className="font-mono text-xs text-gray-300">{health.avgMs != null ? `${health.avgMs} ms` : '—'}</span>}/>
        {health.lastError && (
          <div className="text-[10px] text-red-300 bg-red-900/30 border border-red-800 rounded-md p-2 mt-2 break-words">
            {health.lastError.slice(0, 240)}
          </div>
        )}
      </div>
    </div>
  )
}
function Row({ label, value }: { label: string, value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-gray-500 uppercase tracking-widest">{label}</span>
      {value}
    </div>
  )
}
function timeAgo(d: Date): string {
  const ms = Date.now() - d.getTime()
  if (ms < 0) return 'ahora'
  const s = Math.floor(ms / 1000)
  if (s < 5) return 'ahora'
  if (s < 60) return `hace ${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `hace ${m}m`
  const h = Math.floor(m / 60)
  return `hace ${h}h`
}

// ─── SCORE MIRROR ──────────────────────────────────────────────────────────
function ScoreMirror({ match }: { match: any | null }) {
  if (!match) {
    return (
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8 text-center text-gray-500 min-h-[260px] grid place-items-center">
        Selecciona un partido para ver el espejo del marcador
      </div>
    )
  }
  const score = match.score as Score | null
  const isDoubles = match.match_type === 'doubles'
  const serving = match.serving_team as 1 | 2 | null
  const tbActive = !!(score?.tiebreak_active || score?.super_tiebreak_active)
  const isLive = match.status === 'in_progress'
  const finishedSets = score?.sets ?? []
  const setCount = Math.max(1, Math.min(3, finishedSets.length + (isLive ? 1 : 0)))

  function teamName(t: 1 | 2): string {
    const e = t === 1 ? match.entry1 : match.entry2
    if (!e) return '—'
    if (isDoubles) return [e.player1, e.player2].filter(Boolean).map((p: any) => p.last_name).join(' / ')
    return e.player1?.last_name ?? '—'
  }
  function setVal(t: 1 | 2, i: number): number | null {
    if (i < finishedSets.length) return finishedSets[i][t === 1 ? 't1' : 't2']
    if (i === finishedSets.length && isLive) {
      if (tbActive) return score?.tiebreak_score?.[t === 1 ? 't1' : 't2'] ?? 0
      return score?.current_set?.[t === 1 ? 't1' : 't2'] ?? 0
    }
    return null
  }
  function gamePoint(t: 1 | 2): string {
    if (!score) return '0'
    const k = t === 1 ? 't1' : 't2'
    if (tbActive) return String(score.tiebreak_score?.[k] ?? 0)
    if (score.deuce) return '40'
    return ['0', '15', '30', '40'][score.current_game?.[k] ?? 0] ?? '0'
  }

  return (
    <div className="bg-gradient-to-b from-gray-900 to-gray-950 rounded-2xl border border-gray-800 overflow-hidden">
      <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">🖥 Espejo del marcador</h3>
        <span className="flex items-center gap-1.5 text-[10px] font-mono text-gray-500">
          <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`}/>
          {match.status}
        </span>
      </div>
      <div className="px-4 py-4 grid items-center gap-2"
        style={{ gridTemplateColumns: `1fr ${Array(setCount).fill('60px').join(' ')} 70px` }}>
        {/* T1 row */}
        <div className="text-right flex items-center justify-end gap-2 min-w-0">
          {serving === 1 && <ServeDot/>}
          <span className="text-2xl font-bold uppercase tracking-tight truncate" style={{ color: '#00e0c6' }}>{teamName(1)}</span>
        </div>
        {Array.from({ length: setCount }).map((_, i) => (
          <SetCell key={`s1-${i}`} value={setVal(1, i)} isCurrent={i === finishedSets.length && isLive} accent="#00e0c6"/>
        ))}
        <PointCell value={gamePoint(1)} tb={tbActive} accent="#00e0c6"/>

        {/* T2 row */}
        <div className="text-right flex items-center justify-end gap-2 min-w-0">
          {serving === 2 && <ServeDot/>}
          <span className="text-2xl font-bold uppercase tracking-tight truncate" style={{ color: '#ff7b61' }}>{teamName(2)}</span>
        </div>
        {Array.from({ length: setCount }).map((_, i) => (
          <SetCell key={`s2-${i}`} value={setVal(2, i)} isCurrent={i === finishedSets.length && isLive} accent="#ff7b61"/>
        ))}
        <PointCell value={gamePoint(2)} tb={tbActive} accent="#ff7b61"/>
      </div>
    </div>
  )
}
function ServeDot() {
  return <span className="w-2 h-2 rounded-full bg-yellow-300 animate-pulse" title="Saque"/>
}
function SetCell({ value, isCurrent, accent }: { value: number | null, isCurrent: boolean, accent: string }) {
  return (
    <div className="grid place-items-center text-2xl font-black tabular-nums rounded-md py-1"
      style={{
        background: isCurrent ? `${accent}14` : 'rgba(0,0,0,.18)',
        color: value == null ? 'rgba(255,255,255,.30)' : 'white',
      }}>
      {value == null ? '–' : value}
    </div>
  )
}
function PointCell({ value, tb, accent }: { value: string, tb: boolean, accent: string }) {
  return (
    <div className="grid place-items-center text-xl font-black tabular-nums rounded-md py-1"
      style={{ background: tb ? '#fbbf24' : accent, color: tb ? '#1f1200' : 'white' }}>
      {value}
    </div>
  )
}

// ─── LIVE STATS (compact) ──────────────────────────────────────────────────
function LiveStats({ match }: { match: any | null }) {
  const s = match?.stats
  if (!s) {
    return (
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 text-center text-gray-500 text-sm">
        Sin estadísticas aún.
      </div>
    )
  }
  const rows: Array<{ label: string, a: any, b: any }> = [
    { label: 'Puntos ganados', a: s.t1?.total_points_won ?? 0, b: s.t2?.total_points_won ?? 0 },
    { label: 'Aces',           a: s.t1?.aces ?? 0,              b: s.t2?.aces ?? 0 },
    { label: 'Dobles faltas',  a: s.t1?.double_faults ?? 0,     b: s.t2?.double_faults ?? 0 },
    { label: 'Winners',        a: s.t1?.winners ?? 0,           b: s.t2?.winners ?? 0 },
    { label: 'Errores NF',     a: s.t1?.unforced_errors ?? 0,   b: s.t2?.unforced_errors ?? 0 },
    { label: '% saque',        a: `${Math.round(s.t1?.serve_points_won_pct ?? 0)}%`, b: `${Math.round(s.t2?.serve_points_won_pct ?? 0)}%` },
    { label: 'Breaks',         a: `${s.t1?.break_points_won ?? 0}/${s.t1?.break_points_played_on_return ?? 0}`, b: `${s.t2?.break_points_won ?? 0}/${s.t2?.break_points_played_on_return ?? 0}` },
  ]
  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
      <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">📊 Stats en vivo</h3>
        <span className="text-[10px] text-gray-600 uppercase tracking-widest">acumulado</span>
      </div>
      <div className="divide-y divide-gray-800/60">
        {rows.map((r, i) => {
          const na = parseFloat(String(r.a).replace('%', '').split('/')[0]) || 0
          const nb = parseFloat(String(r.b).replace('%', '').split('/')[0]) || 0
          return (
            <div key={i} className="grid grid-cols-[1fr_2fr_1fr] items-center gap-2 px-4 py-2">
              <span className={`text-base font-black tabular-nums text-right ${na > nb ? 'text-cyan-400' : 'text-white'}`}>{r.a}</span>
              <span className="text-[10px] uppercase tracking-widest text-gray-500 text-center">{r.label}</span>
              <span className={`text-base font-black tabular-nums text-left`} style={{ color: nb > na ? '#ff7b61' : 'white' }}>{r.b}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── SINGULAR CONTROL PANEL (TBD: API calls placeholder) ───────────────────
function SingularControlPanel({ match }: { match: any | null }) {
  // TBD — el usuario proporcionará las API calls de Singular. Por ahora
  // dejamos los botones cableados pero sin endpoint (no-op + toast).
  const [msg, setMsg] = useState<string | null>(null)

  function fire(action: string) {
    // TODO: cuando lleguen los endpoints de Singular, sustituir por:
    //   fetch('/api/singular/...', { method: 'POST', body: JSON.stringify({ action }) })
    setMsg(`[TBD] ${action}`)
    setTimeout(() => setMsg(null), 1600)
  }

  const groups: Array<{ title: string, btns: Array<{ label: string, action: string, color?: 'red'|'amber'|'green'|'gray' }> }> = [
    {
      title: 'Marcador en pantalla',
      btns: [
        { label: 'Mostrar scorebug',  action: 'scorebug.show',  color: 'green' },
        { label: 'Ocultar scorebug',  action: 'scorebug.hide',  color: 'gray' },
        { label: 'Cambiar lado',      action: 'scorebug.flip',  color: 'gray' },
      ],
    },
    {
      title: 'Tercios y rótulos',
      btns: [
        { label: 'Rótulo de jugador 1', action: 'lower3.player1.show', color: 'green' },
        { label: 'Rótulo de jugador 2', action: 'lower3.player2.show', color: 'green' },
        { label: 'Marcador grande',     action: 'fullscreen.score',    color: 'amber' },
        { label: 'Stats al aire',       action: 'fullscreen.stats',    color: 'amber' },
        { label: 'Quitar tercios',      action: 'lower3.clear',        color: 'gray' },
      ],
    },
    {
      title: 'Momentos especiales',
      btns: [
        { label: 'Set Point',     action: 'fx.setpoint',   color: 'red' },
        { label: 'Match Point',   action: 'fx.matchpoint', color: 'red' },
        { label: 'Break Point',   action: 'fx.breakpoint', color: 'red' },
        { label: 'Cambio de set', action: 'fx.setbreak',   color: 'amber' },
      ],
    },
  ]

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
      <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">🎛 Control Singular</h3>
        <span className="text-[10px] text-amber-400/80 uppercase tracking-widest font-mono">TBD · sin API conectada</span>
      </div>
      <div className="p-3 space-y-3">
        {groups.map(g => (
          <div key={g.title}>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1.5 px-1">{g.title}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {g.btns.map(b => (
                <button
                  key={b.action}
                  onClick={() => fire(b.action)}
                  disabled={!match}
                  className={`px-2.5 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-left ${
                    b.color === 'red'   ? 'bg-red-900/40 hover:bg-red-800/60 border border-red-800/50 text-red-200' :
                    b.color === 'amber' ? 'bg-amber-900/30 hover:bg-amber-800/50 border border-amber-800/50 text-amber-200' :
                    b.color === 'green' ? 'bg-emerald-900/30 hover:bg-emerald-800/50 border border-emerald-800/50 text-emerald-200' :
                                          'bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300'
                  }`}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        ))}
        {msg && (
          <div className="text-[11px] text-amber-300 bg-amber-950/40 border border-amber-800/40 rounded-md p-2 font-mono">
            {msg}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── LOG PANEL ─────────────────────────────────────────────────────────────
function LogPanel({ logs, activeMatchId }: { logs: LogRow[], activeMatchId: string | null }) {
  const [filterToActive, setFilterToActive] = useState(false)
  const rows = filterToActive && activeMatchId ? logs.filter(l => l.match_id === activeMatchId) : logs
  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
      <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">📜 Log de envíos</h3>
        <label className="flex items-center gap-1.5 text-[10px] text-gray-500 cursor-pointer select-none">
          <input type="checkbox" checked={filterToActive} onChange={(e) => setFilterToActive(e.target.checked)} className="accent-purple-500"/>
          Solo este partido
        </label>
      </div>
      <div className="max-h-[420px] overflow-y-auto">
        {rows.length === 0 && (
          <div className="text-center text-gray-600 text-xs py-10">Sin actividad</div>
        )}
        {rows.map((l, i) => {
          const t = new Date(l.created_at)
          const ok = l.ok ?? (typeof l.status === 'number' && l.status >= 200 && l.status < 300)
          return (
            <div key={l.id ?? `${l.created_at}-${i}`} className={`grid grid-cols-[60px_1fr_50px_60px] items-center gap-2 px-3 py-1.5 text-[11px] border-b border-gray-900/80 ${ok ? '' : 'bg-red-950/30'}`} title={l.error ?? ''}>
              <span className="font-mono text-gray-600">{t.toLocaleTimeString('es-ES', { hour12: false })}</span>
              <span className={`truncate ${ok ? 'text-gray-300' : 'text-red-300'}`}>
                {l.event}
                {l.retries && l.retries > 0 ? <span className="text-amber-400 ml-1">×{l.retries + 1}</span> : null}
              </span>
              <span className="font-mono text-gray-600 text-[10px]">{l.duration_ms != null ? `${l.duration_ms}ms` : '—'}</span>
              <span className={`font-mono font-bold text-right ${ok ? 'text-emerald-400' : 'text-red-400'}`}>
                {l.status ?? (l.error ? 'ERR' : '—')}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── PAYLOAD PREVIEW ───────────────────────────────────────────────────────
function PayloadPreview({ payload, loading, autoRefresh, onToggleAuto, onRefresh, tournament }: {
  payload: any | null, loading: boolean, autoRefresh: boolean, onToggleAuto: () => void, onRefresh: () => void, tournament: Tournament | null
}) {
  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
      <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">
          🧾 Payload JSON
          <span className="ml-2 text-[10px] text-gray-600 font-mono normal-case">
            {tournament?.broadcast_method ?? 'POST'} → {tournament?.broadcast_endpoint?.replace(/^https?:\/\//, '') || '— sin endpoint —'}
          </span>
        </h3>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[10px] text-gray-500 cursor-pointer select-none">
            <input type="checkbox" checked={autoRefresh} onChange={onToggleAuto} className="accent-purple-500"/>
            Auto-refresh
          </label>
          <button onClick={onRefresh} className="text-[10px] text-gray-400 hover:text-white">
            {loading ? '...' : '↻'}
          </button>
        </div>
      </div>
      <pre className="text-[10px] text-gray-300 overflow-auto bg-gray-950 p-3 max-h-[420px] font-mono leading-snug">
{payload ? JSON.stringify(payload, null, 2) : (loading ? 'Cargando…' : 'Selecciona un partido')}
      </pre>
    </div>
  )
}

// ─── LIVE PREVIEWS (iframes: venue scoreboard + Singular graphics) ─────────
//
// Venue scoreboard URL se compone a partir del matchId activo
// (siempre /scoreboard/<matchId>). Singular es una URL fija por usuario
// (la misma para todos los partidos), guardada en localStorage para que
// no requiera tocar la BD ni una migración.
//
// Ambos iframes tienen botón ↻ para forzar reload (clave para verificar
// que la gráfica volvió a renderizar tras un cambio) y ⛶ para abrir en
// nueva pestaña a tamaño real.
const SINGULAR_URL_KEY = 'bttms:broadcast-monitor:singular-url'

function LivePreviews({ activeMatchId }: { activeMatchId: string | null }) {
  const [singularUrl, setSingularUrl] = useState<string>('')
  const [editingSingular, setEditingSingular] = useState(false)
  const [draftSingular, setDraftSingular] = useState('')
  const [venueKey, setVenueKey] = useState(0)
  const [singularKey, setSingularKey] = useState(0)

  // Cargar la URL guardada al montar (cliente-only)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SINGULAR_URL_KEY) ?? ''
      setSingularUrl(saved)
      if (!saved) setEditingSingular(true)
    } catch {}
  }, [])

  function saveSingular() {
    const v = draftSingular.trim()
    setSingularUrl(v)
    try { localStorage.setItem(SINGULAR_URL_KEY, v) } catch {}
    setEditingSingular(false)
    setSingularKey(k => k + 1)
  }
  function openEditor() {
    setDraftSingular(singularUrl)
    setEditingSingular(true)
  }
  function clearSingular() {
    setSingularUrl(''); setDraftSingular('')
    try { localStorage.removeItem(SINGULAR_URL_KEY) } catch {}
  }

  const venueUrl = activeMatchId ? `/scoreboard/${activeMatchId}` : ''

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {/* Venue scoreboard */}
      <IframePreview
        title="🖥 Marcador venue"
        subtitle={activeMatchId ? `/scoreboard/${activeMatchId.slice(0, 8)}…` : 'sin partido'}
        url={venueUrl}
        iframeKey={venueKey}
        onReload={() => setVenueKey(k => k + 1)}
        emptyMsg="Selecciona un partido para previsualizar el marcador venue"
      />

      {/* Singular graphics */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden flex flex-col">
        <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">🎬 Singular preview</h3>
            <p className="text-[10px] text-gray-600 font-mono truncate max-w-[320px]">{singularUrl || 'sin URL configurada'}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {singularUrl && (
              <>
                <button onClick={() => setSingularKey(k => k + 1)} className="text-[10px] text-gray-400 hover:text-white px-1.5 py-1 rounded bg-gray-800 hover:bg-gray-700">↻</button>
                <a href={singularUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-gray-400 hover:text-white px-1.5 py-1 rounded bg-gray-800 hover:bg-gray-700">⛶</a>
              </>
            )}
            <button onClick={openEditor} className="text-[10px] text-gray-400 hover:text-white px-2 py-1 rounded bg-gray-800 hover:bg-gray-700">
              {singularUrl ? '✎ URL' : '+ URL'}
            </button>
          </div>
        </div>

        {editingSingular && (
          <div className="px-4 py-3 border-b border-gray-800 bg-gray-950/60 space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-gray-500">URL de Singular (output / preview share link)</label>
            <input
              type="url"
              value={draftSingular}
              onChange={(e) => setDraftSingular(e.target.value)}
              placeholder="https://app.singular.live/output/..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-[12px] text-white font-mono focus:outline-none focus:border-purple-500"
            />
            <div className="flex items-center gap-2">
              <button onClick={saveSingular} className="px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-600 text-white text-[11px] font-semibold">
                Guardar
              </button>
              <button onClick={() => setEditingSingular(false)} className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-[11px]">
                Cancelar
              </button>
              {singularUrl && (
                <button onClick={clearSingular} className="ml-auto text-[10px] text-red-400 hover:text-red-300">
                  Borrar URL
                </button>
              )}
            </div>
            <p className="text-[10px] text-gray-600">
              Esta URL se guarda en tu navegador y se reutiliza para todos los partidos.
            </p>
          </div>
        )}

        <div className="relative bg-black flex-1 min-h-[260px]">
          {singularUrl ? (
            <iframe
              key={singularKey}
              src={singularUrl}
              className="absolute inset-0 w-full h-full border-0"
              referrerPolicy="no-referrer"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-gray-600 text-xs text-center px-6">
              {editingSingular ? 'Pega arriba la URL pública de Singular' : 'Pulsa "+ URL" para añadir el preview de Singular'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function IframePreview({ title, subtitle, url, iframeKey, onReload, emptyMsg }: {
  title: string, subtitle: string, url: string, iframeKey: number, onReload: () => void, emptyMsg: string
}) {
  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden flex flex-col">
      <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">{title}</h3>
          <p className="text-[10px] text-gray-600 font-mono truncate">{subtitle}</p>
        </div>
        {url && (
          <div className="flex items-center gap-1.5">
            <button onClick={onReload} className="text-[10px] text-gray-400 hover:text-white px-1.5 py-1 rounded bg-gray-800 hover:bg-gray-700">↻</button>
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-gray-400 hover:text-white px-1.5 py-1 rounded bg-gray-800 hover:bg-gray-700">⛶</a>
          </div>
        )}
      </div>
      <div className="relative bg-black flex-1 min-h-[260px]">
        {url ? (
          <iframe
            key={iframeKey}
            src={url}
            className="absolute inset-0 w-full h-full border-0"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-gray-600 text-xs px-6 text-center">
            {emptyMsg}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Utils ─────────────────────────────────────────────────────────────────
function teamShortName(entry: any): string {
  const a = entry?.player1?.last_name
  const b = entry?.player2?.last_name
  if (a && b) return `${a}/${b}`
  return a ?? '—'
}
