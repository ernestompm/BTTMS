'use client'
// Cuadro de la categoría — versión condensada para el comentarista

import type { Score } from '@/types'

const KO_ROUNDS = ['R32','R16','QF','SF','F'] as const
type KoRound = typeof KO_ROUNDS[number]
const ROUND_LBL: Record<KoRound,string> = {
  R32: '1/16', R16: 'OCTAVOS', QF: 'CUARTOS', SF: 'SEMIS', F: 'FINAL',
}

function pairLabel(entry: any, isDoubles: boolean): string {
  if (!entry) return '—'
  const players = [entry.player1, isDoubles ? entry.player2 : null].filter(Boolean)
  return players.map((p:any) => p.last_name).filter(Boolean).join(' / ').toUpperCase() || '—'
}

export function CommentatorBracketMini({ matches, highlightMatchId, category }: {
  matches: any[], highlightMatchId: string, category: string,
}) {
  // Filtrar por categoría
  const cat = matches[0]?.category ?? category
  const isDoubles = matches.find((m: any) => m.match_type === 'doubles') != null

  // Agrupar por ronda
  const byRound: Record<string, any[]> = { R32: [], R16: [], QF: [], SF: [], F: [] }
  matches.forEach((m: any) => { if (byRound[m.round]) byRound[m.round].push(m) })
  KO_ROUNDS.forEach(r => byRound[r].sort((a: any, b: any) => (a.match_number||0) - (b.match_number||0)))

  // Detectar primeras y últimas rondas presentes
  const present = KO_ROUNDS.filter(r => byRound[r].length > 0)
  if (present.length === 0) {
    return (
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 text-center text-gray-500 text-sm">
        No hay partidos de cuadro de eliminación
      </div>
    )
  }

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-sm font-bold text-white">🏆 Cuadro {cat ? `· ${cat}` : ''}</h2>
        <span className="text-xs text-gray-500">{matches.length} partidos</span>
      </div>
      <div className="p-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${present.length}, minmax(0, 1fr))` }}>
        {present.map(round => (
          <div key={round} className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 text-center pb-1 border-b border-gray-800">
              {ROUND_LBL[round]}
            </div>
            {byRound[round].map((m: any) => {
              const isHighlight = m.id === highlightMatchId
              const score = m.score as Score | null
              const winnerTeam = score?.winner_team
              const finished = m.status === 'finished'
              const inProgress = m.status === 'in_progress'
              const t1Win = finished && winnerTeam === 1
              const t2Win = finished && winnerTeam === 2
              return (
                <div key={m.id}
                  className={`p-1.5 rounded-md border text-[10px] leading-tight ${isHighlight
                    ? 'bg-cyan-900/30 border-cyan-700'
                    : inProgress
                      ? 'bg-red-900/20 border-red-900/40'
                      : 'bg-gray-800/40 border-gray-800'}`}>
                  <div className="flex items-center justify-between gap-1">
                    <span className={`truncate ${t1Win ? 'text-cyan-400 font-bold' : 'text-gray-300'}`}>
                      {pairLabel(m.entry1, isDoubles)}
                    </span>
                    {finished && score?.sets && (
                      <span className={`font-mono tabular-nums ${t1Win ? 'text-cyan-400 font-bold' : 'text-gray-500'}`}>
                        {score.sets.map((s:any) => s.t1).join(' ')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <span className={`truncate ${t2Win ? 'text-orange-400 font-bold' : 'text-gray-300'}`} style={t2Win ? { color: '#ff7b61' } : undefined}>
                      {pairLabel(m.entry2, isDoubles)}
                    </span>
                    {finished && score?.sets && (
                      <span className={`font-mono tabular-nums ${t2Win ? 'font-bold' : 'text-gray-500'}`} style={t2Win ? { color: '#ff7b61' } : undefined}>
                        {score.sets.map((s:any) => s.t2).join(' ')}
                      </span>
                    )}
                  </div>
                  {(inProgress || isHighlight) && (
                    <div className="mt-1 text-[8px] uppercase tracking-widest text-center font-bold">
                      {isHighlight && inProgress ? <span className="text-cyan-300">● ACTUAL · EN JUEGO</span>
                        : isHighlight ? <span className="text-cyan-300">● ACTUAL</span>
                        : inProgress ? <span className="text-red-400">● EN JUEGO</span>
                        : null}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
