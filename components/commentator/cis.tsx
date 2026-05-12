'use client'
// ============================================================================
// CommentatorCIS v2 — Dashboard de widgets denso.
// ============================================================================
// Toda la información que un comentarista necesita, distribuida en widgets
// independientes y visibles sin navegar:
//
//   [TopBar sticky]
//   [ScoreHeaderBig sticky] ─ marcador grande con sets, saque, banderas
//   ────────────────────────────────────────────────────────────────
//   [StatsTable] (2/3)            [PointLog live] (1/3)
//   ────────────────────────────────────────────────────────────────
//   [Tournament] [Match] [NextMatch]   ← info compacta en 3 columnas
//   ────────────────────────────────────────────────────────────────
//   [Players widget — bios de los 4]
//   ────────────────────────────────────────────────────────────────
//   [Bracket] (1/2)           [Resultados previos] (1/2)
//   ────────────────────────────────────────────────────────────────
//   [IA colapsable]
//
// Key win: la STATS TABLE muestra TODOS los sets + TOTAL a la vez (filas
// por stat, columnas por set), no requiere clicar para cambiar de set.
// El comentarista lee "aces 2-1, 0-2, total 2-3" sin moverse del sitio.
// ============================================================================

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { AppUser, Tournament, Score } from '@/types'
import { CATEGORY_LABELS } from '@/types'
import { CommentatorPlayerBio } from './player-bio'
import { CommentatorAIPanel } from './ai-panel'
import { CommentatorBracketMini } from './bracket-mini'
import { CommentatorRecentResults } from './recent-results'
import { CommentatorPointLog } from './point-log'
import { statsFromPoints } from './stats-from-points'

interface Props {
  currentUser: AppUser
  initialMatch: any
  tournament: Tournament
  bracketMatches: any[]
  previousMatches: any[]
  initialPointLog: any[]
}

export function CommentatorCIS({
  currentUser, initialMatch, tournament, bracketMatches, previousMatches, initialPointLog,
}: Props) {
  const supabase = createClient()
  const [match, setMatch] = useState<any>(initialMatch)
  const [pointLog, setPointLog] = useState<any[]>(initialPointLog)

  // Realtime — partido
  useEffect(() => {
    const ch = supabase.channel(`cis-match-${initialMatch.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${initialMatch.id}` },
        (p) => setMatch((m: any) => ({ ...m, ...(p.new as any) })))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [initialMatch.id])

  // Realtime — puntos
  useEffect(() => {
    const ch = supabase.channel(`cis-points-${initialMatch.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'points', filter: `match_id=eq.${initialMatch.id}` },
        async () => {
          const { data } = await supabase.from('points').select('*')
            .eq('match_id', initialMatch.id).eq('is_undone', false)
            .order('sequence', { ascending: false }).limit(200)
          setPointLog((data as any) ?? [])
        })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [initialMatch.id])

  return (
    <div className="min-h-screen flex flex-col bg-gray-950 text-white">
      <TopBar currentUser={currentUser} tournament={tournament} match={match}/>
      <ScoreHeaderBig match={match}/>

      <main className="flex-1">
        <div className="max-w-[1800px] mx-auto px-4 py-4 space-y-4">

          {/* ── Tier 1: STATS TABLE (toda la info a la vez) + LOG live ── */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4 items-start">
            <StatsTableWidget match={match} pointLog={pointLog}/>
            <PointLogWidget pointLog={pointLog} match={match}/>
          </div>

          {/* ── Tier 2: info compacta en tres tarjetas ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <TournamentInfoWidget tournament={tournament} match={match}/>
            <MatchInfoWidget match={match} currentUser={currentUser}/>
            <NextMatchWidget bracketMatches={bracketMatches} currentMatch={match}/>
          </div>

          {/* ── Tier 3: jugadores (bios completos) ── */}
          <PlayersWidget match={match}/>

          {/* ── Tier 4: cuadro + resultados previos ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <Widget icon="🏆" title="Cuadro de la categoría">
              <CommentatorBracketMini matches={bracketMatches} highlightMatchId={match.id} category={match.category}/>
            </Widget>
            <Widget icon="📋" title="Resultados previos">
              <CommentatorRecentResults previousMatches={previousMatches}/>
            </Widget>
          </div>

          {/* ── Tier 5: IA colapsable ── */}
          <CollapsibleAI match={match} tournament={tournament} previousMatches={previousMatches} pointLog={pointLog}/>
        </div>
      </main>
    </div>
  )
}

// ─── TOP BAR ────────────────────────────────────────────────────────────────
function TopBar({ currentUser, tournament, match }: { currentUser: AppUser, tournament: Tournament, match: any }) {
  const isLive = match.status === 'in_progress'
  return (
    <div className="bg-gray-950/95 backdrop-blur border-b border-gray-800 flex-none sticky top-0 z-30">
      <div className="max-w-[1800px] mx-auto px-4 py-2 flex items-center justify-between gap-3 text-sm">
        <Link href="/commentator" className="text-gray-400 hover:text-white">← Partidos</Link>
        <div className="flex items-center gap-3 text-xs text-gray-500 flex-1 justify-center min-w-0 truncate">
          <span className="truncate">{tournament?.name}</span>
          <span className="text-gray-700">·</span>
          <span>{(CATEGORY_LABELS as any)[match.category] ?? match.category}</span>
          {match.round && <><span className="text-gray-700">·</span><span className="font-bold text-white">{match.round}</span></>}
          {match.court && <><span className="text-gray-700">·</span><span>📍 {match.court.name}</span></>}
        </div>
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-red-400 uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"/>
              EN DIRECTO
            </span>
          )}
          <span className="text-xs text-gray-500">{currentUser.full_name}</span>
        </div>
      </div>
    </div>
  )
}

// ─── BIG SCORE HEADER (sticky) ─────────────────────────────────────────────
// Formato CLÁSICO de tenis broadcast: dos filas (un equipo por fila),
// cada fila tiene: [bandera nat] [nombre equipo] [● saque] | set1 | set2 | set3 | punto
// Equivalente a lo que ves en TVs en cualquier ATP/WTA — Federer arriba,
// Nadal abajo, sets corriendo en columnas, current game/TB en la última.
// Cuando un set se cierra, el ganador queda en blanco y el perdedor gris;
// el set en juego se resalta con fondo del color de su equipo.
function ScoreHeaderBig({ match }: { match: any }) {
  const score = match.score as Score | null
  const isDoubles = match.match_type === 'doubles'
  const serving = match.serving_team as 1|2|null
  const tbActive = !!(score?.tiebreak_active || score?.super_tiebreak_active)
  const stbActive = !!(score as any)?.super_tiebreak_active
  const isLive = match.status === 'in_progress'
  const finishedSets = (score?.sets ?? []) as Array<{ t1: number, t2: number }>
  // Siempre mostramos 3 columnas de set: las jugadas + las pendientes en gris.
  // Si el match es a 2 sets + super TB, la tercera columna pasa a ser STB.
  const setCount = 3

  function teamName(t: 1|2): string {
    const e = t === 1 ? match.entry1 : match.entry2
    if (!e) return '—'
    if (isDoubles) return [e.player1, e.player2].filter(Boolean).map((p:any) => p.last_name).join(' / ')
    return e.player1?.last_name ?? '—'
  }
  function teamFlag(t: 1|2): string | null {
    const e = t === 1 ? match.entry1 : match.entry2
    return (e?.player1?.nationality as string | undefined)?.toUpperCase() ?? null
  }
  function setVal(t: 1|2, i: number): number | null {
    const k = t === 1 ? 't1' : 't2'
    if (i < finishedSets.length) return finishedSets[i][k]
    if (i === finishedSets.length && isLive) {
      if (tbActive) return score?.tiebreak_score?.[k] ?? 0
      return score?.current_set?.[k] ?? 0
    }
    return null
  }
  function gamePoint(t: 1|2): string {
    if (!score) return '0'
    const k = t === 1 ? 't1' : 't2'
    if (tbActive) return String(score.tiebreak_score?.[k] ?? 0)
    if (score.deuce) return '40'
    return ['0','15','30','40'][score.current_game?.[k] ?? 0] ?? '0'
  }
  function setWonBy(i: number): 1 | 2 | null {
    const s = finishedSets[i]
    if (!s) return null
    if (s.t1 > s.t2) return 1
    if (s.t2 > s.t1) return 2
    return null
  }

  // Estado del marcador
  const winnerTeam = (score as any)?.winner_team ?? null
  const matchStatus: string = match.status
  const elapsedLabel = matchElapsedLabel(match)

  return (
    <div className="bg-gradient-to-b from-gray-900 to-gray-950 border-b border-gray-800 flex-none sticky top-[37px] z-20">
      <div className="max-w-[1800px] mx-auto px-4 py-2.5">
        {/* Tira superior: estado + tiempo + flags */}
        <div className="flex items-center justify-between gap-3 mb-1.5 text-[10px] uppercase tracking-widest text-gray-500">
          <div className="flex items-center gap-3">
            <StatusBadge status={matchStatus}/>
            {elapsedLabel && <span className="text-gray-400 font-mono tabular-nums">⏱ {elapsedLabel}</span>}
            {tbActive && (
              <span className="text-amber-400 font-bold">
                {stbActive ? 'SUPER TIEBREAK' : 'TIEBREAK'}
              </span>
            )}
          </div>
          {/* Encabezado de columnas (Set 1 / Set 2 / Set 3 / Punto) */}
          <div className="grid items-center gap-1.5"
            style={{ gridTemplateColumns: `repeat(${setCount}, 56px) 72px` }}>
            {Array.from({ length: setCount }).map((_, i) => (
              <span key={i} className="text-center text-gray-600">S{i + 1}</span>
            ))}
            <span className="text-center text-gray-600">{tbActive ? 'TB' : 'PT'}</span>
          </div>
        </div>

        {/* Equipo 1 — fila */}
        <TeamRow
          accent="#00e0c6"
          name={teamName(1)}
          flag={teamFlag(1)}
          isServing={serving === 1}
          isWinner={winnerTeam === 1}
          sets={Array.from({ length: setCount }).map((_, i) => ({
            value: setVal(1, i),
            isCurrent: i === finishedSets.length && isLive,
            isWon: setWonBy(i) === 1,
            isLost: setWonBy(i) === 2,
          }))}
          gamePoint={gamePoint(1)}
          tbActive={tbActive}
          setCount={setCount}
        />
        {/* Equipo 2 — fila */}
        <TeamRow
          accent="#ff7b61"
          name={teamName(2)}
          flag={teamFlag(2)}
          isServing={serving === 2}
          isWinner={winnerTeam === 2}
          sets={Array.from({ length: setCount }).map((_, i) => ({
            value: setVal(2, i),
            isCurrent: i === finishedSets.length && isLive,
            isWon: setWonBy(i) === 2,
            isLost: setWonBy(i) === 1,
          }))}
          gamePoint={gamePoint(2)}
          tbActive={tbActive}
          setCount={setCount}
        />
      </div>
    </div>
  )
}

function TeamRow({
  accent, name, flag, isServing, isWinner, sets, gamePoint, tbActive, setCount,
}: {
  accent: string,
  name: string,
  flag: string | null,
  isServing: boolean,
  isWinner: boolean,
  sets: Array<{ value: number | null, isCurrent: boolean, isWon: boolean, isLost: boolean }>,
  gamePoint: string,
  tbActive: boolean,
  setCount: number,
}) {
  return (
    <div
      className="grid items-stretch gap-1.5 py-1 rounded-md transition-colors"
      style={{
        gridTemplateColumns: `28px 1fr repeat(${setCount}, 56px) 72px`,
        background: isServing ? `${accent}10` : 'transparent',
      }}
    >
      {/* Punto de saque a la izquierda — más visible que el chip anterior */}
      <div className="flex items-center justify-center">
        {isServing
          ? <span className="w-3 h-3 rounded-full" style={{ background: '#fde047', boxShadow: '0 0 10px rgba(253,224,71,.7)' }} title="Al saque"/>
          : <span className="w-3 h-3 rounded-full" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.08)' }}/>
        }
      </div>

      {/* Bandera + nombre */}
      <div className="flex items-center gap-2.5 min-w-0">
        {flag && (
          <img
            src={`/Flags/${flag}.jpg`}
            alt={flag}
            className="w-7 h-5 object-cover rounded-sm flex-shrink-0"
            style={{ boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.3)' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        )}
        <span
          className="text-2xl font-black uppercase tracking-tight truncate"
          style={{ color: isWinner ? '#fff' : accent }}
        >
          {name}
        </span>
        {isWinner && (
          <span className="text-[10px] font-bold tracking-widest text-emerald-400 flex-shrink-0">🏆 GANADOR</span>
        )}
      </div>

      {/* Sets */}
      {sets.map((s, i) => (
        <div
          key={i}
          className="grid place-items-center text-2xl font-black tabular-nums rounded-md"
          style={{
            background: s.isCurrent
              ? `${accent}26`
              : s.isWon
                ? 'rgba(255,255,255,.06)'
                : 'rgba(0,0,0,.18)',
            color: s.value == null
              ? 'rgba(255,255,255,.18)'
              : s.isWon
                ? '#fff'
                : s.isLost
                  ? 'rgba(255,255,255,.42)'
                  : 'white',
            boxShadow: s.isCurrent ? `inset 0 0 0 1px ${accent}66` : 'none',
          }}
        >
          {s.value == null ? '–' : s.value}
        </div>
      ))}

      {/* Punto actual / TB */}
      <div
        className="grid place-items-center text-xl font-black tabular-nums rounded-md"
        style={{
          background: tbActive ? '#fbbf24' : accent,
          color: tbActive ? '#1f1200' : 'white',
        }}
      >
        {gamePoint}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string, cls: string }> = {
    in_progress: { label: 'EN JUEGO',    cls: 'bg-red-700/30 border-red-500 text-red-300' },
    suspended:   { label: 'SUSPENDIDO',  cls: 'bg-amber-700/30 border-amber-500 text-amber-300' },
    finished:    { label: 'FINALIZADO',  cls: 'bg-emerald-700/30 border-emerald-500 text-emerald-300' },
    retired:     { label: 'RETIRADO',    cls: 'bg-gray-700/30 border-gray-500 text-gray-300' },
    walkover:    { label: 'WALKOVER',    cls: 'bg-gray-700/30 border-gray-500 text-gray-300' },
    warmup:      { label: 'CALENTANDO',  cls: 'bg-blue-700/30 border-blue-500 text-blue-300' },
    scheduled:   { label: 'PROGRAMADO',  cls: 'bg-gray-700/30 border-gray-600 text-gray-400' },
  }
  const c = cfg[status] ?? { label: status.toUpperCase(), cls: 'bg-gray-800 border-gray-700 text-gray-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-bold tracking-widest ${c.cls}`}>
      {status === 'in_progress' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"/>}
      {c.label}
    </span>
  )
}

function matchElapsedLabel(match: any): string | null {
  if (!match.started_at) return null
  const end = match.finished_at ? new Date(match.finished_at).getTime() : Date.now()
  const start = new Date(match.started_at).getTime()
  const ms = Math.max(0, end - start)
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${m}m`
}

// ─── Widget shell ──────────────────────────────────────────────────────────
function Widget({
  icon, title, action, children, dense = false,
}: { icon?: string, title: string, action?: React.ReactNode, children: React.ReactNode, dense?: boolean }) {
  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
      <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
          {icon && <span aria-hidden>{icon}</span>}
          {title}
        </h3>
        {action}
      </div>
      <div className={dense ? '' : 'p-4'}>{children}</div>
    </div>
  )
}

// ─── STATS TABLE — Set 1 | Set 2 | Set 3 | TOTAL ───────────────────────────
function StatsTableWidget({ match, pointLog }: { match: any, pointLog: any[] }) {
  const finishedSets: number = match.score?.sets?.length ?? 0
  const isLive = match.status === 'in_progress'
  // Cuántos sets mostramos como columna: terminados + el actual si en juego.
  const setsToShow = Math.min(3, finishedSets + (isLive ? 1 : 0))

  // Stats por cada set + total acumulado.
  const perSet = useMemo(() => {
    const arr: Array<{ n: number, stats: ReturnType<typeof statsFromPoints> }> = []
    for (let n = 1; n <= setsToShow; n++) {
      arr.push({ n, stats: statsFromPoints(pointLog, n) })
    }
    return arr
  }, [pointLog, setsToShow])

  const total = useMemo(() => statsFromPoints(pointLog), [pointLog])

  // Definición de filas (label + función para extraer t1/t2 de TeamStats).
  const ROWS: Array<{
    label: string
    fmt: 'plain' | 'percent' | 'fraction'
    get: (s: any) => [number | string, number | string]
  }> = [
    { label: 'Puntos ganados',     fmt: 'plain',    get: (s) => [s.t1.total_points_won, s.t2.total_points_won] },
    { label: 'Aces',               fmt: 'plain',    get: (s) => [s.t1.aces, s.t2.aces] },
    { label: 'Dobles faltas',      fmt: 'plain',    get: (s) => [s.t1.double_faults, s.t2.double_faults] },
    { label: 'Winners',            fmt: 'plain',    get: (s) => [s.t1.winners, s.t2.winners] },
    { label: 'Errores no forz.',   fmt: 'plain',    get: (s) => [s.t1.unforced_errors, s.t2.unforced_errors] },
    { label: '% Saque ganado',     fmt: 'percent',  get: (s) => [s.t1.serve_points_won_pct, s.t2.serve_points_won_pct] },
    { label: '% Resto ganado',     fmt: 'percent',  get: (s) => [s.t1.return_points_won_pct, s.t2.return_points_won_pct] },
    { label: 'Break points',       fmt: 'fraction', get: (s) => [
      `${s.t1.break_points_won}/${s.t1.break_points_played_on_return ?? 0}`,
      `${s.t2.break_points_won}/${s.t2.break_points_played_on_return ?? 0}`,
    ]},
    { label: 'Breaks salvados',    fmt: 'fraction', get: (s) => [
      `${s.t1.break_points_saved}/${s.t1.break_points_faced ?? 0}`,
      `${s.t2.break_points_saved}/${s.t2.break_points_faced ?? 0}`,
    ]},
  ]

  function cellNumeric(raw: number | string): number {
    if (typeof raw === 'number') return raw
    return parseFloat(String(raw).split('/')[0]) || 0
  }
  function formatCell(raw: number | string, fmt: 'plain'|'percent'|'fraction'): string {
    if (fmt === 'percent') return `${Math.round(Number(raw) || 0)}%`
    return String(raw)
  }

  return (
    <Widget icon="📊" title="Estadísticas — sets en columnas" dense>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-gray-500 border-b border-gray-800">
              <th className="text-left px-4 py-2 font-medium">Stat</th>
              {perSet.map(s => (
                <th key={`h-s${s.n}`} className="text-center px-3 py-2 font-bold text-gray-400">
                  Set {s.n}
                </th>
              ))}
              <th className="text-center px-3 py-2 font-bold text-white bg-gray-800/50">
                Total
              </th>
            </tr>
            <tr className="text-[10px] tabular-nums text-gray-600 border-b border-gray-800/60">
              <th></th>
              {perSet.map(s => (
                <th key={`hh-s${s.n}`} className="text-center px-3 pb-1.5">
                  <span style={{ color: '#00e0c6' }}>t1</span> · <span style={{ color: '#ff7b61' }}>t2</span>
                </th>
              ))}
              <th className="text-center px-3 pb-1.5 bg-gray-800/50">
                <span style={{ color: '#00e0c6' }}>t1</span> · <span style={{ color: '#ff7b61' }}>t2</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r, ri) => {
              const [tA, tB] = r.get(total)
              return (
                <tr key={r.label} className={`border-b border-gray-800/40 ${ri % 2 === 0 ? 'bg-gray-900' : 'bg-gray-900/40'}`}>
                  <td className="px-4 py-2 text-gray-300 text-xs font-medium whitespace-nowrap">{r.label}</td>
                  {perSet.map(s => {
                    const [v1, v2] = r.get(s.stats)
                    const n1 = cellNumeric(v1); const n2 = cellNumeric(v2)
                    return (
                      <td key={`r${ri}-s${s.n}`} className="px-3 py-2 text-center tabular-nums">
                        <span className={`font-black ${n1 > n2 ? 'text-cyan-300' : 'text-white/80'}`}>{formatCell(v1, r.fmt)}</span>
                        <span className="text-gray-700 mx-1">·</span>
                        <span className={`font-black`} style={{ color: n2 > n1 ? '#ff7b61' : 'rgba(255,255,255,.8)' }}>{formatCell(v2, r.fmt)}</span>
                      </td>
                    )
                  })}
                  <td className="px-3 py-2 text-center tabular-nums bg-gray-800/40">
                    <span className={`font-black text-base ${cellNumeric(tA) > cellNumeric(tB) ? 'text-cyan-300' : 'text-white'}`}>{formatCell(tA, r.fmt)}</span>
                    <span className="text-gray-700 mx-1">·</span>
                    <span className={`font-black text-base`} style={{ color: cellNumeric(tB) > cellNumeric(tA) ? '#ff7b61' : 'white' }}>{formatCell(tB, r.fmt)}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {perSet.length === 0 && (
          <div className="text-center text-gray-600 text-xs py-8">
            Aún no se ha jugado ningún punto.
          </div>
        )}
      </div>
    </Widget>
  )
}

// ─── POINT LOG WIDGET ──────────────────────────────────────────────────────
function PointLogWidget({ pointLog, match }: { pointLog: any[], match: any }) {
  return (
    <Widget
      icon="⏱"
      title="Log puntos en vivo"
      action={<span className="text-[10px] text-gray-600 tabular-nums">{pointLog.length}</span>}
      dense
    >
      <div className="max-h-[480px] overflow-y-auto">
        <CommentatorPointLog pointLog={pointLog} match={match}/>
      </div>
    </Widget>
  )
}

// ─── TOURNAMENT INFO WIDGET ────────────────────────────────────────────────
function TournamentInfoWidget({ tournament, match }: { tournament: Tournament, match: any }) {
  const cat = (CATEGORY_LABELS as any)[match.category] ?? match.category
  const rows: Array<[string, React.ReactNode]> = [
    ['Torneo',     <span className="text-white font-semibold truncate" key="t">{tournament.name}</span>],
    ['Sede',       <span className="text-gray-200" key="s">{[tournament.venue_name, tournament.venue_city].filter(Boolean).join(' · ') || '—'}</span>],
    ['Fechas',     <span className="text-gray-200" key="d">{fmtDateRange(tournament.start_date, tournament.end_date)}</span>],
    ['Categoría',  <span className="text-gray-200" key="c">{cat}</span>],
    ['Ronda',      <span className="text-white font-bold" key="r">{match.round ?? '—'}</span>],
  ]
  return (
    <Widget icon="🏟" title="Torneo">
      <InfoTable rows={rows}/>
    </Widget>
  )
}

// ─── MATCH INFO WIDGET ─────────────────────────────────────────────────────
function MatchInfoWidget({ match, currentUser }: { match: any, currentUser: AppUser }) {
  const judgeName = match.judge_name || match.judge?.full_name || '—'
  const scoringSystem = match.scoring_system ?? '—'
  const rows: Array<[string, React.ReactNode]> = [
    ['Pista',          <span className="text-white font-semibold" key="c">{match.court?.name ?? '—'}</span>],
    ['Modalidad',      <span className="text-gray-200" key="t">{match.match_type === 'doubles' ? 'Dobles' : 'Individual'}</span>],
    ['Programado',     <span className="text-gray-200" key="s">{fmtDateTime(match.scheduled_at)}</span>],
    ['Inicio',         <span className="text-gray-200" key="st">{fmtTime(match.started_at)}</span>],
    ['Juez de silla',  <span className="text-gray-200" key="j">{judgeName}</span>],
    ['Sistema',        <span className="text-gray-400 text-[11px]" key="ss">{prettyScoring(scoringSystem)}</span>],
    ['Comentarista',   <span className="text-gray-200 text-xs" key="u">{currentUser.full_name}</span>],
  ]
  return (
    <Widget icon="🎾" title="Partido">
      <InfoTable rows={rows}/>
    </Widget>
  )
}

// ─── NEXT MATCH WIDGET ─────────────────────────────────────────────────────
// El comentarista necesita saber qué partido viene después en el cuadro
// (el que ganará el actual). Mostramos el siguiente slot por round/match_number.
function NextMatchWidget({ bracketMatches, currentMatch }: { bracketMatches: any[], currentMatch: any }) {
  // El siguiente partido es el que está en la ronda inmediatamente superior
  // en la misma rama del bracket. Heurística simple:
  //   - Si actual = R16 #k → siguiente = QF #ceil(k/2)
  //   - Si actual = QF #k  → siguiente = SF #ceil(k/2)
  //   - Si actual = SF #k  → siguiente = F  #1
  const nextRound = nextRoundOf(currentMatch.round)
  const nextNum = currentMatch.match_number != null ? Math.ceil(currentMatch.match_number / 2) : null
  const nextMatch = nextRound && nextNum != null
    ? bracketMatches.find((m: any) => m.round === nextRound && m.match_number === nextNum)
    : null

  return (
    <Widget icon="➡️" title="Siguiente">
      {!nextMatch ? (
        <div className="text-gray-600 text-xs py-2">
          {currentMatch.round === 'F' ? 'Es la final del cuadro.' : 'Sin partido en la siguiente ronda.'}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-widest text-gray-500">
            {roundLongLabel(nextMatch.round)}
            {nextMatch.match_number != null && <span> · #{nextMatch.match_number}</span>}
          </div>
          <NextMatchRow team={nextMatch.entry1} placeholder="Ganador A"/>
          <div className="text-center text-[10px] uppercase tracking-widest text-gray-700">vs</div>
          <NextMatchRow team={nextMatch.entry2} placeholder="Ganador B"/>
          {nextMatch.scheduled_at && (
            <p className="text-[11px] text-gray-500 pt-1 border-t border-gray-800/60">
              ⏰ {fmtDateTime(nextMatch.scheduled_at)}
            </p>
          )}
        </div>
      )}
    </Widget>
  )
}
function NextMatchRow({ team, placeholder }: { team: any, placeholder: string }) {
  if (!team || !team.player1) {
    return <div className="text-gray-600 text-xs italic">{placeholder}</div>
  }
  const t = [team.player1, team.player2].filter(Boolean).map((p: any) => p.last_name).join(' / ')
  return <div className="text-white font-bold uppercase text-sm truncate">{t}</div>
}

// ─── PLAYERS WIDGET (4 bios) ───────────────────────────────────────────────
function PlayersWidget({ match }: { match: any }) {
  const team1 = [match.entry1?.player1, match.entry1?.player2].filter(Boolean)
  const team2 = [match.entry2?.player1, match.entry2?.player2].filter(Boolean)
  return (
    <Widget icon="👤" title="Jugadores" dense>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-gray-800">
        <div className="bg-gray-900 p-3 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-widest" style={{ color: '#00e0c6' }}>Equipo 1</h4>
          {team1.length === 0 && <p className="text-gray-600 text-xs">—</p>}
          {team1.map((p:any) => <CommentatorPlayerBio key={p.id} player={p} accent="cyan"/>)}
        </div>
        <div className="bg-gray-900 p-3 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-widest" style={{ color: '#ff7b61' }}>Equipo 2</h4>
          {team2.length === 0 && <p className="text-gray-600 text-xs">—</p>}
          {team2.map((p:any) => <CommentatorPlayerBio key={p.id} player={p} accent="coral"/>)}
        </div>
      </div>
    </Widget>
  )
}

// ─── COLLAPSIBLE AI ────────────────────────────────────────────────────────
function CollapsibleAI({ match, tournament, previousMatches, pointLog }: {
  match: any, tournament: Tournament, previousMatches: any[], pointLog: any[]
}) {
  const [open, setOpen] = useState(false)
  return (
    <Widget
      icon="🤖"
      title="IA · sugerencias y narrativa"
      action={
        <button
          onClick={() => setOpen(o => !o)}
          className="px-3 py-1 rounded-md text-[11px] font-medium bg-gray-800 hover:bg-gray-700 text-gray-300">
          {open ? '▲ Ocultar' : '▼ Abrir'}
        </button>
      }
    >
      {open
        ? <CommentatorAIPanel match={match} tournament={tournament} previousMatches={previousMatches} pointLog={pointLog}/>
        : <p className="text-gray-600 text-xs">Pulsa "Abrir" para generar sugerencias en tiempo real (no se carga hasta que lo pides).</p>
      }
    </Widget>
  )
}

// ─── InfoTable helper (labels izda + valor dcha) ───────────────────────────
function InfoTable({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="space-y-1.5">
      {rows.map(([label, value], i) => (
        <div key={i} className="grid grid-cols-[100px_1fr] gap-3 items-baseline">
          <dt className="text-[10px] text-gray-500 uppercase tracking-widest">{label}</dt>
          <dd className="text-sm truncate min-w-0">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

// ─── Utilidades de formato ─────────────────────────────────────────────────
function fmtDateRange(start?: string | null, end?: string | null): string {
  if (!start) return '—'
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const s = new Date(start).toLocaleDateString('es-ES', opts)
  if (!end || end === start) return s
  const e = new Date(end).toLocaleDateString('es-ES', { ...opts, year: 'numeric' })
  return `${s} – ${e}`
}
function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
function fmtTime(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}
function prettyScoring(s: string): string {
  if (s === 'best_of_2_sets_super_tb') return '2 sets ganados + super TB'
  if (s === 'best_of_3_sets') return '3 sets ganados'
  return s
}
function nextRoundOf(r?: string | null): string | null {
  if (!r) return null
  const M: Record<string, string> = { R64: 'R32', R32: 'R16', R16: 'QF', QF: 'SF', SF: 'F' }
  return M[r] ?? null
}
function roundLongLabel(r?: string | null): string {
  if (!r) return '—'
  const M: Record<string, string> = {
    R64: 'Dieciseisavos', R32: 'Octavos', R16: 'Octavos',
    QF: 'Cuartos de final', SF: 'Semifinal', F: 'Final',
  }
  return M[r] ?? r
}
