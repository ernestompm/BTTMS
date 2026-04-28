'use client'
// Stats panel comparativa — para soltar datos en el comentario

export function CommentatorStatsCompare({ match }: { match: any }) {
  const s = match.stats
  if (!s) {
    return (
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 text-center text-gray-500 text-sm">
        Aún no hay estadísticas registradas. Empezarán a aparecer en cuanto se juegue el primer punto.
      </div>
    )
  }

  const rows: Array<{ label: string, a: number|string, b: number|string, isPercent?: boolean }> = [
    { label: 'Puntos totales ganados', a: s.t1.total_points_won, b: s.t2.total_points_won },
    { label: 'Aces', a: s.t1.aces, b: s.t2.aces },
    { label: 'Dobles faltas', a: s.t1.double_faults, b: s.t2.double_faults },
    { label: 'Winners', a: s.t1.winners ?? 0, b: s.t2.winners ?? 0 },
    { label: 'Errores no forzados', a: s.t1.unforced_errors ?? 0, b: s.t2.unforced_errors ?? 0 },
    { label: '% Puntos al saque ganados', a: `${Math.round(s.t1.serve_points_won_pct||0)}%`, b: `${Math.round(s.t2.serve_points_won_pct||0)}%`, isPercent: true },
    { label: '% Puntos al resto ganados', a: `${Math.round(s.t1.return_points_won_pct||0)}%`, b: `${Math.round(s.t2.return_points_won_pct||0)}%`, isPercent: true },
    { label: 'Breaks ganados / oportunidades', a: `${s.t1.break_points_won}/${s.t1.break_points_played_on_return ?? 0}`, b: `${s.t2.break_points_won}/${s.t2.break_points_played_on_return ?? 0}` },
    { label: 'Breaks salvados / faced', a: `${s.t1.break_points_saved}/${s.t1.break_points_faced ?? 0}`, b: `${s.t2.break_points_saved}/${s.t2.break_points_faced ?? 0}` },
  ]

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-sm font-bold text-white">📊 Estadísticas en directo</h2>
        <span className="text-xs text-gray-500 uppercase tracking-widest">Acumulado del partido</span>
      </div>
      <div className="divide-y divide-gray-800">
        {rows.map((r, i) => {
          const numA = parseFloat(String(r.a).replace('%','').split('/')[0]) || 0
          const numB = parseFloat(String(r.b).replace('%','').split('/')[0]) || 0
          const aWins = numA > numB
          const bWins = numB > numA
          return (
            <div key={i} className="grid grid-cols-[1fr_2fr_1fr] items-center gap-3 px-5 py-3">
              <span className={`text-xl font-black tabular-nums text-right ${aWins ? 'text-cyan-400' : 'text-white'}`}>{r.a}</span>
              <span className="text-[11px] uppercase tracking-widest text-gray-400 text-center">{r.label}</span>
              <span className={`text-xl font-black tabular-nums text-left`} style={{ color: bWins ? '#ff7b61' : 'white' }}>{r.b}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
