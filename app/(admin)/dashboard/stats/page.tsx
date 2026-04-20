import { createServiceSupabase } from '@/lib/supabase-server'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { CATEGORY_LABELS } from '@/types'

const TOURNAMENT_ID = '00000000-0000-0000-0000-000000000001'

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ match?: string }> }) {
  const { match: matchId } = await searchParams
  const supabase = createServiceSupabase()

  const { data: matches } = await supabase.from('matches')
    .select('id, category, round, status, entry1:draw_entries!entry1_id(player1:players!player1_id(first_name,last_name), player2:players!player2_id(first_name,last_name)), entry2:draw_entries!entry2_id(player1:players!player1_id(first_name,last_name), player2:players!player2_id(first_name,last_name))')
    .eq('tournament_id', TOURNAMENT_ID)
    .in('status', ['in_progress', 'finished'])
    .order('started_at', { ascending: false })

  let selectedMatch: any = null
  if (matchId) {
    const { data } = await supabase.from('matches').select('*, entry1:draw_entries!entry1_id(*, player1:players!player1_id(*), player2:players!player2_id(*)), entry2:draw_entries!entry2_id(*, player1:players!player1_id(*), player2:players!player2_id(*))').eq('id', matchId).single()
    selectedMatch = data
  }

  function teamName(entry: any): string {
    if (!entry) return '—'
    const p1 = entry.player1 ? `${entry.player1.first_name} ${entry.player1.last_name}` : ''
    const p2 = entry.player2 ? ` / ${entry.player2.first_name} ${entry.player2.last_name}` : ''
    return p1 + p2 || '—'
  }

  const stats = selectedMatch?.stats

  return (
    <div className="space-y-6 fade-in">
      <h1 className="text-2xl font-bold text-white font-score">Stats Center</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Match selector */}
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 space-y-2">
          <p className="text-gray-400 text-sm font-medium mb-3">Seleccionar partido</p>
          {(matches ?? []).map((m: any) => (
            <Link key={m.id} href={`/dashboard/stats?match=${m.id}`}
              className={`block p-3 rounded-xl border transition-colors text-sm ${matchId === m.id ? 'border-brand-red bg-brand-red/10 text-white' : 'border-gray-800 text-gray-400 hover:border-gray-700 hover:text-white'}`}>
              <div className="flex gap-2 mb-1">
                <Badge variant={m.status === 'in_progress' ? 'danger' : 'success'}>{m.status}</Badge>
                <span className="text-xs text-gray-600">{m.round}</span>
              </div>
              <p className="truncate">{teamName(m.entry1)}</p>
              <p className="truncate text-gray-500">vs. {teamName(m.entry2)}</p>
            </Link>
          ))}
          {(!matches || matches.length === 0) && (
            <p className="text-gray-600 text-sm">No hay partidos con estadísticas</p>
          )}
        </div>

        {/* Stats panel */}
        <div className="lg:col-span-2">
          {!selectedMatch ? (
            <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 text-center text-gray-500">
              Selecciona un partido para ver sus estadísticas
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div>
                    <p className="text-white font-semibold">{teamName(selectedMatch.entry1)}</p>
                    <p className="text-gray-500 text-sm">vs. {teamName(selectedMatch.entry2)}</p>
                  </div>
                  <Badge variant={selectedMatch.status === 'in_progress' ? 'danger' : 'success'}>{selectedMatch.status}</Badge>
                </div>

                {stats ? (
                  <div className="space-y-3">
                    {[
                      { label: 'Total puntos ganados', t1: stats.t1?.total_points_won, t2: stats.t2?.total_points_won },
                      { label: 'Aces', t1: stats.t1?.aces, t2: stats.t2?.aces },
                      { label: 'Faltas de saque', t1: stats.t1?.serve_faults, t2: stats.t2?.serve_faults },
                      { label: 'Winners totales', t1: stats.t1?.winners, t2: stats.t2?.winners },
                      { label: '  › Derecha', t1: stats.t1?.winners_forehand, t2: stats.t2?.winners_forehand },
                      { label: '  › Revés', t1: stats.t1?.winners_backhand, t2: stats.t2?.winners_backhand },
                      { label: '  › Volea', t1: stats.t1?.winners_volley, t2: stats.t2?.winners_volley },
                      { label: 'Errores no forzados', t1: stats.t1?.unforced_errors, t2: stats.t2?.unforced_errors },
                      { label: 'Errores forzados causados', t1: stats.t1?.forced_errors_caused, t2: stats.t2?.forced_errors_caused },
                      { label: '% puntos al saque', t1: `${stats.t1?.serve_points_won_pct ?? 0}%`, t2: `${stats.t2?.serve_points_won_pct ?? 0}%` },
                      { label: '% puntos al resto', t1: `${stats.t1?.return_points_won_pct ?? 0}%`, t2: `${stats.t2?.return_points_won_pct ?? 0}%` },
                      { label: 'Puntos de rotura convertidos', t1: `${stats.t1?.break_points_won ?? 0}/${stats.t1?.break_points_played_on_return ?? 0}`, t2: `${stats.t2?.break_points_won ?? 0}/${stats.t2?.break_points_played_on_return ?? 0}` },
                      { label: 'Racha máx. de puntos', t1: stats.t1?.max_points_streak, t2: stats.t2?.max_points_streak },
                    ].map((row) => {
                      const n1 = typeof row.t1 === 'number' ? row.t1 : 0
                      const n2 = typeof row.t2 === 'number' ? row.t2 : 0
                      const total = n1 + n2
                      const pct1 = total > 0 ? (n1 / total) * 100 : 50
                      return (
                        <div key={row.label} className="flex items-center gap-3 text-sm">
                          <span className="text-white font-score font-bold w-16 text-right">{row.t1 ?? 0}</span>
                          <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                            <div className="bg-gradient-to-r from-brand-red to-brand-pink h-full transition-all" style={{ width: `${pct1}%` }} />
                          </div>
                          <span className="text-white font-score font-bold w-16">{row.t2 ?? 0}</span>
                          <span className="text-gray-500 text-xs w-36 text-center hidden md:block">{row.label}</span>
                        </div>
                      )
                    })}
                    <p className="text-gray-600 text-xs pt-2 text-center">Izq: {teamName(selectedMatch.entry1)} · Der: {teamName(selectedMatch.entry2)}</p>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">Este partido no tiene estadísticas aún (árbitro no ha iniciado)</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
