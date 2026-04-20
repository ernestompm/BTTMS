import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import type { Match, Tournament } from '@/types'

export default async function DashboardPage() {
  const auth = await createServerSupabase()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) redirect('/login')

  const supabase = createServiceSupabase()
  const { data: appUser } = await supabase.from('app_users').select('role').eq('id', user.id).single()

  // Judges have their own dedicated UI
  if (appUser?.role === 'judge') redirect('/judge')

  const [{ data: tournaments }, { data: matches }, { data: stats }] = await Promise.all([
    supabase.from('tournaments').select('*').order('created_at', { ascending: false }).limit(5),
    supabase.from('matches').select('*, court:courts(name)').eq('status', 'in_progress').limit(10),
    supabase.rpc('get_tournament_stats', {
      p_tournament_id: '00000000-0000-0000-0000-000000000001'
    }),
  ])

  const activeTournament = (tournaments as Tournament[])?.[0]

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white font-score">Panel de Control</h1>
        <p className="text-gray-400 text-sm mt-1">Beach Tennis Tournament Management System v2.0</p>
      </div>

      {/* Tournament banner */}
      {activeTournament && (
        <div className="bg-gradient-to-r from-brand-red/20 to-brand-pink/20 border border-brand-red/30 rounded-2xl p-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <Badge variant={activeTournament.status === 'active' ? 'success' : 'warning'}>
                {activeTournament.status === 'active' ? '● En curso' : activeTournament.status}
              </Badge>
              <h2 className="text-xl font-bold text-white mt-2">{activeTournament.name}</h2>
              <p className="text-gray-300 text-sm">{activeTournament.venue_name} · {activeTournament.venue_city}</p>
            </div>
            <Link href="/dashboard/tournament" className="bg-brand-red hover:bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
              Configurar torneo →
            </Link>
          </div>
        </div>
      )}

      {/* Stats grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Partidos', value: stats.total_matches, icon: '🎾' },
            { label: 'Terminados', value: stats.finished_matches, icon: '✅' },
            { label: 'En Juego', value: stats.in_progress, icon: '🔴' },
            { label: 'Total Puntos', value: stats.total_points, icon: '📊' },
          ].map((s) => (
            <div key={s.label} className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
              <div className="text-2xl mb-2">{s.icon}</div>
              <div className="text-2xl font-bold text-white font-score">{s.value ?? 0}</div>
              <div className="text-gray-400 text-xs mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Live matches */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Partidos en Juego</h2>
        {!matches || matches.length === 0 ? (
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 text-center text-gray-500">
            No hay partidos en curso ahora mismo
          </div>
        ) : (
          <div className="space-y-3">
            {(matches as any[]).map((m) => (
              <div key={m.id} className="bg-gray-900 rounded-2xl p-4 border border-gray-800 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-white font-medium text-sm">{m.category} · {m.round}</span>
                  </div>
                  <p className="text-gray-400 text-xs">{m.court?.name}</p>
                </div>
                <div className="flex items-center gap-3">
                  {m.score && (
                    <div className="text-right">
                      <p className="text-white font-score font-bold">
                        {m.score.sets_won?.t1}-{m.score.sets_won?.t2}
                      </p>
                    </div>
                  )}
                  <Link href={`/scoreboard/${m.id}`} target="_blank"
                    className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg text-xs transition-colors">
                    Marcador ↗
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Acciones Rápidas</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {([
            { href: '/dashboard/matches', label: 'Gestionar Partidos', icon: '🎾', color: 'from-red-900/30 to-red-800/20', roles: ['super_admin','tournament_director','staff'] },
            { href: '/dashboard/players', label: 'Jugadores', icon: '👤', color: 'from-blue-900/30 to-blue-800/20', roles: ['super_admin','tournament_director','staff'] },
            { href: '/dashboard/draws', label: 'Cuadros', icon: '🏆', color: 'from-purple-900/30 to-purple-800/20', roles: ['super_admin','tournament_director'] },
            { href: '/judge', label: 'Judge App', icon: '⚖️', color: 'from-orange-900/30 to-orange-800/20', roles: ['super_admin','tournament_director','staff'] },
          ] as const).filter((a) => a.roles.includes(appUser?.role as any)).map((a) => (
            <Link key={a.href} href={a.href}
              className={`bg-gradient-to-br ${a.color} border border-gray-800 rounded-2xl p-4 hover:border-gray-600 transition-colors group`}>
              <div className="text-2xl mb-2">{a.icon}</div>
              <p className="text-white text-sm font-medium group-hover:text-white">{a.label}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
