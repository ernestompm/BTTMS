'use client'
// ============================================================================
// Streaming Graphics — CHAMPIONSHIP skin (premium ATP/WTA broadcast)
// ============================================================================
// Filosofía visual aplicada tras feedback del cliente (v2):
//
//  - **Sin diferenciación por equipo A/B**: ambos equipos comparten tratamiento.
//    El NARANJA #f57c00 marca al GANADOR, al equipo que va por delante, al
//    mejor valor de cada stat, o el set actual — no al "team 1".
//  - **Aéreo y transparente**: backgrounds muy translúcidos (.55–.70) con blur
//    fuerte (28px). El video del partido respira detrás.
//  - **Tipografía grande**: pensado para verse en móvil sin esforzarse.
//  - **Logos solo en gráficos grandes** (BigScoreboard, MatchPresentation,
//    Stats, Bracket, ResultsGrid, Awards, Intro, Venue) vía LogoBar.
//  - **Campos vacíos no se renderizan** (sin huecos visuales).
// ============================================================================

import React from 'react'
import type { Score, Tournament, Player, Sponsor, Category, WeatherData } from '@/types'
import { CATEGORY_LABELS } from '@/types'
import { hexAlpha, flagPath, palette, firstSurname, animStyle } from './stage-shared'

// ─── PALETA ─────────────────────────────────────────────────────────────────
const CH = {
  orange:    '#f57c00',           // accent principal — ganadores, líderes
  orangeDk:  '#d96a00',
  orangeLt:  '#ff9d3d',
  orangeGlow:'rgba(245,124,0,.40)',
  navy:      '#0a3c5e',
  navyDk:    '#062236',
  navyMid:   '#1a5a87',
  white:     '#ffffff',
  text:      'rgba(255,255,255,.98)',
  textStrong:'#ffffff',
  muted:     'rgba(255,255,255,.74)',
  mutedSoft: 'rgba(255,255,255,.55)',
  serve:     '#ffd54f',           // amarillo del punto de saque
  hairline:  'rgba(255,255,255,.14)',
  stroke:    'rgba(255,255,255,.18)',
}

const FONT = "'Barlow Condensed', 'Inter', system-ui, -apple-system, sans-serif"
const TS_HARD = '0 2px 4px rgba(0,0,0,.65), 0 4px 16px rgba(0,0,0,.40)'
const TS_SOFT = '0 1px 2px rgba(0,0,0,.45)'

// ─── HELPERS DE SCORE ───────────────────────────────────────────────────────
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
function setsWonCount(score: Score | null, team: 1 | 2): number {
  if (!score?.sets?.length) return 0
  const k = team === 1 ? 't1' : 't2'
  const ok = team === 1 ? 't2' : 't1'
  return score.sets.reduce((acc: number, s: any) => acc + ((s[k] ?? 0) > (s[ok] ?? 0) ? 1 : 0), 0)
}
function lastSetWinner(score: Score | null): 1 | 2 | null {
  if (!score?.sets?.length) return null
  const last = score.sets[score.sets.length - 1]
  if ((last?.t1 ?? 0) === (last?.t2 ?? 0)) return null
  return (last?.t1 ?? 0) > (last?.t2 ?? 0) ? 1 : 2
}

// ─── TIEMPO ─────────────────────────────────────────────────────────────────
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
  const s = Math.max(0, secs | 0)
  const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60)
  return hh > 0 ? `${hh}H ${String(mm).padStart(2, '0')}'` : `${mm}'`
}

// ─── PERSONAS ───────────────────────────────────────────────────────────────
function ageFrom(iso: string) {
  const d = new Date(iso); const now = new Date(); let a = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--
  return a
}
function lateralityShortEs(laterality: string | null | undefined) {
  if (laterality === 'left') return 'ZURDO'
  if (laterality === 'ambidextrous') return 'AMBIDIESTRO'
  if (laterality === 'right') return 'DIESTRO'
  return null
}

// ─── PAÍSES ─────────────────────────────────────────────────────────────────
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
  return COUNTRY_NAMES[nat.toUpperCase()] ?? nat.toUpperCase()
}

// ─── ROUNDS ─────────────────────────────────────────────────────────────────
const ROUND_LABELS_CH: Record<string, string> = {
  F: 'FINAL', SF: 'SEMIFINAL', QF: 'CUARTOS DE FINAL', R16: 'OCTAVOS DE FINAL',
  R32: 'DIECISEISAVOS', RR: 'FASE DE GRUPOS', GRP: 'FASE DE GRUPOS', CON: 'CONSOLACIÓN',
  Q1: 'CLASIFICATORIA 1', Q2: 'CLASIFICATORIA 2',
}
const ROUND_LABELS_SHORT_CH: Record<string, string> = {
  F: 'FINAL', SF: 'SEMIFINAL', QF: 'CUARTOS', R16: 'OCTAVOS', R32: '1/16',
}
const roundLabel = (r: any): string => ROUND_LABELS_CH[r ?? ''] ?? (r ?? '').toString().toUpperCase()

// ─── NOMBRES DE EQUIPO ──────────────────────────────────────────────────────
function fullPlayerName(p: any): string {
  if (!p) return ''
  return `${(p.first_name ?? '').toUpperCase()} ${(p.last_name ?? '').toUpperCase()}`.trim()
}
function teamFullName(match: any, team: 1 | 2): string {
  const e = team === 1 ? match?.entry1 : match?.entry2
  if (!e?.player1) return ''
  const isDoubles = match.match_type === 'doubles'
  if (isDoubles && e.player2) {
    return `${fullPlayerName(e.player1)} / ${fullPlayerName(e.player2)}`
  }
  return fullPlayerName(e.player1)
}
function teamShortName(match: any, team: 1 | 2): string {
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

// ─── CARDS GLASSY (más transparente, más blur — sensación aérea) ────────────
const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(15,55,84,.62) 0%, rgba(7,28,45,.72) 100%)',
  border: `1px solid ${CH.stroke}`,
  borderRadius: 12,
  backdropFilter: 'blur(28px) saturate(1.20)',
  WebkitBackdropFilter: 'blur(28px) saturate(1.20)',
  boxShadow: '0 24px 64px rgba(0,0,0,.50), inset 0 1px 0 rgba(255,255,255,.12)',
  overflow: 'hidden',
}
const cardStyleLg: React.CSSProperties = {
  ...cardStyle,
  borderRadius: 16,
  boxShadow: '0 32px 90px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.14)',
}

// ─── LOGO BAR (top-right consistente en gráficos grandes) ──────────────────
function LogoBar({ tournament, sponsor, height = 36, gap = 18 }: {
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
          {i > 0 && <span style={{ width: 1, height: height * 0.6, background: 'rgba(255,255,255,.20)' }}/>}
          <img src={src} alt="" style={{ height, objectFit: 'contain', opacity: .94 }}/>
        </React.Fragment>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 01 · SCOREBUG — top-left compacto, fuentes incrementadas para móvil
// ════════════════════════════════════════════════════════════════════════════
const STAT_LABELS: Record<string, string> = {
  aces: 'ACES', double_faults: 'DOBLES F.',
  serve_points_won_pct: '% SAQUE', return_points_won_pct: '% RESTO',
  break_points_won: 'BREAKS', total_points_won: 'PTS TOT.',
}
function statValue(stats: any, stat: string, team: 1 | 2): string | number {
  const t = team === 1 ? stats?.t1 : stats?.t2
  const v = t?.[stat]
  if (v == null) return '—'
  if (stat.endsWith('_pct')) return `${Math.round(v)}%`
  return v
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
  const lastWinner = lastSetWinner(score)

  const setsPlayed = score?.sets?.length ?? 0
  const setCount = Math.max(1, Math.min(3, setsPlayed + (inProgress ? 1 : 0)))
  const tbActive = !!(score?.tiebreak_active || score?.super_tiebreak_active)
  const currentSetIdx = inProgress ? setsPlayed : -1

  const showTicker = !!tickerStat && !!match.stats
  const tickerLabel = tickerStat ? (STAT_LABELS[tickerStat] ?? tickerStat.toUpperCase()) : ''

  const setColW = 44
  const gameColW = 58
  const nameColW = isDoubles ? 270 : 290
  const flagColW = 64
  const totalW = flagColW + nameColW + setColW * setCount + gameColW

  function teamPlayers(t: 1 | 2): any[] {
    const e = t === 1 ? match.entry1 : match.entry2
    if (!e) return []
    return [e.player1, isDoubles ? e.player2 : null].filter(Boolean)
  }
  function teamSubtitle(t: 1 | 2): string {
    const e = t === 1 ? match?.entry1 : match?.entry2
    const players = teamPlayers(t)
    if (!players.length) return ''
    const seed = e?.seed ? `${e.seed}.` : ''
    if (isDoubles) {
      const nats = Array.from(new Set(players.map((p: any) => p.nationality).filter(Boolean)))
      return nats.length === 1 ? `${seed}${countryName(nats[0])}` : seed
    }
    const p = players[0]
    const city = p.birth_city ? String(p.birth_city).toUpperCase() : ''
    const country = countryName(p.nationality)
    return `${seed}${[city, country].filter(Boolean).join(', ')}`.trim()
  }

  return (
    <div style={{
      position: 'absolute', top: 36, left: 36, width: totalW,
      ...cardStyle, fontFamily: FONT,
      ...animStyle(visible, 'sgInR', 'sgOutR', 600),
    }}>
      {[1, 2].map((tn) => {
        const team = tn as 1 | 2
        const players = teamPlayers(team)
        const sets = setsFor(score, team).slice(0, setCount)
        const pt = gamePoint(score, team)
        const isServing = serving === team
        const subtitle = teamSubtitle(team)
        const tickerVal = showTicker ? statValue(match.stats, tickerStat!, team) : null
        // Naranja en el nombre si lleva ventaja en el último set
        const isLeading = lastWinner === team

        return (
          <div key={team} style={{
            display: 'grid',
            gridTemplateColumns: `${flagColW}px ${nameColW}px ${Array(setCount).fill(`${setColW}px`).join(' ')} ${gameColW}px`,
            alignItems: 'stretch',
            borderTop: team === 2 ? `1px solid ${CH.hairline}` : 'none',
            minHeight: subtitle ? 52 : 44,
          }}>
            {/* serve dot + flag */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
              gap: 7, padding: '0 8px 0 12px',
            }}>
              <span aria-hidden style={{
                width: 8, height: 8, borderRadius: '50%',
                background: isServing ? CH.serve : 'transparent',
                boxShadow: isServing ? `0 0 10px ${CH.serve}` : 'none',
                flex: 'none',
                animation: isServing ? 'sgSrvPulse 1.6s infinite' : 'none',
              }}/>
              {isDoubles ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 'none' }}>
                  {players.slice(0, 2).map((p: any, i: number) => (
                    <img key={i} src={flagPath(p?.nationality)} alt=""
                      style={{ width: 26, height: 16, borderRadius: 1, objectFit: 'cover' }}/>
                  ))}
                </div>
              ) : (
                <img src={flagPath(players[0]?.nationality)} alt=""
                  style={{ width: 32, height: 21, borderRadius: 1, objectFit: 'cover', flex: 'none' }}/>
              )}
            </div>

            {/* nombre + subtitle */}
            <div style={{
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
              padding: '4px 8px 4px 0', minWidth: 0,
            }}>
              <span style={{
                fontSize: 23,
                fontWeight: 800,
                fontStyle: 'italic',
                letterSpacing: '.02em',
                color: isLeading ? CH.orange : CH.text,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                lineHeight: 1.05,
                textShadow: TS_HARD,
              }}>
                {teamShortName(match, team)}
              </span>
              {subtitle && (
                <span style={{
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: '.06em',
                  color: CH.muted,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  marginTop: 2,
                }}>
                  {subtitle}
                </span>
              )}
            </div>

            {/* set cells */}
            {sets.map((v, i) => {
              const isCurrent = i === currentSetIdx
              return (
                <div key={i} style={{
                  display: 'grid', placeItems: 'center',
                  background: isCurrent
                    ? CH.orange
                    : v != null ? 'rgba(255,255,255,.92)' : 'rgba(255,255,255,.05)',
                  borderLeft: `1px solid ${CH.hairline}`,
                  color: isCurrent ? '#fff' : v != null ? '#0e2236' : CH.mutedSoft,
                  fontSize: 26, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
                  textShadow: isCurrent ? '0 1px 2px rgba(0,0,0,.40)' : 'none',
                  boxShadow: isCurrent ? `inset 0 -3px 0 ${CH.orangeDk}` : 'none',
                }}>
                  {v == null ? '–' : v}
                </div>
              )
            })}

            {/* game / ticker cell */}
            <div style={{
              display: 'grid', placeItems: 'center',
              background: showTicker
                ? 'linear-gradient(135deg, rgba(251,191,36,.92), rgba(245,158,11,.85))'
                : tbActive ? '#fbbf24' : 'rgba(7,28,45,.85)',
              borderLeft: `1px solid ${CH.hairline}`,
              color: showTicker || tbActive ? '#1f1200' : CH.text,
              fontSize: 26, fontWeight: 800,
              fontStyle: showTicker ? 'italic' : 'normal',
              fontVariantNumeric: 'tabular-nums',
              textShadow: showTicker || tbActive ? 'none' : TS_HARD,
            }}>
              {showTicker ? tickerVal : pt}
            </div>
          </div>
        )
      })}

      {showTicker && (
        <div style={{
          padding: '5px 12px 6px',
          background: 'rgba(0,0,0,.32)',
          borderTop: `1px solid ${CH.hairline}`,
          textAlign: 'right',
          fontSize: 11, fontWeight: 800, letterSpacing: '.22em',
          color: '#fbbf24',
        }}>{tickerLabel}</div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 02 · BIG SCOREBOARD — lower-third, NOMBRES COMPLETOS, indicador de saque
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
  const winner: 1 | 2 | null = sets1 === sets2 ? null : (sets1 > sets2 ? 1 : 2)
  const leader = winner ?? lastSetWinner(score)
  const serving = match.serving_team as 1 | 2 | null
  const headerLabel = finished ? roundLabel(match.round) : (roundLabel(match.round) || 'EN JUEGO')
  const isDoubles = match.match_type === 'doubles'

  function Row({ team }: { team: 1 | 2 }) {
    const e = team === 1 ? match.entry1 : match.entry2
    const players = [e?.player1, isDoubles ? e?.player2 : null].filter(Boolean)
    const setsWon = team === 1 ? sets1 : sets2
    const isLeader = leader === team
    const isServing = serving === team

    // Cuando hay líder/ganador, su fila se enciende en naranja; la otra fila
    // queda en navy translúcido. Sin diferenciación A/B.
    const rowBg = isLeader
      ? `linear-gradient(90deg, ${hexAlpha(CH.orange, .92)} 0%, ${hexAlpha(CH.orangeDk, .92)} 100%)`
      : `linear-gradient(90deg, rgba(15,55,84,.62) 0%, rgba(10,40,62,.72) 100%)`
    const numBg = isLeader ? '#ffffff' : 'rgba(255,255,255,.10)'
    const numColor = isLeader ? CH.orangeDk : CH.text

    return (
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 110px',
        background: rowBg,
        boxShadow: isLeader ? 'inset 0 0 0 1px rgba(255,255,255,.16)' : 'none',
        minHeight: 78,
        alignItems: 'stretch',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '0 22px' }}>
          {/* serve indicator */}
          <span aria-hidden style={{
            width: 14, height: 14, borderRadius: '50%',
            background: isServing ? CH.serve : 'rgba(255,255,255,.10)',
            border: isServing ? 'none' : '1.5px solid rgba(255,255,255,.30)',
            boxShadow: isServing ? `0 0 14px ${CH.serve}` : 'none',
            animation: isServing ? 'sgSrvPulse 1.6s infinite' : 'none',
            flex: 'none',
          }}/>
          {/* flag */}
          {isDoubles ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 'none' }}>
              {players.slice(0, 2).map((p: any, i: number) => (
                <img key={i} src={flagPath(p?.nationality)} alt=""
                  style={{ width: 38, height: 25, borderRadius: 2, objectFit: 'cover', border: '1px solid rgba(255,255,255,.20)' }}/>
              ))}
            </div>
          ) : (
            <img src={flagPath(players[0]?.nationality)} alt=""
              style={{ width: 50, height: 33, borderRadius: 2, objectFit: 'cover', flex: 'none', border: '1px solid rgba(255,255,255,.20)' }}/>
          )}
          {/* nombre completo */}
          <span style={{
            fontSize: 32, fontWeight: 800, fontStyle: 'italic', letterSpacing: '.02em',
            color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            lineHeight: 1.05, textShadow: TS_HARD, flex: 1,
          }}>
            {teamFullName(match, team)}
          </span>
        </div>
        <div style={{
          display: 'grid', placeItems: 'center', borderLeft: '1px solid rgba(255,255,255,.18)',
          fontSize: 56, fontWeight: 900, color: numColor, background: numBg,
          fontVariantNumeric: 'tabular-nums',
          textShadow: isLeader ? 'none' : TS_HARD,
        }}>
          {setsWon}
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position: 'absolute', bottom: 70, left: '50%', transform: 'translateX(-50%)', width: 1240,
      ...cardStyleLg, fontFamily: FONT,
      ...animStyle(visible, 'sgInU', 'sgOutU', 700),
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 26px', borderBottom: `1px solid ${CH.hairline}`, background: 'rgba(0,0,0,.18)',
      }}>
        <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '.32em', color: CH.text }}>
          {headerLabel}
        </span>
        <LogoBar tournament={tournament} sponsor={sponsor} height={32} gap={16}/>
      </div>
      <div>
        <Row team={1}/>
        <div style={{ height: 1, background: CH.hairline }}/>
        <Row team={2}/>
      </div>
      <div style={{
        textAlign: 'right', padding: '6px 18px 8px', fontSize: 14, fontWeight: 800,
        letterSpacing: '.20em', color: CH.muted, background: 'rgba(0,0,0,.20)',
      }}>
        {fmtClockShort(elapsed)}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 03 · MATCH PRESENTATION — sin scrim, transparente, solo nombres completos
// ════════════════════════════════════════════════════════════════════════════
export function MatchPresentationChampionship({ visible, match, tournament }: {
  visible: boolean, match: any, tournament: Tournament | null,
}) {
  if (!match) return null
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
      fontFamily: FONT, pointerEvents: 'none',
      ...animStyle(visible, 'sgInF', 'sgOutF', 750),
    }}>
      {/* SIN scrim de fondo — el video respira detrás. Solo card flotante. */}
      <div style={{ width: 1480, ...cardStyleLg }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '22px 36px', borderBottom: `1px solid ${CH.hairline}`,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '.34em', color: CH.muted }}>
              {tournament?.name?.toUpperCase()}
            </span>
            <span style={{ fontSize: 32, fontWeight: 900, color: CH.orange, letterSpacing: '.08em', marginTop: 4, textShadow: TS_HARD }}>
              {roundLabel(match.round)} · {CATEGORY_LABELS[match.category as Category]?.toUpperCase()}
            </span>
          </div>
          <LogoBar tournament={tournament} height={56} gap={22}/>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 1fr', alignItems: 'stretch', minHeight: 280 }}>
          <PresoTeamSimple match={match} team={1}/>
          <div style={{
            display: 'grid', placeItems: 'center',
            fontSize: 64, fontWeight: 900, color: CH.orange, letterSpacing: '.04em',
            fontStyle: 'italic', textShadow: '0 4px 16px rgba(245,124,0,.45)',
          }}>VS</div>
          <PresoTeamSimple match={match} team={2}/>
        </div>
      </div>
    </div>
  )
}
function PresoTeamSimple({ match, team }: { match: any, team: 1 | 2 }) {
  const e = team === 1 ? match.entry1 : match.entry2
  const isDoubles = match.match_type === 'doubles'
  const players = [e?.player1, isDoubles ? e?.player2 : null].filter(Boolean)
  const align = team === 1 ? 'flex-start' : 'flex-end'
  const textAlign: 'left' | 'right' = team === 1 ? 'left' : 'right'
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 18, justifyContent: 'center',
      alignItems: align, padding: '36px 42px', textAlign,
    }}>
      {/* banderas grandes */}
      <div style={{ display: 'flex', flexDirection: team === 1 ? 'row' : 'row-reverse', gap: 10 }}>
        {players.map((p: any, i: number) => (
          <img key={i} src={flagPath(p?.nationality)} alt=""
            style={{ width: 76, height: 50, objectFit: 'cover', borderRadius: 3, border: '1px solid rgba(255,255,255,.22)', boxShadow: '0 6px 24px rgba(0,0,0,.40)' }}/>
        ))}
      </div>
      {/* nombres completos — uno por línea para que se lean */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {players.map((p: any, i: number) => (
          <div key={i} style={{
            fontSize: 56, fontWeight: 900, fontStyle: 'italic', letterSpacing: '.02em',
            color: CH.text, lineHeight: 1.0, textShadow: TS_HARD,
          }}>
            {fullPlayerName(p)}
          </div>
        ))}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 04 · PLAYER BIO — datos grandes, campos vacíos OCULTOS, accent naranja
// ════════════════════════════════════════════════════════════════════════════
export function PlayerBioChampionship({ visible, player, team, category, tournament }: {
  visible: boolean, player: Player | null, team: 1 | 2, category?: Category, tournament: Tournament | null,
}) {
  if (!player) return null
  const isLeft = team === 1

  // Campos visibles solo si tienen valor (sin huecos)
  const fields: Array<{ label: string, value: string }> = []
  if (player.birth_date) fields.push({ label: 'EDAD', value: `${ageFrom(player.birth_date)} AÑOS` })
  if (player.height_cm) fields.push({ label: 'ALTURA', value: `${player.height_cm} CM` })
  const lat = lateralityShortEs(player.laterality)
  if (lat) fields.push({ label: 'LATERALIDAD', value: lat })
  if (player.ranking_rfet) fields.push({ label: 'RANKING RFET', value: `#${player.ranking_rfet}` })
  if (player.ranking_itf) fields.push({ label: 'RANKING ITF', value: `#${player.ranking_itf}` })
  if (player.club) fields.push({ label: 'CLUB', value: player.club.toUpperCase() })
  if (player.federacion_autonomica) fields.push({ label: 'FEDERACIÓN', value: player.federacion_autonomica.toUpperCase() })
  if (player.birth_city) fields.push({ label: 'CIUDAD', value: player.birth_city.toUpperCase() })

  return (
    <div style={{
      position: 'absolute',
      [isLeft ? 'left' : 'right']: 60,
      bottom: 200,
      width: 540,
      ...cardStyleLg, fontFamily: FONT,
      ...animStyle(visible, isLeft ? 'sgInR' : 'sgInL', isLeft ? 'sgOutR' : 'sgOutL', 700),
    }}>
      {/* accent naranja (siempre, sin diferenciar equipos) */}
      <div style={{ height: 8, background: `linear-gradient(90deg, ${CH.orange} 0%, ${CH.orangeDk} 100%)` }}/>

      <div style={{ padding: '24px 26px' }}>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
          {player.photo_url ? (
            <img src={player.photo_url} alt=""
              style={{ width: 130, height: 130, borderRadius: 10, objectFit: 'cover', flex: 'none', border: '2px solid rgba(255,255,255,.20)' }}/>
          ) : (
            <div style={{
              width: 130, height: 130, borderRadius: 10, background: 'rgba(255,255,255,.06)',
              display: 'grid', placeItems: 'center', flex: 'none', border: '1px solid rgba(255,255,255,.10)',
            }}>
              <img src={flagPath(player.nationality)} alt=""
                style={{ width: 80, height: 53, objectFit: 'cover', borderRadius: 2 }}/>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0, flex: 1 }}>
            {category && (
              <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.28em', color: CH.muted }}>
                {CATEGORY_LABELS[category]?.toUpperCase()}
              </span>
            )}
            <span style={{ fontSize: 36, fontWeight: 900, fontStyle: 'italic', color: CH.text, lineHeight: 1.02, marginTop: 4, textShadow: TS_HARD, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {(player.first_name ?? '').toUpperCase()}
            </span>
            <span style={{ fontSize: 36, fontWeight: 900, fontStyle: 'italic', color: CH.text, lineHeight: 1.02, textShadow: TS_HARD, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {(player.last_name ?? '').toUpperCase()}
            </span>
            {player.nationality && (
              <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '.10em', color: CH.orange, marginTop: 6 }}>
                {countryName(player.nationality)}
              </span>
            )}
          </div>
        </div>

        {fields.length > 0 && (
          <>
            <div style={{ height: 1, background: CH.hairline, margin: '20px 0 18px' }}/>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              {fields.map((f, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.24em', color: CH.muted }}>{f.label}</span>
                  <span style={{ fontSize: 24, fontWeight: 800, color: CH.text, marginTop: 3, textShadow: TS_SOFT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {f.value}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 05 · STATS PANEL — centrado, fuentes grandes, highlight de mejor stat
// ════════════════════════════════════════════════════════════════════════════
export function StatsPanelChampionship({ visible, match, tournament, scope }: {
  visible: boolean, match: any, tournament: Tournament | null, scope: 'set_1' | 'set_2' | 'set_3' | 'match' | 'auto',
}) {
  if (!match) return null
  const score = match.score as Score | null
  const elapsed = useTicker(match.started_at ?? null, match.finished_at ?? null)
  const stats = match.stats
  const setsPlayed = score?.sets?.length ?? 0
  const inProgress = score?.match_status === 'in_progress'
  const currentSet = setsPlayed + (inProgress ? 1 : 0)
  const lastWinner = lastSetWinner(score)
  const headerLabel = scope === 'match'
    ? 'ESTADÍSTICAS DEL PARTIDO'
    : `ESTADÍSTICAS SET ${scope === 'auto' ? currentSet : Number(String(scope).split('_')[1])}`

  // Filas con función de "mejor": indica si t1 o t2 va por delante en esa stat.
  // Para porcentajes y conteos, mayor = mejor. Para faltas, menor = mejor.
  const rows: Array<{ label: string, get: (s: any) => string, raw: (s: any) => number, lowerIsBetter?: boolean }> = [
    { label: 'ACES',                     get: s => String(s?.aces ?? 0),                                                raw: s => s?.aces ?? 0 },
    { label: 'FALTAS DE SAQUE',          get: s => String(s?.double_faults ?? 0),                                       raw: s => s?.double_faults ?? 0, lowerIsBetter: true },
    { label: '% PUNTOS DE SAQUE',        get: s => `${Math.round(s?.serve_points_won_pct ?? 0)}%`,                      raw: s => s?.serve_points_won_pct ?? 0 },
    { label: '% PUNTOS AL RESTO',        get: s => `${Math.round(s?.return_points_won_pct ?? 0)}%`,                     raw: s => s?.return_points_won_pct ?? 0 },
    { label: 'PUNTOS DE BREAK GANADOS',  get: s => `${s?.break_points_won ?? 0}/${s?.break_points ?? 0}`,               raw: s => s?.break_points_won ?? 0 },
    { label: 'PUNTOS TOTALES',           get: s => String(s?.total_points_won ?? 0),                                    raw: s => s?.total_points_won ?? 0 },
  ]

  function NameHeader({ team }: { team: 1 | 2 }) {
    const align: 'left' | 'right' = team === 1 ? 'left' : 'right'
    const isLeader = lastWinner === team
    return (
      <div style={{
        padding: '18px 26px',
        textAlign: align,
        background: isLeader
          ? `linear-gradient(${team === 1 ? '90deg' : '270deg'}, rgba(245,124,0,.85) 0%, rgba(217,106,0,.65) 100%)`
          : 'linear-gradient(180deg, rgba(15,55,84,.55) 0%, rgba(10,40,62,.65) 100%)',
        boxShadow: isLeader ? 'inset 0 0 0 1px rgba(255,255,255,.18)' : 'none',
        color: '#fff', display: 'flex', flexDirection: 'column',
        alignItems: team === 1 ? 'flex-start' : 'flex-end',
        justifyContent: 'center', gap: 4,
      }}>
        {isLeader && (
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.30em', opacity: .92 }}>
            ▲ ÚLTIMO SET
          </span>
        )}
        <span style={{ fontSize: 32, fontWeight: 900, fontStyle: 'italic', letterSpacing: '.02em', textShadow: TS_HARD, lineHeight: 1.05 }}>
          {teamShortName(match, team)}
        </span>
      </div>
    )
  }

  return (
    <div style={{
      position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)', width: 1180,
      ...cardStyleLg, fontFamily: FONT,
      ...animStyle(visible, 'sgInD', 'sgOutD', 700),
    }}>
      {/* Header con título centrado y logos */}
      <div style={{
        display: 'grid', gridTemplateColumns: '200px 1fr 200px',
        alignItems: 'center', padding: '18px 26px', borderBottom: `1px solid ${CH.hairline}`,
      }}>
        {tournament?.logo_url
          ? <img src={tournament.logo_url} alt="" style={{ height: 42, objectFit: 'contain', justifySelf: 'start' }}/>
          : <span/>}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '.20em', color: CH.text, textShadow: TS_HARD }}>{headerLabel}</div>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '.22em', color: CH.muted, marginTop: 4 }}>{fmtHHmm(elapsed)}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <LogoBar tournament={tournament} height={36} gap={14}/>
        </div>
      </div>

      {/* Headers de equipo */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        <NameHeader team={1}/>
        <NameHeader team={2}/>
      </div>

      {/* Filas de estadísticas — el mejor valor en naranja con glow */}
      <div>
        {rows.map((r, i) => {
          const v1 = r.raw(stats?.t1)
          const v2 = r.raw(stats?.t2)
          const better: 1 | 2 | null = v1 === v2 ? null : (
            r.lowerIsBetter ? (v1 < v2 ? 1 : 2) : (v1 > v2 ? 1 : 2)
          )
          const valStyle = (isBest: boolean): React.CSSProperties => ({
            fontSize: isBest ? 32 : 26,
            fontWeight: 900,
            color: isBest ? CH.orange : CH.text,
            fontVariantNumeric: 'tabular-nums',
            textShadow: isBest ? `0 0 18px ${CH.orangeGlow}, ${TS_HARD}` : TS_HARD,
            transition: 'all .3s ease',
          })
          return (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '1fr 2fr 1fr',
              alignItems: 'center', padding: '16px 26px',
              borderTop: `1px solid ${CH.hairline}`,
              background: i % 2 === 0 ? 'rgba(255,255,255,.02)' : 'transparent',
            }}>
              <span style={{ ...valStyle(better === 1), textAlign: 'left' }}>
                {r.get(stats?.t1)}
              </span>
              <span style={{
                textAlign: 'center', fontSize: 18, fontWeight: 800,
                letterSpacing: '.20em', color: CH.muted,
              }}>
                {r.label}
              </span>
              <span style={{ ...valStyle(better === 2), textAlign: 'right' }}>
                {r.get(stats?.t2)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 06 · RESULTS GRID — winner naranja, loser navy translúcido
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
      position: 'absolute', top: 80, right: 60, width: 760,
      ...cardStyleLg, fontFamily: FONT,
      ...animStyle(visible, 'sgInL', 'sgOutL', 700),
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 24px', borderBottom: `1px solid ${CH.hairline}`,
      }}>
        <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: '.24em', color: CH.text }}>RESULTADOS</span>
        <LogoBar tournament={tournament} height={28} gap={14}/>
      </div>
      <div>
        {list.length === 0 && (
          <div style={{ padding: 26, color: CH.muted, fontSize: 16, fontWeight: 700 }}>Sin resultados todavía.</div>
        )}
        {list.map(m => {
          const isHL = m.id === highlightMatchId
          const winner: 1 | 2 = setsWonCount(m.score, 1) > setsWonCount(m.score, 2) ? 1 : 2
          return (
            <div key={m.id} style={{
              display: 'grid', gridTemplateColumns: '120px 1fr',
              borderTop: `1px solid ${CH.hairline}`,
              background: isHL ? 'rgba(245,124,0,.10)' : 'transparent',
            }}>
              <div style={{
                display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.22)',
                fontSize: 13, fontWeight: 800, letterSpacing: '.22em', color: CH.muted,
              }}>
                {ROUND_LABELS_SHORT_CH[m.round ?? ''] ?? (m.round ?? '')}
              </div>
              <div>
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
      display: 'grid', gridTemplateColumns: '1fr 42px 42px 42px',
      alignItems: 'center', padding: '10px 18px',
      background: isWinner ? `linear-gradient(90deg, ${CH.orange} 0%, ${CH.orangeDk} 100%)` : 'rgba(15,55,84,.40)',
      color: '#fff',
      borderTop: team === 2 ? '1px solid rgba(255,255,255,.10)' : 'none',
      boxShadow: isWinner ? 'inset 0 0 0 1px rgba(255,255,255,.16)' : 'none',
    }}>
      <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: TS_SOFT }}>
        {teamShortName(match, team)}
      </span>
      {sets.map((v, i) => (
        <span key={i} style={{ fontSize: 18, fontWeight: 900, fontVariantNumeric: 'tabular-nums', textAlign: 'center', textShadow: TS_SOFT }}>
          {v == null ? '' : v}
        </span>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 07 · BRACKET — cada partido como CUADRO independiente, claro y separado
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
  const rounds = BRACKET_ORDER.filter(r => all.some(m => m.round === r.key))
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: FONT,
      pointerEvents: 'none',
      ...animStyle(visible, 'sgInF', 'sgOutF', 700),
    }}>
      <div style={{ width: 1700, ...cardStyleLg }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 32px', borderBottom: `1px solid ${CH.hairline}`,
        }}>
          <span style={{ fontSize: 26, fontWeight: 900, letterSpacing: '.24em', color: CH.text, textShadow: TS_HARD }}>
            {tournament?.name?.toUpperCase()}
          </span>
          <LogoBar tournament={tournament} height={42} gap={20}/>
        </div>

        {/* Round headers */}
        <div style={{
          display: 'grid', gridTemplateColumns: `repeat(${rounds.length}, 1fr)`,
          padding: '14px 18px', background: 'rgba(0,0,0,.22)', gap: 16,
        }}>
          {rounds.map(r => (
            <div key={r.key} style={{
              textAlign: 'center', fontSize: 15, fontWeight: 900, letterSpacing: '.26em', color: CH.orange,
              textShadow: TS_HARD,
            }}>{r.label}</div>
          ))}
        </div>

        {/* Bracket columns con cuadros independientes */}
        <div style={{
          display: 'grid', gridTemplateColumns: `repeat(${rounds.length}, 1fr)`,
          gap: 16, padding: 20,
        }}>
          {rounds.map((r, ri) => {
            const ms = all.filter(m => m.round === r.key)
            const spacing = Math.pow(2, ri)
            return (
              <div key={r.key} style={{
                display: 'flex', flexDirection: 'column', justifyContent: 'space-around',
                gap: 12 * spacing,
              }}>
                {ms.map((m, i) => {
                  const w: 1 | 2 = setsWonCount(m.score, 1) > setsWonCount(m.score, 2) ? 1 : 2
                  const finished = m.score?.match_status === 'finished'
                  const isHL = m.id === highlightMatchId
                  return (
                    <div key={m.id ?? i} style={{
                      borderRadius: 8, overflow: 'hidden',
                      background: 'rgba(15,55,84,.40)',
                      border: `1px solid ${isHL ? CH.orange : 'rgba(255,255,255,.12)'}`,
                      boxShadow: isHL
                        ? `0 0 24px ${CH.orangeGlow}, 0 4px 16px rgba(0,0,0,.32)`
                        : '0 4px 16px rgba(0,0,0,.32)',
                    }}>
                      <BracketRow match={m} team={1} isWinner={finished && w === 1}/>
                      <div style={{ height: 1, background: 'rgba(255,255,255,.10)' }}/>
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
      display: 'grid', gridTemplateColumns: '1fr 32px 32px 32px',
      alignItems: 'center', padding: '10px 14px',
      background: isWinner ? `linear-gradient(90deg, ${CH.orange} 0%, ${CH.orangeDk} 100%)` : 'transparent',
      color: '#fff',
    }}>
      <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: TS_SOFT }}>
        {teamShortName(match, team) || '—'}
      </span>
      {sets.map((v, i) => (
        <span key={i} style={{ fontSize: 16, fontWeight: 900, fontVariantNumeric: 'tabular-nums', textAlign: 'center', textShadow: TS_SOFT }}>
          {v == null ? '' : v}
        </span>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 08 · WEATHER — con icono de condición y fuentes grandes
// ════════════════════════════════════════════════════════════════════════════
function weatherIcon(condition: string | null | undefined): string {
  const c = (condition ?? '').toLowerCase()
  if (/torment|storm|trueno/.test(c)) return '⛈️'
  if (/lluv|rain|chubasc|llovizn/.test(c)) return '🌧️'
  if (/niev|snow/.test(c)) return '❄️'
  if (/niebla|fog|brum/.test(c)) return '🌫️'
  if (/nubl|cubiert|overcast/.test(c)) return '☁️'
  if (/parcial|partly|interval/.test(c)) return '⛅'
  if (/despej|sole|sunny|clear/.test(c)) return '☀️'
  return '🌤️'
}
export function WeatherChampionship({ visible, weather, tournament }: {
  visible: boolean, weather: WeatherData | null, tournament: Tournament | null,
}) {
  if (!weather) return null
  const icon = weatherIcon(weather.condition)
  return (
    <div style={{
      position: 'absolute', top: 80, right: 60, width: 380, ...cardStyleLg, fontFamily: FONT,
      ...animStyle(visible, 'sgInL', 'sgOutL', 600),
    }}>
      <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.28em', color: CH.muted }}>
          CLIMA · {weather.location?.toUpperCase()}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 84, lineHeight: 1, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,.40))' }}>{icon}</span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 76, fontWeight: 900, color: CH.orange, lineHeight: 1, fontVariantNumeric: 'tabular-nums', textShadow: TS_HARD }}>
              {Math.round(weather.temperature_c)}°
            </span>
            <span style={{ fontSize: 14, fontWeight: 800, color: CH.muted, letterSpacing: '.10em', marginTop: 2 }}>
              SENS. {Math.round(weather.feels_like_c)}°
            </span>
          </div>
        </div>
        <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '.06em', color: CH.text, textTransform: 'uppercase' }}>
          {weather.condition}
        </span>
        <div style={{ height: 1, background: CH.hairline }}/>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <WeatherRow label="VIENTO" value={`${Math.round(weather.wind_speed_kmh)} KM/H ${weather.wind_direction ?? ''}`}/>
          <WeatherRow label="HUMEDAD" value={`${weather.humidity_pct}%`}/>
          {weather.precipitation_mm_last_hour > 0 && (
            <WeatherRow label="LLUVIA 1H" value={`${weather.precipitation_mm_last_hour} MM`}/>
          )}
          <WeatherRow label="UV" value={String(weather.uv_index)}/>
        </div>
      </div>
    </div>
  )
}
function WeatherRow({ label, value }: { label: string, value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.24em', color: CH.muted }}>{label}</span>
      <span style={{ fontSize: 20, fontWeight: 800, color: CH.text, marginTop: 2, textShadow: TS_SOFT }}>{value}</span>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 09 · COIN TOSS — ABAJO-DERECHA, sin scrim, transparente
// ════════════════════════════════════════════════════════════════════════════
export function CoinTossChampionship({ visible, match, tournament }: {
  visible: boolean, match: any, tournament: Tournament | null,
}) {
  if (!match) return null
  const winnerTeam: 1 | 2 = (match.coin_toss_winner ?? match.serving_team ?? 1) as 1 | 2
  const choice = match.coin_toss_choice ?? 'SAQUE'
  return (
    <div style={{
      position: 'absolute', bottom: 70, right: 60, width: 540,
      ...cardStyleLg, fontFamily: FONT, pointerEvents: 'none',
      ...animStyle(visible, 'sgInL', 'sgOutL', 650),
    }}>
      {/* accent stripe naranja arriba */}
      <div style={{ height: 6, background: `linear-gradient(90deg, ${CH.orange} 0%, ${CH.orangeDk} 100%)` }}/>
      <div style={{ padding: '20px 24px' }}>
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.32em', color: CH.muted }}>
          SORTEO
        </div>
        <div style={{ fontSize: 30, fontWeight: 900, fontStyle: 'italic', color: CH.orange, marginTop: 6, letterSpacing: '.04em', textShadow: TS_HARD, lineHeight: 1.05 }}>
          {teamShortName(match, winnerTeam)}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '.18em', color: CH.muted, marginTop: 10 }}>
          ELIGE
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, color: CH.text, marginTop: 2, letterSpacing: '.06em', textShadow: TS_HARD }}>
          {String(choice).toUpperCase()}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 10 · TOURNAMENT INTRO — rehecho como CARD consistente con el resto
// ════════════════════════════════════════════════════════════════════════════
export function TournamentIntroChampionship({ visible, tournament }: {
  visible: boolean, tournament: Tournament | null,
}) {
  if (!tournament) return null
  const startDate = tournament.start_date ? new Date(tournament.start_date) : null
  const endDate = tournament.end_date ? new Date(tournament.end_date) : null
  const dateRange = startDate && endDate
    ? `${startDate.getDate()}–${endDate.getDate()} ${endDate.toLocaleDateString('es-ES', { month: 'long' }).toUpperCase()} ${endDate.getFullYear()}`
    : startDate
      ? startDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()
      : ''

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: FONT,
      pointerEvents: 'none',
      ...animStyle(visible, 'sgInZ', 'sgOutZ', 800),
    }}>
      <div style={{ width: 1280, ...cardStyleLg }}>
        {/* accent superior */}
        <div style={{ height: 8, background: `linear-gradient(90deg, ${CH.orange} 0%, ${CH.orangeLt} 50%, ${CH.orange} 100%)` }}/>

        <div style={{ padding: '52px 56px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, textAlign: 'center' }}>
          {tournament.logo_url && (
            <img src={tournament.logo_url} alt=""
              style={{ maxHeight: 140, objectFit: 'contain', filter: 'drop-shadow(0 12px 32px rgba(0,0,0,.50))' }}/>
          )}

          <div style={{ height: 4, width: 140, background: CH.orange, borderRadius: 2, boxShadow: `0 0 20px ${CH.orangeGlow}` }}/>

          <div style={{
            fontSize: 72, fontWeight: 900, fontStyle: 'italic', letterSpacing: '.04em',
            color: CH.text, lineHeight: 1.0, textShadow: TS_HARD,
          }}>
            {tournament.name?.toUpperCase()}
          </div>

          {(tournament.venue_name || tournament.venue_city) && (
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '.20em', color: CH.orange, textShadow: TS_HARD }}>
              {[tournament.venue_name, tournament.venue_city].filter(Boolean).join(' · ').toUpperCase()}
            </div>
          )}

          {dateRange && (
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '.28em', color: CH.muted }}>
              {dateRange}
            </div>
          )}

          <div style={{ height: 1, width: '60%', background: CH.hairline, margin: '8px 0' }}/>

          <LogoBar tournament={tournament} height={56} gap={32}/>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 11 · VENUE CARD — sede, estilo consistente
// ════════════════════════════════════════════════════════════════════════════
export function VenueCardChampionship({ visible, tournament }: {
  visible: boolean, tournament: Tournament | null,
}) {
  if (!tournament) return null
  return (
    <div style={{
      position: 'absolute', bottom: 110, left: '50%', transform: 'translateX(-50%)',
      width: 1000, ...cardStyleLg, fontFamily: FONT, pointerEvents: 'none',
      ...animStyle(visible, 'sgInU', 'sgOutU', 650),
    }}>
      <div style={{ height: 8, background: `linear-gradient(90deg, ${CH.orange} 0%, ${CH.orangeDk} 100%)` }}/>
      <div style={{ padding: '26px 32px', display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '.32em', color: CH.muted }}>SEDE</span>
          <span style={{ fontSize: 44, fontWeight: 900, fontStyle: 'italic', color: CH.text, letterSpacing: '.04em', marginTop: 4, textShadow: TS_HARD, lineHeight: 1.05 }}>
            {tournament.venue_name?.toUpperCase()}
          </span>
          {tournament.venue_city && (
            <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '.18em', color: CH.orange, marginTop: 4, textShadow: TS_HARD }}>
              {tournament.venue_city.toUpperCase()}
            </span>
          )}
        </div>
        <LogoBar tournament={tournament} height={48} gap={20}/>
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
      position: 'absolute', bottom: 90, left: 60, width: 580, ...cardStyle, fontFamily: FONT,
      pointerEvents: 'none',
      ...animStyle(visible, 'sgInR', 'sgOutR', 650),
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '8px 1fr' }}>
        <div style={{ background: `linear-gradient(180deg, ${CH.orange} 0%, ${CH.orangeDk} 100%)` }}/>
        <div style={{ padding: '16px 22px' }}>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.30em', color: CH.muted }}>JUEZ ÁRBITRO</span>
          <div style={{ fontSize: 30, fontWeight: 900, fontStyle: 'italic', color: CH.text, letterSpacing: '.02em', marginTop: 4, textShadow: TS_HARD, lineHeight: 1.05 }}>
            {referee.full_name.toUpperCase()}
          </div>
          {referee.federacion && (
            <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '.18em', color: CH.orange, textShadow: TS_HARD }}>
              {referee.federacion.toUpperCase()}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 13 · AWARDS PODIUM — palmarés, naranja gradiente por rango
// ════════════════════════════════════════════════════════════════════════════
export function AwardsPodiumChampionship({ visible, data, tournament }: {
  visible: boolean, data: any, tournament: Tournament | null,
}) {
  if (!data) return null
  const items = [
    { rank: 1, label: 'CAMPEÓN',     bg: `linear-gradient(90deg, ${CH.orange} 0%, ${CH.orangeDk} 100%)`,   intensity: 1.0, data: data?.champion },
    { rank: 2, label: 'SUBCAMPEÓN',  bg: `linear-gradient(90deg, ${hexAlpha(CH.orange, .55)} 0%, ${hexAlpha(CH.orangeDk, .50)} 100%)`, intensity: .75, data: data?.runner_up },
    { rank: 3, label: 'TERCERO',     bg: 'linear-gradient(90deg, rgba(15,55,84,.55) 0%, rgba(10,40,62,.55) 100%)',                    intensity: .55, data: data?.third },
  ].filter(i => i.data)
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: FONT,
      pointerEvents: 'none',
      ...animStyle(visible, 'sgInZ', 'sgOutZ', 800),
    }}>
      <div style={{ width: 1280, ...cardStyleLg }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 32px', borderBottom: `1px solid ${CH.hairline}`,
        }}>
          <span style={{ fontSize: 26, fontWeight: 900, letterSpacing: '.24em', color: CH.text, textShadow: TS_HARD }}>PALMARÉS</span>
          <LogoBar tournament={tournament} height={42} gap={20}/>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {items.map((it, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '90px 1fr',
              background: it.bg, color: '#fff', borderRadius: 10, overflow: 'hidden',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.18), inset 0 -2px 0 rgba(0,0,0,.20), 0 6px 24px rgba(0,0,0,.32)',
            }}>
              <div style={{ display: 'grid', placeItems: 'center', fontSize: 52, fontWeight: 900, fontStyle: 'italic', textShadow: TS_HARD }}>
                {it.rank}
              </div>
              <div style={{ padding: '18px 24px', borderLeft: '1px solid rgba(255,255,255,.18)' }}>
                <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.28em', opacity: .92 }}>{it.label}</span>
                <div style={{ fontSize: 32, fontWeight: 900, fontStyle: 'italic', letterSpacing: '.04em', marginTop: 4, textShadow: TS_HARD, lineHeight: 1.05 }}>
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
