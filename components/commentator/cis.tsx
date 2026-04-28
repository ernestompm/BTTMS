'use client'
// ============================================================================
// CommentatorCIS — Centro de Información del Comentarista
// ============================================================================
// Vista de un solo scroll dividida en paneles, cada uno con datos clave para
// soltar comentarios en directo. Todos los datos en directo (score, stats,
// log de puntos) se actualizan via Supabase realtime.
//
// Layout (desktop):
//   [HEADER: marcador en directo + estado + tiempo]
//   [PANEL JUGADORES (3 columnas: bio T1 | live score | bio T2)]
//   [PANEL STATS comparativa (1v1)]
//   [PANEL AI sugerencias de comentario]
//   [PANEL CUADRO + RESULTADOS RECIENTES]
//   [PANEL LOG DE PUNTOS]
// ============================================================================

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { AppUser, Tournament, Score, Category } from '@/types'
import { CATEGORY_LABELS } from '@/types'
import { CommentatorScoreLive } from './score-live'
import { CommentatorPlayerBio } from './player-bio'
import { CommentatorStatsCompare } from './stats-compare'
import { CommentatorAIPanel } from './ai-panel'
import { CommentatorBracketMini } from './bracket-mini'
import { CommentatorRecentResults } from './recent-results'
import { CommentatorPointLog } from './point-log'

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

  // Realtime: cualquier cambio en el match (score, stats, status, serving)
  // refresca la card en directo
  useEffect(() => {
    const ch = supabase.channel(`cis-match-${initialMatch.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${initialMatch.id}` },
        (p) => setMatch((m: any) => ({ ...m, ...(p.new as any) })))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [initialMatch.id])

  // Realtime: log de puntos (insert + undone change)
  useEffect(() => {
    const ch = supabase.channel(`cis-points-${initialMatch.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'points', filter: `match_id=eq.${initialMatch.id}` },
        async () => {
          const { data } = await supabase.from('points').select('*')
            .eq('match_id', initialMatch.id).eq('is_undone', false)
            .order('sequence', { ascending: false }).limit(50)
          setPointLog((data as any) ?? [])
        })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [initialMatch.id])

  const team1Players = useMemo(() => {
    return [match.entry1?.player1, match.entry1?.player2].filter(Boolean)
  }, [match.entry1])
  const team2Players = useMemo(() => {
    return [match.entry2?.player1, match.entry2?.player2].filter(Boolean)
  }, [match.entry2])

  const score = match.score as Score | null
  const isLive = match.status === 'in_progress'

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-gray-950/95 backdrop-blur border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link href="/commentator" className="text-gray-400 hover:text-white text-sm">← Partidos</Link>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">
              {currentUser.full_name} · 🎙️ Comentarista
            </span>
            <span className="text-xs text-gray-700">|</span>
            <span className="text-xs text-gray-500">
              {tournament?.name}
            </span>
          </div>
          {isLive && (
            <span className="flex items-center gap-2 text-xs font-bold text-red-400 uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"/>
              EN DIRECTO
            </span>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* HEADER: marcador en directo grande */}
        <CommentatorScoreLive match={match}/>

        {/* JUGADORES + LIVE STATS LADO A LADO */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4">
          <div className="space-y-4">
            <h2 className="text-xs font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1 h-3 rounded-full bg-cyan-400"/>
              EQUIPO 1 — {(CATEGORY_LABELS as any)[match.category] ?? match.category}
            </h2>
            {team1Players.map((p: any) => (
              <CommentatorPlayerBio key={p.id} player={p} accent="cyan"/>
            ))}
          </div>
          <div className="space-y-4">
            <h2 className="text-xs font-bold text-coral-400 uppercase tracking-widest flex items-center gap-2" style={{ color: '#ff7b61' }}>
              <span className="w-1 h-3 rounded-full" style={{ background: '#ff7b61' }}/>
              EQUIPO 2
            </h2>
            {team2Players.map((p: any) => (
              <CommentatorPlayerBio key={p.id} player={p} accent="coral"/>
            ))}
          </div>
        </div>

        {/* STATS COMPARATIVA EN DIRECTO */}
        <CommentatorStatsCompare match={match}/>

        {/* AI SUGERENCIAS DE COMENTARIO */}
        <CommentatorAIPanel match={match} tournament={tournament} previousMatches={previousMatches} pointLog={pointLog}/>

        {/* CUADRO + RESULTADOS DEL TORNEO LADO A LADO */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
          <CommentatorBracketMini matches={bracketMatches} highlightMatchId={match.id} category={match.category}/>
          <CommentatorRecentResults previousMatches={previousMatches}/>
        </div>

        {/* LOG DE PUNTOS DETALLE */}
        <CommentatorPointLog pointLog={pointLog} match={match}/>

      </div>
    </div>
  )
}
