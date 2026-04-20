import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { CATEGORY_LABELS } from '@/types'

export const dynamic = 'force-dynamic'

export default async function JudgeIndexPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = createServiceSupabase()
  const { data: appUser } = await service.from('app_users').select('*').eq('id', user.id).single()
  if (!appUser) redirect('/login')

  let query = service.from('matches')
    .select(`*, court:courts(name), entry1:draw_entries!entry1_id(player1:players!player1_id(first_name,last_name,nationality), player2:players!player2_id(first_name,last_name,nationality)), entry2:draw_entries!entry2_id(player1:players!player1_id(first_name,last_name,nationality), player2:players!player2_id(first_name,last_name,nationality))`)
    .in('status', ['scheduled', 'judge_on_court', 'players_on_court', 'warmup', 'in_progress'])
    .order('scheduled_at', { nullsFirst: false })

  if (appUser.role === 'judge') {
    query = query.eq('judge_id', user.id)
  } else if (appUser.role !== 'super_admin' && appUser.tournament_id) {
    // Directors and staff only see their tournament's matches
    query = query.eq('tournament_id', appUser.tournament_id)
  }

  const { data: matches } = await query.limit(50)

  function teamName(entry: any): string {
    if (!entry) return 'Por determinar'
    const p1 = entry.player1 ? `${entry.player1.first_name} ${entry.player1.last_name}` : ''
    const p2 = entry.player2 ? ` / ${entry.player2.first_name} ${entry.player2.last_name}` : ''
    return p1 + p2 || 'Por determinar'
  }

  return (
    <div className="min-h-screen bg-gray-950 p-4">
      <div className="max-w-lg mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white font-score">Arbitraje</h1>
            <p className="text-gray-400 text-sm">{appUser.full_name} · {appUser.role.replace('_', ' ')}</p>
          </div>
          <Link href="/dashboard" className="text-gray-500 hover:text-white text-sm">Panel →</Link>
        </div>

        <p className="text-gray-500 text-xs">
          {appUser.role === 'judge'
            ? 'Partidos asignados a ti como juez árbitro.'
            : 'Como admin puedes arbitrar cualquier partido. Pulsa uno para empezar.'}
        </p>

        <div className="space-y-3">
          {(matches ?? []).map((m: any) => (
            <Link key={m.id} href={`/judge/${m.id}`}
              className="block bg-gray-900 border border-gray-800 hover:border-brand-red rounded-2xl p-4 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div className="flex gap-2">
                  <Badge variant={m.status === 'in_progress' ? 'danger' : m.status === 'warmup' ? 'warning' : 'outline'}>
                    {m.status === 'in_progress' ? '● En juego'
                      : m.status === 'warmup' ? '⏱ Calentamiento'
                      : m.status === 'players_on_court' ? '👥 Jugadores en pista'
                      : m.status === 'judge_on_court' ? '🧑‍⚖️ Juez en pista'
                      : 'Programado'}
                  </Badge>
                  <Badge variant="default">{m.round ?? '—'}</Badge>
                </div>
                {m.scheduled_at && (
                  <span className="text-gray-500 text-xs">
                    {new Date(m.scheduled_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mb-2">
                {(CATEGORY_LABELS as Record<string, string>)[m.category] ?? m.category}
                {m.court && ` · ${m.court.name}`}
              </p>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-white text-sm font-medium">{teamName(m.entry1)}</p>
                  {m.score && <span className="text-brand-red font-score font-bold">{m.score.sets_won?.t1 ?? 0}</span>}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-white text-sm font-medium">{teamName(m.entry2)}</p>
                  {m.score && <span className="text-brand-red font-score font-bold">{m.score.sets_won?.t2 ?? 0}</span>}
                </div>
              </div>
            </Link>
          ))}
          {(!matches || matches.length === 0) && (
            <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 text-center">
              <p className="text-gray-500">No hay partidos programados o en juego</p>
              <Link href="/dashboard/draws" className="text-brand-red text-sm mt-2 inline-block">Crear cuadro →</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
