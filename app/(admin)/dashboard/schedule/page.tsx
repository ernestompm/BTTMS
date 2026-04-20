import { createServiceSupabase } from '@/lib/supabase-server'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { CATEGORY_LABELS } from '@/types'

const TOURNAMENT_ID = '00000000-0000-0000-0000-000000000001'

const statusLabel: Record<string, { label: string; variant: any }> = {
  scheduled: { label: 'Programado', variant: 'outline' },
  in_progress: { label: 'En Juego', variant: 'danger' },
  finished: { label: 'Finalizado', variant: 'success' },
  suspended: { label: 'Suspendido', variant: 'warning' },
}

export default async function SchedulePage() {
  const service = createServiceSupabase()

  const { data: matches } = await service.from('matches')
    .select(`*, court:courts(name), entry1:draw_entries!entry1_id(player1:players!player1_id(first_name,last_name), player2:players!player2_id(first_name,last_name)), entry2:draw_entries!entry2_id(player1:players!player1_id(first_name,last_name), player2:players!player2_id(first_name,last_name))`)
    .eq('tournament_id', TOURNAMENT_ID)
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .limit(200)

  function teamName(entry: any): string {
    if (!entry) return 'Por determinar'
    const p1 = entry.player1 ? `${entry.player1.first_name} ${entry.player1.last_name}` : ''
    const p2 = entry.player2 ? ` / ${entry.player2.first_name} ${entry.player2.last_name}` : ''
    return p1 + p2 || 'Por determinar'
  }

  // Group by date
  const grouped: Record<string, any[]> = {}
  for (const m of (matches ?? [])) {
    const day = m.scheduled_at
      ? new Date(m.scheduled_at).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
      : 'Sin fecha'
    if (!grouped[day]) grouped[day] = []
    grouped[day].push(m)
  }

  const noScheduled = !matches || matches.length === 0

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-score">Horario</h1>
          <p className="text-gray-400 text-sm">{matches?.length ?? 0} partidos programados</p>
        </div>
        <Link href="/dashboard/matches/new"
          className="bg-brand-red hover:bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
          + Nuevo partido
        </Link>
      </div>

      {noScheduled ? (
        <div className="bg-gray-900 rounded-2xl p-10 border border-gray-800 text-center">
          <p className="text-gray-500 mb-2">No hay partidos programados</p>
          <Link href="/dashboard/matches/new" className="text-brand-red text-sm">Crear el primer partido →</Link>
        </div>
      ) : (
        Object.entries(grouped).map(([day, dayMatches]) => (
          <div key={day}>
            <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-3 capitalize">{day}</h2>
            <div className="space-y-2">
              {dayMatches.map((m: any) => {
                const sl = statusLabel[m.status] ?? { label: m.status, variant: 'default' }
                return (
                  <Link key={m.id} href={`/dashboard/matches/${m.id}`}
                    className="flex items-center gap-4 bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-4 transition-colors">
                    <div className="text-center w-14 flex-shrink-0">
                      {m.scheduled_at ? (
                        <p className="text-white font-score font-bold text-lg">
                          {new Date(m.scheduled_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      ) : (
                        <p className="text-gray-600 text-sm">—</p>
                      )}
                      {m.court && <p className="text-gray-500 text-xs">{m.court.name}</p>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex gap-2 mb-1 flex-wrap">
                        <Badge variant={sl.variant}>{sl.label}</Badge>
                        <Badge variant="outline">{(CATEGORY_LABELS as Record<string, string>)[m.category] ?? m.category}</Badge>
                        {m.round && <Badge variant="default">{m.round}</Badge>}
                      </div>
                      <p className="text-white text-sm truncate">{teamName(m.entry1)} <span className="text-gray-600">vs</span> {teamName(m.entry2)}</p>
                    </div>
                    {m.score && (
                      <div className="text-right font-score font-bold flex-shrink-0">
                        <span className="text-brand-red">{m.score.sets_won?.t1 ?? 0}</span>
                        <span className="text-gray-600"> - </span>
                        <span className="text-brand-pink">{m.score.sets_won?.t2 ?? 0}</span>
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
