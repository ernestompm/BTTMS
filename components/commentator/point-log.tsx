'use client'
// Log punto a punto reciente con tipo de punto (ace, winner, etc.)

const POINT_TYPE_LABELS: Record<string, string> = {
  ace: 'ACE',
  double_fault: 'Doble falta',
  service_winner: 'Servicio ganador',
  winner: 'Winner',
  unforced_error: 'Error no forzado',
  forced_error: 'Error forzado',
  break_point_won: 'Break point ganado',
  break_point_saved: 'Break point salvado',
  game_won: 'Game',
  set_won: 'Set',
  match_won: 'Partido',
  rally: 'Punto',
}

const POINT_TYPE_COLOR: Record<string, string> = {
  ace: 'text-emerald-400',
  double_fault: 'text-red-400',
  service_winner: 'text-emerald-300',
  winner: 'text-cyan-400',
  unforced_error: 'text-orange-400',
  forced_error: 'text-yellow-400',
  break_point_won: 'text-purple-400',
  set_won: 'text-purple-300',
  match_won: 'text-amber-300',
  rally: 'text-gray-400',
}

export function CommentatorPointLog({ pointLog, match }: { pointLog: any[], match: any }) {
  if (!pointLog.length) {
    return (
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 text-center text-gray-500 text-sm">
        Aún no se han jugado puntos
      </div>
    )
  }

  function teamName(t: 1|2): string {
    const e = t === 1 ? match.entry1 : match.entry2
    if (!e) return `Equipo ${t}`
    if (match.match_type === 'doubles') {
      return [e.player1, e.player2].filter(Boolean).map((p:any) => p.last_name).join(' / ')
    }
    return e.player1?.last_name ?? `Equipo ${t}`
  }

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-sm font-bold text-white">⏱ Últimos puntos</h2>
        <span className="text-xs text-gray-500">{pointLog.length} registrados (más recientes arriba)</span>
      </div>
      <div className="divide-y divide-gray-800 max-h-72 overflow-y-auto font-mono text-xs">
        {pointLog.slice(0, 30).map((p: any) => {
          const winnerLabel = teamName(p.winner_team as 1|2)
          const typeLabel = POINT_TYPE_LABELS[p.point_type] ?? p.point_type
          const typeColor = POINT_TYPE_COLOR[p.point_type] ?? 'text-gray-400'
          return (
            <div key={p.id} className="grid grid-cols-[40px_70px_1fr_120px] gap-3 px-4 py-2 items-center">
              <span className="text-gray-600 tabular-nums">#{p.sequence}</span>
              <span className={`uppercase tracking-widest font-bold text-[10px] ${typeColor}`}>
                {typeLabel}
              </span>
              <span className="text-gray-300 truncate">
                Punto para <strong className={`${p.winner_team === 1 ? 'text-cyan-400' : ''}`} style={p.winner_team === 2 ? { color: '#ff7b61' } : undefined}>{winnerLabel}</strong>
                {p.shot_direction && <span className="text-gray-500 ml-2">· {p.shot_direction}</span>}
              </span>
              <span className="text-gray-600 text-right text-[10px]">
                {p.created_at && new Date(p.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
