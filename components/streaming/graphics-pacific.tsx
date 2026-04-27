'use client'
// ============================================================================
// Streaming Graphics — PACIFIC skin
// ============================================================================
// Estetica "sunset beach": gradientes turquesa-coral, cards translucidas con
// blur, formas organicas (border-radius irregular), tipografia ligera (Inter),
// pesos 300-700, mucho whitespace, premium minimalista tipo Apple Sport.
//
// La paleta del torneo (palette()) sigue presente como acento secundario para
// distinguir equipos, pero la atmosfera principal viene de los gradientes
// pacific (cyan-coral). Si el cliente quiere su rojo Vinteon, tambien aparece
// pero como acento puntual, no como fondo.
//
// Mismas dimensiones / posiciones que classic+tour: vMix no necesita
// re-rigging al cambiar de skin.
// ============================================================================

import React, { useEffect, useState } from 'react'
import type { Player, Score, Sponsor, Tournament, WeatherData, Category } from '@/types'
import { CATEGORY_LABELS } from '@/types'
import { animStyle, hexAlpha, flagPath, palette, firstSurname } from './stage-shared'

// ─── PACIFIC PALETTE ────────────────────────────────────────────────────────
const PAC = {
  cyan:    '#5fc4cc',
  cyanLt:  '#7dd3d8',
  blue:    '#4a90c2',
  blueDk:  '#3a72a0',
  coral:   '#ff8a72',
  coralLt: '#ffb39d',
  amber:   '#ffd07a',
  ink:     '#0e1c29',
  textHi:  '#ffffff',
  textMid: 'rgba(255,255,255,.78)',
  textLo:  'rgba(255,255,255,.55)',
}

// Gradientes reutilizables
const GRAD_HORIZ = `linear-gradient(90deg, ${hexAlpha(PAC.cyan,.55)} 0%, ${hexAlpha(PAC.blue,.55)} 50%, ${hexAlpha(PAC.coral,.55)} 100%)`
const GRAD_DIAG  = `linear-gradient(135deg, ${hexAlpha(PAC.cyan,.28)} 0%, ${hexAlpha(PAC.blue,.20)} 50%, ${hexAlpha(PAC.coral,.30)} 100%)`
const GRAD_DARK  = `linear-gradient(135deg, ${hexAlpha(PAC.cyan,.18)} 0%, ${hexAlpha(PAC.ink,.55)} 60%, ${hexAlpha(PAC.coral,.22)} 100%)`

const PAC_FONT = "'Inter', 'SF Pro Display', system-ui, -apple-system, sans-serif"

// Card translucida con backdrop blur — base de la mayoria de graficos
function pacCard(opts?: { intensity?: 'soft' | 'medium' | 'dark' }): React.CSSProperties {
  const i = opts?.intensity ?? 'soft'
  return {
    background: i === 'dark' ? GRAD_DARK : i === 'medium' ? GRAD_DIAG : `linear-gradient(135deg, ${hexAlpha(PAC.cyan,.15)} 0%, ${hexAlpha(PAC.coral,.18)} 100%)`,
    border: '1px solid rgba(255,255,255,.22)',
    borderRadius: 28,
    boxShadow: '0 18px 50px rgba(0,0,0,.30), inset 0 1px 0 rgba(255,255,255,.20)',
    backdropFilter: 'blur(22px) saturate(1.2)',
    WebkitBackdropFilter: 'blur(22px) saturate(1.2)',
    overflow: 'hidden',
  }
}

// Forma organica (asymmetric border-radius). Para cards con vibe blob.
function pacBlob(seed: number = 1): React.CSSProperties {
  const sets = [
    { borderRadius: '40px 60px 38px 56px / 50px 40px 60px 44px' },
    { borderRadius: '60px 38px 56px 40px / 40px 60px 44px 50px' },
    { borderRadius: '50px 30px 60px 50px / 60px 50px 30px 50px' },
    { borderRadius: '30px 60px 40px 60px / 50px 30px 60px 40px' },
  ]
  return sets[seed % sets.length]
}

// Pill horizontal con gradiente (header chips)
function pacPill(): React.CSSProperties {
  return {
    background: GRAD_HORIZ,
    border: '1px solid rgba(255,255,255,.30)',
    borderRadius: 999,
    boxShadow: '0 10px 30px rgba(0,0,0,.20), inset 0 1px 0 rgba(255,255,255,.25)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
  }
}

// Texto kicker (etiqueta uppercase ligera)
const pacKicker = (color: string = PAC.textLo, size: number = 13): React.CSSProperties => ({
  fontSize: size, letterSpacing: '.22em', textTransform: 'uppercase',
  fontWeight: 500, color,
})

// ─── ETIQUETAS ──────────────────────────────────────────────────────────────
const ROUND_LABELS: Record<string, string> = {
  F: 'Final', SF: 'Semifinal', QF: 'Cuartos de final', R16: 'Octavos de final',
  R32: 'Dieciseisavos', RR: 'Fase de grupos', GRP: 'Fase de grupos', CON: 'Consolación',
  Q1: 'Clasificatoria 1', Q2: 'Clasificatoria 2',
}
const roundLabel = (r: any): string => ROUND_LABELS[r ?? ''] ?? (r ?? '')

const PTS = ['0','15','30','40']
function gamePoint(score: Score | null, team: 1|2): string {
  if (!score) return '0'
  const k = team === 1 ? 't1' : 't2'
  if (score.super_tiebreak_active || score.tiebreak_active) return String(score.tiebreak_score?.[k] ?? 0)
  if (score.deuce) return '40'
  return PTS[score.current_game?.[k] ?? 0] ?? '0'
}
function threeSetsFor(score: Score | null, team: 1|2): Array<number|null> {
  const out: Array<number|null> = [null, null, null]
  if (!score) return out
  const k = team === 1 ? 't1' : 't2'
  const sets = score.sets ?? []
  for (let i = 0; i < Math.min(3, sets.length); i++) out[i] = sets[i][k]
  if (score.match_status === 'in_progress') {
    const idx = sets.length
    if (idx < 3) {
      out[idx] = score.super_tiebreak_active
        ? (score.tiebreak_score?.[k] ?? 0)
        : (score.current_set?.[k] ?? 0)
    }
  }
  return out
}
function fmtClock(secs: number) {
  const s = Math.max(0, secs|0)
  const hh = Math.floor(s/3600), mm = Math.floor((s%3600)/60), ss = s%60
  return hh ? `${hh}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}` : `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`
}
function fmtHHmm(secs: number) {
  const s = Math.max(0, secs|0)
  const hh = Math.floor(s/3600), mm = Math.floor((s%3600)/60)
  return `${hh}:${String(mm).padStart(2,'0')}`
}
function useTicker(start: string | null, stop: string | null) {
  const [, tick] = useState(0)
  useEffect(() => { const id = setInterval(() => tick(x => x+1), 1000); return () => clearInterval(id) }, [])
  if (!start) return 0
  const end = stop ? new Date(stop).getTime() : Date.now()
  return Math.floor((end - new Date(start).getTime()) / 1000)
}
function ageFrom(iso: string) {
  const d = new Date(iso); const now = new Date(); let a = now.getFullYear()-d.getFullYear()
  const m = now.getMonth()-d.getMonth()
  if (m<0 || (m===0 && now.getDate()<d.getDate())) a--
  return a
}
function lateralityText(laterality: 'right'|'left'|'ambidextrous', category?: Category) {
  const female = (category ?? '').endsWith('_f')
  if (laterality === 'ambidextrous') return female ? 'Ambidiestra' : 'Ambidiestro'
  if (laterality === 'left') return female ? 'Zurda' : 'Zurdo'
  return female ? 'Diestra' : 'Diestro'
}

// ════════════════════════════════════════════════════════════════════════════
// 1) SCOREBUG PACIFIC — top-left, blob organico
// ════════════════════════════════════════════════════════════════════════════
const STAT_LABELS: Record<string, string> = {
  aces: 'Aces',
  double_faults: 'Dobles faltas',
  serve_points_won_pct: '% pts saque',
  return_points_won_pct: '% pts resto',
  break_points_won: 'Breaks ganados',
  total_points_won: 'Puntos totales',
}
function statValue(stats: any, stat: string, team: 1|2): string|number {
  const t = team === 1 ? stats?.t1 : stats?.t2
  const v = t?.[stat]
  if (v == null) return '—'
  if (stat.endsWith('_pct')) return `${Math.round(v)}%`
  return v
}

export function ScorebugPacific({ visible, match, tournament, tickerStat }: {
  visible: boolean, match: any, tournament: Tournament | null, tickerStat?: string | null,
}) {
  if (!match) return null
  const pal = palette(tournament?.scoreboard_config)
  const score = match.score as Score | null
  const isDoubles = match.match_type === 'doubles'
  const serving = match.serving_team as 1|2|null
  const inProgress = score?.match_status === 'in_progress'
  const setsPlayed = score?.sets?.length ?? 0
  // No mostrar set 0-0
  const cs = score?.current_set ?? { t1: 0, t2: 0 }
  const tb = score?.tiebreak_score ?? { t1: 0, t2: 0 }
  const tbActive = !!(score?.tiebreak_active || score?.super_tiebreak_active)
  const cT1 = tbActive ? (tb.t1 ?? 0) : (cs.t1 ?? 0)
  const cT2 = tbActive ? (tb.t2 ?? 0) : (cs.t2 ?? 0)
  const currentHasScore = inProgress && (cT1 > 0 || cT2 > 0)
  const setCount = Math.min(3, setsPlayed + (currentHasScore ? 1 : 0))
  const showTicker = !!tickerStat && !!match.stats
  const tickerLabel = tickerStat ? (STAT_LABELS[tickerStat] ?? tickerStat.toUpperCase()) : ''

  return (
    <div style={{
      position: 'absolute', top: 40, left: 40,
      ...animStyle(visible, 'sgInR', 'sgOutR', 600),
    }}>
      <div style={{
        ...pacCard({ intensity: 'medium' }),
        ...pacBlob(1),
        padding: '14px 18px',
        fontFamily: PAC_FONT,
        minWidth: 380,
      }}>
        {[1,2].map(tn => {
          const team = tn as 1|2
          const opTeam = (team === 1 ? 2 : 1) as 1|2
          const entry = team === 1 ? match.entry1 : match.entry2
          const accent = team === 1 ? pal.accentA : pal.accentB
          const players = [entry?.player1, isDoubles ? entry?.player2 : null].filter(Boolean)
          const setsT = threeSetsFor(score, team).slice(0, setCount)
          const setsOp = threeSetsFor(score, opTeam).slice(0, setCount)
          const pt = gamePoint(score, team)
          const isServe = serving === team
          const tickerVal = showTicker ? statValue(match.stats, tickerStat!, team) : ''
          const finishedSetCount = setsPlayed
          // Ordenar de derecha a izquierda: set 1 a la derecha, set N a la izquierda
          const setIdx = Array.from({ length: setCount }, (_, i) => i).reverse()  // [N-1..0] => set N..1 visual L->R
          // actually we want set 1 rightmost: visual order should be [N-1, N-2, ..., 0] so set N is leftmost, set 1 rightmost
          const renderIdx = Array.from({ length: setCount }, (_, i) => setCount - 1 - i)  // [N-1..0]
          // ^ for each visual position from left, the actual set index

          return (
            <div key={team} style={{
              display: 'grid',
              gridTemplateColumns: `28px auto 1fr ${setCount > 0 ? `repeat(${setCount}, 36px)` : ''} 56px`,
              alignItems: 'center', gap: 10,
              padding: '8px 0',
              borderTop: tn === 2 ? '1px solid rgba(255,255,255,.10)' : 'none',
            }}>
              {/* Serve dot */}
              <div>
                {isServe && (
                  <span style={{
                    display: 'block', width: 10, height: 10, borderRadius: '50%',
                    background: PAC.amber, boxShadow: `0 0 12px ${PAC.amber}`,
                    animation: 'sgSrvPulse 1.4s infinite',
                  }}/>
                )}
              </div>
              {/* Flag(s) */}
              <div>
                {isDoubles ? (
                  <div style={{ display: 'flex', gap: 3 }}>
                    {players.map((p:any, i:number) => (
                      <img key={i} src={flagPath(p?.nationality)} alt="" style={{ width: 22, height: 15, borderRadius: 3, objectFit: 'cover' }}/>
                    ))}
                  </div>
                ) : (
                  <img src={flagPath(players[0]?.nationality)} alt="" style={{ width: 28, height: 19, borderRadius: 3, objectFit: 'cover' }}/>
                )}
              </div>
              {/* Names */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, whiteSpace: 'nowrap', minWidth: 220 }}>
                <span style={{ fontSize: 22, fontWeight: 600, color: PAC.textHi, letterSpacing: '-.005em' }}>
                  {isDoubles
                    ? players.map((p:any) => firstSurname(p)).join(' / ')
                    : (players[0]?.last_name ?? '')}
                </span>
                {entry?.seed && <span style={{ fontSize: 12, fontWeight: 500, color: PAC.textLo }}>({entry.seed})</span>}
              </div>
              {/* Set tabs (right-to-left visually) */}
              {renderIdx.map((actualIdx, visualPos) => {
                const v = setsT[actualIdx]
                const opV = setsOp[actualIdx]
                const isFinishedSet = actualIdx < finishedSetCount
                const isCurrent = !isFinishedSet
                const isWonSet = isFinishedSet && v != null && opV != null && v > opV
                return (
                  <div key={`s${visualPos}`} style={{
                    width: 32, height: 28, display: 'grid', placeItems: 'center',
                    background: isWonSet
                      ? `linear-gradient(135deg, ${PAC.cyan} 0%, ${PAC.coral} 100%)`
                      : isCurrent ? hexAlpha(accent, .25) : 'rgba(255,255,255,.06)',
                    border: isCurrent && !isWonSet ? `1px solid ${accent}` : '1px solid rgba(255,255,255,.14)',
                    borderRadius: 8,
                    color: PAC.textHi, fontSize: 17, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                  }}>
                    {v == null ? '' : v}
                  </div>
                )
              })}
              {/* Points / Ticker */}
              <div style={{
                height: 32, padding: '0 10px', display: 'grid', placeItems: 'center',
                background: showTicker
                  ? 'rgba(255,255,255,.08)'
                  : tbActive ? PAC.amber : `linear-gradient(135deg, ${PAC.cyan} 0%, ${PAC.blue} 100%)`,
                color: showTicker ? PAC.textHi : tbActive ? PAC.ink : PAC.textHi,
                borderRadius: 10,
                fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
              }}>
                {showTicker ? tickerVal : pt}
              </div>
            </div>
          )
        })}
        {/* Ticker label */}
        {showTicker && (
          <div style={{ paddingTop: 6, marginTop: 4, borderTop: '1px solid rgba(255,255,255,.10)', textAlign: 'right' }}>
            <span style={pacKicker(PAC.coralLt, 11)}>{tickerLabel}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 2) BIG SCOREBOARD PACIFIC — barra horizontal centrada bottom 50
// ════════════════════════════════════════════════════════════════════════════
export function BigScoreboardPacific({ visible, match, tournament, sponsor, opts }: {
  visible: boolean, match: any, tournament: Tournament | null, sponsor?: Sponsor | null, opts?: any,
}) {
  if (!match) return null
  const pal = palette(tournament?.scoreboard_config)
  const score = match.score as Score | null
  const isDoubles = match.match_type === 'doubles'
  const totalSecs = useTicker(match.started_at, match.finished_at)
  const showSponsor = opts?.show_sponsor !== false && !!sponsor
  const serving = match.serving_team as 1|2|null

  const finishedSetCount = score?.sets?.length ?? 0
  const inProgress = score?.match_status === 'in_progress'
  const cs = score?.current_set ?? { t1: 0, t2: 0 }
  const tb = score?.tiebreak_score ?? { t1: 0, t2: 0 }
  const tbActive = !!(score?.tiebreak_active || score?.super_tiebreak_active)
  const cT1 = tbActive ? (tb.t1 ?? 0) : (cs.t1 ?? 0)
  const cT2 = tbActive ? (tb.t2 ?? 0) : (cs.t2 ?? 0)
  const currentHasScore = inProgress && (cT1 > 0 || cT2 > 0)
  const setCount = Math.min(3, finishedSetCount + (currentHasScore ? 1 : 0))
  // Right-to-left sets: visual position p (0=leftmost) maps to actual set index setCount-1-p
  const visualToActual = (p: number) => setCount - 1 - p

  const setColW = 86
  const sponsorColW = 220
  const cardMaxW = showSponsor ? 1500 : 1100

  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 50,
      display: 'flex', justifyContent: 'center', pointerEvents: 'none',
    }}>
      <div style={{
        width: 'fit-content', maxWidth: cardMaxW,
        ...pacCard({ intensity: 'medium' }),
        borderRadius: 36,
        padding: 0,
        pointerEvents: 'auto',
        fontFamily: PAC_FONT,
        ...animStyle(visible, 'sgInU', 'sgOutU', 700),
      }}>
        {/* HEADER */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'auto 1fr auto',
          alignItems: 'center', padding: '12px 24px', gap: 18,
          borderBottom: '1px solid rgba(255,255,255,.12)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {tournament?.logo_url && <img src={tournament.logo_url} alt="" style={{ height: 40, objectFit: 'contain' }}/>}
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: PAC.textHi, letterSpacing: '-.005em', whiteSpace: 'nowrap' }}>
                {tournament?.name}
              </span>
              <span style={pacKicker(PAC.textLo, 12)}>
                {CATEGORY_LABELS[match.category as Category] ?? match.category}
              </span>
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <span style={{
              ...pacPill(),
              padding: '6px 22px', fontSize: 16, fontWeight: 700, letterSpacing: '.18em',
              textTransform: 'uppercase', color: PAC.textHi, whiteSpace: 'nowrap', display: 'inline-block',
            }}>
              {roundLabel(match.round) || '—'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.05 }}>
            <span style={pacKicker(PAC.textLo, 11)}>TIEMPO</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 600, color: PAC.textHi, marginTop: 2 }}>
              {fmtHHmm(totalSecs)}
            </span>
          </div>
        </div>

        {/* BODY */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: setCount > 0
            ? (showSponsor
                ? `8px minmax(380px, max-content) repeat(${setCount}, ${setColW}px) ${sponsorColW}px`
                : `8px minmax(380px, max-content) repeat(${setCount}, ${setColW}px)`)
            : (showSponsor
                ? `8px minmax(380px, max-content) ${sponsorColW}px`
                : `8px minmax(380px, max-content)`),
          gridTemplateRows: setCount > 0 ? '26px 1fr 1fr' : '1fr 1fr',
        }}>
          {/* Set headers row */}
          {setCount > 0 && (
            <>
              <div style={{ gridColumn: '1 / span 2', gridRow: 1, borderBottom: '1px solid rgba(255,255,255,.10)' }}/>
              {Array.from({ length: setCount }).map((_, p) => {
                const actual = visualToActual(p)
                const dur = opts?.set_durations?.[actual]
                return (
                  <div key={`st${p}`} style={{
                    gridColumn: 3 + p, gridRow: 1,
                    display: 'grid', placeItems: 'center',
                    fontSize: 13, letterSpacing: '.20em', fontWeight: 600, color: PAC.textLo,
                    textTransform: 'uppercase',
                    borderLeft: '1px solid rgba(255,255,255,.08)',
                    borderBottom: '1px solid rgba(255,255,255,.10)',
                  }}>
                    SET {actual+1}{dur ? ` · ${fmtClock(dur)}` : ''}
                  </div>
                )
              })}
            </>
          )}

          {/* TEAM ROWS */}
          {[1,2].map(tn => {
            const team = tn as 1|2
            const opTeam = (team === 1 ? 2 : 1) as 1|2
            const entry = team === 1 ? match.entry1 : match.entry2
            const accent = team === 1 ? pal.accentA : pal.accentB
            const setsT = threeSetsFor(score, team).slice(0, setCount)
            const setsOp = threeSetsFor(score, opTeam).slice(0, setCount)
            const won = match.status === 'finished' && score?.winner_team === team
            const players = [entry?.player1, isDoubles ? entry?.player2 : null].filter(Boolean)
            const isServingTeam = serving === team
            const row = setCount > 0 ? 1 + team : team
            const rowBg = won ? hexAlpha(PAC.cyan, .14) : isServingTeam ? hexAlpha(accent, .08) : 'transparent'
            return (
              <div key={team} style={{ display: 'contents' }}>
                {/* Accent bar */}
                <div style={{
                  gridColumn: 1, gridRow: row,
                  background: `linear-gradient(180deg, ${accent} 0%, ${hexAlpha(accent,.6)} 100%)`,
                }}/>
                {/* Names */}
                <div style={{
                  gridColumn: 2, gridRow: row,
                  display: 'flex', flexDirection: 'column', justifyContent: 'center',
                  gap: isDoubles ? 4 : 0, padding: '12px 22px',
                  background: rowBg,
                  borderTop: team === 2 ? '1px solid rgba(255,255,255,.08)' : 'none',
                }}>
                  {players.map((p:any, i:number) => {
                    const isServer = isServingTeam && (!isDoubles || p.id === match.current_server_id)
                    return (
                      <PacificPlayerLine key={i} player={p} accent={accent} isDoubles={isDoubles} isServer={isServer}/>
                    )
                  })}
                </div>
                {/* Set scores — right to left */}
                {Array.from({ length: setCount }).map((_, p) => {
                  const actualIdx = visualToActual(p)
                  const v = setsT[actualIdx]
                  const opV = setsOp[actualIdx]
                  const isFinishedSet = actualIdx < finishedSetCount
                  const isCurrent = !isFinishedSet && currentHasScore
                  const isSetWon = isFinishedSet && v != null && opV != null && v > opV
                  return (
                    <div key={p} style={{
                      gridColumn: 3 + p, gridRow: row,
                      display: 'grid', placeItems: 'center',
                      fontSize: 50, fontWeight: 600,
                      borderLeft: '1px solid rgba(255,255,255,.08)',
                      borderTop: team === 2 ? '1px solid rgba(255,255,255,.08)' : 'none',
                      background: isSetWon
                        ? `linear-gradient(135deg, ${hexAlpha(PAC.cyan,.85)} 0%, ${hexAlpha(PAC.coral,.85)} 100%)`
                        : isCurrent ? hexAlpha(accent, .12) : 'rgba(255,255,255,.04)',
                      color: v == null ? PAC.textLo : isSetWon ? PAC.ink : PAC.textHi,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {v == null ? '–' : v}
                    </div>
                  )
                })}
              </div>
            )
          })}

          {/* SPONSOR — anclado a la derecha */}
          {showSponsor && (
            <div style={{
              gridColumn: setCount > 0 ? `${3 + setCount} / ${4 + setCount}` : '3 / 4',
              gridRow: setCount > 0 ? '1 / 4' : '1 / 3',
              borderLeft: '1px solid rgba(255,255,255,.12)',
              background: 'rgba(255,255,255,.03)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: 14,
            }}>
              <div style={pacKicker(PAC.textLo, 10)}>Patrocinador oficial</div>
              <div style={{ flex: 1, display: 'grid', placeItems: 'center', width: '100%', marginTop: 6 }}>
                {sponsor?.logo_url
                  ? <img src={sponsor.logo_url} alt={sponsor?.name} style={{ maxWidth: 180, maxHeight: 80, objectFit: 'contain' }}/>
                  : <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '.04em', textAlign: 'center', color: PAC.textHi, textTransform: 'uppercase' }}>{sponsor?.name ?? ''}</span>
                }
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PacificPlayerLine({ player, accent, isDoubles, isServer }: { player: any, accent: string, isDoubles: boolean, isServer: boolean }) {
  if (!player) return null
  const lastFs = isDoubles ? 30 : 40
  const firstFs = isDoubles ? 16 : 20
  const flagSz = isDoubles ? { w: 36, h: 24 } : { w: 48, h: 32 }
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, whiteSpace: 'nowrap' }}>
      <img src={flagPath(player.nationality)} alt="" style={{ flex: 'none', width: flagSz.w, height: flagSz.h, borderRadius: 4, objectFit: 'cover', alignSelf: 'center' }}/>
      {player.first_name && (
        <span style={{ fontSize: firstFs, fontWeight: 400, color: PAC.textMid, letterSpacing: '.01em', textTransform: 'uppercase' }}>
          {player.first_name.toUpperCase()}
        </span>
      )}
      <span style={{ fontSize: lastFs, fontWeight: 600, color: PAC.textHi, letterSpacing: '-.01em', textTransform: 'uppercase' }}>
        {(player.last_name ?? '').toUpperCase()}
      </span>
      {isServer && (
        <span aria-label="saca" style={{
          alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '3px 10px 3px 6px', borderRadius: 999,
          background: hexAlpha(PAC.amber, .16),
          border: `1px solid ${hexAlpha(PAC.amber, .55)}`,
          marginLeft: 6,
        }}>
          <span style={{
            width: 12, height: 12, borderRadius: '50%', background: PAC.amber,
            boxShadow: `0 0 10px ${PAC.amber}`, animation: 'sgSrvPulse 1.3s infinite',
            display: 'inline-block',
          }}/>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.18em', color: PAC.amber }}>SAQUE</span>
        </span>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 3) WEATHER PACIFIC — blob organico bottom-right
// ════════════════════════════════════════════════════════════════════════════
export function WeatherPacific({ visible, weather, tournament }: {
  visible: boolean, weather: WeatherData | null, tournament: Tournament | null,
}) {
  if (!weather) return null
  const ICONS: Record<string, string> = {
    clear: '☀️', cloudy: '⛅', rain: '🌧', snow: '❄️', fog: '🌫', storm: '⛈',
    Despejado: '☀️', 'Parcialmente nublado': '⛅', Niebla: '🌫', Llovizna: '🌦', Lluvia: '🌧',
    Nieve: '❄️', Chubascos: '🌦', Tormenta: '⛈', Desconocido: '🌡',
  }
  const icon = ICONS[weather.condition] ?? '☀️'
  return (
    <div style={{
      position: 'absolute', right: 90, bottom: 90, width: 320,
      ...pacCard({ intensity: 'soft' }),
      ...pacBlob(2),
      padding: '20px 26px',
      fontFamily: PAC_FONT,
      ...animStyle(visible, 'sgInL', 'sgOutL', 650),
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
        <span style={{ fontSize: 44, lineHeight: 1 }}>{icon}</span>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{ fontSize: 56, fontWeight: 300, color: PAC.textHi, letterSpacing: '-.02em' }}>
            {Math.round(weather.temperature_c)}°
          </span>
          <span style={pacKicker(PAC.coralLt, 12)}>{weather.condition}</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.12)' }}>
        <div>
          <div style={pacKicker(PAC.textLo, 10)}>Sensación</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: PAC.textHi, marginTop: 2 }}>{Math.round(weather.feels_like_c)}°</div>
        </div>
        <div>
          <div style={pacKicker(PAC.textLo, 10)}>Viento</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: PAC.textHi, marginTop: 2 }}>{Math.round(weather.wind_speed_kmh)} km/h</div>
        </div>
        <div>
          <div style={pacKicker(PAC.textLo, 10)}>Humedad</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: PAC.textHi, marginTop: 2 }}>{weather.humidity_pct}%</div>
        </div>
        <div>
          <div style={pacKicker(PAC.textLo, 10)}>Sede</div>
          <div style={{ fontSize: 18, fontWeight: 500, color: PAC.textHi, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {tournament?.venue_city ?? '—'}
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 4) TOURNAMENT INTRO PACIFIC — 1400x720 centrado
// ════════════════════════════════════════════════════════════════════════════
export function TournamentIntroPacific({ visible, tournament }: { visible: boolean, tournament: Tournament | null }) {
  if (!tournament) return null
  const start = new Date(tournament.start_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
  const end = new Date(tournament.end_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
  const subtitle = [tournament.venue_name, tournament.venue_city, `${start} — ${end}`].filter(Boolean).join('  ·  ')
  return (
    <div style={{
      position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
      width: 1400, height: 720,
      ...pacCard({ intensity: 'medium' }),
      borderRadius: 48,
      padding: '60px 80px', fontFamily: PAC_FONT,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32, textAlign: 'center',
      ...animStyle(visible, 'sgInZC', 'sgOutZC', 750),
    }}>
      {/* Decorative blobs */}
      <div style={{
        position: 'absolute', top: -80, left: -60, width: 280, height: 280,
        borderRadius: '50% 38% 60% 50%',
        background: `radial-gradient(circle at 30% 30%, ${hexAlpha(PAC.cyan,.55)}, transparent 70%)`,
        filter: 'blur(20px)', pointerEvents: 'none',
      }}/>
      <div style={{
        position: 'absolute', bottom: -100, right: -80, width: 320, height: 320,
        borderRadius: '50% 38% 60% 50%',
        background: `radial-gradient(circle at 70% 70%, ${hexAlpha(PAC.coral,.55)}, transparent 70%)`,
        filter: 'blur(22px)', pointerEvents: 'none',
      }}/>

      {tournament.logo_url && (
        <img src={tournament.logo_url} alt="" style={{ maxWidth: 280, maxHeight: 240, objectFit: 'contain', position: 'relative', zIndex: 1 }}/>
      )}
      <div style={{ fontSize: 110, fontWeight: 300, lineHeight: .92, letterSpacing: '-.025em', color: PAC.textHi, position: 'relative', zIndex: 1 }}>
        {tournament.name}
      </div>
      <div style={{ ...pacPill(), display: 'inline-block', padding: '12px 36px', position: 'relative', zIndex: 1 }}>
        <span style={{ fontSize: 22, fontWeight: 500, letterSpacing: '.08em', color: PAC.textHi, textTransform: 'uppercase' }}>{subtitle}</span>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 5) VENUE CARD PACIFIC — 560 ancho, blob bottom-right
// ════════════════════════════════════════════════════════════════════════════
export function VenueCardPacific({ visible, tournament }: { visible: boolean, tournament: Tournament | null }) {
  if (!tournament) return null
  return (
    <div style={{
      position: 'absolute', right: 90, bottom: 90, width: 560,
      ...pacCard({ intensity: 'soft' }),
      ...pacBlob(0),
      padding: '24px 32px', fontFamily: PAC_FONT,
      ...animStyle(visible, 'sgInL', 'sgOutL', 650),
    }}>
      <div style={pacKicker(PAC.coralLt, 14)}>SEDE</div>
      <div style={{ marginTop: 8, fontSize: 42, fontWeight: 500, lineHeight: .98, color: PAC.textHi, letterSpacing: '-.01em' }}>
        {tournament.venue_name || tournament.venue_city}
      </div>
      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 400, color: PAC.cyanLt, letterSpacing: '.06em', textTransform: 'uppercase' }}>
        {tournament.venue_city}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 6) MATCH PRESENTATION PACIFIC
// ════════════════════════════════════════════════════════════════════════════
export function MatchPresentationPacific({ visible, match, tournament }: {
  visible: boolean, match: any, tournament: Tournament | null,
}) {
  if (!match) return null
  const pal = palette(tournament?.scoreboard_config)
  const isDoubles = match.match_type === 'doubles'
  const phaseLabel = roundLabel(match.round)
  const categoryLabel = CATEGORY_LABELS[match.category as Category] ?? match.category ?? ''
  const pillText = [phaseLabel, categoryLabel].filter(Boolean).join('  ·  ')

  return (
    <div style={{
      position: 'absolute', left: 170, right: 170, top: 160, bottom: 160,
      ...pacCard({ intensity: 'medium' }),
      borderRadius: 44,
      padding: 0, fontFamily: PAC_FONT,
      display: 'flex', flexDirection: 'column',
      ...animStyle(visible, 'sgInZ', 'sgOutZ', 750),
    }}>
      {/* Header */}
      <div style={{ padding: '36px 60px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 36, borderBottom: '1px solid rgba(255,255,255,.10)' }}>
        {tournament?.logo_url && <img src={tournament.logo_url} alt="" style={{ height: 100, width: 100, objectFit: 'contain', flex: 'none' }}/>}
        <div style={{ fontSize: 64, fontWeight: 300, lineHeight: .98, color: PAC.textHi, letterSpacing: '-.018em', textAlign: 'center', maxWidth: 1100 }}>
          {tournament?.name}
        </div>
      </div>
      {/* Phase pill */}
      {pillText && (
        <div style={{ textAlign: 'center', padding: '24px 0 12px' }}>
          <span style={{ ...pacPill(), display: 'inline-block', padding: '12px 36px', fontSize: 22, fontWeight: 500, letterSpacing: '.18em', textTransform: 'uppercase', color: PAC.textHi }}>
            {pillText}
          </span>
        </div>
      )}
      {/* Teams */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 240px 1fr', alignItems: 'center', padding: '12px 40px 36px' }}>
        <PacTeamBlock entry={match.entry1} accent={pal.accentA} align="right" isDoubles={isDoubles}/>
        <div style={{ display: 'grid', placeItems: 'center' }}>
          <div style={{
            fontSize: 200, fontWeight: 200, lineHeight: .85, letterSpacing: '-.05em',
            background: `linear-gradient(135deg, ${PAC.cyan} 0%, ${PAC.coral} 100%)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>vs</div>
        </div>
        <PacTeamBlock entry={match.entry2} accent={pal.accentB} align="left" isDoubles={isDoubles}/>
      </div>
    </div>
  )
}

function PacTeamBlock({ entry, accent, align, isDoubles }: { entry: any, accent: string, align: 'left'|'right', isDoubles: boolean }) {
  const players = [entry?.player1, isDoubles ? entry?.player2 : null].filter(Boolean)
  const hasAnyPhoto = players.some((p: any) => !!p?.photo_url)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: align === 'right' ? 'flex-end' : 'flex-start', justifyContent: 'center', gap: 22, padding: '0 32px' }}>
      {hasAnyPhoto && (
        <div style={{ display: 'flex', gap: 18, flexDirection: align === 'right' ? 'row-reverse' : 'row' }}>
          {players.map((p: any, i: number) => p?.photo_url && (
            <div key={i} style={{
              width: isDoubles ? 150 : 200, height: isDoubles ? 150 : 200,
              borderRadius: '46% 54% 50% 50% / 50% 46% 54% 50%',
              overflow: 'hidden',
              border: `2px solid ${hexAlpha(PAC.cyan, .55)}`,
              boxShadow: `0 12px 30px ${hexAlpha(accent,.30)}`,
            }}>
              <img src={p.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: align === 'right' ? 'flex-end' : 'flex-start' }}>
        {players.map((p: any, i: number) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, flexDirection: align === 'right' ? 'row-reverse' : 'row' }}>
            <img src={flagPath(p?.nationality)} alt="" style={{ flex: 'none', width: 60, height: 40, borderRadius: 5, objectFit: 'cover' }}/>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: align === 'right' ? 'flex-end' : 'flex-start', lineHeight: 1 }}>
              {p?.first_name && (
                <span style={{ fontSize: players.length === 1 ? 26 : 20, fontWeight: 400, color: PAC.textMid, letterSpacing: '.02em', textTransform: 'uppercase' }}>
                  {p.first_name}
                </span>
              )}
              <span style={{ fontSize: players.length === 1 ? 70 : 50, fontWeight: 600, lineHeight: .95, textTransform: 'uppercase', whiteSpace: 'nowrap', color: PAC.textHi, letterSpacing: '-.01em' }}>
                {(p?.last_name ?? '').toUpperCase()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 7) PLAYER BIO PACIFIC — 740 ancho lateral
// ════════════════════════════════════════════════════════════════════════════
export function PlayerBioPacific({ visible, player, team, category, tournament }: {
  visible: boolean, player: Player | null, team: 1|2, category?: Category, tournament: Tournament | null,
}) {
  if (!player) return null
  const pal = palette(tournament?.scoreboard_config)
  const accent = team === 1 ? pal.accentA : pal.accentB
  const side: 'left'|'right' = team === 1 ? 'left' : 'right'
  const enter = side === 'left' ? 'sgInR' : 'sgInL'
  const exit = side === 'left' ? 'sgOutR' : 'sgOutL'

  const ficha: Array<[string, string]> = []
  if (player.birth_date) ficha.push(['Edad', String(ageFrom(player.birth_date))])
  else if (player.age_manual) ficha.push(['Edad', String(player.age_manual)])
  if (player.birth_city) ficha.push(['Nacimiento', player.birth_city])
  if (player.height_cm) ficha.push(['Altura', `${player.height_cm} cm`])
  if (player.laterality) ficha.push(['Lateralidad', lateralityText(player.laterality, category)])
  if (player.club) ficha.push(['Club', player.club])
  if (player.federacion_autonomica) ficha.push(['Federación', player.federacion_autonomica])

  const hasPhoto = !!player.photo_url
  const hasRanking = !!(player.ranking_rfet || player.ranking_itf)
  const hasTitles = (player.titles?.length ?? 0) > 0
  const hasBio = !!player.bio

  const pos: React.CSSProperties = { position: 'absolute', top: 60, bottom: 60, width: 740 }
  if (side === 'left') pos.left = 60
  if (side === 'right') pos.right = 60

  const sectionTitle: React.CSSProperties = { fontSize: 16, letterSpacing: '.34em', textTransform: 'uppercase', fontWeight: 600, color: PAC.coralLt }
  const divider: React.CSSProperties = { height: 1, background: 'rgba(255,255,255,.10)', margin: '20px 0' }

  return (
    <div style={{
      ...pos,
      ...pacCard({ intensity: 'medium' }),
      borderRadius: 36,
      padding: 0, fontFamily: PAC_FONT,
      display: 'flex', flexDirection: 'column',
      ...animStyle(visible, enter, exit, 700),
    } as any}>
      <div style={{ padding: '28px 36px 24px', display: 'flex', gap: 22, alignItems: 'center' }}>
        {hasPhoto && (
          <div style={{
            flex: 'none', width: 220, height: 220,
            borderRadius: '46% 54% 50% 50% / 50% 46% 54% 50%',
            overflow: 'hidden', border: `2px solid ${hexAlpha(PAC.cyan, .55)}`,
            boxShadow: `0 12px 30px ${hexAlpha(accent,.30)}`,
          }}>
            <img src={player.photo_url!} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: 18 }}>
          <img src={flagPath(player.nationality)} alt="" style={{ flex: 'none', width: 84, height: 56, borderRadius: 5, objectFit: 'cover' }}/>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 32, fontWeight: 400, color: PAC.textMid, lineHeight: 1, textTransform: 'uppercase', letterSpacing: '.02em' }}>
              {player.first_name}
            </div>
            <div style={{ fontSize: 70, fontWeight: 500, lineHeight: .92, textTransform: 'uppercase', color: PAC.textHi, letterSpacing: '-.01em' }}>
              {player.last_name}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 36px 28px', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        {ficha.length > 0 && (<>
          <div style={divider}/>
          <div style={sectionTitle}>FICHA</div>
          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 28px' }}>
            {ficha.map(([k, v]) => (
              <div key={k}>
                <div style={pacKicker(PAC.textLo, 12)}>{k}</div>
                <div style={{ fontSize: 28, fontWeight: 500, color: PAC.textHi, marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>
        </>)}

        {hasRanking && (<>
          <div style={divider}/>
          <div style={sectionTitle}>RANKING</div>
          <div style={{ marginTop: 12, display: 'flex', gap: 18 }}>
            {player.ranking_rfet && (
              <div style={{
                flex: 1, padding: '14px 22px', borderRadius: 16,
                background: `linear-gradient(135deg, ${hexAlpha(PAC.cyan,.18)} 0%, ${hexAlpha(PAC.coral,.18)} 100%)`,
                border: `1px solid ${hexAlpha(PAC.cyan, .35)}`,
              }}>
                <div style={pacKicker(PAC.cyanLt, 14)}>RFET</div>
                <div style={{ fontSize: 64, fontWeight: 300, lineHeight: 1, color: PAC.textHi, fontVariantNumeric: 'tabular-nums' }}>#{player.ranking_rfet}</div>
              </div>
            )}
            {player.ranking_itf && (
              <div style={{
                flex: 1, padding: '14px 22px', borderRadius: 16,
                background: `linear-gradient(135deg, ${hexAlpha(PAC.cyan,.18)} 0%, ${hexAlpha(PAC.coral,.18)} 100%)`,
                border: `1px solid ${hexAlpha(PAC.cyan, .35)}`,
              }}>
                <div style={pacKicker(PAC.cyanLt, 14)}>ITF</div>
                <div style={{ fontSize: 64, fontWeight: 300, lineHeight: 1, color: PAC.textHi, fontVariantNumeric: 'tabular-nums' }}>#{player.ranking_itf}</div>
              </div>
            )}
          </div>
        </>)}

        {hasTitles && (<>
          <div style={divider}/>
          <div style={sectionTitle}>PALMARÉS</div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {player.titles!.slice(0, 4).map((t: any, i: number) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 16, alignItems: 'baseline' }}>
                <span style={{ fontSize: 24, fontWeight: 600, color: PAC.coralLt, fontVariantNumeric: 'tabular-nums' }}>{t.year}</span>
                <span style={{ fontSize: 22, fontWeight: 400, color: PAC.textHi, lineHeight: 1.2 }}>{t.name}</span>
              </div>
            ))}
          </div>
        </>)}

        {hasBio && (<>
          <div style={divider}/>
          <div style={sectionTitle}>BIO</div>
          <div style={{ marginTop: 10, fontSize: 20, lineHeight: 1.45, color: PAC.textMid, overflow: 'hidden', flex: 1, fontWeight: 300 }}>
            {player.bio}
          </div>
        </>)}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 8) REFEREE LOWER THIRD PACIFIC — 1240x140 centrado bottom 100
// ════════════════════════════════════════════════════════════════════════════
export function RefereeLowerThirdPacific({ visible, referee, tournament }: {
  visible: boolean, referee: { full_name: string, federacion?: string|null } | null, tournament: Tournament | null,
}) {
  if (!referee) return null
  return (
    <div style={{
      position: 'absolute', left: '50%', bottom: 100, transform: 'translateX(-50%)',
      width: 1240, height: 140,
      ...pacCard({ intensity: 'medium' }),
      borderRadius: 36, padding: 0, fontFamily: PAC_FONT,
      display: 'grid', gridTemplateColumns: '260px 1fr',
      ...animStyle(visible, 'sgInClip', 'sgOutClip', 700),
    }}>
      <div style={{
        background: GRAD_HORIZ,
        display: 'grid', placeItems: 'center',
      }}>
        <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: '.3em', textTransform: 'uppercase', color: PAC.textHi }}>ÁRBITRO</span>
      </div>
      <div style={{ padding: '0 32px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
        <span style={{ fontSize: 50, fontWeight: 500, lineHeight: .95, textTransform: 'uppercase', color: PAC.textHi, letterSpacing: '-.01em' }}>{referee.full_name}</span>
        {referee.federacion && <span style={pacKicker(PAC.cyanLt, 18)}>{referee.federacion}</span>}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 9) STATS PANEL PACIFIC — 1180 ancho centrado
// ════════════════════════════════════════════════════════════════════════════
function autoScope(match: any): 'set_1'|'set_2'|'set_3'|'match' {
  const sets = match?.score?.sets?.length ?? 0
  if (match?.status === 'finished') return 'match'
  if (sets <= 1) return 'set_1'
  if (sets === 2) return 'set_2'
  return 'set_3'
}
const SCOPE_TITLE: Record<string, string> = {
  set_1: 'PRIMER SET', set_2: 'SEGUNDO SET', set_3: 'TERCER SET', match: 'PARTIDO',
}

export function StatsPanelPacific({ visible, match, tournament, scope }: {
  visible: boolean, match: any, tournament: Tournament | null, scope: 'set_1'|'set_2'|'set_3'|'match'|'auto',
}) {
  if (!match?.stats) return null
  const pal = palette(tournament?.scoreboard_config)
  const advanced = !!tournament?.advanced_stats_enabled
  const resolvedScope = scope === 'auto' ? autoScope(match) : scope
  const s = match.stats
  const isDoubles = match.match_type === 'doubles'

  const breaksWonA = s.t1.break_points_won
  const breaksWonTotA = s.t1.break_points_played_on_return ?? 0
  const breaksWonB = s.t2.break_points_won
  const breaksWonTotB = s.t2.break_points_played_on_return ?? 0
  const breaksSavedA = s.t1.break_points_saved
  const breaksFacedA = s.t1.break_points_faced ?? 0
  const breaksSavedB = s.t2.break_points_saved
  const breaksFacedB = s.t2.break_points_faced ?? 0

  const rows: Array<{ label: string, a: number|string, b: number|string }> = [
    { label: 'Aces', a: s.t1.aces, b: s.t2.aces },
    { label: 'Dobles faltas', a: s.t1.double_faults, b: s.t2.double_faults },
    ...(advanced ? [
      { label: 'Winners', a: s.t1.winners, b: s.t2.winners },
      { label: 'Errores no forzados', a: s.t1.unforced_errors, b: s.t2.unforced_errors },
    ] : []),
    { label: '% Puntos saque', a: `${Math.round(s.t1.serve_points_won_pct||0)}%`, b: `${Math.round(s.t2.serve_points_won_pct||0)}%` },
    { label: '% Puntos resto', a: `${Math.round(s.t1.return_points_won_pct||0)}%`, b: `${Math.round(s.t2.return_points_won_pct||0)}%` },
    { label: 'Breaks ganados / total', a: `${breaksWonA}/${breaksWonTotA}`, b: `${breaksWonB}/${breaksWonTotB}` },
    { label: 'Breaks salvados / total', a: `${breaksSavedA}/${breaksFacedA}`, b: `${breaksSavedB}/${breaksFacedB}` },
    { label: 'Puntos totales', a: s.t1.total_points_won, b: s.t2.total_points_won },
  ]

  const sets = match.score?.sets ?? []
  const currentSet = match.score?.current_set
  const showCount = resolvedScope === 'set_1' ? 1 : resolvedScope === 'set_2' ? 2 : resolvedScope === 'set_3' ? 3 : Math.max(1, sets.length)
  const visibleSets: Array<{ num: number, t1: number, t2: number, isCurrent: boolean }> = []
  for (let i = 0; i < showCount; i++) {
    if (sets[i]) visibleSets.push({ num: i+1, t1: sets[i].t1, t2: sets[i].t2, isCurrent: false })
    else if (i === sets.length && currentSet && match.status === 'in_progress') {
      visibleSets.push({ num: i+1, t1: currentSet.t1 ?? 0, t2: currentSet.t2 ?? 0, isCurrent: true })
    }
  }

  return (
    <div style={{
      position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
      width: 1180, ...pacCard({ intensity: 'medium' }),
      borderRadius: 40, padding: '32px 48px', fontFamily: PAC_FONT,
      ...animStyle(visible, 'sgInZC', 'sgOutZC', 700),
    }}>
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <div style={{ fontSize: 44, fontWeight: 300, color: PAC.textHi, letterSpacing: '-.01em' }}>Estadísticas</div>
        <div style={pacKicker(PAC.coralLt, 16)}>{SCOPE_TITLE[resolvedScope] ?? ''}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 28, alignItems: 'center', marginBottom: 22 }}>
        <PacPlayerSmall entry={match.entry1} align="right" accent={pal.accentA} doubles={isDoubles}/>
        <PacScoreMini visibleSets={visibleSets}/>
        <PacPlayerSmall entry={match.entry2} align="left" accent={pal.accentB} doubles={isDoubles}/>
      </div>

      <div>
        <div style={{ height: 1, background: 'rgba(255,255,255,.10)' }}/>
        {rows.map((r, i) => <PacStatRow key={i} label={r.label} a={r.a} b={r.b}/>)}
      </div>

      <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <span style={pacKicker(PAC.coralLt, 16)}>{roundLabel(match.round)}</span>
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,.3)' }}/>
        <span style={pacKicker(PAC.textMid, 14)}>{CATEGORY_LABELS[match.category as Category] ?? match.category}</span>
      </div>
    </div>
  )
}

function PacPlayerSmall({ entry, align, doubles }: { entry: any, align: 'left'|'right', accent: string, doubles: boolean }) {
  const players = [entry?.player1, doubles ? entry?.player2 : null].filter(Boolean)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: align === 'right' ? 'flex-end' : 'flex-start' }}>
      {players.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: align === 'right' ? 'row-reverse' : 'row' }}>
          <img src={flagPath(p?.nationality)} alt="" style={{ flex: 'none', width: 50, height: 34, borderRadius: 4, objectFit: 'cover' }}/>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1, alignItems: align === 'right' ? 'flex-end' : 'flex-start' }}>
            {p?.first_name && (
              <span style={{ fontSize: players.length === 1 ? 18 : 15, fontWeight: 400, color: PAC.textMid, letterSpacing: '.02em', textTransform: 'uppercase' }}>{p.first_name}</span>
            )}
            <span style={{ fontSize: players.length === 1 ? 42 : 30, fontWeight: 500, lineHeight: .95, textTransform: 'uppercase', whiteSpace: 'nowrap', color: PAC.textHi, letterSpacing: '-.005em' }}>
              {(p?.last_name ?? '').toUpperCase()}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
function PacScoreMini({ visibleSets }: { visibleSets: Array<{ num: number, t1: number, t2: number, isCurrent: boolean }> }) {
  if (visibleSets.length === 0) return <div style={{ opacity: .3, fontSize: 26, fontWeight: 400 }}>—</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', minWidth: 200 }}>
      {visibleSets.map(s => (
        <div key={s.num} style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span style={pacKicker(PAC.textLo, 14)}>SET {s.num}</span>
          <span style={{ fontSize: 30, fontWeight: 500, color: PAC.textHi, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {s.t1}<span style={{ opacity: .35, margin: '0 10px' }}>—</span>{s.t2}
          </span>
        </div>
      ))}
    </div>
  )
}
function PacStatRow({ label, a, b }: { label: string, a: number|string, b: number|string }) {
  const numA = parseFloat(String(a).replace('%', '').split('/')[0]) || 0
  const numB = parseFloat(String(b).replace('%', '').split('/')[0]) || 0
  const aWins = numA > numB
  const bWins = numB > numA
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', alignItems: 'center', gap: 22, padding: '12px 4px' }}>
        <span style={{ fontSize: 32, fontWeight: 600, textAlign: 'right', color: aWins ? PAC.cyanLt : PAC.textMid, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{a}</span>
        <span style={pacKicker(PAC.textMid, 14)}>{label}</span>
        <span style={{ fontSize: 32, fontWeight: 600, textAlign: 'left', color: bWins ? PAC.coralLt : PAC.textMid, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{b}</span>
      </div>
      <div style={{ height: 1, background: 'rgba(255,255,255,.06)' }}/>
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 10) RESULTS GRID PACIFIC — solo fase en curso, 1680 ancho
// ════════════════════════════════════════════════════════════════════════════
function fmtSchedule(iso: string | null | undefined, courtName?: string | null) {
  if (!iso && !courtName) return '— POR CONFIRMAR —'
  const parts: string[] = []
  if (iso) {
    const d = new Date(iso)
    const day = d.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase().replace('.', '')
    const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    parts.push(day, time)
  }
  if (courtName) parts.push(courtName)
  return parts.join(' · ')
}

export function ResultsGridPacific({ visible, matches, highlightMatchId, tournament, category }: {
  visible: boolean, matches: any[], highlightMatchId?: string|null, tournament: Tournament | null, category?: string,
}) {
  const ROUND_ORDER = ['F','SF','QF','R16','R32','RR','GRP','CON','Q1','Q2']
  const cat = (category ?? matches[0]?.category) as Category | undefined
  const catMatches = cat ? matches.filter((m: any) => m.category === cat) : matches
  // Solo la fase EN CURSO
  const liveMatch = catMatches.find((m: any) => m.status === 'in_progress')
  let activeRound: string | null = null
  if (liveMatch) activeRound = liveMatch.round
  else {
    const pending = ROUND_ORDER.find(r => catMatches.some((m: any) => m.round === r && m.status !== 'finished'))
    if (pending) activeRound = pending
    else {
      const lastFinished = [...ROUND_ORDER].reverse().find(r => catMatches.some((m: any) => m.round === r))
      activeRound = lastFinished ?? null
    }
  }
  const filtered = catMatches.filter((m: any) => activeRound === null || m.round === activeRound)

  return (
    <div style={{
      position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
      width: 1680, maxHeight: 980,
      ...pacCard({ intensity: 'medium' }),
      borderRadius: 40, padding: 0, fontFamily: PAC_FONT,
      ...animStyle(visible, 'sgInZC', 'sgOutZC', 700),
    }}>
      <div style={{ padding: '24px 40px', borderBottom: '1px solid rgba(255,255,255,.10)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={pacKicker(PAC.coralLt, 14)}>Orden de juego · {ROUND_LABELS[activeRound ?? ''] ?? activeRound ?? ''}</div>
          <div style={{ fontSize: 42, fontWeight: 300, color: PAC.textHi, lineHeight: .98, letterSpacing: '-.01em', marginTop: 6 }}>
            {CATEGORY_LABELS[(category ?? matches[0]?.category) as Category] ?? tournament?.name}
          </div>
        </div>
        {tournament?.logo_url && <img src={tournament.logo_url} alt="" style={{ height: 60 }}/>}
      </div>

      <div style={{ padding: '20px 40px 30px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 28px', overflow: 'hidden' }}>
        {filtered.map((m: any) => (
          <PacResultRow key={m.id} m={m} highlight={m.id === highlightMatchId}/>
        ))}
      </div>
    </div>
  )
}

function PacResultRow({ m, highlight }: { m: any, highlight: boolean }) {
  const score = m.score as Score | null
  const isDoubles = m.match_type === 'doubles'
  const winnerTeam = score?.winner_team
  const finished = m.status === 'finished'
  const inProgress = m.status === 'in_progress'

  const teamLabel = (entry: any) => {
    if (!entry) return 'Por determinar'
    const players = [entry.player1, isDoubles ? entry.player2 : null].filter(Boolean)
    return players.map((p: any) => firstSurname(p)).filter(Boolean).join(' / ').toUpperCase()
  }
  const setsLine = (team: 1|2) => {
    if (!score || !score.sets?.length) return ''
    return score.sets.map((s: any) => team === 1 ? s.t1 : s.t2).join('  ')
  }

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center',
      padding: '10px 16px', borderRadius: 14,
      background: highlight
        ? `linear-gradient(135deg, ${hexAlpha(PAC.cyan,.18)} 0%, ${hexAlpha(PAC.coral,.18)} 100%)`
        : 'rgba(255,255,255,.04)',
      border: highlight ? `1px solid ${hexAlpha(PAC.cyan, .55)}` : '1px solid rgba(255,255,255,.10)',
    }}>
      <div>
        {[1, 2].map(tn => {
          const team = tn as 1|2
          const entry = team === 1 ? m.entry1 : m.entry2
          const isWinner = finished && winnerTeam === team
          return (
            <div key={team} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'baseline', padding: '2px 0' }}>
              <span style={{ fontSize: 22, fontWeight: isWinner ? 600 : 400, color: isWinner ? PAC.textHi : PAC.textMid, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {teamLabel(entry)}
              </span>
              <span style={{ fontSize: 22, fontWeight: 600, color: isWinner ? PAC.cyanLt : PAC.textLo, fontVariantNumeric: 'tabular-nums', letterSpacing: '.04em' }}>
                {setsLine(team)}
              </span>
            </div>
          )
        })}
      </div>
      <div style={{ textAlign: 'right' }}>
        {finished
          ? <span style={pacKicker(PAC.textLo, 12)}>FINAL</span>
          : inProgress
          ? <span style={pacKicker(PAC.coralLt, 12)}>EN JUEGO</span>
          : <span style={pacKicker(PAC.textLo, 12)}>{fmtSchedule(m.scheduled_at, m.court?.name)}</span>
        }
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 11) BRACKET VIEW PACIFIC — solo QF/SF/F (mismas dimensiones)
// ════════════════════════════════════════════════════════════════════════════
const PAC_KO = ['QF', 'SF', 'F'] as const
type PacKoRound = typeof PAC_KO[number]
const PAC_KO_LBL: Record<PacKoRound, string> = { QF: 'CUARTOS', SF: 'SEMIFINALES', F: 'FINAL' }
const PAC_KO_SLOTS: Record<PacKoRound, number> = { QF: 4, SF: 2, F: 1 }

export function BracketViewPacific({ visible, matches, highlightMatchId, tournament, category }: {
  visible: boolean, matches: any[], highlightMatchId?: string|null, tournament: Tournament | null, category?: string,
}) {
  const LC = 'rgba(255,255,255,.22)'
  const cat = (category ?? matches[0]?.category) as Category | undefined
  const catMatches = cat ? matches.filter((m: any) => m.category === cat) : matches

  const byRound: Record<string, any[]> = { QF: [], SF: [], F: [] }
  catMatches.forEach((m: any) => { if (byRound[m.round]) byRound[m.round].push(m) })
  PAC_KO.forEach(r => byRound[r].sort((a, b) => (a.match_number||0) - (b.match_number||0)))

  const visibleRounds: PacKoRound[] = ['QF', 'SF', 'F']
  const roundsData = visibleRounds.map(r => {
    const expected = PAC_KO_SLOTS[r]
    const byNum: Record<number, any> = {}
    byRound[r].forEach((m: any) => { if (m.match_number) byNum[m.match_number] = m })
    const slots: any[] = []
    for (let i = 1; i <= expected; i++) slots.push(byNum[i] ?? null)
    return { round: r, slots }
  })

  const totalRows = PAC_KO_SLOTS.QF * 2  // 8 filas
  const colTracks: string[] = []
  for (let i = 0; i < visibleRounds.length; i++) {
    if (i > 0) colTracks.push('60px')
    colTracks.push('1fr')
  }
  const gridCols = colTracks.join(' ')

  return (
    <div style={{
      position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
      width: 1760, height: 960,
      ...pacCard({ intensity: 'medium' }),
      borderRadius: 44, padding: 0, fontFamily: PAC_FONT,
      ...animStyle(visible, 'sgInZC', 'sgOutZC', 700),
    }}>
      <div style={{ padding: '22px 40px', borderBottom: '1px solid rgba(255,255,255,.10)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={pacKicker(PAC.coralLt, 16)}>CUADRO</div>
          <div style={{ fontSize: 38, fontWeight: 300, color: PAC.textHi, letterSpacing: '-.01em', marginTop: 4 }}>
            {CATEGORY_LABELS[(category ?? matches[0]?.category) as Category] ?? ''}
          </div>
        </div>
        {tournament?.logo_url && <img src={tournament.logo_url} alt="" style={{ height: 60 }}/>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: gridCols, padding: '14px 40px 0', gap: 0 }}>
        {visibleRounds.map((r, i) => (
          <React.Fragment key={r}>
            {i > 0 && <div/>}
            <div style={{ textAlign: 'center', ...pacKicker(PAC.coralLt, 16) }}>{PAC_KO_LBL[r]}</div>
          </React.Fragment>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: gridCols, gridTemplateRows: `repeat(${totalRows}, 1fr)`, height: 760, padding: '14px 40px 24px' }}>
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
                  <div key={`${round}-${i}`} style={{ gridColumn, gridRow: `${startRow}/${endRow}`, display: 'flex', alignItems: 'center', padding: '6px 0' }}>
                    <PacBracketSlot m={m} hot={m?.id === highlightMatchId} isFinal={round === 'F'}/>
                  </div>
                )
              })}
              {colIdx < roundsData.length - 1 && (
                <div style={{ gridColumn: colIdx*2 + 2, gridRow: `1/${totalRows+1}`, position: 'relative' }}>
                  {Array.from({ length: slotsCount / 2 }).map((_, p) => {
                    const i1 = p*2, i2 = p*2 + 1
                    const c1 = ((i1 + 0.5) / slotsCount) * 100
                    const c2 = ((i2 + 0.5) / slotsCount) * 100
                    const cMid = (c1 + c2) / 2
                    return (
                      <React.Fragment key={p}>
                        <div style={{ position: 'absolute', left: 0, width: '50%', top: `calc(${c1}% - 1px)`, height: 2, background: LC }}/>
                        <div style={{ position: 'absolute', left: 0, width: '50%', top: `calc(${c2}% - 1px)`, height: 2, background: LC }}/>
                        <div style={{ position: 'absolute', left: 'calc(50% - 1px)', top: `${c1}%`, height: `${c2-c1}%`, width: 2, background: LC }}/>
                        <div style={{ position: 'absolute', left: '50%', right: 0, top: `calc(${cMid}% - 1px)`, height: 2, background: LC }}/>
                      </React.Fragment>
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

function PacBracketSlot({ m, hot, isFinal = false }: { m: any, hot: boolean, isFinal?: boolean }) {
  if (!m) {
    return (
      <div style={{
        flex: 1, padding: '14px 14px', borderRadius: 14,
        background: 'rgba(255,255,255,.03)',
        border: '1px dashed rgba(255,255,255,.18)',
        textAlign: 'center',
      }}>
        <span style={pacKicker(PAC.textLo, 14)}>Por determinar</span>
      </div>
    )
  }
  const score = m.score as Score | null
  const isDoubles = m.match_type === 'doubles'
  return (
    <div style={{
      flex: 1, padding: '10px 14px', borderRadius: 14,
      background: hot
        ? `linear-gradient(135deg, ${hexAlpha(PAC.cyan,.22)} 0%, ${hexAlpha(PAC.coral,.22)} 100%)`
        : isFinal ? hexAlpha(PAC.coral, .12) : 'rgba(255,255,255,.04)',
      border: hot
        ? `1.5px solid ${hexAlpha(PAC.cyan, .60)}`
        : isFinal ? `1px solid ${hexAlpha(PAC.coral, .50)}` : '1px solid rgba(255,255,255,.10)',
    }}>
      <PacBracketLine entry={m.entry1} score={score} team={1} isDoubles={isDoubles}/>
      <div style={{ height: 1, background: 'rgba(255,255,255,.10)', margin: '4px 0' }}/>
      <PacBracketLine entry={m.entry2} score={score} team={2} isDoubles={isDoubles}/>
    </div>
  )
}
function PacBracketLine({ entry, score, team, isDoubles }: { entry: any, score: Score|null, team: 1|2, isDoubles: boolean }) {
  if (!entry) return <div style={{ padding: '4px 0', fontSize: 18, color: PAC.textLo }}>—</div>
  const players = [entry?.player1, isDoubles ? entry?.player2 : null].filter(Boolean)
  const sets = threeSetsFor(score, team)
  const winner = (score?.winner_team ?? null) === team
  const nameStr = isDoubles
    ? players.map((p: any) => firstSurname(p)).filter(Boolean).join(' / ')
    : (players[0]?.last_name ?? '')
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', alignItems: 'center', gap: 8 }}>
      <span style={{
        fontSize: 18, fontWeight: winner ? 600 : 400,
        color: winner ? PAC.textHi : PAC.textMid,
        textTransform: 'uppercase', letterSpacing: '-.005em',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {nameStr.toUpperCase()}
      </span>
      {sets.map((v, i) => (
        <span key={i} style={{ minWidth: 18, textAlign: 'center', fontSize: 18, fontWeight: 600, color: winner ? PAC.cyanLt : PAC.textLo, fontVariantNumeric: 'tabular-nums' }}>
          {v == null ? '' : v}
        </span>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 12) COIN TOSS PACIFIC
// ════════════════════════════════════════════════════════════════════════════
export function CoinTossPacific({ visible, match, tournament }: { visible: boolean, match: any, tournament: Tournament | null }) {
  if (!match) return null
  const winnerTeam = match.toss_winner_team as 1|2|null
  const choice = match.toss_choice as 'serve'|'receive'|'side'|null
  const won = winnerTeam ? (winnerTeam === 1 ? match.entry1 : match.entry2) : null
  const players = won ? [won.player1, match.match_type === 'doubles' ? won.player2 : null].filter(Boolean) : []
  const choiceText = choice === 'serve' ? 'SACAR' : choice === 'receive' ? 'RESTAR' : choice === 'side' ? 'ELEGIR LADO' : ''

  return (
    <div style={{
      position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
      width: 'fit-content', minWidth: 800,
      ...pacCard({ intensity: 'medium' }),
      borderRadius: 44, padding: '50px 64px', fontFamily: PAC_FONT,
      textAlign: 'center',
      ...animStyle(visible, 'sgInZC', 'sgOutZC', 700),
    }}>
      <div style={{ ...pacKicker(PAC.coralLt, 18), marginBottom: 20 }}>SORTEO</div>
      <div style={{ fontSize: 36, fontWeight: 300, color: PAC.textMid, marginBottom: 14 }}>Gana el sorteo</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 28 }}>
        {players.map((p: any, i: number) => (
          <div key={i} style={{ fontSize: 56, fontWeight: 500, lineHeight: 1, color: PAC.textHi, textTransform: 'uppercase', whiteSpace: 'nowrap', letterSpacing: '-.01em' }}>
            <span style={{ fontWeight: 300, color: PAC.textMid }}>{(p?.first_name ?? '')} </span>
            {(p?.last_name ?? '').toUpperCase()}
          </div>
        ))}
      </div>
      {choiceText && (<>
        <div style={{ ...pacKicker(PAC.coralLt, 16), marginBottom: 12 }}>Y ELIGE</div>
        <div style={{
          ...pacPill(),
          display: 'inline-block', padding: '14px 40px',
          fontSize: 50, fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase', color: PAC.textHi,
        }}>
          {choiceText}
        </div>
      </>)}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 13) AWARDS PODIUM PACIFIC — 1400x720 centrado
// ════════════════════════════════════════════════════════════════════════════
export function AwardsPodiumPacific({ visible, data, tournament }: {
  visible: boolean, data: any, tournament: Tournament | null,
}) {
  if (!data) return null
  const champion = data.champion as { name: string, photo_url?: string|null } | null
  const finalist = data.finalist as { name: string, photo_url?: string|null } | null
  return (
    <div style={{
      position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
      width: 1400, height: 720,
      ...pacCard({ intensity: 'medium' }),
      borderRadius: 48, padding: '50px 60px', fontFamily: PAC_FONT,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32, textAlign: 'center',
      ...animStyle(visible, 'sgInZC', 'sgOutZC', 750),
    }}>
      <div style={pacKicker(PAC.coralLt, 18)}>PODIO</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'end', width: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ ...pacKicker(PAC.textLo, 14), marginBottom: 10 }}>FINALISTA</div>
          {finalist?.photo_url && (
            <div style={{
              width: 200, height: 200, margin: '0 auto 16px',
              borderRadius: '46% 54% 50% 50% / 50% 46% 54% 50%',
              overflow: 'hidden', border: `2px solid ${hexAlpha(PAC.cyan, .55)}`,
            }}>
              <img src={finalist.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
            </div>
          )}
          <div style={{ fontSize: 44, fontWeight: 400, lineHeight: .98, textTransform: 'uppercase', color: PAC.textHi, letterSpacing: '-.01em' }}>{finalist?.name}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ ...pacKicker(PAC.coralLt, 18), marginBottom: 10 }}>🏆 CAMPEÓN</div>
          {champion?.photo_url && (
            <div style={{
              width: 240, height: 240, margin: '0 auto 16px',
              borderRadius: '46% 54% 50% 50% / 50% 46% 54% 50%',
              overflow: 'hidden',
              border: `3px solid ${PAC.coralLt}`,
              boxShadow: `0 0 50px ${hexAlpha(PAC.coral, .55)}`,
            }}>
              <img src={champion.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
            </div>
          )}
          <div style={{ fontSize: 56, fontWeight: 500, lineHeight: .98, textTransform: 'uppercase', color: PAC.textHi, letterSpacing: '-.015em' }}>{champion?.name}</div>
        </div>
      </div>

      <div style={pacKicker(PAC.textLo, 16)}>{tournament?.name}</div>
    </div>
  )
}
