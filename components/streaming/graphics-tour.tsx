'use client'
// ============================================================================
// Streaming Graphics — TOUR skin
// ============================================================================
// Lenguaje visual inspirado en transmisiones WTA Tour (Qatar, Indian Wells,
// Madrid Open) PERO con la paleta del torneo (rojo Vinteon por defecto, viene
// de tournament.scoreboard_config.colors).
//
// Diseño: cajas compactas navy con tabs/pills, tipografia limpia, accent
// reservado para datos clave (winners, serving, current set, breaks).
//
// Todas las dimensiones / posiciones replican el grafico clasico equivalente
// (intro 1400x720, big_scoreboard centrado bottom 50, scorebug top-left etc.)
// para que se pueda intercambiar el skin sin re-rigging en vMix.
// ============================================================================

import React, { useEffect, useState } from 'react'
import type { Player, Score, Sponsor, Tournament, WeatherData, Category } from '@/types'
import { CATEGORY_LABELS } from '@/types'
import { animStyle, hexAlpha, flagPath, palette, firstSurname } from './stage-shared'

// ─── ETIQUETAS / HELPERS ────────────────────────────────────────────────────
const ROUND_LABELS: Record<string, string> = {
  F: 'FINAL', SF: 'SEMIFINAL', QF: 'CUARTOS DE FINAL', R16: 'OCTAVOS DE FINAL',
  R32: 'DIECISEISAVOS', RR: 'FASE DE GRUPOS', GRP: 'FASE DE GRUPOS', CON: 'CONSOLACIÓN',
  Q1: 'CLASIFICATORIA 1', Q2: 'CLASIFICATORIA 2',
}
const roundLabel = (r: any): string => ROUND_LABELS[r ?? ''] ?? (r ?? '')

const PTS = ['0','15','30','40']
function gamePoint(score: Score | null, team: 1|2): string {
  if (!score) return '0'
  const k = team===1 ? 't1' : 't2'
  if (score.super_tiebreak_active || score.tiebreak_active) return String(score.tiebreak_score?.[k] ?? 0)
  if (score.deuce) return '40'
  return PTS[score.current_game?.[k] ?? 0] ?? '0'
}
function threeSetsFor(score: Score | null, team: 1|2): Array<number|null> {
  const out: Array<number|null> = [null, null, null]
  if (!score) return out
  const k = team===1 ? 't1' : 't2'
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

// ─── ESTILO BASE TOUR ───────────────────────────────────────────────────────
// Card navy-gradient compacta + sombra suave. Sirve para todos los graficos.
function tourCard(): React.CSSProperties {
  return {
    background: 'linear-gradient(180deg, #1c2438 0%, #0d1322 100%)',
    border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 10,
    boxShadow: '0 16px 40px rgba(0,0,0,.55)',
    overflow: 'hidden',
  }
}
const TOUR_FONT = "'Roboto Condensed', 'Barlow Condensed', system-ui, sans-serif"

// ─── KICKER (etiqueta uppercase + letterspacing pequeña) ────────────────────
const tourKicker = (color: string, size: number = 14): React.CSSProperties => ({
  fontSize: size, letterSpacing: '.28em', textTransform: 'uppercase',
  fontWeight: 700, color,
})

// ════════════════════════════════════════════════════════════════════════════
// 1) SCOREBUG TOUR — top-left (mismas dimensiones que classic)
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

export function ScorebugTour({ visible, match, tournament, tickerStat }: {
  visible: boolean, match: any, tournament: Tournament | null, tickerStat?: string | null,
}) {
  if (!match) return null
  const pal = palette(tournament?.scoreboard_config)
  const score = match.score as Score | null
  const isDoubles = match.match_type === 'doubles'
  const serving = match.serving_team as 1|2|null
  const inProgress = score?.match_status === 'in_progress'
  const setsPlayed = score?.sets?.length ?? 0
  const setCount = Math.max(1, Math.min(3, setsPlayed + (inProgress ? 1 : 0)))
  const currentSetIdx = inProgress ? setsPlayed : -1
  const tbActive = !!(score?.tiebreak_active || score?.super_tiebreak_active)
  const showTicker = !!tickerStat && !!match.stats
  const tickerLabel = tickerStat ? (STAT_LABELS[tickerStat] ?? tickerStat.toUpperCase()) : ''

  // Mismo posicionamiento que classic (top-left, padding 40)
  return (
    <div style={{
      position: 'absolute', top: 40, left: 40,
      ...animStyle(visible, 'sgInR', 'sgOutR', 500),
    }}>
      <div style={{ ...tourCard(), padding: 0, fontFamily: TOUR_FONT }}>
        {/* Accent strip top */}
        <div style={{ height: 3, background: `linear-gradient(90deg, ${pal.accentA} 0%, ${pal.accentB} 100%)` }}/>

        <table style={{ borderCollapse: 'separate', borderSpacing: 0, margin: 6 }}>
          <tbody>
            {[1,2].map(tn => {
              const team = tn as 1|2
              const entry = team === 1 ? match.entry1 : match.entry2
              const accent = team === 1 ? pal.accentA : pal.accentB
              const players = [entry?.player1, isDoubles ? entry?.player2 : null].filter(Boolean)
              const sets = threeSetsFor(score, team).slice(0, setCount)
              const pt = gamePoint(score, team)
              const isServe = serving === team
              const tickerVal = showTicker ? statValue(match.stats, tickerStat!, team) : ''

              const nameStr = isDoubles
                ? players.map((p:any) => firstSurname(p).toUpperCase()).join(' / ')
                : (players[0]?.last_name ?? '').toUpperCase()
              const initials = isDoubles
                ? players.map((p:any) => (p?.first_name?.[0] ?? '').toUpperCase() + '.').join(' ')
                : (players[0]?.first_name?.[0] ?? '').toUpperCase() + '.'

              return (
                <tr key={team} style={{ borderTop: tn === 2 ? '1px solid rgba(255,255,255,.06)' : undefined }}>
                  {/* Serve dot */}
                  <td style={{ width: 18, padding: '6px 0 6px 8px' }}>
                    {isServe && (
                      <span style={{
                        display: 'block', width: 11, height: 11, borderRadius: '50%',
                        background: pal.serve, boxShadow: `0 0 10px ${pal.serve}`,
                        animation: 'sgSrvPulse 1.4s infinite',
                      }}/>
                    )}
                  </td>
                  {/* Flag */}
                  <td style={{ padding: '6px 0' }}>
                    {isDoubles ? (
                      <div style={{ display: 'flex', gap: 2 }}>
                        {players.map((p:any, i:number) => (
                          <img key={i} src={flagPath(p?.nationality)} alt="" style={{ width: 22, height: 15, borderRadius: 2, objectFit: 'cover' }}/>
                        ))}
                      </div>
                    ) : (
                      <img src={flagPath(players[0]?.nationality)} alt="" style={{ width: 26, height: 17, borderRadius: 2, objectFit: 'cover' }}/>
                    )}
                  </td>
                  {/* Name */}
                  <td style={{ padding: '6px 14px 6px 10px', minWidth: 220 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap' }}>
                      <span style={{ color: 'rgba(255,255,255,.55)', fontSize: 16, fontWeight: 500, letterSpacing: '.03em' }}>{initials}</span>
                      <span style={{ color: '#fff', fontSize: 22, fontWeight: 700, letterSpacing: '.005em', textTransform: 'uppercase' }}>{nameStr}</span>
                      {entry?.seed && <span style={{ color: 'rgba(255,255,255,.45)', fontSize: 13, fontWeight: 600, marginLeft: 2 }}>({entry.seed})</span>}
                    </div>
                  </td>
                  {/* Set tabs */}
                  {sets.map((v, i) => {
                    const opSets = threeSetsFor(score, team === 1 ? 2 : 1)
                    const isWonSet = i < setsPlayed && v != null && opSets[i] != null && (v as number) > (opSets[i] as number)
                    const isCurrent = i === currentSetIdx
                    const bg = isWonSet
                      ? hexAlpha(accent, .9)
                      : isCurrent ? hexAlpha(accent, .22) : 'rgba(255,255,255,.06)'
                    const border = isCurrent && !isWonSet ? `1px solid ${accent}` : `1px solid rgba(255,255,255,.10)`
                    const color = '#fff'
                    return (
                      <td key={i} style={{ padding: '6px 2px' }}>
                        <div style={{
                          width: 34, height: 30, display: 'grid', placeItems: 'center',
                          background: bg, border, borderRadius: 5,
                          color, fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
                        }}>
                          {v === null ? '' : v}
                        </div>
                      </td>
                    )
                  })}
                  {/* Points / Ticker stat */}
                  <td style={{ padding: '6px 8px 6px 4px' }}>
                    <div style={{
                      minWidth: 50, height: 30, padding: '0 8px', display: 'grid', placeItems: 'center',
                      background: showTicker
                        ? 'rgba(255,255,255,.08)'
                        : tbActive ? '#fbbf24' : accent,
                      borderRadius: 5,
                      color: showTicker ? accent : tbActive ? '#1f1200' : '#fff',
                      fontSize: 18, fontWeight: 900, fontVariantNumeric: 'tabular-nums',
                      whiteSpace: 'nowrap',
                    }}>
                      {showTicker ? tickerVal : pt}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Ticker label pill */}
        {showTicker && (
          <div style={{
            background: 'rgba(0,0,0,.25)', borderTop: '1px solid rgba(255,255,255,.06)',
            padding: '4px 12px', textAlign: 'right',
          }}>
            <span style={tourKicker(pal.accentA, 12)}>{tickerLabel}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 2) BIG SCOREBOARD TOUR — barra horizontal centrada bottom 50 (full width)
// ════════════════════════════════════════════════════════════════════════════
export function BigScoreboardTour({ visible, match, tournament, sponsor, opts }: {
  visible: boolean, match: any, tournament: Tournament | null, sponsor?: Sponsor | null, opts?: any,
}) {
  if (!match) return null
  const pal = palette(tournament?.scoreboard_config)
  const score = match.score as Score | null
  const isDoubles = match.match_type === 'doubles'
  const totalSecs = useTicker(match.started_at, match.finished_at)
  const setCount = Math.max(1, Math.min(3, (score?.sets?.length ?? 0) + (score?.match_status === 'in_progress' ? 1 : 0)))
  const showSponsor = opts?.show_sponsor !== false && !!sponsor
  const serving = match.serving_team as 1|2|null
  const setColW = 100  // mismo ancho que classic
  const cardMaxW = showSponsor ? 1420 : 1060

  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 50, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{
        width: 'fit-content', maxWidth: cardMaxW,
        ...tourCard(), pointerEvents: 'auto', fontFamily: TOUR_FONT,
        ...animStyle(visible, 'sgInU', 'sgOutU', 700),
      }}>
        {/* Accent strip top */}
        <div style={{ height: 4, background: `linear-gradient(90deg, ${pal.accentA} 0%, ${pal.accentB} 100%)` }}/>

        {/* HEADER */}
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', padding: '14px 26px', borderBottom: '1px solid rgba(255,255,255,.07)', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {tournament?.logo_url && <img src={tournament.logo_url} alt="" style={{ height: 52, objectFit: 'contain' }}/>}
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
              <span style={{ fontSize: 24, fontWeight: 900, letterSpacing: '.02em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{tournament?.name}</span>
              <span style={tourKicker('rgba(255,255,255,.65)', 16)}>{CATEGORY_LABELS[match.category as Category] ?? match.category}</span>
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <span style={{
              padding: '6px 18px', borderRadius: 4,
              background: hexAlpha(pal.accentA, .15), border: `1px solid ${hexAlpha(pal.accentA, .55)}`,
              fontSize: 18, fontWeight: 900, letterSpacing: '.18em', textTransform: 'uppercase', color: pal.accentA, whiteSpace: 'nowrap',
            }}>
              {roundLabel(match.round) || '—'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.05 }}>
            <span style={tourKicker('rgba(255,255,255,.55)', 14)}>TIEMPO TOTAL</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 800, letterSpacing: '.02em', marginTop: 4 }}>{fmtHHmm(totalSecs)}</span>
          </div>
        </div>

        {/* BODY */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: showSponsor
            ? `12px minmax(360px, max-content) repeat(${setCount}, ${setColW}px) 260px`
            : `12px minmax(360px, max-content) repeat(${setCount}, ${setColW}px)`,
          gridTemplateRows: '34px 1fr 1fr',
        }}>
          {/* Set headers */}
          <div style={{ gridColumn: '1 / span 2', gridRow: 1, borderBottom: '1px solid rgba(255,255,255,.05)', background: 'rgba(0,0,0,.18)' }}/>
          {Array.from({ length: setCount }).map((_, i) => {
            const dur = opts?.set_durations?.[i]
            return (
              <div key={`st${i}`} style={{
                gridColumn: 3 + i, gridRow: 1, display: 'grid', placeItems: 'center',
                fontSize: 14, letterSpacing: '.22em', fontWeight: 800, color: 'rgba(255,255,255,.65)',
                textTransform: 'uppercase', borderLeft: '1px solid rgba(255,255,255,.05)', borderBottom: '1px solid rgba(255,255,255,.05)',
                background: 'rgba(0,0,0,.18)',
              }}>
                SET {i+1}{dur ? ` · ${fmtClock(dur)}` : ''}
              </div>
            )
          })}

          {/* TEAM ROWS */}
          {[1,2].map(tn => {
            const team = tn as 1|2
            const entry = team === 1 ? match.entry1 : match.entry2
            const accent = team === 1 ? pal.accentA : pal.accentB
            const sets = threeSetsFor(score, team).slice(0, setCount)
            const won = match.status === 'finished' && score?.winner_team === team
            const players = [entry?.player1, isDoubles ? entry?.player2 : null].filter(Boolean)
            const isServingTeam = serving === team
            const row = 1 + team
            const rowBg = won ? hexAlpha(accent, .14) : isServingTeam ? hexAlpha(accent, .06) : 'transparent'
            return (
              <div key={team} style={{ display: 'contents' }}>
                {/* Accent bar */}
                <div style={{ gridColumn: 1, gridRow: row, background: accent }}/>
                {/* Names */}
                <div style={{
                  gridColumn: 2, gridRow: row,
                  display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: isDoubles ? 6 : 4,
                  padding: '14px 24px', background: rowBg,
                  borderTop: team === 2 ? '1px solid rgba(255,255,255,.06)' : 'none',
                }}>
                  {players.map((p: any, i: number) => {
                    const isServer = isServingTeam && (!isDoubles || p.id === match.current_server_id)
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, whiteSpace: 'nowrap' }}>
                        <img src={flagPath(p.nationality)} alt="" style={{
                          flex: 'none',
                          width: isDoubles ? 42 : 54, height: isDoubles ? 28 : 36,
                          borderRadius: 3, objectFit: 'cover',
                        }}/>
                        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
                          {p.first_name && (
                            <span style={{ fontSize: isDoubles ? 20 : 24, fontWeight: 600, letterSpacing: '.02em', textTransform: 'uppercase', color: 'rgba(255,255,255,.78)' }}>
                              {p.first_name.toUpperCase()}
                            </span>
                          )}
                          <span style={{ fontSize: isDoubles ? 36 : 48, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-.005em', color: '#fff', marginTop: p.first_name ? 2 : 0 }}>
                            {(p.last_name ?? '').toUpperCase()}
                          </span>
                        </div>
                        {isServer && (
                          <span style={{
                            flex: 'none', width: 22, height: 22, borderRadius: '50%', background: pal.serve,
                            boxShadow: `0 0 18px ${pal.serve}`, animation: 'sgSrvPulse 1.3s infinite', marginLeft: 6,
                          }}/>
                        )}
                      </div>
                    )
                  })}
                </div>
                {/* Set scores */}
                {sets.map((v, i) => {
                  const isCurrent = (score?.sets?.length ?? 0) === i
                  const isWonSet = i < (score?.sets?.length ?? 0) && v != null && (sets[i] as number) > (threeSetsFor(score, team === 1 ? 2 : 1)[i] as number ?? -1)
                  return (
                    <div key={i} style={{
                      gridColumn: 3 + i, gridRow: row, display: 'grid', placeItems: 'center',
                      fontSize: 60, fontWeight: 900,
                      borderLeft: '1px solid rgba(255,255,255,.05)',
                      borderTop: team === 2 ? '1px solid rgba(255,255,255,.06)' : 'none',
                      background: isWonSet ? hexAlpha(accent, .85) : isCurrent ? hexAlpha(accent, .14) : 'rgba(0,0,0,.18)',
                      color: v === null ? 'rgba(255,255,255,.3)' : '#fff',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {v === null ? '–' : v}
                    </div>
                  )
                })}
              </div>
            )
          })}

          {/* SPONSOR */}
          {showSponsor && (
            <div style={{
              gridColumn: 3 + setCount, gridRow: '1 / 4',
              borderLeft: '1px solid rgba(255,255,255,.08)',
              background: 'rgba(255,255,255,.02)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16,
            }}>
              <div style={tourKicker('rgba(255,255,255,.55)', 14)}>Patrocinador oficial</div>
              <div style={{ flex: 1, display: 'grid', placeItems: 'center', width: '100%', marginTop: 10 }}>
                {sponsor?.logo_url
                  ? <img src={sponsor.logo_url} alt={sponsor?.name} style={{ maxWidth: 220, maxHeight: 130, objectFit: 'contain' }}/>
                  : <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: '.06em', textAlign: 'center', textTransform: 'uppercase' }}>{sponsor?.name ?? ''}</span>
                }
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 3) WEATHER BAR TOUR — bottom-right pequeño, formato pill horizontal
// ════════════════════════════════════════════════════════════════════════════
export function WeatherBarTour({ visible, weather, tournament }: {
  visible: boolean, weather: WeatherData | null, tournament: Tournament | null,
}) {
  if (!weather) return null
  const pal = palette(tournament?.scoreboard_config)
  const ICONS: Record<string, string> = {
    clear: '☀️', cloudy: '⛅', rain: '🌧', snow: '❄️', fog: '🌫', storm: '⛈',
  }
  const icon = ICONS[weather.condition] ?? '☀️'
  return (
    <div style={{
      position: 'absolute', right: 90, bottom: 90,
      ...tourCard(), padding: '14px 22px', fontFamily: TOUR_FONT,
      display: 'flex', alignItems: 'center', gap: 18,
      borderLeft: `4px solid ${pal.accentA}`,
      ...animStyle(visible, 'sgInL', 'sgOutL', 650),
    }}>
      <span style={{ fontSize: 40 }}>{icon}</span>
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
        <span style={tourKicker('rgba(255,255,255,.55)', 12)}>{tournament?.venue_city ?? 'AHORA'}</span>
        <span style={{ fontSize: 36, fontWeight: 900, color: '#fff', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
          {Math.round(weather.temperature_c)}°
          <span style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,.6)', marginLeft: 8 }}>
            {weather.humidity_pct}% HR · {Math.round(weather.wind_speed_kmh)} km/h
          </span>
        </span>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 4) TOURNAMENT INTRO TOUR — 1400x720 centrado (mismas dimensiones)
// ════════════════════════════════════════════════════════════════════════════
export function TournamentIntroTour({ visible, tournament }: { visible: boolean, tournament: Tournament | null }) {
  if (!tournament) return null
  const pal = palette(tournament.scoreboard_config)
  const start = new Date(tournament.start_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
  const end = new Date(tournament.end_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
  const subtitle = [tournament.venue_name, tournament.venue_city, `${start} — ${end}`].filter(Boolean).join('  ·  ')

  return (
    <div style={{
      position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
      width: 1400, height: 720, ...tourCard(), padding: '60px 80px', fontFamily: TOUR_FONT,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 36, textAlign: 'center',
      ...animStyle(visible, 'sgInZC', 'sgOutZC', 750),
    }}>
      {/* Top accent line */}
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: 200, height: 5, background: pal.accentA, borderRadius: '0 0 4px 4px',
      }}/>

      {tournament.logo_url && (
        <img src={tournament.logo_url} alt="" style={{ maxWidth: 320, maxHeight: 280, objectFit: 'contain' }}/>
      )}
      <div style={{ fontSize: 120, fontWeight: 900, lineHeight: .9, letterSpacing: '-.012em', textTransform: 'uppercase', color: '#fff' }}>
        {tournament.name}
      </div>
      <div style={tourKicker(pal.accentA, 30)}>{subtitle}</div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 5) VENUE CARD TOUR — 560 ancho, bottom-right
// ════════════════════════════════════════════════════════════════════════════
export function VenueCardTour({ visible, tournament }: { visible: boolean, tournament: Tournament | null }) {
  if (!tournament) return null
  const pal = palette(tournament.scoreboard_config)
  return (
    <div style={{
      position: 'absolute', right: 90, bottom: 90, width: 560,
      ...tourCard(), padding: '22px 30px', fontFamily: TOUR_FONT,
      borderLeft: `5px solid ${pal.accentA}`,
      ...animStyle(visible, 'sgInL', 'sgOutL', 650),
    }}>
      <div style={tourKicker('rgba(255,255,255,.55)', 18)}>SEDE</div>
      <div style={{ marginTop: 6, fontSize: 42, fontWeight: 900, lineHeight: .95, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#fff' }}>
        {tournament.venue_name || tournament.venue_city}
      </div>
      <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', color: pal.accentA, lineHeight: 1 }}>
        {tournament.venue_city}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 6) MATCH PRESENTATION TOUR — fullscreen rectangle (left 170 right 170)
// ════════════════════════════════════════════════════════════════════════════
export function MatchPresentationTour({ visible, match, tournament }: {
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
      ...tourCard(), padding: 0, fontFamily: TOUR_FONT,
      display: 'flex', flexDirection: 'column',
      ...animStyle(visible, 'sgInZ', 'sgOutZ', 750),
    }}>
      {/* Accent strip top */}
      <div style={{ height: 5, background: `linear-gradient(90deg, ${pal.accentA} 0%, ${pal.accentB} 100%)` }}/>

      {/* HEADER tournament name */}
      <div style={{ padding: '34px 60px 28px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 40, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        {tournament?.logo_url && <img src={tournament.logo_url} alt="" style={{ height: 120, width: 120, objectFit: 'contain', flex: 'none' }}/>}
        <div style={{ fontSize: 70, fontWeight: 900, lineHeight: .95, letterSpacing: '-.005em', textTransform: 'uppercase', color: '#fff', textAlign: 'center', maxWidth: 1120 }}>
          {tournament?.name}
        </div>
      </div>

      {/* PHASE pill */}
      {pillText && (
        <div style={{ textAlign: 'center', padding: '22px 0 10px' }}>
          <span style={{
            display: 'inline-block', padding: '12px 44px', borderRadius: 6,
            background: hexAlpha(pal.accentA, .14), border: `1.5px solid ${hexAlpha(pal.accentA, .55)}`,
            fontSize: 28, fontWeight: 900, letterSpacing: '.2em', textTransform: 'uppercase', color: pal.accentA,
          }}>
            {pillText}
          </span>
        </div>
      )}

      {/* TEAMS */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 280px 1fr', alignItems: 'center', padding: '10px 40px 36px' }}>
        <TourTeamBlock entry={match.entry1} accent={pal.accentA} align="right" isDoubles={isDoubles}/>
        <div style={{ display: 'grid', placeItems: 'center' }}>
          <div style={{
            fontSize: 230, fontWeight: 900, lineHeight: .82, letterSpacing: '-.04em',
            background: `linear-gradient(180deg, ${pal.accentA} 0%, ${pal.accentB} 100%)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>VS</div>
        </div>
        <TourTeamBlock entry={match.entry2} accent={pal.accentB} align="left" isDoubles={isDoubles}/>
      </div>
    </div>
  )
}

function TourTeamBlock({ entry, accent, align, isDoubles }: { entry: any, accent: string, align: 'left'|'right', isDoubles: boolean }) {
  const players = [entry?.player1, isDoubles ? entry?.player2 : null].filter(Boolean)
  const hasAnyPhoto = players.some((p: any) => !!p?.photo_url)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: align === 'right' ? 'flex-end' : 'flex-start', justifyContent: 'center', gap: 24, padding: '0 32px' }}>
      {hasAnyPhoto && (
        <div style={{ display: 'flex', gap: 22, flexDirection: align === 'right' ? 'row-reverse' : 'row' }}>
          {players.map((p: any, i: number) => p?.photo_url && (
            <div key={i} style={{
              width: isDoubles ? 160 : 210, height: isDoubles ? 160 : 210,
              borderRadius: 8, overflow: 'hidden', border: `2px solid ${hexAlpha(accent, .55)}`,
            }}>
              <img src={p.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: align === 'right' ? 'flex-end' : 'flex-start' }}>
        {players.map((p: any, i: number) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 18, flexDirection: align === 'right' ? 'row-reverse' : 'row' }}>
            <img src={flagPath(p?.nationality)} alt="" style={{ flex: 'none', width: 72, height: 48, borderRadius: 4, objectFit: 'cover' }}/>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: align === 'right' ? 'flex-end' : 'flex-start', lineHeight: 1 }}>
              {p?.first_name && (
                <span style={{ fontSize: players.length === 1 ? 30 : 22, fontWeight: 600, letterSpacing: '.02em', opacity: .8, textTransform: 'uppercase' }}>{p.first_name}</span>
              )}
              <span style={{ fontSize: players.length === 1 ? 78 : 54, fontWeight: 900, lineHeight: .92, textTransform: 'uppercase', whiteSpace: 'nowrap', color: accent }}>
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
// 7) PLAYER BIO TOUR — 740 ancho, lateral (mismas dimensiones que classic)
// ════════════════════════════════════════════════════════════════════════════
export function PlayerBioTour({ visible, player, team, category, tournament }: {
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

  const sectionTitle: React.CSSProperties = { fontSize: 18, letterSpacing: '.34em', textTransform: 'uppercase', fontWeight: 800, color: accent }
  const divider: React.CSSProperties = { height: 1, background: 'rgba(255,255,255,.08)', margin: '22px 0' }

  return (
    <div style={{
      ...pos, ...tourCard(), padding: 0, fontFamily: TOUR_FONT,
      display: 'flex', flexDirection: 'column',
      ...animStyle(visible, enter, exit, 700),
    } as any}>
      {/* Side accent strip */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0, [side === 'left' ? 'left' : 'right']: 0,
        width: 6, background: accent,
      }}/>

      <div style={{ padding: '30px 36px 26px', display: 'flex', gap: 24, alignItems: 'center' }}>
        {hasPhoto && (
          <div style={{ flex: 'none', width: 240, height: 240, borderRadius: 10, overflow: 'hidden', border: `2px solid ${hexAlpha(accent, .55)}` }}>
            <img src={player.photo_url!} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: 20 }}>
          <img src={flagPath(player.nationality)} alt="" style={{ flex: 'none', width: 96, height: 64, borderRadius: 4, objectFit: 'cover' }}/>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: '.02em', textTransform: 'uppercase', lineHeight: 1, color: 'rgba(255,255,255,.78)' }}>
              {player.first_name}
            </div>
            <div style={{ fontSize: 78, fontWeight: 900, lineHeight: .92, textTransform: 'uppercase', color: '#fff', letterSpacing: '-.005em' }}>
              {player.last_name}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 36px 30px', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        {ficha.length > 0 && (<>
          <div style={divider}/>
          <div style={sectionTitle}>FICHA</div>
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 30px' }}>
            {ficha.map(([k, v]) => (
              <div key={k}>
                <div style={tourKicker('rgba(255,255,255,.55)', 16)}>{k}</div>
                <div style={{ fontSize: 32, fontWeight: 800, marginTop: 3, lineHeight: 1.05, color: '#fff' }}>{v}</div>
              </div>
            ))}
          </div>
        </>)}

        {hasRanking && (<>
          <div style={divider}/>
          <div style={sectionTitle}>RANKING</div>
          <div style={{ marginTop: 14, display: 'flex', gap: 22 }}>
            {player.ranking_rfet && (
              <div style={{ flex: 1, background: hexAlpha(accent, .12), border: `1px solid ${hexAlpha(accent, .4)}`, borderRadius: 8, padding: '16px 22px' }}>
                <div style={tourKicker(accent, 18)}>RFET</div>
                <div style={{ fontSize: 76, fontWeight: 900, lineHeight: 1, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>#{player.ranking_rfet}</div>
              </div>
            )}
            {player.ranking_itf && (
              <div style={{ flex: 1, background: hexAlpha(accent, .12), border: `1px solid ${hexAlpha(accent, .4)}`, borderRadius: 8, padding: '16px 22px' }}>
                <div style={tourKicker(accent, 18)}>ITF</div>
                <div style={{ fontSize: 76, fontWeight: 900, lineHeight: 1, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>#{player.ranking_itf}</div>
              </div>
            )}
          </div>
        </>)}

        {hasTitles && (<>
          <div style={divider}/>
          <div style={sectionTitle}>PALMARÉS</div>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {player.titles!.slice(0, 4).map((t: any, i: number) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 18, alignItems: 'baseline' }}>
                <span style={{ fontSize: 28, fontWeight: 900, color: accent, fontVariantNumeric: 'tabular-nums' }}>{t.year}</span>
                <span style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.15 }}>{t.name}</span>
              </div>
            ))}
          </div>
        </>)}

        {hasBio && (<>
          <div style={divider}/>
          <div style={sectionTitle}>BIO</div>
          <div style={{ marginTop: 12, fontSize: 22, lineHeight: 1.4, color: 'rgba(255,255,255,.88)', overflow: 'hidden', flex: 1 }}>
            {player.bio}
          </div>
        </>)}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 8) REFEREE LOWER THIRD TOUR — 1240x140, bottom 100, centrado
// ════════════════════════════════════════════════════════════════════════════
export function RefereeLowerThirdTour({ visible, referee, tournament }: {
  visible: boolean, referee: { full_name: string, federacion?: string|null } | null, tournament: Tournament | null,
}) {
  if (!referee) return null
  const pal = palette(tournament?.scoreboard_config)
  return (
    <div style={{
      position: 'absolute', left: '50%', bottom: 100, transform: 'translateX(-50%)',
      width: 1240, height: 140, ...tourCard(), padding: 0, fontFamily: TOUR_FONT,
      display: 'grid', gridTemplateColumns: '260px 1fr',
      ...animStyle(visible, 'sgInClip', 'sgOutClip', 700),
    }}>
      <div style={{ background: `linear-gradient(135deg, ${pal.accentA} 0%, ${pal.accentB} 100%)`, display: 'grid', placeItems: 'center' }}>
        <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: '.3em', textTransform: 'uppercase', color: '#fff' }}>ÁRBITRO</span>
      </div>
      <div style={{ padding: '0 32px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
        <span style={{ fontSize: 54, fontWeight: 900, lineHeight: .95, textTransform: 'uppercase', color: '#fff' }}>{referee.full_name}</span>
        {referee.federacion && <span style={tourKicker('rgba(255,255,255,.65)', 22)}>{referee.federacion}</span>}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 9) STATS PANEL TOUR — 1180 ancho, centrado
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

export function StatsPanelTour({ visible, match, tournament, scope }: {
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
      width: 1180, ...tourCard(), padding: '34px 48px', fontFamily: TOUR_FONT,
      ...animStyle(visible, 'sgInZC', 'sgOutZC', 700),
    }}>
      {/* Top accent strip */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${pal.accentA} 0%, ${pal.accentB} 100%)` }}/>

      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 48, fontWeight: 900, lineHeight: .95, letterSpacing: '-.005em', textTransform: 'uppercase', color: '#fff' }}>ESTADÍSTICAS</div>
        <div style={tourKicker(pal.accentA, 22)}>{SCOPE_TITLE[resolvedScope] ?? ''}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 28, alignItems: 'center', marginBottom: 22 }}>
        <TourPlayerBlockSmall entry={match.entry1} align="right" accent={pal.accentA} doubles={isDoubles}/>
        <TourScoreMini visibleSets={visibleSets}/>
        <TourPlayerBlockSmall entry={match.entry2} align="left" accent={pal.accentB} doubles={isDoubles}/>
      </div>

      <div>
        <div style={{ height: 1, background: 'rgba(255,255,255,.08)' }}/>
        {rows.map((r, i) => <TourStatRow key={i} label={r.label} a={r.a} b={r.b} accentA={pal.accentA} accentB={pal.accentB}/>)}
      </div>

      <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
        <span style={tourKicker(pal.accentA, 22)}>{roundLabel(match.round)}</span>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,.3)' }}/>
        <span style={tourKicker('rgba(255,255,255,.65)', 18)}>{CATEGORY_LABELS[match.category as Category] ?? match.category}</span>
      </div>
    </div>
  )
}

function TourPlayerBlockSmall({ entry, align, accent, doubles }: { entry: any, align: 'left'|'right', accent: string, doubles: boolean }) {
  const players = [entry?.player1, doubles ? entry?.player2 : null].filter(Boolean)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: align === 'right' ? 'flex-end' : 'flex-start' }}>
      {players.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, flexDirection: align === 'right' ? 'row-reverse' : 'row' }}>
          <img src={flagPath(p?.nationality)} alt="" style={{ flex: 'none', width: 56, height: 38, borderRadius: 3, objectFit: 'cover' }}/>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1, alignItems: align === 'right' ? 'flex-end' : 'flex-start' }}>
            {p?.first_name && (
              <span style={{ fontSize: players.length === 1 ? 20 : 16, fontWeight: 600, letterSpacing: '.02em', opacity: .82, textTransform: 'uppercase' }}>{p.first_name}</span>
            )}
            <span style={{ fontSize: players.length === 1 ? 46 : 32, fontWeight: 900, lineHeight: .95, textTransform: 'uppercase', whiteSpace: 'nowrap', color: accent }}>
              {(p?.last_name ?? '').toUpperCase()}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
function TourScoreMini({ visibleSets }: { visibleSets: Array<{ num: number, t1: number, t2: number, isCurrent: boolean }> }) {
  if (visibleSets.length === 0) return <div style={{ opacity: .3, fontSize: 28, fontWeight: 900 }}>—</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', minWidth: 200 }}>
      {visibleSets.map(s => (
        <div key={s.num} style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <span style={tourKicker('rgba(255,255,255,.5)', 16)}>SET {s.num}</span>
          <span style={{ fontSize: 32, fontWeight: 900, fontVariantNumeric: 'tabular-nums', lineHeight: 1, color: '#fff' }}>
            {s.t1}<span style={{ opacity: .35, margin: '0 10px' }}>—</span>{s.t2}
          </span>
        </div>
      ))}
    </div>
  )
}
function TourStatRow({ label, a, b, accentA, accentB }: { label: string, a: number|string, b: number|string, accentA: string, accentB: string }) {
  const numA = parseFloat(String(a).replace('%', '').split('/')[0]) || 0
  const numB = parseFloat(String(b).replace('%', '').split('/')[0]) || 0
  const aWins = numA > numB
  const bWins = numB > numA
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', alignItems: 'center', gap: 24, padding: '14px 4px' }}>
        <span style={{ fontSize: 36, fontWeight: 900, textAlign: 'right', color: aWins ? accentA : 'rgba(255,255,255,.85)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{a}</span>
        <span style={{ fontSize: 22, letterSpacing: '.22em', textAlign: 'center', opacity: .75, textTransform: 'uppercase', fontWeight: 700 }}>{label}</span>
        <span style={{ fontSize: 36, fontWeight: 900, textAlign: 'left', color: bWins ? accentB : 'rgba(255,255,255,.85)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{b}</span>
      </div>
      <div style={{ height: 1, background: 'rgba(255,255,255,.06)' }}/>
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 10) RESULTS GRID TOUR — 1680 ancho, maxHeight 980, centrado
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

export function ResultsGridTour({ visible, matches, highlightMatchId, tournament, category }: {
  visible: boolean, matches: any[], highlightMatchId?: string|null, tournament: Tournament | null, category?: string,
}) {
  const pal = palette(tournament?.scoreboard_config)
  const ROUND_ORDER = ['F','SF','QF','R16','R32','RR','GRP','CON','Q1','Q2']
  const cat = (category ?? matches[0]?.category) as Category | undefined
  const catMatches = cat ? matches.filter((m: any) => m.category === cat) : matches
  const groups: Record<string, any[]> = {}
  catMatches.forEach((m: any) => { const r = m.round ?? 'OTHER'; (groups[r] ??= []).push(m) })
  const rounds = Object.keys(groups).sort((a, b) => (ROUND_ORDER.indexOf(a)+1 || 99) - (ROUND_ORDER.indexOf(b)+1 || 99))

  return (
    <div style={{
      position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
      width: 1680, maxHeight: 980, ...tourCard(), padding: 0, fontFamily: TOUR_FONT,
      ...animStyle(visible, 'sgInZC', 'sgOutZC', 700),
    }}>
      <div style={{ height: 4, background: `linear-gradient(90deg, ${pal.accentA} 0%, ${pal.accentB} 100%)` }}/>

      {/* HEADER */}
      <div style={{ padding: '22px 40px', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={tourKicker('rgba(255,255,255,.55)', 18)}>Orden de juego · Resultados</div>
          <div style={{ fontSize: 46, fontWeight: 900, lineHeight: .95, letterSpacing: '-.005em', textTransform: 'uppercase', color: '#fff', marginTop: 4 }}>
            {CATEGORY_LABELS[(category ?? matches[0]?.category) as Category] ?? tournament?.name}
          </div>
        </div>
        {tournament?.logo_url && <img src={tournament.logo_url} alt="" style={{ height: 64 }}/>}
      </div>

      {/* BODY */}
      <div style={{ padding: '18px 40px 30px', display: 'flex', flexDirection: 'column', gap: 20, overflow: 'hidden' }}>
        {rounds.map(r => (
          <div key={r}>
            <div style={{ ...tourKicker(pal.accentA, 18), marginBottom: 8 }}>{ROUND_LABELS[r] ?? r}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
              {groups[r].map((m: any) => (
                <TourResultRow key={m.id} m={m} highlight={m.id === highlightMatchId} accent={pal.accentA}/>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TourResultRow({ m, highlight, accent }: { m: any, highlight: boolean, accent: string }) {
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
      padding: '8px 14px', borderRadius: 6,
      background: highlight ? hexAlpha(accent, .18) : 'rgba(255,255,255,.04)',
      border: highlight ? `1px solid ${hexAlpha(accent, .55)}` : '1px solid rgba(255,255,255,.08)',
    }}>
      <div>
        {[1, 2].map(tn => {
          const team = tn as 1|2
          const entry = team === 1 ? m.entry1 : m.entry2
          const isWinner = finished && winnerTeam === team
          return (
            <div key={team} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'baseline', padding: '2px 0' }}>
              <span style={{ fontSize: 22, fontWeight: isWinner ? 900 : 600, color: isWinner ? '#fff' : 'rgba(255,255,255,.78)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {teamLabel(entry)}
              </span>
              <span style={{ fontSize: 22, fontWeight: 900, color: isWinner ? accent : 'rgba(255,255,255,.55)', fontVariantNumeric: 'tabular-nums', letterSpacing: '.04em' }}>
                {setsLine(team)}
              </span>
            </div>
          )
        })}
      </div>
      <div style={{ textAlign: 'right' }}>
        {finished
          ? <span style={tourKicker('rgba(255,255,255,.55)', 13)}>FINAL</span>
          : inProgress
          ? <span style={tourKicker('#22d3ee', 13)}>EN JUEGO</span>
          : <span style={tourKicker('rgba(255,255,255,.5)', 13)}>{fmtSchedule(m.scheduled_at, m.court?.name)}</span>
        }
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 11) BRACKET VIEW TOUR — 1760x960 centrado, mismas dimensiones que classic
// ════════════════════════════════════════════════════════════════════════════
const BRACKET_KO_ROUNDS = ['R32', 'R16', 'QF', 'SF', 'F'] as const
type KoRound = typeof BRACKET_KO_ROUNDS[number]
const BRACKET_HEADER_LBL: Record<KoRound, string> = { R32: '1/16', R16: 'OCTAVOS', QF: 'CUARTOS', SF: 'SEMIFINALES', F: 'FINAL' }
const BRACKET_SLOTS: Record<KoRound, number> = { R32: 16, R16: 8, QF: 4, SF: 2, F: 1 }

export function BracketViewTour({ visible, matches, highlightMatchId, tournament, category }: {
  visible: boolean, matches: any[], highlightMatchId?: string|null, tournament: Tournament | null, category?: string,
}) {
  const pal = palette(tournament?.scoreboard_config)
  const LC = 'rgba(255,255,255,.25)'
  const cat = (category ?? matches[0]?.category) as Category | undefined
  const catMatches = cat ? matches.filter((m: any) => m.category === cat) : matches

  const byRound: Record<string, any[]> = { R32: [], R16: [], QF: [], SF: [], F: [] }
  catMatches.forEach((m: any) => { if (byRound[m.round]) byRound[m.round].push(m) })
  BRACKET_KO_ROUNDS.forEach(r => byRound[r].sort((a, b) => (a.match_number||0) - (b.match_number||0)))

  const present = BRACKET_KO_ROUNDS.filter(r => byRound[r].length > 0)
  const firstRound: KoRound = (present[0] ?? 'QF') as KoRound
  const firstIdx = BRACKET_KO_ROUNDS.indexOf(firstRound)
  const visibleRounds = BRACKET_KO_ROUNDS.slice(firstIdx) as KoRound[]

  const roundsData = visibleRounds.map(r => {
    const expected = BRACKET_SLOTS[r]
    const byNum: Record<number, any> = {}
    byRound[r].forEach((m: any) => { if (m.match_number) byNum[m.match_number] = m })
    const slots: any[] = []
    for (let i = 1; i <= expected; i++) slots.push(byNum[i] ?? null)
    return { round: r, slots }
  })

  const totalRows = BRACKET_SLOTS[firstRound] * 2
  const N_COLS = visibleRounds.length
  const colTracks: string[] = []
  for (let i = 0; i < N_COLS; i++) {
    if (i > 0) colTracks.push('60px')
    colTracks.push('1fr')
  }
  const gridCols = colTracks.join(' ')

  return (
    <div style={{
      position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
      width: 1760, height: 960, ...tourCard(), padding: 0, fontFamily: TOUR_FONT,
      ...animStyle(visible, 'sgInZC', 'sgOutZC', 700),
    }}>
      <div style={{ height: 5, background: `linear-gradient(90deg, ${pal.accentA} 0%, ${pal.accentB} 100%)` }}/>

      <div style={{ padding: '20px 36px', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={tourKicker('rgba(255,255,255,.55)', 18)}>Cuadro</div>
          <div style={{ fontSize: 38, fontWeight: 900, textTransform: 'uppercase', lineHeight: .95, color: '#fff', marginTop: 4 }}>
            {CATEGORY_LABELS[(category ?? matches[0]?.category) as Category] ?? ''}
          </div>
        </div>
        {tournament?.logo_url && <img src={tournament.logo_url} alt="" style={{ height: 60 }}/>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: gridCols, padding: '14px 32px 0', gap: 0 }}>
        {visibleRounds.map((r, i) => (
          <React.Fragment key={r}>
            {i > 0 && <div/>}
            <div style={{ textAlign: 'center', ...tourKicker(pal.accentA, 18) }}>{BRACKET_HEADER_LBL[r]}</div>
          </React.Fragment>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: gridCols, gridTemplateRows: `repeat(${totalRows}, 1fr)`, height: 760, padding: '10px 32px 24px' }}>
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
                  <div key={`${round}-${i}`} style={{ gridColumn, gridRow: `${startRow}/${endRow}`, display: 'flex', alignItems: 'center', padding: '4px 0' }}>
                    <TourBracketSlot m={m} hot={m?.id === highlightMatchId} accent={pal.accentA} isFinal={round === 'F'}/>
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

function TourBracketSlot({ m, hot, accent, isFinal = false }: { m: any, hot: boolean, accent: string, isFinal?: boolean }) {
  if (!m) {
    return (
      <div style={{ flex: 1, padding: '14px 14px', borderRadius: 6, background: 'rgba(255,255,255,.02)', border: '1px dashed rgba(255,255,255,.15)', textAlign: 'center' }}>
        <span style={tourKicker('rgba(255,255,255,.4)', 16)}>Por determinar</span>
      </div>
    )
  }
  const score = m.score as Score | null
  const isDoubles = m.match_type === 'doubles'
  return (
    <div style={{
      flex: 1, padding: '8px 12px', borderRadius: 6,
      background: hot ? hexAlpha(accent, .22) : isFinal ? hexAlpha(accent, .12) : 'rgba(255,255,255,.04)',
      border: hot ? `1.5px solid ${accent}` : isFinal ? `1px solid ${hexAlpha(accent, .5)}` : '1px solid rgba(255,255,255,.1)',
    }}>
      <TourBracketLine entry={m.entry1} score={score} team={1} accent={accent} isDoubles={isDoubles}/>
      <div style={{ height: 1, background: 'rgba(255,255,255,.08)', margin: '4px 0' }}/>
      <TourBracketLine entry={m.entry2} score={score} team={2} accent={accent} isDoubles={isDoubles}/>
    </div>
  )
}
function TourBracketLine({ entry, score, team, accent, isDoubles }: { entry: any, score: Score|null, team: 1|2, accent: string, isDoubles: boolean }) {
  if (!entry) return <div style={{ padding: '3px 0', fontSize: 18, opacity: .35 }}>—</div>
  const players = [entry?.player1, isDoubles ? entry?.player2 : null].filter(Boolean)
  const sets = threeSetsFor(score, team)
  const winner = (score?.winner_team ?? null) === team
  const nameStr = isDoubles
    ? players.map((p: any) => firstSurname(p)).filter(Boolean).join(' / ')
    : (players[0]?.last_name ?? '')
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 18, fontWeight: winner ? 900 : 600, color: winner ? '#fff' : 'rgba(255,255,255,.78)', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {nameStr.toUpperCase()}
      </span>
      {sets.map((v, i) => (
        <span key={i} style={{ minWidth: 18, textAlign: 'center', fontSize: 18, fontWeight: 900, color: winner ? accent : 'rgba(255,255,255,.55)', fontVariantNumeric: 'tabular-nums' }}>
          {v == null ? '' : v}
        </span>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 12) COIN TOSS TOUR — 1100x720 centrado
// ════════════════════════════════════════════════════════════════════════════
export function CoinTossTour({ visible, match, tournament }: { visible: boolean, match: any, tournament: Tournament | null }) {
  if (!match) return null
  const pal = palette(tournament?.scoreboard_config)
  const winnerTeam = match.toss_winner_team as 1|2|null
  const choice = match.toss_choice as 'serve'|'receive'|'side'|null
  const won = winnerTeam ? (winnerTeam === 1 ? match.entry1 : match.entry2) : null
  const players = won ? [won.player1, match.match_type === 'doubles' ? won.player2 : null].filter(Boolean) : []
  const choiceText = choice === 'serve' ? 'SACAR' : choice === 'receive' ? 'RESTAR' : choice === 'side' ? 'ELEGIR LADO' : ''
  const accent = winnerTeam === 2 ? pal.accentB : pal.accentA

  return (
    <div style={{
      position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
      width: 'fit-content', minWidth: 800, ...tourCard(), padding: '50px 60px', fontFamily: TOUR_FONT,
      textAlign: 'center',
      ...animStyle(visible, 'sgInZC', 'sgOutZC', 700),
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${pal.accentA} 0%, ${pal.accentB} 100%)` }}/>
      <div style={{ ...tourKicker(pal.accentA, 20), marginBottom: 20 }}>SORTEO</div>
      <div style={{ fontSize: 42, fontWeight: 800, color: 'rgba(255,255,255,.7)', textTransform: 'uppercase', marginBottom: 16 }}>Gana el sorteo</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 30 }}>
        {players.map((p: any, i: number) => (
          <div key={i} style={{ fontSize: 64, fontWeight: 900, lineHeight: 1, color: accent, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            {(p?.first_name ?? '')} <span style={{ color: '#fff' }}>{(p?.last_name ?? '').toUpperCase()}</span>
          </div>
        ))}
      </div>
      {choiceText && (<>
        <div style={{ ...tourKicker(pal.accentA, 18), marginBottom: 10 }}>Y ELIGE</div>
        <div style={{
          display: 'inline-block', padding: '14px 40px', borderRadius: 6,
          background: hexAlpha(accent, .18), border: `2px solid ${accent}`,
          fontSize: 56, fontWeight: 900, letterSpacing: '.18em', textTransform: 'uppercase', color: '#fff',
        }}>
          {choiceText}
        </div>
      </>)}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 13) AWARDS PODIUM TOUR — 1400x720 centrado (mismas dimensiones que classic)
// ════════════════════════════════════════════════════════════════════════════
export function AwardsPodiumTour({ visible, data, tournament }: {
  visible: boolean, data: any, tournament: Tournament | null,
}) {
  if (!data) return null
  const pal = palette(tournament?.scoreboard_config)
  const champion = data.champion as { name: string, photo_url?: string|null } | null
  const finalist = data.finalist as { name: string, photo_url?: string|null } | null
  return (
    <div style={{
      position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
      width: 1400, height: 720, ...tourCard(), padding: '50px 60px', fontFamily: TOUR_FONT,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 36, textAlign: 'center',
      ...animStyle(visible, 'sgInZC', 'sgOutZC', 750),
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: `linear-gradient(90deg, ${pal.accentA} 0%, ${pal.accentB} 100%)` }}/>
      <div style={{ ...tourKicker(pal.accentA, 22) }}>PODIO</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'end', width: '100%' }}>
        {/* Finalist */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ ...tourKicker('rgba(255,255,255,.6)', 18), marginBottom: 10 }}>FINALISTA</div>
          {finalist?.photo_url && (
            <div style={{ width: 200, height: 200, margin: '0 auto 16px', borderRadius: 12, overflow: 'hidden', border: `2px solid ${hexAlpha(pal.accentB, .55)}` }}>
              <img src={finalist.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
            </div>
          )}
          <div style={{ fontSize: 48, fontWeight: 900, lineHeight: .95, textTransform: 'uppercase', color: '#fff' }}>{finalist?.name}</div>
        </div>
        {/* Champion */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ ...tourKicker(pal.accentA, 22), marginBottom: 10 }}>🏆 CAMPEÓN</div>
          {champion?.photo_url && (
            <div style={{ width: 240, height: 240, margin: '0 auto 16px', borderRadius: 12, overflow: 'hidden', border: `3px solid ${pal.accentA}`, boxShadow: `0 0 40px ${hexAlpha(pal.accentA, .55)}` }}>
              <img src={champion.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
            </div>
          )}
          <div style={{ fontSize: 56, fontWeight: 900, lineHeight: .95, textTransform: 'uppercase', color: pal.accentA }}>{champion?.name}</div>
        </div>
      </div>

      <div style={tourKicker('rgba(255,255,255,.6)', 18)}>{tournament?.name}</div>
    </div>
  )
}
