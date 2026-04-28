'use client'
// Lista de partidos previos del torneo donde participaron los 4 jugadores

export function CommentatorRecentResults({ previousMatches }: { previousMatches: any[] }) {
  if (!previousMatches.length) {
    return (
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 text-center text-gray-500 text-sm">
        Sin partidos previos en el torneo
      </div>
    )
  }

  function pairLabel(entry: any): string {
    if (!entry) return '—'
    const players = [entry.player1, entry.player2].filter(Boolean)
    return players.map((p: any) => p.last_name).filter(Boolean).join(' / ').toUpperCase() || '—'
  }

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-sm font-bold text-white">📋 Resultados previos del torneo</h2>
        <span className="text-xs text-gray-500">{previousMatches.length}</span>
      </div>
      <div className="divide-y divide-gray-800 max-h-96 overflow-y-auto">
        {previousMatches.map((m: any) => {
          const score = m.score
          const winnerTeam = score?.winner_team
          const t1Won = winnerTeam === 1
          const t2Won = winnerTeam === 2
          return (
            <div key={m.id} className="px-4 py-3 hover:bg-gray-800/50 transition-colors">
              <div className="flex items-center justify-between mb-1.5">
                {m.round && <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{m.round}</span>}
                {m.finished_at && (
                  <span className="text-[10px] text-gray-600">
                    {new Date(m.finished_at).toLocaleDateString('es-ES', { day:'2-digit', month:'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center justify-between gap-3">
                  <span className={`text-sm truncate ${t1Won ? 'text-white font-bold' : 'text-gray-400'}`}>
                    {pairLabel(m.entry1)}
                  </span>
                  {score?.sets && (
                    <span className={`text-sm font-mono tabular-nums ${t1Won ? 'text-cyan-400 font-bold' : 'text-gray-500'}`}>
                      {score.sets.map((s:any) => s.t1).join(' ')}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className={`text-sm truncate ${t2Won ? 'text-white font-bold' : 'text-gray-400'}`}>
                    {pairLabel(m.entry2)}
                  </span>
                  {score?.sets && (
                    <span className={`text-sm font-mono tabular-nums ${t2Won ? 'font-bold' : 'text-gray-500'}`} style={t2Won ? { color: '#ff7b61' } : undefined}>
                      {score.sets.map((s:any) => s.t2).join(' ')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
