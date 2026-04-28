// ============================================================================
// /commentator — Listado de partidos para el comentarista
// ============================================================================
// Vista de solo lectura. Muestra los partidos del torneo en juego, calentando
// y proximos. Click en uno → CIS (Centro de Información del Comentarista).
// ============================================================================

import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { CATEGORY_LABELS } from '@/types'

export const dynamic = 'force-dynamic'

export default async function CommentatorIndexPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = createServiceSupabase()
  const { data: appUser } = await service.from('app_users').select('*').eq('id', user.id).single()
  if (!appUser) redirect('/login')

  // Cualquier usuario autenticado puede acceder, pero el comentarista es el
  // target principal. Director / admin tambien pueden previsualizar.
  // (No restrict por rol — read-only y data publica del torneo)

  // Traer todos los partidos relevantes (programados + en juego + recien acabados)
  const { data: matches } = await service.from('matches')
    .select(`*,
      court:courts(name),
      entry1:draw_entries!entry1_id(seed, player1:players!player1_id(first_name,last_name,nationality), player2:players!player2_id(first_name,last_name,nationality)),
      entry2:draw_entries!entry2_id(seed, player1:players!player1_id(first_name,last_name,nationality), player2:players!player2_id(first_name,last_name,nationality))
    `)
    .order('scheduled_at', { nullsFirst: false })
    .limit(80)

  function teamName(entry: any): string {
    if (!entry) return 'Por determinar'
    const p1 = entry.player1 ? `${entry.player1.first_name} ${entry.player1.last_name}` : ''
    const p2 = entry.player2 ? ` / ${entry.player2.first_name} ${entry.player2.last_name}` : ''
    return p1 + p2 || 'Por determinar'
  }

  const live = (matches ?? []).filter((m: any) => ['in_progress','warmup','players_on_court','judge_on_court'].includes(m.status))
  const upcoming = (matches ?? []).filter((m: any) => m.status === 'scheduled')
  const finished = (matches ?? []).filter((m: any) => ['finished','retired','walkover'].includes(m.status))

  return (
    <div className="min-h-screen bg-gray-950 p-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white font-score">🎙️ Comentarista</h1>
            <p className="text-gray-400 text-sm">{appUser.full_name} · {appUser.role}</p>
          </div>
          <form action="/api/auth/signout" method="post">
            <button type="submit" className="text-gray-500 hover:text-white text-sm">Salir →</button>
          </form>
        </div>
        <p className="text-gray-500 text-xs">
          Selecciona un partido para abrir el <strong className="text-gray-300">Centro de Información</strong> con stats, biografías, cuadro y sugerencias de IA para tu comentario.
        </p>

        {/* LIVE matches */}
        {live.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"/>
              EN DIRECTO ({live.length})
            </h2>
            <div className="space-y-2">
              {live.map((m: any) => <MatchCard key={m.id} m={m} teamName={teamName} accent="live"/>)}
            </div>
          </section>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-bold text-cyan-400 uppercase tracking-widest">PRÓXIMOS ({upcoming.length})</h2>
            <div className="space-y-2">
              {upcoming.slice(0, 12).map((m: any) => <MatchCard key={m.id} m={m} teamName={teamName} accent="upcoming"/>)}
            </div>
          </section>
        )}

        {/* Finished */}
        {finished.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">FINALIZADOS RECIENTES ({finished.length})</h2>
            <div className="space-y-2">
              {finished.slice(0, 8).map((m: any) => <MatchCard key={m.id} m={m} teamName={teamName} accent="finished"/>)}
            </div>
          </section>
        )}

        {(matches?.length ?? 0) === 0 && (
          <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 text-center">
            <p className="text-gray-500">No hay partidos disponibles</p>
          </div>
        )}
      </div>
    </div>
  )
}

function MatchCard({ m, teamName, accent }: { m: any, teamName: (e:any) => string, accent: 'live'|'upcoming'|'finished' }) {
  const accentClass = accent === 'live'
    ? 'border-red-700/50 hover:border-red-500'
    : accent === 'upcoming'
    ? 'border-cyan-900/50 hover:border-cyan-700'
    : 'border-gray-800 hover:border-gray-600'

  const score = m.score
  return (
    <Link href={`/commentator/${m.id}`}
      className={`block bg-gray-900 border ${accentClass} rounded-2xl p-4 transition-colors`}>
      <div className="flex items-start justify-between mb-2 gap-3">
        <div className="flex gap-2 flex-wrap">
          <Badge variant={m.status === 'in_progress' ? 'danger' : m.status === 'warmup' ? 'warning' : m.status === 'finished' ? 'success' : 'outline'}>
            {m.status === 'in_progress' ? '● En juego'
              : m.status === 'warmup' ? '⏱ Calentamiento'
              : m.status === 'players_on_court' ? '👥 En pista'
              : m.status === 'finished' ? 'Finalizado'
              : 'Programado'}
          </Badge>
          {m.round && <Badge variant="default">{m.round}</Badge>}
          <Badge variant="outline">{(CATEGORY_LABELS as any)[m.category] ?? m.category}</Badge>
        </div>
        {m.scheduled_at && (
          <span className="text-gray-500 text-xs whitespace-nowrap">
            {new Date(m.scheduled_at).toLocaleString('es-ES', { weekday:'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-white text-sm font-medium truncate">{teamName(m.entry1)}</p>
          {score && <span className="text-brand-red font-score font-bold tabular-nums">{score.sets_won?.t1 ?? 0}</span>}
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-white text-sm font-medium truncate">{teamName(m.entry2)}</p>
          {score && <span className="text-brand-red font-score font-bold tabular-nums">{score.sets_won?.t2 ?? 0}</span>}
        </div>
      </div>
      {m.court && <p className="mt-2 text-xs text-gray-500">📍 {m.court.name}</p>}
    </Link>
  )
}
