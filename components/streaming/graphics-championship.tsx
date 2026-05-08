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

// ════════════════════════════════════════════════════════════════════════════
// HELPERS COMPARTIDOS PARA EL RESTO DE GRÁFICOS (F2 + F3)
// ════════════════════════════════════════════════════════════════════════════

import { CATEGORY_LABELS } from '@/types'
import type { Player, Sponsor, Category, WeatherData } from '@/types'

const ROUND_LABELS_CH: Record<string, string> = {
  F: 'FINAL', SF: 'SEMIFINAL', QF: 'CUARTOS DE FINAL', R16: 'OCTAVOS DE FINAL',
  R32: 'DIECISEISAVOS', RR: 'FASE DE GRUPOS', GRP: 'FASE DE GRUPOS', CON: 'CONSOLACIÓN',
  Q1: 'CLASIFICATORIA 1', Q2: 'CLASIFICATORIA 2',
}
const roundLabel = (r: any): string => ROUND_LABELS_CH[r ?? ''] ?? (r ?? '').toString().toUpperCase()
const ROUND_LABELS_SHORT_CH: Record<string, string> = {
  F: 'FINAL', SF: 'SEMIFINAL', QF: 'CUARTOS', R16: 'OCTAVOS', R32: 'DIECISEISAVOS',
}

function useTicker(start: string | null, stop: string | null) {
  const [, tick] = React.useState(0)
  React.useEffect(() => { const id = setInterval(() => tick(x => x + 1), 1000); return () => clearInterval(id) }, [])
  if (!start) return 0
  const end = stop ? new Date(stop).getTime() : Date.now()
  return Math.floor((end - new Date(start).getTime()) / 1000)
}
function fmtHHmm(secs: number) {
  const s = Math.max(0, secs | 0)
  const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60)
  return `${hh}H ${String(mm).padStart(2, '0')}M`
}
function fmtClockShort(secs: number) {
  // "55'" si <60min, "1H 05'" si >=60min
  const s = Math.max(0, secs | 0)
  const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60)
  return hh > 0 ? `${hh}H ${String(mm).padStart(2, '0')}'` : `${mm}'`
}
function setsWonCount(score: Score | null, team: 1 | 2): number {
  if (!score?.sets?.length) return 0
  const k = team === 1 ? 't1' : 't2'
  const ok = team === 1 ? 't2' : 't1'
  return score.sets.reduce((acc: number, s: any) => acc + ((s[k] ?? 0) > (s[ok] ?? 0) ? 1 : 0), 0)
}
function ageFrom(iso: string) {
  const d = new Date(iso); const now = new Date(); let a = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--
  return a
}
function lateralityShortEs(laterality: string | null | undefined) {
  if (laterality === 'left') return 'ZURDO'
  if (laterality === 'ambidextrous') return 'AMBIDIESTRO'
  return 'DIESTRO'
}

// LogoBar — barra de logos top-right consistente en todos los gráficos
// "grandes": tournament_logo + rfet_logo + sponsor principal. Si alguno
// falta, simplemente no se renderiza esa imagen.
function LogoBar({ tournament, sponsor, height = 32, gap = 16 }: {
  tournament: Tournament | null, sponsor?: Sponsor | null, height?: number, gap?: number,
}) {
  const tLogo = tournament?.logo_url ?? tournament?.scoreboard_config?.logos?.tournament_logo_url
  const rfet = tournament?.scoreboard_config?.logos?.rfet_logo_url
  const items: string[] = []
  if (tLogo) items.push(tLogo)
  if (rfet) items.push(rfet)
  if (sponsor?.logo_url) items.push(sponsor.logo_url)
  if (!items.length) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap, flex: 'none' }}>
      {items.map((src, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span style={{ width: 1, height: height * 0.6, background: 'rgba(255,255,255,.18)' }}/>}
          <img src={src} alt="" style={{ height, objectFit: 'contain', opacity: .92 }}/>
        </React.Fragment>
      ))}
    </div>
  )
}

// Card grande (full takeover) con la misma estética glassy navy del scorebug
const cardStyleLg: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(15,55,84,.86) 0%, rgba(7,28,45,.92) 100%)',
  border: `1px solid ${CH.stroke}`,
  borderRadius: 14,
  backdropFilter: 'blur(24px) saturate(1.18)',
  WebkitBackdropFilter: 'blur(24px) saturate(1.18)',
  boxShadow: '0 32px 90px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.10)',
  overflow: 'hidden',
}

// Bloque de equipo coloreado (orange / navy) — base para BigScoreboard,
// MatchPresentation, StatsPanel, Awards
function TeamBlock({ side, accent, children }: {
  side: 'left' | 'right', accent: 'orange' | 'navy', children: React.ReactNode,
}) {
  const bg = accent === 'orange'
    ? 'linear-gradient(180deg, #f57c00 0%, #d96a00 100%)'
    : 'linear-gradient(180deg, #154a73 0%, #0c3654 100%)'
  return (
    <div style={{
      background: bg,
      padding: '12px 18px',
      borderTopLeftRadius: side === 'left' ? 10 : 0,
      borderBottomLeftRadius: side === 'left' ? 10 : 0,
      borderTopRightRadius: side === 'right' ? 10 : 0,
      borderBottomRightRadius: side === 'right' ? 10 : 0,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,.16), inset 0 -2px 0 rgba(0,0,0,.18)',
      color: '#fff',
    }}>
      {children}
    </div>
  )
}

// Helper: nombre formateado "{INITIAL}.{LAST}" (singles) o "{LAST1} / {LAST2}" (dobles)
function teamLabel(match: any, team: 1 | 2): string {
  const e = team === 1 ? match?.entry1 : match?.entry2
  if (!e?.player1) return ''
  const isDoubles = match.match_type === 'doubles'
  if (isDoubles && e.player2) {
    return [e.player1, e.player2].map((p: any) => firstSurname(p).toUpperCase()).join(' / ')
  }
  const init = (e.player1.first_name ?? '').charAt(0).toUpperCase()
  const sur = firstSurname(e.player1).toUpperCase()
  return init ? `${init}.${sur}` : sur
}
function teamSubtitleLong(match: any, team: 1 | 2): string {
  const e = team === 1 ? match?.entry1 : match?.entry2
  const players = [e?.player1, match?.match_type === 'doubles' ? e?.player2 : null].filter(Boolean)
  if (!players.length) return ''
  const seed = e?.seed ? `${e.seed}.` : ''
  if (match.match_type === 'doubles') {
    const nats = Array.from(new Set(players.map((p: any) => p.nationality).filter(Boolean)))
    return nats.length === 1 ? `${seed}${countryName(nats[0])}` : seed
  }
  const p = players[0]
  const city = p.birth_city ? String(p.birth_city).toUpperCase() : ''
  const country = countryName(p.nationality)
  return `${seed}${[city, country].filter(Boolean).join(', ')}`
}

// ════════════════════════════════════════════════════════════════════════════
// 02 · BIG SCOREBOARD — lower-third grande con FINAL + flag pills + reloj
// Posición: bottom-center, ancho 1080px aprox
// ════════════════════════════════════════════════════════════════════════════
export function BigScoreboardChampionship({ visible, match, tournament, sponsor, opts }: {
  visible: boolean, match: any, tournament: Tournament | null, sponsor?: Sponsor | null, opts?: any,
}) {
  if (!match) return null
  const score = match.score as Score | null
  const finished = score?.match_status === 'finished'
  const elapsed = useTicker(match.started_at ?? null, match.finished_at ?? null)
  const sets1 = setsWonCount(score, 1)
  const sets2 = setsWonCount(score, 2)
  const winner: 1 | 2 = sets1 > sets2 ? 1 : 2
  const headerLabel = finished ? roundLabel(match.round) : (roundLabel(match.round) || 'EN JUEGO')

  // Para cada equipo: [flag pill] [name] [score grande]
  function Row({ team }: { team: 1 | 2 }) {
    const e = team === 1 ? match.entry1 : match.entry2
    const isDoubles = match.match_type === 'doubles'
    const players = [e?.player1, isDoubles ? e?.player2 : null].filter(Boolean)
    const name = teamLabel(match, team)
    const subtitle = teamSubtitleLong(match, team)
    const setsWon = team === 1 ? sets1 : sets2
    const isWinner = finished && winner === team
    const accent = isWinner ? CH.orange : CH.navyMid
    const accentDk = isWinner ? CH.orangeDk : CH.navy
    return (
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 96px',
        background: `linear-gradient(90deg, ${accent} 0%, ${accentDk} 100%)`,
        boxShadow: isWinner ? `inset 0 0 0 1px ${hexAlpha('#ffffff', .12)}` : 'none',
        minHeight: 56,
        alignItems: 'stretch',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px' }}>
          {/* dash icon (separador estético al estilo de tu referencia 3) */}
          <span aria-hidden style={{
            width: 18, height: 3, background: 'rgba(255,255,255,.78)', borderRadius: 2, flex: 'none',
          }}/>
          {/* flag pill */}
          {isDoubles ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 'none' }}>
              {players.slice(0, 2).map((p: any, i: number) => (
                <img key={i} src={flagPath(p?.nationality)} alt="" style={{ width: 26, height: 17, borderRadius: 2, objectFit: 'cover' }}/>
              ))}
            </div>
          ) : (
            <img src={flagPath(players[0]?.nationality)} alt="" style={{ width: 32, height: 21, borderRadius: 2, objectFit: 'cover', flex: 'none' }}/>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
            <span style={{
              fontSize: 22, fontWeight: 800, fontStyle: 'italic', letterSpacing: '.02em',
              color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              lineHeight: 1.05, textShadow: TS_HARD,
            }}>{name}</span>
            {subtitle && (
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.06em', color: 'rgba(255,255,255,.85)', marginTop: 2 }}>
                {subtitle}
              </span>
            )}
          </div>
        </div>
        <div style={{
          display: 'grid', placeItems: 'center', borderLeft: '1px solid rgba(255,255,255,.18)',
          fontSize: 38, fontWeight: 900, color: '#fff', fontVariantNumeric: 'tabular-nums', textShadow: TS_HARD,
        }}>
          {setsWon}
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position: 'absolute', bottom: 64, left: 420, width: 1080,
      ...cardStyleLg, fontFamily: FONT,
      ...animStyle(visible, 'sgInU', 'sgOutU', 700),
    }}>
      {/* Header con título + logos */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 22px', borderBottom: `1px solid ${CH.hairline}`, background: 'rgba(0,0,0,.18)',
      }}>
        <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '.30em', color: CH.text }}>
          {headerLabel}
        </span>
        <LogoBar tournament={tournament} sponsor={sponsor} height={26} gap={14}/>
      </div>
      <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: 0 }}>
        <Row team={1}/>
        <Row team={2}/>
      </div>
      {/* Reloj de partido */}
      <div style={{
        textAlign: 'right', padding: '4px 16px 6px', fontSize: 12, fontWeight: 800,
        letterSpacing: '.18em', color: CH.muted, background: 'rgba(0,0,0,.22)',
      }}>
        {fmtClockShort(elapsed)}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 03 · MATCH PRESENTATION — fullscreen takeover antes de empezar
// ════════════════════════════════════════════════════════════════════════════
export function MatchPresentationChampionship({ visible, match, tournament }: {
  visible: boolean, match: any, tournament: Tournament | null,
}) {
  if (!match) return null
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'grid', placeItems: 'center', fontFamily: FONT,
      background: 'linear-gradient(180deg, rgba(7,28,45,.92) 0%, rgba(2,12,22,.96) 100%)',
      ...animStyle(visible, 'sgInF', 'sgOutF', 750),
    }}>
      <div style={{ width: 1480, ...cardStyleLg }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 32px', borderBottom: `1px solid ${CH.hairline}`,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '.32em', color: CH.muted }}>
              {tournament?.name?.toUpperCase()}
            </span>
            <span style={{ fontSize: 28, fontWeight: 900, color: CH.text, letterSpacing: '.06em', marginTop: 4 }}>
              {roundLabel(match.round)} · {CATEGORY_LABELS[match.category as Category]?.toUpperCase()}
            </span>
          </div>
          <LogoBar tournament={tournament} height={48} gap={20}/>
        </div>
        {/* Two team blocks side by side with VS in middle */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr', alignItems: 'stretch' }}>
          <TeamBlock side="left" accent="orange">
            <PresoTeam match={match} team={1}/>
          </TeamBlock>
          <div style={{
            display: 'grid', placeItems: 'center', background: '#0a2236',
            fontSize: 44, fontWeight: 900, color: CH.orange, letterSpacing: '.04em',
            fontStyle: 'italic',
          }}>VS</div>
          <TeamBlock side="right" accent="navy">
            <PresoTeam match={match} team={2}/>
          </TeamBlock>
        </div>
      </div>
    </div>
  )
}
function PresoTeam({ match, team }: { match: any, team: 1 | 2 }) {
  const e = team === 1 ? match.entry1 : match.entry2
  const isDoubles = match.match_type === 'doubles'
  const players = [e?.player1, isDoubles ? e?.player2 : null].filter(Boolean)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 220 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {isDoubles ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {players.slice(0, 2).map((p: any, i: number) => (
              <img key={i} src={flagPath(p?.nationality)} alt="" style={{ width: 56, height: 36, objectFit: 'cover', borderRadius: 3, border: '1px solid rgba(255,255,255,.18)' }}/>
            ))}
          </div>
        ) : (
          <img src={flagPath(players[0]?.nationality)} alt="" style={{ width: 70, height: 46, objectFit: 'cover', borderRadius: 3, border: '1px solid rgba(255,255,255,.18)' }}/>
        )}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.28em', color: 'rgba(255,255,255,.78)' }}>
            {e?.seed ? `Nº ${e.seed} CABEZA DE SERIE` : ' '}
          </span>
          <span style={{ fontSize: 42, fontWeight: 900, fontStyle: 'italic', letterSpacing: '.02em', color: '#fff', marginTop: 2, textShadow: TS_HARD }}>
            {teamLabel(match, team)}
          </span>
        </div>
      </div>
      <div style={{ height: 1, background: 'rgba(255,255,255,.20)' }}/>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {players.map((p: any, i: number) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
            <span style={{ fontWeight: 700, letterSpacing: '.10em', color: 'rgba(255,255,255,.78)' }}>
              {(p.first_name ?? '').toUpperCase()} {(p.last_name ?? '').toUpperCase()}
            </span>
            <span style={{ fontWeight: 700, color: 'rgba(255,255,255,.66)' }}>
              {p.birth_date ? `${ageFrom(p.birth_date)} AÑOS` : ''}
              {p.ranking_rfet ? ` · #${p.ranking_rfet} RFET` : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 04 · PLAYER BIO — lateral card, foto + datos
// ════════════════════════════════════════════════════════════════════════════
export function PlayerBioChampionship({ visible, player, team, category, tournament }: {
  visible: boolean, player: Player | null, team: 1 | 2, category?: Category, tournament: Tournament | null,
}) {
  if (!player) return null
  const isLeft = team === 1
  return (
    <div style={{
      position: 'absolute',
      [isLeft ? 'left' : 'right']: 60,
      bottom: 220,
      width: 460,
      ...cardStyleLg, fontFamily: FONT,
      ...animStyle(visible, isLeft ? 'sgInR' : 'sgInL', isLeft ? 'sgOutR' : 'sgOutL', 700),
    }}>
      {/* accent stripe */}
      <div style={{ height: 6, background: team === 1 ? CH.orange : CH.navyMid }}/>
      <div style={{ padding: 22 }}>
        <div style={{ display: 'flex', gap: 16 }}>
          {player.photo_url ? (
            <img src={player.photo_url} alt="" style={{ width: 110, height: 110, borderRadius: 8, objectFit: 'cover', flex: 'none', border: '1px solid rgba(255,255,255,.16)' }}/>
          ) : (
            <div style={{ width: 110, height: 110, borderRadius: 8, background: 'rgba(255,255,255,.06)', display: 'grid', placeItems: 'center', flex: 'none' }}>
              <img src={flagPath(player.nationality)} alt="" style={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 2 }}/>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.26em', color: CH.muted }}>
              {category ? CATEGORY_LABELS[category]?.toUpperCase() : ''}
            </span>
            <span style={{ fontSize: 30, fontWeight: 900, fontStyle: 'italic', color: CH.text, lineHeight: 1.05, marginTop: 2 }}>
              {(player.first_name ?? '').toUpperCase()}
            </span>
            <span style={{ fontSize: 30, fontWeight: 900, fontStyle: 'italic', color: CH.text, lineHeight: 1.05 }}>
              {(player.last_name ?? '').toUpperCase()}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.06em', color: CH.orange, marginTop: 6 }}>
              {countryName(player.nationality)}
            </span>
          </div>
        </div>
        <div style={{ height: 1, background: 'rgba(255,255,255,.12)', margin: '16px 0' }}/>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <BioRow label="EDAD" value={player.birth_date ? `${ageFrom(player.birth_date)}` : '—'}/>
          <BioRow label="ALTURA" value={player.height_cm ? `${player.height_cm} cm` : '—'}/>
          <BioRow label="LATERALIDAD" value={lateralityShortEs(player.laterality)}/>
          <BioRow label="RANKING RFET" value={player.ranking_rfet ? `#${player.ranking_rfet}` : '—'}/>
          {player.club && <BioRow label="CLUB" value={player.club}/>}
          {player.federacion_autonomica && <BioRow label="FEDERACIÓN" value={player.federacion_autonomica}/>}
        </div>
      </div>
    </div>
  )
}
function BioRow({ label, value }: { label: string, value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.22em', color: CH.muted }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 800, color: CH.text, marginTop: 2 }}>{value}</span>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 05 · STATS PANEL — referencia 1 del cliente
// ════════════════════════════════════════════════════════════════════════════
export function StatsPanelChampionship({ visible, match, tournament, scope }: {
  visible: boolean, match: any, tournament: Tournament | null, scope: 'set_1' | 'set_2' | 'set_3' | 'match' | 'auto',
}) {
  if (!match) return null
  const score = match.score as Score | null
  const elapsed = useTicker(match.started_at ?? null, match.finished_at ?? null)
  const stats = match.stats // objeto { t1, t2 } con campos por scope
  const setsPlayed = score?.sets?.length ?? 0
  const inProgress = score?.match_status === 'in_progress'
  const currentSet = setsPlayed + (inProgress ? 1 : 0)
  const headerLabel = scope === 'match'
    ? 'ESTADÍSTICAS DEL PARTIDO'
    : `ESTADÍSTICAS SET ${scope === 'auto' ? currentSet : Number(String(scope).split('_')[1])}`

  // Filas de estadísticas — adaptadas a la referencia (Aces, Faltas saque,
  // Puntos decisivos, % al resto, Breaks, Puntos totales)
  const rows: { label: string, get: (s: any) => string }[] = [
    { label: 'ACES',                     get: (s) => String(s?.aces ?? 0) },
    { label: 'FALTAS DE SAQUE',          get: (s) => String(s?.double_faults ?? 0) },
    { label: 'PUNTOS DECISIVOS GANADOS', get: (s) => `${s?.break_points_won ?? 0}/${s?.break_points ?? 0}` },
    { label: 'PUNTOS GANADOS AL RESTO',  get: (s) => `${Math.round(s?.return_points_won_pct ?? 0)}%` },
    { label: 'PUNTOS DE BREAK GANADOS',  get: (s) => `${s?.break_points_won ?? 0}/${s?.break_points ?? 0}` },
    { label: 'PUNTOS TOTALES',           get: (s) => String(s?.total_points_won ?? 0) },
  ]

  return (
    <div style={{
      position: 'absolute', top: 100, left: '50%', transform: 'translateX(-50%)',
      width: 1100, ...cardStyleLg, fontFamily: FONT,
      ...animStyle(visible, 'sgInD', 'sgOutD', 700),
    }}>
      {/* Header con logos */}
      <div style={{
        display: 'grid', gridTemplateColumns: '180px 1fr 180px',
        alignItems: 'center', padding: '14px 22px', borderBottom: `1px solid ${CH.hairline}`,
      }}>
        {tournament?.logo_url ? <img src={tournament.logo_url} alt="" style={{ height: 40, objectFit: 'contain' }}/> : <span/>}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '.18em', color: CH.text }}>{headerLabel}</div>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.20em', color: CH.muted, marginTop: 2 }}>{fmtHHmm(elapsed)}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <LogoBar tournament={tournament} height={32} gap={14}/>
        </div>
      </div>

      {/* Headline con bloques de equipo + scoreline central */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px 1fr', alignItems: 'stretch', gap: 0 }}>
        <TeamBlock side="left" accent="orange">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 28, fontWeight: 900, fontStyle: 'italic', letterSpacing: '.02em', textShadow: TS_HARD }}>
              {teamLabel(match, 1)}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.06em', opacity: .85, marginTop: 2 }}>
              {teamSubtitleLong(match, 1)}
            </span>
          </div>
        </TeamBlock>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,.30)', padding: '8px 0', fontVariantNumeric: 'tabular-nums',
        }}>
          {(score?.sets ?? []).slice(0, 3).map((s: any, i: number) => (
            <div key={i} style={{ fontSize: 18, fontWeight: 800, color: CH.text, lineHeight: 1.15 }}>
              {s.t1 ?? 0} - {s.t2 ?? 0}
            </div>
          ))}
          {inProgress && (
            <div style={{ fontSize: 18, fontWeight: 800, color: CH.orange, lineHeight: 1.15 }}>
              {score?.current_game?.t1 ?? 0} - {score?.current_game?.t2 ?? 0}
            </div>
          )}
        </div>
        <TeamBlock side="right" accent="navy">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: 28, fontWeight: 900, fontStyle: 'italic', letterSpacing: '.02em', textShadow: TS_HARD }}>
              {teamLabel(match, 2)}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.06em', opacity: .85, marginTop: 2 }}>
              {teamSubtitleLong(match, 2)}
            </span>
          </div>
        </TeamBlock>
      </div>

      {/* Filas de estadísticas */}
      <div>
        {rows.map((r, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '1fr 2fr 1fr',
            alignItems: 'center', padding: '10px 22px',
            borderTop: `1px solid ${CH.hairline}`,
          }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: CH.orange, fontVariantNumeric: 'tabular-nums' }}>
              {r.get(stats?.t1)}
            </span>
            <span style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, letterSpacing: '.16em', color: CH.text }}>
              {r.label}
            </span>
            <span style={{ fontSize: 18, fontWeight: 800, color: CH.text, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
              {r.get(stats?.t2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 06 · RESULTS GRID — tabla de resultados con highlight
// ════════════════════════════════════════════════════════════════════════════
export function ResultsGridChampionship({ visible, matches, highlightMatchId, tournament, category }: {
  visible: boolean, matches: any[], highlightMatchId?: string | null, tournament: Tournament | null, category?: string,
}) {
  const list = (matches ?? [])
    .filter(m => !category || m.category === category)
    .filter(m => m.score?.match_status === 'finished')
    .slice(0, 8)
  return (
    <div style={{
      position: 'absolute', top: 80, right: 60, width: 720,
      ...cardStyleLg, fontFamily: FONT,
      ...animStyle(visible, 'sgInL', 'sgOutL', 700),
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 22px', borderBottom: `1px solid ${CH.hairline}`,
      }}>
        <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '.22em', color: CH.text }}>RESULTADOS</span>
        <LogoBar tournament={tournament} height={26} gap={12}/>
      </div>
      <div>
        {list.length === 0 && (
          <div style={{ padding: 22, color: CH.muted, fontSize: 14 }}>Sin resultados todavía.</div>
        )}
        {list.map(m => {
          const isHL = m.id === highlightMatchId
          const winner: 1 | 2 = setsWonCount(m.score, 1) > setsWonCount(m.score, 2) ? 1 : 2
          return (
            <div key={m.id} style={{
              display: 'grid', gridTemplateColumns: '110px 1fr',
              borderTop: `1px solid ${CH.hairline}`,
              background: isHL ? 'rgba(245,124,0,.08)' : 'transparent',
            }}>
              <div style={{
                display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.22)',
                fontSize: 11, fontWeight: 800, letterSpacing: '.22em', color: CH.muted,
              }}>
                {ROUND_LABELS_SHORT_CH[m.round ?? ''] ?? (m.round ?? '')}
              </div>
              <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr' }}>
                <ResultRow match={m} team={1} isWinner={winner === 1}/>
                <ResultRow match={m} team={2} isWinner={winner === 2}/>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
function ResultRow({ match, team, isWinner }: { match: any, team: 1 | 2, isWinner: boolean }) {
  const sets = setsFor(match.score as Score | null, team, 3)
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 38px 38px 38px',
      alignItems: 'center', padding: '8px 14px',
      background: isWinner ? CH.orange : 'rgba(21,74,115,.5)',
      color: '#fff', borderTop: team === 2 ? '1px solid rgba(255,255,255,.10)' : 'none',
    }}>
      <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {teamLabel(match, team)}
      </span>
      {sets.map((v, i) => (
        <span key={i} style={{ fontSize: 16, fontWeight: 900, fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>
          {v == null ? '' : v}
        </span>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 07 · BRACKET — referencia 2 del cliente
// ════════════════════════════════════════════════════════════════════════════
const BRACKET_ORDER: Array<{ key: string, label: string }> = [
  { key: 'R32', label: '1/16' }, { key: 'R16', label: 'OCTAVOS' },
  { key: 'QF', label: 'CUARTOS DE FINAL' }, { key: 'SF', label: 'SEMIFINAL' },
  { key: 'F', label: 'FINAL' },
]
export function BracketViewChampionship({ visible, matches, highlightMatchId, tournament, category }: {
  visible: boolean, matches: any[], highlightMatchId?: string | null, tournament: Tournament | null, category?: string,
}) {
  const all = (matches ?? []).filter(m => !category || m.category === category)
  // Solo rondas con al menos un partido
  const rounds = BRACKET_ORDER.filter(r => all.some(m => m.round === r.key))
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: FONT,
      background: 'linear-gradient(180deg, rgba(7,28,45,.94) 0%, rgba(2,12,22,.97) 100%)',
      ...animStyle(visible, 'sgInF', 'sgOutF', 700),
    }}>
      <div style={{ width: 1600, ...cardStyleLg }}>
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center',
          padding: '16px 26px', borderBottom: `1px solid ${CH.hairline}`,
        }}>
          <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: '.22em', color: CH.text }}>
            {tournament?.name?.toUpperCase()}
          </span>
          <LogoBar tournament={tournament} height={36} gap={16}/>
        </div>

        {/* Round headers */}
        <div style={{
          display: 'grid', gridTemplateColumns: `repeat(${rounds.length}, 1fr)`,
          padding: '10px 0', background: 'rgba(0,0,0,.20)',
        }}>
          {rounds.map(r => (
            <div key={r.key} style={{
              textAlign: 'center', fontSize: 13, fontWeight: 800, letterSpacing: '.22em', color: CH.text,
            }}>{r.label}</div>
          ))}
        </div>

        {/* Bracket columns */}
        <div style={{
          display: 'grid', gridTemplateColumns: `repeat(${rounds.length}, 1fr)`,
          gap: 14, padding: 18,
        }}>
          {rounds.map((r, ri) => {
            const ms = all.filter(m => m.round === r.key)
            const spacing = Math.pow(2, ri) // separación creciente para "alinear" con árbol
            return (
              <div key={r.key} style={{
                display: 'flex', flexDirection: 'column', justifyContent: 'space-around',
                gap: 8 * spacing,
              }}>
                {ms.map((m, i) => {
                  const w: 1 | 2 = setsWonCount(m.score, 1) > setsWonCount(m.score, 2) ? 1 : 2
                  const finished = m.score?.match_status === 'finished'
                  return (
                    <div key={m.id ?? i} style={{
                      borderRadius: 6, overflow: 'hidden',
                      outline: m.id === highlightMatchId ? `2px solid ${CH.orange}` : 'none',
                    }}>
                      <BracketRow match={m} team={1} isWinner={finished && w === 1}/>
                      <BracketRow match={m} team={2} isWinner={finished && w === 2}/>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
function BracketRow({ match, team, isWinner }: { match: any, team: 1 | 2, isWinner: boolean }) {
  const sets = setsFor(match.score as Score | null, team, 3)
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 28px 28px 28px',
      alignItems: 'center', padding: '6px 10px',
      background: isWinner ? CH.orange : 'rgba(21,74,115,.55)',
      color: '#fff',
      borderBottom: team === 1 ? '1px solid rgba(255,255,255,.12)' : 'none',
    }}>
      <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {teamLabel(match, team) || '—'}
      </span>
      {sets.map((v, i) => (
        <span key={i} style={{ fontSize: 14, fontWeight: 900, fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>
          {v == null ? '' : v}
        </span>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 08 · WEATHER CARD
// ════════════════════════════════════════════════════════════════════════════
export function WeatherChampionship({ visible, weather, tournament }: {
  visible: boolean, weather: WeatherData | null, tournament: Tournament | null,
}) {
  if (!weather) return null
  return (
    <div style={{
      position: 'absolute', top: 90, right: 60, width: 320, ...cardStyleLg, fontFamily: FONT,
      ...animStyle(visible, 'sgInL', 'sgOutL', 600),
    }}>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.26em', color: CH.muted }}>
          CLIMA · {weather.location?.toUpperCase()}
        </span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 56, fontWeight: 900, color: CH.orange, lineHeight: 1, fontVariantNumeric: 'tabular-nums', textShadow: TS_HARD }}>
            {Math.round(weather.temperature_c)}°
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, color: CH.muted, letterSpacing: '.10em' }}>
            SENS. {Math.round(weather.feels_like_c)}°
          </span>
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '.06em', color: CH.text, textTransform: 'uppercase' }}>
          {weather.condition}
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
          <BioRow label="VIENTO" value={`${Math.round(weather.wind_speed_kmh)} km/h ${weather.wind_direction ?? ''}`}/>
          <BioRow label="HUMEDAD" value={`${weather.humidity_pct}%`}/>
          <BioRow label="LLUVIA 1H" value={`${weather.precipitation_mm_last_hour} mm`}/>
          <BioRow label="UV" value={String(weather.uv_index)}/>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 09 · COIN TOSS — sorteo de saque
// ════════════════════════════════════════════════════════════════════════════
export function CoinTossChampionship({ visible, match, tournament }: {
  visible: boolean, match: any, tournament: Tournament | null,
}) {
  if (!match) return null
  const winnerTeam: 1 | 2 = (match.coin_toss_winner ?? match.serving_team ?? 1) as 1 | 2
  const choice = match.coin_toss_choice ?? 'SAQUE'
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: FONT,
      ...animStyle(visible, 'sgInF', 'sgOutF', 650),
    }}>
      <div style={{ width: 880, ...cardStyleLg, padding: 28 }}>
        <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 800, letterSpacing: '.32em', color: CH.muted }}>
          SORTEO
        </div>
        <div style={{ textAlign: 'center', fontSize: 36, fontWeight: 900, color: CH.text, marginTop: 4, letterSpacing: '.08em' }}>
          GANA EL SORTEO
        </div>
        <div style={{ marginTop: 18 }}>
          <TeamBlock side="left" accent={winnerTeam === 1 ? 'orange' : 'navy'}>
            <div style={{ textAlign: 'center', fontSize: 36, fontWeight: 900, fontStyle: 'italic', letterSpacing: '.04em' }}>
              {teamLabel(match, winnerTeam)}
            </div>
          </TeamBlock>
        </div>
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 18, fontWeight: 700, letterSpacing: '.18em', color: CH.muted }}>
          ELIGE
        </div>
        <div style={{ textAlign: 'center', fontSize: 32, fontWeight: 900, color: CH.orange, marginTop: 4, letterSpacing: '.06em' }}>
          {String(choice).toUpperCase()}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 10 · TOURNAMENT INTRO — pantalla completa
// ════════════════════════════════════════════════════════════════════════════
export function TournamentIntroChampionship({ visible, tournament }: {
  visible: boolean, tournament: Tournament | null,
}) {
  if (!tournament) return null
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: FONT,
      background: 'linear-gradient(180deg, rgba(7,28,45,.96) 0%, rgba(2,12,22,.99) 100%)',
      ...animStyle(visible, 'sgInZ', 'sgOutZ', 800),
    }}>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        {tournament.logo_url && (
          <img src={tournament.logo_url} alt="" style={{ maxHeight: 180, objectFit: 'contain', filter: 'drop-shadow(0 12px 32px rgba(0,0,0,.45))' }}/>
        )}
        <div style={{ height: 4, width: 120, background: CH.orange, borderRadius: 2 }}/>
        <div style={{ fontSize: 64, fontWeight: 900, fontStyle: 'italic', letterSpacing: '.06em', color: CH.text, lineHeight: 1.05, textShadow: TS_HARD }}>
          {tournament.name?.toUpperCase()}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '.18em', color: CH.muted }}>
          {tournament.venue_name?.toUpperCase()} · {tournament.venue_city?.toUpperCase()}
        </div>
        <div style={{ marginTop: 14 }}>
          <LogoBar tournament={tournament} height={48} gap={28}/>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 11 · VENUE CARD — sede
// ════════════════════════════════════════════════════════════════════════════
export function VenueCardChampionship({ visible, tournament }: {
  visible: boolean, tournament: Tournament | null,
}) {
  if (!tournament) return null
  return (
    <div style={{
      position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)',
      width: 900, ...cardStyleLg, fontFamily: FONT,
      ...animStyle(visible, 'sgInU', 'sgOutU', 650),
    }}>
      <div style={{ height: 6, background: CH.orange }}/>
      <div style={{ padding: '22px 28px', display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.30em', color: CH.muted }}>SEDE</span>
          <span style={{ fontSize: 36, fontWeight: 900, fontStyle: 'italic', color: CH.text, letterSpacing: '.04em', marginTop: 2 }}>
            {tournament.venue_name?.toUpperCase()}
          </span>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '.14em', color: CH.orange, marginTop: 2 }}>
            {tournament.venue_city?.toUpperCase()}
          </span>
        </div>
        <LogoBar tournament={tournament} height={42} gap={18}/>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 12 · REFEREE LOWER THIRD
// ════════════════════════════════════════════════════════════════════════════
export function RefereeLowerThirdChampionship({ visible, referee, tournament }: {
  visible: boolean, referee: { full_name: string, federacion?: string | null } | null, tournament: Tournament | null,
}) {
  if (!referee) return null
  return (
    <div style={{
      position: 'absolute', bottom: 80, left: 60, width: 520, ...cardStyleLg, fontFamily: FONT,
      ...animStyle(visible, 'sgInR', 'sgOutR', 650),
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '6px 1fr' }}>
        <div style={{ background: CH.orange }}/>
        <div style={{ padding: '14px 20px' }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.28em', color: CH.muted }}>JUEZ ÁRBITRO</span>
          <div style={{ fontSize: 26, fontWeight: 900, fontStyle: 'italic', color: CH.text, letterSpacing: '.02em', marginTop: 2 }}>
            {referee.full_name.toUpperCase()}
          </div>
          {referee.federacion && (
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.16em', color: CH.orange }}>
              {referee.federacion.toUpperCase()}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 13 · AWARDS PODIUM
// ════════════════════════════════════════════════════════════════════════════
export function AwardsPodiumChampionship({ visible, data, tournament }: {
  visible: boolean, data: any, tournament: Tournament | null,
}) {
  if (!data) return null
  // data esperado: { champion: {label, players[]}, runner_up: {...}, third: {...} }
  const items = [
    { rank: 1, label: 'CAMPEÓN',     accent: CH.orange,  data: data?.champion },
    { rank: 2, label: 'SUBCAMPEÓN',  accent: CH.navyMid, data: data?.runner_up },
    { rank: 3, label: 'TERCERO',     accent: 'rgba(21,74,115,.55)', data: data?.third },
  ].filter(i => i.data)
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: FONT,
      background: 'linear-gradient(180deg, rgba(7,28,45,.94) 0%, rgba(2,12,22,.97) 100%)',
      ...animStyle(visible, 'sgInZ', 'sgOutZ', 800),
    }}>
      <div style={{ width: 1200, ...cardStyleLg }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 26px', borderBottom: `1px solid ${CH.hairline}`,
        }}>
          <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: '.22em', color: CH.text }}>PALMARÉS</span>
          <LogoBar tournament={tournament} height={36} gap={16}/>
        </div>
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((it, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '70px 1fr',
              background: it.accent, color: '#fff', borderRadius: 8, overflow: 'hidden',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.16), inset 0 -2px 0 rgba(0,0,0,.18)',
            }}>
              <div style={{ display: 'grid', placeItems: 'center', fontSize: 36, fontWeight: 900, fontStyle: 'italic' }}>
                {it.rank}
              </div>
              <div style={{ padding: '14px 18px', borderLeft: '1px solid rgba(255,255,255,.18)' }}>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.26em', opacity: .85 }}>{it.label}</span>
                <div style={{ fontSize: 26, fontWeight: 900, fontStyle: 'italic', letterSpacing: '.04em', marginTop: 2 }}>
                  {Array.isArray(it.data?.players)
                    ? it.data.players.map((p: any) => firstSurname(p).toUpperCase()).join(' / ')
                    : (it.data?.label ?? '')}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
