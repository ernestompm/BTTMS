// ============================================================================
// BracketTree — vista de cuadro tipo arbol con conectores
// ============================================================================
// Server component. Recibe los partidos del cuadro y dibuja columnas
// horizontales (R32 -> R16 -> QF -> SF -> F) con lineas conectoras entre
// cada par y la siguiente ronda. Cada partido es un Link clickable a
// /dashboard/matches/{id}.
//
// El algoritmo de pairing es identico al usado en streaming (graphics.tsx
// BracketView): match N -> match CEIL(N/2) en la siguiente ronda.
// ============================================================================

import React from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import type { Score } from '@/types'

const KO_ROUNDS = ['R32', 'R16', 'QF', 'SF', 'F'] as const
type KoRound = typeof KO_ROUNDS[number]
const ROUND_LBL: Record<KoRound, string> = {
  R32: '1/16', R16: 'OCTAVOS', QF: 'CUARTOS', SF: 'SEMIFINALES', F: 'FINAL',
}
const SLOTS: Record<KoRound, number> = { R32: 16, R16: 8, QF: 4, SF: 2, F: 1 }

const STATUS_MAP: Record<string, { label: string; variant: any }> = {
  scheduled: { label: 'Prog.', variant: 'outline' },
  in_progress: { label: 'En juego', variant: 'danger' },
  finished: { label: 'Final', variant: 'success' },
  suspended: { label: 'Suspendido', variant: 'warning' },
  walkover: { label: 'W.O.', variant: 'default' },
  bye: { label: 'Bye', variant: 'default' },
}

function entryName(entry: any, isDoubles: boolean): string {
  if (!entry) return ''
  const p1 = entry.player1 ? `${entry.player1.first_name} ${entry.player1.last_name}` : ''
  if (!isDoubles) return p1
  const p2 = entry.player2 ? `${entry.player2.first_name} ${entry.player2.last_name}` : ''
  return [p1, p2].filter(Boolean).join(' / ')
}

function teamSets(score: Score | null | undefined, team: 1|2): number[] {
  return (score?.sets ?? []).map((s: any) => team === 1 ? s.t1 : s.t2)
}

export function BracketTree({ matches, isDoubles }: { matches: any[], isDoubles: boolean }) {
  // Agrupar por ronda
  const byRound: Record<string, any[]> = { R32: [], R16: [], QF: [], SF: [], F: [] }
  matches.forEach(m => { if (byRound[m.round]) byRound[m.round].push(m) })
  KO_ROUNDS.forEach(r => byRound[r].sort((a, b) => (a.match_number||0) - (b.match_number||0)))

  // Detectar primera ronda con datos
  const present = KO_ROUNDS.filter(r => byRound[r].length > 0)
  if (present.length === 0) {
    return (
      <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 text-center text-gray-500">
        <p>No hay partidos del cuadro de eliminación todavía.</p>
      </div>
    )
  }
  const firstRound = present[0] as KoRound
  const firstIdx = KO_ROUNDS.indexOf(firstRound)
  const visibleRounds = KO_ROUNDS.slice(firstIdx) as KoRound[]

  // Por cada ronda visible, rellenar slots por match_number
  const roundsData = visibleRounds.map(r => {
    const expected = SLOTS[r]
    const byNum: Record<number, any> = {}
    byRound[r].forEach((m: any) => { if (m.match_number) byNum[m.match_number] = m })
    const slots: any[] = []
    for (let i = 1; i <= expected; i++) slots.push(byNum[i] ?? null)
    return { round: r, slots }
  })

  const totalRows = SLOTS[firstRound] * 2
  const N_COLS = visibleRounds.length

  // Plantilla: alterna [round 1fr] [conector 40px] [round 1fr] ...
  const colTracks: string[] = []
  for (let i = 0; i < N_COLS; i++) {
    if (i > 0) colTracks.push('40px')
    colTracks.push('minmax(220px, 1fr)')
  }
  const gridCols = colTracks.join(' ')

  // Altura: dimensionar la altura del bracket en funcion del numero de slots
  // de la primera ronda. Cada slot necesita ~110px para un partido legible.
  const slotPx = 110
  const totalHeightPx = SLOTS[firstRound] * slotPx * 2  // *2 = padding visual
  const minHeight = Math.min(totalHeightPx, 1400)
  const finalHeight = Math.max(minHeight, 520)

  const lineColor = 'rgba(75,85,99,.55)'  // gray-600/55

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4 overflow-x-auto">
      {/* Round headers */}
      <div className="grid mb-3" style={{ gridTemplateColumns: gridCols, gap: 0 }}>
        {visibleRounds.map((r, i) => (
          <div key={r} style={{ gridColumn: i === 0 ? 1 : i*2 + 1 }}
            className="text-xs font-bold text-gray-400 tracking-widest uppercase text-center pb-2 border-b border-gray-800">
            {ROUND_LBL[r]}
          </div>
        ))}
      </div>

      {/* Bracket body */}
      <div className="grid relative" style={{
        gridTemplateColumns: gridCols,
        gridTemplateRows: `repeat(${totalRows}, minmax(0, 1fr))`,
        height: finalHeight,
      }}>
        {roundsData.map(({ round, slots }, colIdx) => {
          const slotsCount = slots.length
          const span = totalRows / slotsCount
          const gridColumn = colIdx === 0 ? 1 : colIdx * 2 + 1
          return (
            <React.Fragment key={round}>
              {slots.map((m, i) => {
                const startRow = i * span + 1
                const endRow = startRow + span
                return (
                  <div key={`${round}-${i}`}
                    style={{ gridColumn, gridRow: `${startRow}/${endRow}` }}
                    className="flex items-center px-1 py-1.5">
                    <BracketMatchCard m={m} isDoubles={isDoubles} isFinal={round === 'F'}/>
                  </div>
                )
              })}

              {/* Connectors hacia la siguiente columna */}
              {colIdx < roundsData.length - 1 && (
                <div style={{ gridColumn: colIdx*2 + 2, gridRow: `1/${totalRows+1}`, position: 'relative' }}>
                  {Array.from({ length: slotsCount / 2 }).map((_, p) => {
                    const i1 = p*2, i2 = p*2 + 1
                    const c1 = ((i1 + 0.5) / slotsCount) * 100
                    const c2 = ((i2 + 0.5) / slotsCount) * 100
                    const cMid = (c1 + c2) / 2
                    return (
                      <div key={p}>
                        <div style={{ position: 'absolute', left: 0, width: '50%', top: `calc(${c1}% - 1px)`, height: 2, background: lineColor }}/>
                        <div style={{ position: 'absolute', left: 0, width: '50%', top: `calc(${c2}% - 1px)`, height: 2, background: lineColor }}/>
                        <div style={{ position: 'absolute', left: 'calc(50% - 1px)', top: `${c1}%`, height: `${c2-c1}%`, width: 2, background: lineColor }}/>
                        <div style={{ position: 'absolute', left: '50%', right: 0, top: `calc(${cMid}% - 1px)`, height: 2, background: lineColor }}/>
                      </div>
                    )
                  })}
                </div>
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

function BracketMatchCard({ m, isDoubles, isFinal }: { m: any | null, isDoubles: boolean, isFinal: boolean }) {
  if (!m) {
    return (
      <div className="w-full bg-gray-800/30 border border-dashed border-gray-700 rounded-lg p-2.5 text-center">
        <span className="text-[10px] tracking-widest font-bold uppercase text-gray-600">Por determinar</span>
      </div>
    )
  }
  const isFinished = m.status === 'finished'
  const w1 = isFinished && m.score?.winner_team === 1
  const w2 = isFinished && m.score?.winner_team === 2
  const sets1 = teamSets(m.score, 1)
  const sets2 = teamSets(m.score, 2)
  const sl = STATUS_MAP[m.status] ?? { label: m.status, variant: 'default' }
  const name1 = entryName(m.entry1, isDoubles)
  const name2 = entryName(m.entry2, isDoubles)
  const ringClass = isFinal ? 'border-yellow-700/60 bg-yellow-900/10' : 'border-gray-800 hover:border-gray-600'

  return (
    <Link href={`/dashboard/matches/${m.id}`}
      className={`w-full bg-gray-950/60 border ${ringClass} rounded-lg overflow-hidden transition-colors group block`}>
      {/* Team 1 */}
      <div className={`flex items-center gap-2 px-2.5 py-1.5 ${w1 ? 'bg-green-900/25' : ''}`}>
        <span className={`w-1 h-4 rounded-full flex-shrink-0 ${w1 ? 'bg-green-400' : 'bg-gray-700'}`} />
        <span className={`text-xs flex-1 min-w-0 truncate ${w1 ? 'text-white font-semibold' : !name1 ? 'text-gray-600 italic' : 'text-gray-300'}`}>
          {name1 || 'Por determinar'}
        </span>
        <div className="flex gap-1 ml-1 font-bold text-xs flex-shrink-0">
          {sets1.length === 0
            ? <span className="text-gray-700">—</span>
            : sets1.map((s, i) => (
              <span key={i} className={`w-4 text-center tabular-nums ${w1 ? 'text-green-400' : 'text-gray-500'}`}>{s}</span>
            ))
          }
        </div>
      </div>
      <div className="border-t border-gray-800/60 mx-2.5" />
      {/* Team 2 */}
      <div className={`flex items-center gap-2 px-2.5 py-1.5 ${w2 ? 'bg-green-900/25' : ''}`}>
        <span className={`w-1 h-4 rounded-full flex-shrink-0 ${w2 ? 'bg-green-400' : 'bg-gray-700'}`} />
        <span className={`text-xs flex-1 min-w-0 truncate ${w2 ? 'text-white font-semibold' : !name2 ? 'text-gray-600 italic' : 'text-gray-300'}`}>
          {name2 || 'Por determinar'}
        </span>
        <div className="flex gap-1 ml-1 font-bold text-xs flex-shrink-0">
          {sets2.length === 0
            ? <span className="text-gray-700">—</span>
            : sets2.map((s, i) => (
              <span key={i} className={`w-4 text-center tabular-nums ${w2 ? 'text-green-400' : 'text-gray-500'}`}>{s}</span>
            ))
          }
        </div>
      </div>
      {/* Footer */}
      <div className="px-2.5 py-1 bg-gray-900/60 border-t border-gray-800 flex items-center justify-between">
        <span className="text-[9px] text-gray-500 tabular-nums">#{m.match_number}</span>
        <Badge variant={sl.variant}>{sl.label}</Badge>
        <span className="text-[9px] text-gray-600 tabular-nums truncate ml-1">
          {m.court?.name ?? ''}
        </span>
      </div>
    </Link>
  )
}
