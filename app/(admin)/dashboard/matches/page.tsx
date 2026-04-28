import { createServiceSupabase } from '@/lib/supabase-server'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import type { Match } from '@/types'
import { CATEGORY_LABELS } from '@/types'
import { BulkJudgeAssigner } from '@/components/admin/judge-assigner'

const TOURNAMENT_ID = '00000000-0000-0000-0000-000000000001'

const statusLabel: Record<string, { label: string; variant: any }> = {
  scheduled: { label: 'Programado', variant: 'outline' },
  in_progress: { label: 'En Juego', variant: 'danger' },
  finished: { label: 'Finalizado', variant: 'success' },
  suspended: { label: 'Suspendido', variant: 'warning' },
  walkover: { label: 'W.O.', variant: 'default' },
  bye: { label: 'Bye', variant: 'default' },
}

export default async function MatchesPage({ searchParams }: { searchParams: Promise<{ status?: string; category?: string }> }) {
  const { status, category } = await searchParams
  const supabase = createServiceSupabase()

  let query = supabase.from('matches')
    .select(`*, court:courts(name), entry1:draw_entries!entry1_id(player1:players!player1_id(first_name,last_name), player2:players!player2_id(first_name,last_name)), entry2:draw_entries!entry2_id(player1:players!player1_id(first_name,last_name), player2:players!player2_id(first_name,last_name))`)
    .order('scheduled_at', { ascending: true })

  if (status) query = query.eq('status', status)
  if (category) query = query.eq('category', category)

  const { data: matches } = await query.limit(100)

  function getTeamName(entry: any): string {
    if (!entry) return 'Por determinar'
    const p1 = entry.player1 ? `${entry.player1.first_name} ${entry.player1.last_name}` : ''
    const p2 = entry.player2 ? ` / ${entry.player2.first_name} ${entry.player2.last_name}` : ''
    return p1 + p2 || 'Por determinar'
  }

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-score">Partidos</h1>
          <p className="text-gray-400 text-sm">{matches?.length ?? 0} partidos</p>
        </div>
        <Link href="/dashboard/matches/new" className="bg-brand-red hover:bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
          + Nuevo partido
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(['', 'in_progress', 'scheduled', 'finished', 'suspended', 'walkover', 'bye'] as const).map((s) => (
          <Link key={s} href={`/dashboard/matches${s ? `?status=${s}` : ''}`}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${status === s || (!status && !s) ? 'bg-brand-red text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            {s === '' ? 'Todos' : statusLabel[s]?.label ?? s}
          </Link>
        ))}
      </div>

      {/* Bulk assignment de juez */}
      <BulkJudgeAssigner tournamentId={TOURNAMENT_ID}/>

      {/* Matches list */}
      <div className="space-y-3">
        {(matches as any[] || []).map((m) => {
          const sl = statusLabel[m.status] ?? { label: m.status, variant: 'default' }
          return (
            <div key={m.id} className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-4 transition-colors">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Badge variant={sl.variant}>{sl.label}</Badge>
                    <Badge variant="outline">{(CATEGORY_LABELS as Record<string, string>)[m.category] ?? m.category}</Badge>
                    {m.round && <Badge variant="default">{m.round}</Badge>}
                    {m.court && <span className="text-gray-500 text-xs">{m.court.name}</span>}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {m.serving_team === 1 && m.status === 'in_progress' && (
                        <span className="w-2 h-2 rounded-full bg-brand-orange serving-pulse flex-shrink-0" />
                      )}
                      <p className="text-white font-medium text-sm">{getTeamName(m.entry1)}</p>
                      {m.score && <span className="text-brand-red font-score font-bold">{m.score.sets_won?.t1 ?? 0}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {m.serving_team === 2 && m.status === 'in_progress' && (
                        <span className="w-2 h-2 rounded-full bg-brand-orange serving-pulse flex-shrink-0" />
                      )}
                      <p className="text-white font-medium text-sm">{getTeamName(m.entry2)}</p>
                      {m.score && <span className="text-brand-red font-score font-bold">{m.score.sets_won?.t2 ?? 0}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {m.scheduled_at && (
                    <span className="text-gray-500 text-xs">
                      {new Date(m.scheduled_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  <Link href={`/dashboard/matches/${m.id}`}
                    className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg text-xs transition-colors">
                    Detalle
                  </Link>
                  <Link href={`/judge/${m.id}`}
                    className="bg-brand-red hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs transition-colors">
                    ⚖️ Arbitrar
                  </Link>
                  {m.status === 'in_progress' && (
                    <Link href={`/scoreboard/${m.id}`} target="_blank"
                      className="bg-brand-red/20 hover:bg-brand-red/30 text-brand-red px-3 py-1.5 rounded-lg text-xs transition-colors">
                      Live ↗
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        {(!matches || matches.length === 0) && (
          <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 text-center text-gray-500">
            No hay partidos que mostrar
          </div>
        )}
      </div>
    </div>
  )
}
