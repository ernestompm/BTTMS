'use client'
// ============================================================================
// Streaming Graphics — CHAMPIONSHIP skin (premium ATP/WTA broadcast style)
// ============================================================================
// Diseño tipo retransmisión deportiva premium (referencia ATP/WTA TV):
//  - Card glassy navy con transparencias, blur fuerte
//  - Naranja saturado (#f57c00) para set actual / equipo destacado
//  - Azul profundo (#0a3c5e / #154a73) para el otro equipo
//  - Filas finas y compactas, separadas por hairline
//  - Punto amarillo de saque, banderas reales pequeñas
//  - Tipografía Barlow Condensed bold, italic en nombres
//  - Logos del torneo / patrocinador SOLO en gráficos grandes
//    (NO aparecen en este Scorebug compacto)
//
// FASE 1 — solo Scorebug. El resto de los gráficos (BigScoreboard, StatsPanel,
// Bracket, etc.) caen en fallback al skin Classic hasta que lleguen F2/F3.
// ============================================================================

import React from 'react'
import type { Score, Tournament } from '@/types'
import { hexAlpha, flagPath, palette, firstSurname, animStyle } from './stage-shared'

// ─── PALETA ─────────────────────────────────────────────────────────────────
// Tomada literalmente de la referencia compartida por el cliente.
const CH = {
  orange:    '#f57c00',           // set actual / equipo destacado
  orangeDk:  '#e06a00',
  navy:      '#0a3c5e',           // azul base
  navyDk:    '#062236',
  navyMid:   '#154a73',
  white:     '#ffffff',
  text:      'rgba(255,255,255,.96)',
  muted:     'rgba(255,255,255,.62)',
  serve:     '#ffd54f',           // punto amarillo de saque
  hairline:  'rgba(255,255,255,.10)',
  stroke:    'rgba(255,255,255,.18)',
}

const FONT = "'Barlow Condensed', 'Inter', system-ui, -apple-system, sans-serif"
const TS_HARD = '0 1px 2px rgba(0,0,0,.55), 0 2px 10px rgba(0,0,0,.30)'

// ─── HELPERS DE SCORE (compartidos con otros skins, duplicados aquí para
// que el archivo sea autosuficiente y se pueda evolucionar sin tocar broadcast) ──
const PTS = ['0', '15', '30', '40']
function gamePoint(score: Score | null, team: 1 | 2): string {
  if (!score) return '0'
  const k = team === 1 ? 't1' : 't2'
  if (score.super_tiebreak_active || score.tiebreak_active) {
    return String(score.tiebreak_score?.[k] ?? 0)
  }
  if (score.deuce) return '40'
  return PTS[score.current_game?.[k] ?? 0] ?? '0'
}
function setsFor(score: Score | null, team: 1 | 2, n: number = 3): Array<number | null> {
  const out: Array<number | null> = Array(n).fill(null)
  if (!score) return out
  const k = team === 1 ? 't1' : 't2'
  const sets = score.sets ?? []
  for (let i = 0; i < Math.min(n, sets.length); i++) out[i] = sets[i][k]
  return out
}

// ─── CARD GLASSY NAVY ───────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  // Doble degradado: navy traslúcido → más oscuro abajo, dejando ver el video
  background: 'linear-gradient(180deg, rgba(15,55,84,.78) 0%, rgba(7,28,45,.86) 100%)',
  border: `1px solid ${CH.stroke}`,
  borderRadius: 10,
  backdropFilter: 'blur(20px) saturate(1.18)',
  WebkitBackdropFilter: 'blur(20px) saturate(1.18)',
  boxShadow: '0 18px 48px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.08)',
  overflow: 'hidden',
}

// ════════════════════════════════════════════════════════════════════════════
// 01 · SCOREBUG CHAMPIONSHIP — top-left, compacto, premium
// ════════════════════════════════════════════════════════════════════════════
//
// Layout (referencia ATP):
// ┌─────────────────────────────────────────────────┐
// │ ● 🇭🇺 Z.PIROS  ............. │ 7 │ 6 │ 0 │      │  ← naranja en set actual
// │   2.BUDAPEST, HUNGARY        │   │   │   │      │
// ├──────────────────────────────┼───┼───┼───┤      │
// │   🇩🇪 J.RODIONOV ........... │ 5 │ 2 │ 0 │      │
// │   2.NUREMBERG, GERMANY       │   │   │   │      │
// └─────────────────────────────────────────────────┘
//
// El "2." en la subtitle es el seed (entry.seed). Si no hay seed se omite.
// El ticker de stats (cuando v('stats_ticker')) se sustituye en la celda de
// game-points en lugar de añadir una columna extra (mantiene compacto).
// ════════════════════════════════════════════════════════════════════════════

const STAT_LABELS: Record<string, string> = {
  aces: 'ACES',
  double_faults: 'DOBLES F.',
  serve_points_won_pct: '% SAQUE',
  return_points_won_pct: '% RESTO',
  break_points_won: 'BREAKS',
  total_points_won: 'PTS TOT.',
}
function statValue(stats: any, stat: string, team: 1 | 2): string | number {
  const t = team === 1 ? stats?.t1 : stats?.t2
  const v = t?.[stat]
  if (v == null) return '—'
  if (stat.endsWith('_pct')) return `${Math.round(v)}%`
  return v
}

// Mapping mínimo de código ISO-3 → nombre de país en mayúsculas, para la
// subtitle "BUDAPEST, HUNGARY". Si falta el país, se omite la subtitle entera.
const COUNTRY_NAMES: Record<string, string> = {
  ESP: 'ESPAÑA', FRA: 'FRANCIA', ITA: 'ITALIA', POR: 'PORTUGAL',
  GER: 'ALEMANIA', NED: 'PAÍSES BAJOS', BEL: 'BÉLGICA', SUI: 'SUIZA',
  AUT: 'AUSTRIA', GBR: 'REINO UNIDO', IRL: 'IRLANDA', DEN: 'DINAMARCA',
  SWE: 'SUECIA', NOR: 'NORUEGA', FIN: 'FINLANDIA', POL: 'POLONIA',
  CZE: 'CHEQUIA', SVK: 'ESLOVAQUIA', HUN: 'HUNGRÍA', ROU: 'RUMANÍA',
  GRE: 'GRECIA', UKR: 'UCRANIA', RUS: 'RUSIA', BLR: 'BIELORRUSIA',
  USA: 'EE. UU.', CAN: 'CANADÁ', MEX: 'MÉXICO', BRA: 'BRASIL',
  ARG: 'ARGENTINA', URU: 'URUGUAY', CHI: 'CHILE', COL: 'COLOMBIA',
  AUS: 'AUSTRALIA', NZL: 'NUEVA ZELANDA', JPN: 'JAPÓN', CHN: 'CHINA',
  KOR: 'COREA DEL SUR', IND: 'INDIA', RSA: 'SUDÁFRICA', MAR: 'MARRUECOS',
  TUN: 'TÚNEZ', EGY: 'EGIPTO', ISR: 'ISRAEL', TUR: 'TURQUÍA',
}
function countryName(nat: string | null | undefined): string {
  if (!nat) return ''
  const code = nat.toUpperCase()
  return COUNTRY_NAMES[code] ?? code
}

export function ScorebugChampionship({ visible, match, tournament, tickerStat }: {
  visible: boolean
  match: any
  tournament: Tournament | null
  tickerStat?: string | null
}) {
  if (!match) return null
  const pal = palette(tournament?.scoreboard_config)
  const score = match.score as Score | null
  const isDoubles = match.match_type === 'doubles'
  const serving = match.serving_team as 1 | 2 | null
  const inProgress = score?.match_status === 'in_progress'

  // Sets a mostrar: los jugados + el actual si está en juego (mín 1, máx 3).
  const setsPlayed = score?.sets?.length ?? 0
  const setCount = Math.max(1, Math.min(3, setsPlayed + (inProgress ? 1 : 0)))
  const tbActive = !!(score?.tiebreak_active || score?.super_tiebreak_active)
  const currentSetIdx = inProgress ? setsPlayed : -1

  const showTicker = !!tickerStat && !!match.stats
  const tickerLabel = tickerStat ? (STAT_LABELS[tickerStat] ?? tickerStat.toUpperCase()) : ''

  // Helpers locales para nombres
  function teamPlayers(t: 1 | 2): any[] {
    const e = t === 1 ? match.entry1 : match.entry2
    if (!e) return []
    return [e.player1, isDoubles ? e.player2 : null].filter(Boolean)
  }
  function teamSeed(t: 1 | 2): number | null {
    const e = t === 1 ? match.entry1 : match.entry2
    return e?.seed ?? null
  }
  function teamDisplayName(t: 1 | 2): string {
    const players = teamPlayers(t)
    if (!players.length) return ''
    if (isDoubles) {
      // "PIROS / RODIONOV"
      return players.map((p: any) => firstSurname(p).toUpperCase()).join(' / ')
    }
    // Singles: "Z.PIROS" — primera inicial + apellido
    const p = players[0]
    const initial = (p?.first_name ?? '').charAt(0).toUpperCase()
    const surname = firstSurname(p).toUpperCase()
    return initial ? `${initial}.${surname}` : surname
  }
  function teamSubtitle(t: 1 | 2): string {
    const players = teamPlayers(t)
    if (!players.length) return ''
    const seed = teamSeed(t)
    const seedPrefix = seed ? `${seed}.` : ''
    if (isDoubles) {
      // En dobles la subtitle muestra el país (todos los jugadores comparten
      // o se queda en blanco si difieren).
      const nats = Array.from(new Set(players.map((p: any) => p?.nationality).filter(Boolean)))
      if (nats.length === 1) return `${seedPrefix}${countryName(nats[0])}`.trim()
      return seedPrefix.trim()
    }
    // Singles: ciudad, país (si hay)
    const p = players[0]
    const city = p?.birth_city ? String(p.birth_city).toUpperCase() : ''
    const country = countryName(p?.nationality)
    const cityCountry = [city, country].filter(Boolean).join(', ')
    return `${seedPrefix}${cityCountry}`.trim()
  }

  // Grid: [serve dot+flag] [name col] [N set cells] [game cell]
  const setColW = 38
  const gameColW = 50
  const nameColW = isDoubles ? 230 : 250
  const flagColW = 60 // serve dot + flag
  const totalW = flagColW + nameColW + setColW * setCount + gameColW

  return (
    <div style={{
      position: 'absolute',
      top: 36,
      left: 36,
      width: totalW,
      ...cardStyle,
      fontFamily: FONT,
      ...animStyle(visible, 'sgInR', 'sgOutR', 600),
    }}>
      {/* 2 filas, una por equipo */}
      {[1, 2].map((tn) => {
        const team = tn as 1 | 2
        const players = teamPlayers(team)
        const sets = setsFor(score, team).slice(0, setCount)
        const pt = gamePoint(score, team)
        const isServing = serving === team
        const subtitle = teamSubtitle(team)
        const tickerVal = showTicker ? statValue(match.stats, tickerStat!, team) : null

        return (
          <div key={team} style={{
            display: 'grid',
            gridTemplateColumns: `${flagColW}px ${nameColW}px ${Array(setCount).fill(`${setColW}px`).join(' ')} ${gameColW}px`,
            alignItems: 'stretch',
            borderTop: team === 2 ? `1px solid ${CH.hairline}` : 'none',
            minHeight: subtitle ? 44 : 36,
          }}>

            {/* ── Col 1: serve dot + flag ─────────────────────────────── */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
              gap: 6, padding: '0 8px 0 10px',
            }}>
              <span aria-hidden style={{
                width: 7, height: 7, borderRadius: '50%',
                background: isServing ? CH.serve : 'transparent',
                boxShadow: isServing ? `0 0 8px ${CH.serve}` : 'none',
                flex: 'none',
                animation: isServing ? 'sgSrvPulse 1.6s infinite' : 'none',
              }}/>
              {isDoubles ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 'none' }}>
                  {players.slice(0, 2).map((p: any, i: number) => (
                    <img key={i} src={flagPath(p?.nationality)} alt=""
                      style={{ width: 22, height: 14, borderRadius: 1, objectFit: 'cover' }}/>
                  ))}
                </div>
              ) : (
                <img src={flagPath(players[0]?.nationality)} alt=""
                  style={{ width: 28, height: 18, borderRadius: 1, objectFit: 'cover', flex: 'none' }}/>
              )}
            </div>

            {/* ── Col 2: nombre + subtitle ────────────────────────────── */}
            <div style={{
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
              padding: '4px 8px 4px 0',
              minWidth: 0,
            }}>
              <span style={{
                fontSize: 19,
                fontWeight: 700,
                fontStyle: 'italic',
                letterSpacing: '.02em',
                color: CH.text,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: 1.05,
                textShadow: TS_HARD,
              }}>
                {teamDisplayName(team)}
              </span>
              {subtitle && (
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '.06em',
                  color: CH.muted,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  marginTop: 1,
                }}>
                  {subtitle}
                </span>
              )}
            </div>

            {/* ── Cols 3..N: SET cells (orange en set actual) ────────── */}
            {sets.map((v, i) => {
              const isCurrent = i === currentSetIdx
              return (
                <div key={i} style={{
                  display: 'grid',
                  placeItems: 'center',
                  background: isCurrent ? CH.orange : 'rgba(255,255,255,.94)',
                  borderLeft: `1px solid ${isCurrent ? hexAlpha(CH.orangeDk, .55) : CH.hairline}`,
                  color: isCurrent ? '#fff' : '#0e2236',
                  fontSize: 22,
                  fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums',
                  textShadow: isCurrent ? '0 1px 2px rgba(0,0,0,.35)' : 'none',
                  // En el set actual, brillo sutil interior
                  boxShadow: isCurrent ? `inset 0 -2px 0 ${CH.orangeDk}` : 'none',
                }}>
                  {v == null ? '–' : v}
                </div>
              )
            })}

            {/* ── Col última: GAME / TIEBREAK / TICKER ─────────────────── */}
            <div style={{
              display: 'grid',
              placeItems: 'center',
              background: showTicker
                ? 'linear-gradient(135deg, rgba(251,191,36,.92), rgba(245,158,11,.85))'
                : tbActive ? '#fbbf24' : CH.navyDk,
              borderLeft: `1px solid ${CH.hairline}`,
              color: showTicker || tbActive ? '#1f1200' : CH.text,
              fontSize: 22,
              fontWeight: 800,
              fontStyle: showTicker ? 'italic' : 'normal',
              fontVariantNumeric: 'tabular-nums',
              textShadow: showTicker || tbActive ? 'none' : TS_HARD,
            }}>
              {showTicker ? tickerVal : pt}
            </div>
          </div>
        )
      })}

      {/* Etiqueta de stat ticker — visible solo cuando hay ticker activo,
          deja claro que la última columna es ESTADÍSTICA y no resultado. */}
      {showTicker && (
        <div style={{
          padding: '4px 10px 5px',
          background: 'rgba(0,0,0,.32)',
          borderTop: `1px solid ${CH.hairline}`,
          textAlign: 'right',
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '.22em',
          color: '#fbbf24',
        }}>
          {tickerLabel}
        </div>
      )}
    </div>
  )
}

// ─── EXPORTS ────────────────────────────────────────────────────────────────
// FASE 1: solo Scorebug. Los demás 13 gráficos del skin championship caen al
// fallback Classic en OverlayStage hasta que se implementen en F2/F3.
