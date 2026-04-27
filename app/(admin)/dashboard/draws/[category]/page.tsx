import { createServiceSupabase } from '@/lib/supabase-server'
import Link from 'next/link'
import { EmptyDrawCTA } from './empty-cta'
import { BracketTree } from '@/components/admin/bracket-tree'
import { Badge } from '@/components/ui/badge'
import { CATEGORY_LABELS } from '@/types'

const TOURNAMENT_ID = '00000000-0000-0000-0000-000000000001'

const ROUND_ORDER = ['F', 'SF', 'QF', 'R16', 'R32', 'Q1', 'Q2', 'GRP', 'RR', 'CON']
const ROUND_LABELS: Record<string, string> = {
  F: 'Final', SF: 'Semifinales', QF: 'Cuartos de final',
  R16: 'Octavos de final', R32: 'Dieciseisavos de final',
  Q1: 'Clasificación 1', Q2: 'Clasificación 2',
  GRP: 'Fase de Grupos', RR: 'Round Robin', CON: 'Consolación',
}
const STATUS_MAP: Record<string, { label: string; variant: any }> = {
  scheduled: { label: 'Prog.', variant: 'outline' },
  in_progress: { label: 'En juego', variant: 'danger' },
  finished: { label: 'Terminado', variant: 'success' },
  suspended: { label: 'Suspendido', variant: 'warning' },
  walkover: { label: 'W.O.', variant: 'default' },
  bye: { label: 'Bye', variant: 'default' },
}

function entryName(entry: any): string {
  if (!entry) return 'Por determinar'
  const p1 = entry.player1 ? `${entry.player1.first_name} ${entry.player1.last_name}` : ''
  const p2 = entry.player2 ? ` / ${entry.player2.first_name} ${entry.player2.last_name}` : ''
  return p1 + p2 || 'Por determinar'
}

function teamSets(score: any, team: 1 | 2): number[] {
  return (score?.sets ?? []).map((s: any) => s[`t${team}`])
}

export default async function DrawDetailPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params
  const service = createServiceSupabase()

  const { data: draw } = await service.from('draws')
    .select('*')
    .eq('tournament_id', TOURNAMENT_ID)
    .eq('category', category)
    .maybeSingle()

  // En lugar de 404, mostrar una pantalla con CTA reales — el primario hace
  // el seed completo (jugadores + cuadro + 15 partidos) en un click. Asi se
  // rompe el bucle "no hay cuadro -> crear cuadro -> no hay cuadro" que se
  // producia cuando el formulario manual fallaba o el usuario no entendia
  // el flujo.
  if (!draw) {
    const friendlyCat = (CATEGORY_LABELS as Record<string, string>)[category] ?? category
    return (
      <div className="space-y-6 fade-in">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/draws" className="text-gray-400 hover:text-white text-sm">← Cuadros</Link>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center space-y-4">
          <div className="text-6xl">🏆</div>
          <h1 className="text-xl font-bold text-white">No hay cuadro para «{friendlyCat}»</h1>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            La forma más rápida de tener un cuadro funcional es <strong className="text-gray-200">sembrar datos de prueba</strong>:
            crea 32 jugadores españoles, las 16 parejas y los 15 partidos del cuadro completo (R16 + QF + SF + F)
            en un solo paso.
          </p>
          <EmptyDrawCTA />
        </div>
      </div>
    )
  }

  const { data: entries } = await service.from('draw_entries')
    .select('*, player1:players!player1_id(first_name,last_name,nationality,ranking_rfet), player2:players!player2_id(first_name,last_name,nationality,ranking_rfet)')
    .eq('draw_id', draw.id)
    .order('seed', { ascending: true, nullsFirst: false })

  const { data: matches } = await service.from('matches')
    .select('*, court:courts(name), entry1:draw_entries!entry1_id(player1:players!player1_id(first_name,last_name), player2:players!player2_id(first_name,last_name)), entry2:draw_entries!entry2_id(player1:players!player1_id(first_name,last_name), player2:players!player2_id(first_name,last_name))')
    .eq('draw_id', draw.id)
    .order('match_number', { ascending: true })

  // Group matches by round
  const grouped: Record<string, any[]> = {}
  for (const m of matches ?? []) {
    const r = m.round ?? 'Sin ronda'
    if (!grouped[r]) grouped[r] = []
    grouped[r].push(m)
  }

  const categoryLabel = (CATEGORY_LABELS as Record<string, string>)[category] ?? category
  const matchType = (draw as any).match_type ?? 'doubles'
  const matchTypeLabel = matchType === 'singles' ? 'Individual' : 'Dobles'

  // Build JSON export
  const bracketJson = {
    categoria: categoryLabel,
    modalidad: matchTypeLabel,
    tipo_cuadro: draw.draw_type.replace(/_/g, ' '),
    estado: draw.status,
    fases: Object.fromEntries(
      ROUND_ORDER.filter(r => grouped[r]).map(r => [
        ROUND_LABELS[r] ?? r,
        grouped[r].map((m: any, i: number) => ({
          partido: i + 1,
          equipoA: entryName(m.entry1),
          equipoB: entryName(m.entry2),
          resultado: m.score?.sets
            ? m.score.sets.map((s: any) => `${s.t1}-${s.t2}`).join(' ')
            : null,
          estado: m.status,
          ganador: m.score?.winner_team === 1
            ? entryName(m.entry1)
            : m.score?.winner_team === 2
            ? entryName(m.entry2)
            : null,
          pista: m.court?.name ?? null,
          hora: m.scheduled_at
            ? new Date(m.scheduled_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
            : null,
        }))
      ])
    ),
  }

  const hasMatches = matches && matches.length > 0
  const orderedRounds = ROUND_ORDER.filter(r => grouped[r])
  const unknownRounds = Object.keys(grouped).filter(r => !ROUND_ORDER.includes(r))

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/draws" className="text-gray-400 hover:text-white text-sm">← Cuadros</Link>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white font-score">{categoryLabel}</h1>
          <p className="text-gray-400 text-sm">
            {draw.draw_type.replace(/_/g, ' ')} · {draw.size} plazas · {matchTypeLabel}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Badge variant={draw.status === 'finished' ? 'success' : draw.status === 'in_progress' ? 'danger' : 'outline'}>
            {draw.status}
          </Badge>
          <Link href={`/dashboard/matches/new`}
            className="bg-brand-red hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs transition-colors">
            + Partido
          </Link>
          <Link href="/dashboard/draws/new"
            className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg text-xs transition-colors">
            Nuevo cuadro
          </Link>
        </div>
      </div>

      {/* Entries */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
        <h2 className="text-white font-semibold mb-4">Inscripciones ({entries?.length ?? 0}/{draw.size})</h2>
        {(!entries || entries.length === 0) ? (
          <p className="text-gray-500 text-sm">No hay inscripciones en este cuadro</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {(entries as any[]).map((e, i) => (
              <div key={e.id} className="flex items-center gap-3 p-3 bg-gray-800 rounded-xl">
                <span className="text-gray-600 text-xs w-5 text-right flex-shrink-0">{e.seed ?? i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {e.player1 ? `${e.player1.first_name} ${e.player1.last_name}` : '—'}
                    {e.player2 && <span className="text-gray-400"> / {e.player2.first_name} {e.player2.last_name}</span>}
                  </p>
                  <p className="text-gray-500 text-xs">
                    {e.player1?.nationality}
                    {e.player1?.ranking_rfet && ` · RFET #${e.player1.ranking_rfet}`}
                  </p>
                </div>
                <Badge variant={e.status === 'confirmed' ? 'success' : 'outline'}>{e.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bracket — vista en arbol (R32 -> R16 -> QF -> SF -> F) con conectores */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">
            Cuadro de eliminación
            <span className="text-gray-500 text-sm font-normal ml-2">({matches?.length ?? 0} partidos · click para abrir cada partido)</span>
          </h2>
        </div>

        {!hasMatches ? (
          <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 text-center text-gray-500 space-y-3">
            <p>No hay partidos en esta categoría todavía.</p>
            <p className="text-xs">Si acabas de crear el cuadro vacío y no se generaron partidos automáticamente, sembrá los datos completos:</p>
            <div className="pt-2"><EmptyDrawCTA /></div>
          </div>
        ) : (
          <BracketTree matches={matches as any[]} isDoubles={matchType !== 'singles'}/>
        )}
      </div>

      {/* Lista plana por ronda (para no-KO o referencia rápida) — solo si hay rondas no-KO */}
      {hasMatches && unknownRounds.length > 0 && (
        <div>
          <h2 className="text-white font-semibold mb-3">Otras rondas (fase de grupos / consolación)</h2>
          <div className="space-y-6">
            {unknownRounds.map((round) => (
              <div key={round}>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span className="w-6 h-px bg-gray-700 inline-block" />
                  {ROUND_LABELS[round] ?? round}
                  <span className="flex-1 h-px bg-gray-700 inline-block" />
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {grouped[round].map((m: any) => {
                    const isFinished = m.status === 'finished'
                    const w1 = isFinished && m.score?.winner_team === 1
                    const w2 = isFinished && m.score?.winner_team === 2
                    const sets1 = teamSets(m.score, 1)
                    const sets2 = teamSets(m.score, 2)
                    const sl = STATUS_MAP[m.status] ?? { label: m.status, variant: 'default' }
                    return (
                      <Link key={m.id} href={`/dashboard/matches/${m.id}`}
                        className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-2xl overflow-hidden transition-colors">
                        <div className={`flex items-center gap-3 px-4 py-3 ${w1 ? 'bg-green-900/20' : ''}`}>
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${w1 ? 'bg-green-400' : 'bg-transparent'}`} />
                          <span className={`text-sm flex-1 min-w-0 truncate ${w1 ? 'text-white font-medium' : 'text-gray-300'}`}>{entryName(m.entry1)}</span>
                          <div className="flex gap-2 ml-2 font-score font-bold text-sm flex-shrink-0">
                            {sets1.length === 0 ? <span className="text-gray-700 text-xs">—</span> : sets1.map((s: number, i: number) => (
                              <span key={i} className={`w-5 text-center ${w1 ? 'text-white' : 'text-gray-500'}`}>{s}</span>
                            ))}
                          </div>
                        </div>
                        <div className="border-t border-gray-800 mx-4" />
                        <div className={`flex items-center gap-3 px-4 py-3 ${w2 ? 'bg-green-900/20' : ''}`}>
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${w2 ? 'bg-green-400' : 'bg-transparent'}`} />
                          <span className={`text-sm flex-1 min-w-0 truncate ${w2 ? 'text-white font-medium' : 'text-gray-300'}`}>{entryName(m.entry2)}</span>
                          <div className="flex gap-2 ml-2 font-score font-bold text-sm flex-shrink-0">
                            {sets2.length === 0 ? <span className="text-gray-700 text-xs">—</span> : sets2.map((s: number, i: number) => (
                              <span key={i} className={`w-5 text-center ${w2 ? 'text-white' : 'text-gray-500'}`}>{s}</span>
                            ))}
                          </div>
                        </div>
                        <div className="px-4 py-2 border-t border-gray-800 bg-gray-950/40 flex items-center justify-between">
                          <Badge variant={sl.variant}>{sl.label}</Badge>
                          <span className="text-xs text-gray-600">{m.court ? m.court.name : ''}</span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* JSON Export */}
      <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
        <h2 className="text-white font-semibold mb-1">Datos del cuadro · JSON</h2>
        <p className="text-gray-500 text-xs mb-3">Estructura para TV Broadcast y sistemas externos</p>
        <pre className="bg-gray-950 rounded-xl p-4 text-xs text-green-400 overflow-x-auto max-h-72 overflow-y-auto font-mono leading-relaxed whitespace-pre">
          {JSON.stringify(bracketJson, null, 2)}
        </pre>
      </div>
    </div>
  )
}
