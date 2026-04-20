import { createServiceSupabase } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { CATEGORY_LABELS } from '@/types'

const TOURNAMENT_ID = '00000000-0000-0000-0000-000000000001'

export default async function DrawDetailPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params
  const service = createServiceSupabase()

  const { data: draw } = await service.from('draws')
    .select('*')
    .eq('tournament_id', TOURNAMENT_ID)
    .eq('category', category)
    .single()

  if (!draw) notFound()

  const { data: entries } = await service.from('draw_entries')
    .select('*, player1:players!player1_id(first_name,last_name,nationality,ranking_rfet), player2:players!player2_id(first_name,last_name,nationality,ranking_rfet)')
    .eq('draw_id', draw.id)
    .order('seed', { ascending: true, nullsFirst: false })

  const { data: matches } = await service.from('matches')
    .select('*, court:courts(name), entry1:draw_entries!entry1_id(player1:players!player1_id(first_name,last_name), player2:players!player2_id(first_name,last_name)), entry2:draw_entries!entry2_id(player1:players!player1_id(first_name,last_name), player2:players!player2_id(first_name,last_name))')
    .eq('tournament_id', TOURNAMENT_ID)
    .eq('category', category)
    .order('scheduled_at', { ascending: true })

  function entryName(entry: any): string {
    if (!entry) return '—'
    const p1 = entry.player1 ? `${entry.player1.first_name} ${entry.player1.last_name}` : ''
    const p2 = entry.player2 ? ` / ${entry.player2.first_name} ${entry.player2.last_name}` : ''
    return p1 + p2 || '—'
  }

  const categoryLabel = (CATEGORY_LABELS as Record<string, string>)[category] ?? category

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/draws" className="text-gray-400 hover:text-white text-sm">← Cuadros</Link>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-score">{categoryLabel}</h1>
          <p className="text-gray-400 text-sm">{draw.draw_type.replace('_', ' ')} · {draw.size} plazas</p>
        </div>
        <div className="flex gap-2">
          <Badge variant={draw.status === 'finished' ? 'success' : draw.status === 'in_progress' ? 'danger' : 'outline'}>
            {draw.status}
          </Badge>
          <Link href="/dashboard/draws/new"
            className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg text-xs transition-colors">
            Nuevo cuadro
          </Link>
        </div>
      </div>

      {/* Entries */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">Inscripciones ({entries?.length ?? 0}/{draw.size})</h2>
        </div>
        {(!entries || entries.length === 0) ? (
          <p className="text-gray-500 text-sm">No hay inscripciones en este cuadro</p>
        ) : (
          <div className="space-y-2">
            {(entries as any[]).map((e, i) => (
              <div key={e.id} className="flex items-center gap-3 p-3 bg-gray-800 rounded-xl">
                <span className="text-gray-600 text-xs w-6 text-right">{e.seed ?? i + 1}</span>
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">{entryName(e)}</p>
                  <p className="text-gray-500 text-xs">
                    {e.player1?.nationality && `${e.player1.nationality}`}
                    {e.player1?.ranking_rfet && ` · RFET #${e.player1.ranking_rfet}`}
                  </p>
                </div>
                <Badge variant={e.status === 'confirmed' ? 'success' : 'outline'}>{e.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Matches */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">Partidos ({matches?.length ?? 0})</h2>
          <Link href={`/dashboard/matches/new`}
            className="bg-brand-red hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs transition-colors">
            + Partido
          </Link>
        </div>
        {(!matches || matches.length === 0) ? (
          <p className="text-gray-500 text-sm">No hay partidos en esta categoría</p>
        ) : (
          <div className="space-y-2">
            {(matches as any[]).map((m) => (
              <Link key={m.id} href={`/dashboard/matches/${m.id}`}
                className="flex items-center justify-between p-3 bg-gray-800 rounded-xl hover:bg-gray-700 transition-colors">
                <div>
                  <p className="text-gray-400 text-xs mb-0.5">{m.round ?? '—'} {m.court ? `· ${m.court.name}` : ''}</p>
                  <p className="text-white text-sm">{entryName(m.entry1)} <span className="text-gray-500">vs</span> {entryName(m.entry2)}</p>
                </div>
                {m.score && (
                  <span className="font-score font-bold text-brand-red">
                    {m.score.sets_won?.t1 ?? 0}–{m.score.sets_won?.t2 ?? 0}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
