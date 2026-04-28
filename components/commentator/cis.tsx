'use client'
// ============================================================================
// CommentatorCIS — Dashboard tabbed para el comentarista
// ============================================================================
// TODO en una pantalla:
//  - Top bar fija con score compacto + estado
//  - Barra de tabs sticky
//  - Contenido del tab activo (con scroll interno solo si hace falta)
//
// Tabs:
//  📊 Stats  — con subfiltro Total / Set 1 / Set 2 / Set 3
//  👤 Jugadores  — 4 bios en grid 2×2
//  🏆 Cuadro
//  📋 Resultados torneo
//  ⏱ Log de puntos
//  🤖 IA · sugerencias
// ============================================================================

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { AppUser, Tournament, Score } from '@/types'
import { CATEGORY_LABELS } from '@/types'
import { CommentatorPlayerBio } from './player-bio'
import { CommentatorStatsCompare } from './stats-compare'
import { CommentatorAIPanel } from './ai-panel'
import { CommentatorBracketMini } from './bracket-mini'
import { CommentatorRecentResults } from './recent-results'
import { CommentatorPointLog } from './point-log'
import { statsFromPoints } from './stats-from-points'

type TabId = 'stats' | 'players' | 'bracket' | 'results' | 'log' | 'ai'

const TABS: Array<{ id: TabId, label: string, icon: string }> = [
  { id: 'stats',   label: 'Stats',      icon: '📊' },
  { id: 'players', label: 'Jugadores',  icon: '👤' },
  { id: 'bracket', label: 'Cuadro',     icon: '🏆' },
  { id: 'results', label: 'Resultados', icon: '📋' },
  { id: 'log',     label: 'Log puntos', icon: '⏱' },
  { id: 'ai',      label: 'IA',         icon: '🤖' },
]

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
  const [tab, setTab] = useState<TabId>('stats')

  // Realtime
  useEffect(() => {
    const ch = supabase.channel(`cis-match-${initialMatch.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${initialMatch.id}` },
        (p) => setMatch((m: any) => ({ ...m, ...(p.new as any) })))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [initialMatch.id])

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
    <div className="h-screen flex flex-col bg-gray-950 text-white">
      <TopBar currentUser={currentUser} tournament={tournament} match={match}/>
      <CompactScoreHeader match={match}/>
      <TabsBar active={tab} onChange={setTab} pendingCount={pointLog.length}/>

      {/* Tab content — fills remaining height with internal scroll */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 py-4">
          {tab === 'stats' && <StatsTabPanel match={match} pointLog={pointLog}/>}
          {tab === 'players' && <PlayersTabPanel match={match}/>}
          {tab === 'bracket' && <CommentatorBracketMini matches={bracketMatches} highlightMatchId={match.id} category={match.category}/>}
          {tab === 'results' && <CommentatorRecentResults previousMatches={previousMatches}/>}
          {tab === 'log' && <CommentatorPointLog pointLog={pointLog} match={match}/>}
          {tab === 'ai' && <CommentatorAIPanel match={match} tournament={tournament} previousMatches={previousMatches} pointLog={pointLog}/>}
        </div>
      </main>
    </div>
  )
}

// ─── TOP BAR ────────────────────────────────────────────────────────────────
function TopBar({ currentUser, tournament, match }: { currentUser: AppUser, tournament: Tournament, match: any }) {
  const isLive = match.status === 'in_progress'
  return (
    <div className="bg-gray-950/95 backdrop-blur border-b border-gray-800 flex-none">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3 text-sm">
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

// ─── COMPACT SCORE HEADER ───────────────────────────────────────────────────
function CompactScoreHeader({ match }: { match: any }) {
  const score = match.score as Score | null
  const isDoubles = match.match_type === 'doubles'
  const serving = match.serving_team as 1|2|null
  const tbActive = !!(score?.tiebreak_active || score?.super_tiebreak_active)
  const isLive = match.status === 'in_progress'
  const finishedSets = score?.sets ?? []
  const setCount = Math.max(1, Math.min(3, finishedSets.length + (isLive ? 1 : 0)))

  function teamName(t: 1|2): string {
    const e = t === 1 ? match.entry1 : match.entry2
    if (!e) return '—'
    if (isDoubles) return [e.player1, e.player2].filter(Boolean).map((p:any) => p.last_name).join(' / ')
    return e.player1?.last_name ?? '—'
  }
  function setVal(t: 1|2, i: number): number | null {
    if (i < finishedSets.length) return finishedSets[i][t === 1 ? 't1' : 't2']
    if (i === finishedSets.length && isLive) {
      if (tbActive) return score?.tiebreak_score?.[t === 1 ? 't1' : 't2'] ?? 0
      return score?.current_set?.[t === 1 ? 't1' : 't2'] ?? 0
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

  return (
    <div className="bg-gradient-to-b from-gray-900 to-gray-950 border-b border-gray-800 flex-none">
      <div className="max-w-7xl mx-auto px-4 py-3 grid items-center gap-2"
        style={{ gridTemplateColumns: `1fr ${Array(setCount).fill('60px').join(' ')} 70px 1fr ${Array(setCount).fill('60px').join(' ')} 70px` }}>
        {/* Team 1 */}
        <div className="text-right">
          <span className="text-xs text-gray-500 uppercase tracking-widest">Equipo 1</span>
          <div className="flex items-center justify-end gap-2">
            {serving === 1 && <ServingIndicator/>}
            <span className="text-2xl font-bold uppercase tracking-tight" style={{ color: '#00e0c6' }}>{teamName(1)}</span>
          </div>
        </div>
        {/* Sets T1 */}
        {Array.from({ length: setCount }).map((_, i) => (
          <SetCell key={`s1-${i}`} value={setVal(1, i)} isCurrent={i === finishedSets.length && isLive} accent="#00e0c6"/>
        ))}
        <PointCell value={gamePoint(1)} tb={tbActive} accent="#00e0c6"/>

        {/* Team 2 */}
        <div className="text-left">
          <span className="text-xs text-gray-500 uppercase tracking-widest">Equipo 2</span>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold uppercase tracking-tight" style={{ color: '#ff7b61' }}>{teamName(2)}</span>
            {serving === 2 && <ServingIndicator/>}
          </div>
        </div>
        {Array.from({ length: setCount }).map((_, i) => (
          <SetCell key={`s2-${i}`} value={setVal(2, i)} isCurrent={i === finishedSets.length && isLive} accent="#ff7b61"/>
        ))}
        <PointCell value={gamePoint(2)} tb={tbActive} accent="#ff7b61"/>
      </div>
    </div>
  )
}
function ServingIndicator() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(253,224,71,.20)', border: '1px solid rgba(253,224,71,.55)' }}>
      <span className="w-1.5 h-1.5 rounded-full bg-yellow-300 animate-pulse"/>
      <span className="text-[9px] font-bold text-yellow-300 tracking-widest">SAQUE</span>
    </span>
  )
}
function SetCell({ value, isCurrent, accent }: { value: number|null, isCurrent: boolean, accent: string }) {
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
      style={{
        background: tb ? '#fbbf24' : accent,
        color: tb ? '#1f1200' : 'white',
      }}>
      {value}
    </div>
  )
}

// ─── TABS BAR ───────────────────────────────────────────────────────────────
function TabsBar({ active, onChange, pendingCount }: { active: TabId, onChange: (t: TabId) => void, pendingCount: number }) {
  return (
    <div className="bg-gray-900 border-b border-gray-800 flex-none">
      <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors text-sm font-medium whitespace-nowrap ${active === t.id
              ? 'border-purple-500 text-white'
              : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            <span>{t.icon}</span>
            <span>{t.label}</span>
            {t.id === 'log' && pendingCount > 0 && (
              <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded-full tabular-nums">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── STATS TAB ──────────────────────────────────────────────────────────────
function StatsTabPanel({ match, pointLog }: { match: any, pointLog: any[] }) {
  type Scope = 'total' | 1 | 2 | 3
  const [scope, setScope] = useState<Scope>('total')

  const setsPlayed = (match.score?.sets?.length ?? 0) + (match.status === 'in_progress' ? 1 : 0)
  const availableSets = Math.min(3, setsPlayed)

  // Stats por set se calculan desde pointLog. Total usa match.stats si esta o computa.
  const stats = useMemo(() => {
    if (scope === 'total') return match.stats ?? statsFromPoints(pointLog)
    return statsFromPoints(pointLog, scope)
  }, [scope, match.stats, pointLog])

  const fakeMatch = { ...match, stats }

  return (
    <div className="space-y-3">
      {/* Filtro por set */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500 uppercase tracking-widest mr-2">Mostrar stats de:</span>
        <ScopeBtn active={scope === 'total'} onClick={() => setScope('total')}>Total partido</ScopeBtn>
        {Array.from({ length: availableSets }).map((_, i) => {
          const n = i + 1
          return (
            <ScopeBtn key={n} active={scope === n} onClick={() => setScope(n as Scope)}>
              Set {n}
            </ScopeBtn>
          )
        })}
        {availableSets === 0 && <span className="text-xs text-gray-600">Aún no se ha jugado ningún set</span>}
      </div>
      <CommentatorStatsCompare match={fakeMatch}/>
    </div>
  )
}
function ScopeBtn({ active, onClick, children }: { active: boolean, onClick: () => void, children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${active
        ? 'bg-purple-700 text-white'
        : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'}`}>
      {children}
    </button>
  )
}

// ─── PLAYERS TAB ────────────────────────────────────────────────────────────
function PlayersTabPanel({ match }: { match: any }) {
  const team1 = [match.entry1?.player1, match.entry1?.player2].filter(Boolean)
  const team2 = [match.entry2?.player1, match.entry2?.player2].filter(Boolean)
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: '#00e0c6' }}>
          Equipo 1
        </h3>
        {team1.map((p:any) => <CommentatorPlayerBio key={p.id} player={p} accent="cyan"/>)}
      </div>
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: '#ff7b61' }}>
          Equipo 2
        </h3>
        {team2.map((p:any) => <CommentatorPlayerBio key={p.id} player={p} accent="coral"/>)}
      </div>
    </div>
  )
}
