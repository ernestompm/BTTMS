'use client'
// Score header — marcador en directo del partido a comentar
import { useEffect, useState } from 'react'
import type { Score } from '@/types'

const PTS = ['0','15','30','40']

function gamePoint(score: Score | null, team: 1|2): string {
  if (!score) return '0'
  const k = team === 1 ? 't1' : 't2'
  if (score.super_tiebreak_active || score.tiebreak_active) return String(score.tiebreak_score?.[k] ?? 0)
  if (score.deuce) return '40'
  return PTS[score.current_game?.[k] ?? 0] ?? '0'
}

function fmtClock(secs: number) {
  const s = Math.max(0, secs|0)
  const hh = Math.floor(s/3600), mm = Math.floor((s%3600)/60), ss = s%60
  return hh ? `${hh}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}` : `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`
}

export function CommentatorScoreLive({ match }: { match: any }) {
  const score = match.score as Score | null
  const isDoubles = match.match_type === 'doubles'
  const isLive = match.status === 'in_progress'
  const serving = match.serving_team as 1|2|null
  const tbActive = !!(score?.tiebreak_active || score?.super_tiebreak_active)

  // Live clock
  const [, tick] = useState(0)
  useEffect(() => { const id = setInterval(() => tick(x => x+1), 1000); return () => clearInterval(id) }, [])
  const elapsed = match.started_at
    ? Math.floor((Date.now() - new Date(match.started_at).getTime()) / 1000)
    : 0

  function teamName(t: 1|2): string {
    const e = t === 1 ? match.entry1 : match.entry2
    if (!e) return '—'
    if (isDoubles) {
      return [e.player1, e.player2].filter(Boolean).map((p:any) => p.last_name).join(' / ')
    }
    return e.player1?.last_name ?? '—'
  }

  const sets = score?.sets ?? []
  const setCount = Math.max(1, Math.min(3, sets.length + (isLive ? 1 : 0)))
  const currentSetIdx = isLive ? sets.length : -1
  const currentSet = score?.current_set ?? { t1: 0, t2: 0 }

  function setVal(t: 1|2, i: number): number | null {
    if (i < sets.length) return sets[i][t === 1 ? 't1' : 't2']
    if (i === sets.length && isLive) {
      if (tbActive) return score?.tiebreak_score?.[t === 1 ? 't1' : 't2'] ?? 0
      return currentSet[t === 1 ? 't1' : 't2'] ?? 0
    }
    return null
  }

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {match.round && <span className="px-2 py-1 rounded-md bg-brand-red/20 text-brand-red text-xs font-bold tracking-widest">{match.round}</span>}
          <span className="text-xs text-gray-400 uppercase tracking-widest">
            {match.match_type === 'doubles' ? 'Dobles' : 'Individual'}
          </span>
          {match.court && <span className="text-xs text-gray-500">📍 {match.court.name}</span>}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {isLive && match.started_at && (
            <span className="font-mono tabular-nums">{fmtClock(elapsed)}</span>
          )}
          {tbActive && <span className="px-2 py-0.5 bg-amber-500 text-amber-950 rounded-md font-bold text-[10px] tracking-widest">{score?.super_tiebreak_active ? 'SUPER TB' : 'TIE-BREAK'}</span>}
        </div>
      </div>

      {/* Score grid */}
      <div className="grid items-center" style={{ gridTemplateColumns: `1fr ${Array(setCount).fill('72px').join(' ')} 80px` }}>
        {[1, 2].map(tn => {
          const team = tn as 1|2
          const accent = team === 1 ? '#00e0c6' : '#ff7b61'
          const isServing = serving === team
          return (
            <div key={team} className="contents">
              {/* Name */}
              <div className={`flex items-center gap-3 px-5 py-3 ${tn === 2 ? 'border-t border-gray-800' : ''}`} style={{ background: isServing ? `${accent}10` : 'transparent' }}>
                <span className="w-1 h-8 rounded-full" style={{ background: accent }}/>
                <span className="text-white text-2xl font-bold uppercase tracking-tight truncate">{teamName(team)}</span>
                {isServing && (
                  <span className="ml-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full" style={{ background: 'rgba(253,224,71,.20)', border: '1px solid rgba(253,224,71,.55)' }}>
                    <span className="w-2 h-2 rounded-full bg-yellow-300 animate-pulse"/>
                    <span className="text-[10px] font-bold text-yellow-300 tracking-widest">SAQUE</span>
                  </span>
                )}
              </div>
              {/* Set cells */}
              {Array.from({ length: setCount }).map((_, i) => {
                const v = setVal(team, i)
                const isCurrent = i === currentSetIdx
                return (
                  <div key={i}
                    className={`flex items-center justify-center text-3xl font-black tabular-nums ${tn === 2 ? 'border-t border-gray-800' : ''}`}
                    style={{
                      background: isCurrent ? `${accent}14` : 'rgba(0,0,0,.18)',
                      color: v == null ? 'rgba(255,255,255,.30)' : 'white',
                      borderLeft: '1px solid rgba(255,255,255,.06)',
                    }}>
                    {v == null ? '–' : v}
                  </div>
                )
              })}
              {/* Game/Point */}
              <div className={`flex items-center justify-center text-2xl font-black tabular-nums ${tn === 2 ? 'border-t border-gray-800' : ''}`}
                style={{
                  background: tbActive ? '#fbbf24' : accent,
                  color: tbActive ? '#1f1200' : 'white',
                  borderLeft: '1px solid rgba(255,255,255,.06)',
                }}>
                {gamePoint(score, team)}
              </div>
            </div>
          )
        })}
      </div>

      {match.status !== 'in_progress' && (
        <div className="p-3 text-center text-xs text-gray-500 uppercase tracking-widest border-t border-gray-800">
          {match.status === 'finished' ? '✓ Partido finalizado' : match.status === 'scheduled' ? 'Programado' : match.status}
        </div>
      )}
    </div>
  )
}
