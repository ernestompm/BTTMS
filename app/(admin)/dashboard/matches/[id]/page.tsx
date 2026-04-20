import { createServerSupabase } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import type { Match } from '@/types'
import { CATEGORY_LABELS } from '@/types'

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabase()

  const { data: match } = await supabase.from('matches')
    .select(`*, court:courts(name), entry1:draw_entries!entry1_id(*, player1:players!player1_id(*), player2:players!player2_id(*)), entry2:draw_entries!entry2_id(*, player1:players!player1_id(*), player2:players!player2_id(*))`)
    .eq('id', id)
    .single()

  if (!match) notFound()
  const m = match as any

  const { data: pointLog } = await supabase.from('points')
    .select('*').eq('match_id', id).eq('is_undone', false)
    .order('sequence', { ascending: false }).limit(30)

  function playerName(entry: any): string {
    if (!entry) return '—'
    const p1 = entry.player1 ? `${entry.player1.first_name} ${entry.player1.last_name}` : ''
    const p2 = entry.player2 ? ` / ${entry.player2.first_name} ${entry.player2.last_name}` : ''
    return p1 + p2 || '—'
  }

  const score = m.score
  const stats = m.stats

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/matches" className="text-gray-400 hover:text-white text-sm">← Partidos</Link>
      </div>

      {/* Header */}
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex gap-2 mb-3 flex-wrap">
              <Badge variant={m.status === 'in_progress' ? 'danger' : m.status === 'finished' ? 'success' : 'outline'}>
                {m.status}
              </Badge>
              <Badge variant="outline">{(CATEGORY_LABELS as Record<string, string>)[m.category] ?? m.category}</Badge>
              {m.round && <Badge variant="default">{m.round}</Badge>}
            </div>
            <div className="space-y-2">
              {[m.entry1, m.entry2].map((entry: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  {m.serving_team === i + 1 && m.status === 'in_progress' && (
                    <span className="w-2.5 h-2.5 rounded-full bg-brand-orange serving-pulse" />
                  )}
                  <span className="text-white font-medium">{playerName(entry)}</span>
                  {score && <span className="text-brand-red font-score font-bold text-lg">{score.sets_won?.[`t${i+1}`] ?? 0}</span>}
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/scoreboard/${m.id}`} target="_blank"
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-xl text-sm transition-colors">
              Marcador ↗
            </Link>
          </div>
        </div>
      </div>

      {/* Score detail */}
      {score && (
        <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
          <h2 className="text-white font-semibold mb-3">Marcador actual</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500">
                  <th className="text-left py-1 pr-4">Equipo</th>
                  {score.sets?.map((_: any, i: number) => (
                    <th key={i} className="text-center px-3">Set {i+1}</th>
                  ))}
                  <th className="text-center px-3">Set actual</th>
                  <th className="text-center px-3">Juego</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2].map((team) => (
                  <tr key={team} className="border-t border-gray-800">
                    <td className="py-2 pr-4 text-white font-medium">{team === 1 ? playerName(m.entry1).split('/')[0] : playerName(m.entry2).split('/')[0]}</td>
                    {score.sets?.map((s: any, i: number) => (
                      <td key={i} className="text-center px-3 text-white font-score font-bold">{s[`t${team}`]}</td>
                    ))}
                    <td className="text-center px-3 text-white">{score.current_set?.[`t${team}`] ?? 0}</td>
                    <td className="text-center px-3 text-brand-orange font-score">
                      {score.tiebreak_active || score.super_tiebreak_active
                        ? (score.tiebreak_score?.[`t${team}`] ?? 0)
                        : score.deuce ? (score.advantage_team === team ? 'ADV' : '40')
                        : ['0','15','30','40'][score.current_game?.[`t${team}`] ?? 0]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
          <h2 className="text-white font-semibold mb-3">Estadísticas</h2>
          <div className="space-y-2">
            {[
              { label: 'Puntos totales', t1: stats.t1?.total_points_won, t2: stats.t2?.total_points_won, total1: stats.t1?.total_points_played, total2: stats.t2?.total_points_played },
              { label: 'Aces', t1: stats.t1?.aces, t2: stats.t2?.aces },
              { label: 'Faltas de saque', t1: stats.t1?.serve_faults, t2: stats.t2?.serve_faults },
              { label: 'Winners', t1: stats.t1?.winners, t2: stats.t2?.winners },
              { label: 'Errores no forzados', t1: stats.t1?.unforced_errors, t2: stats.t2?.unforced_errors },
              { label: '% puntos al saque', t1: `${stats.t1?.serve_points_won_pct ?? 0}%`, t2: `${stats.t2?.serve_points_won_pct ?? 0}%` },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-3 text-sm">
                <span className="text-white font-score font-semibold w-12 text-right">{row.t1 ?? 0}</span>
                <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                  <div className="bg-brand-red h-full" style={{ width: `${typeof row.t1 === 'number' && typeof row.t2 === 'number' && (row.t1 + row.t2) > 0 ? (row.t1 / (row.t1 + row.t2)) * 100 : 50}%` }} />
                </div>
                <span className="text-white font-score font-semibold w-12">{row.t2 ?? 0}</span>
                <span className="text-gray-500 text-xs w-28 text-center">{row.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Point log */}
      <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
        <h2 className="text-white font-semibold mb-3">Log de puntos (últimos {pointLog?.length ?? 0})</h2>
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {(pointLog ?? []).map((p: any) => (
            <div key={p.id} className="flex items-center gap-3 text-xs text-gray-400">
              <span className="text-gray-600 w-6">#{p.sequence}</span>
              <span className={p.winner_team === 1 ? 'text-brand-red font-medium' : 'text-brand-pink font-medium'}>
                Eq.{p.winner_team}
              </span>
              <span className="capitalize">{p.point_type?.replace('_', ' ')}</span>
              {p.shot_direction && <span className="text-gray-600">{p.shot_direction}</span>}
              <span className="text-gray-700 ml-auto">{new Date(p.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>
          ))}
          {(!pointLog || pointLog.length === 0) && (
            <p className="text-gray-600 text-xs">No hay puntos registrados aún</p>
          )}
        </div>
      </div>
    </div>
  )
}
