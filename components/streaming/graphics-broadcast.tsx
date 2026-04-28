'use client'
// ============================================================================
// Streaming Graphics — BROADCAST skin (live TV style)
// ============================================================================
// Diseño dinámico tipo retransmisión deportiva:
//  - Cards inclinadas (skewX -8deg), contenido contra-skewed para legibilidad
//  - Sheen brillante que barre cada 5.2s
//  - Pill cells (border-radius 999px) para sets/games/points
//  - Italic uppercase con tracking ancho
//  - Doble accent al pie: cyan a la izquierda, coral a la derecha
//  - Speed lines decorativas en gráficos takeover (esfera deportiva)
//  - Inter 950 weight para nombres, glass dark
// ============================================================================

import React, { useEffect, useState } from 'react'
import type { Player, Score, Sponsor, Tournament, WeatherData, Category } from '@/types'
import { CATEGORY_LABELS } from '@/types'
import { hexAlpha, flagPath, palette, firstSurname } from './stage-shared'

// ─── PALETA ─────────────────────────────────────────────────────────────────
const BC = {
  cyan:    '#00e0c6',
  coral:   '#ff7b61',
  sand:    '#d8b682',
  white:   'rgba(255,255,255,.96)',
  muted:   'rgba(255,255,255,.64)',
  dark:    'rgba(7,14,20,.72)',
  stroke:  'rgba(255,255,255,.24)',
}
const FONT = "'Inter', 'SF Pro Display', system-ui, -apple-system, sans-serif"
const SKEW_DEG = 8
const SKEW_OUTER = `skewX(-${SKEW_DEG}deg)`
const SKEW_INNER = `skewX(${SKEW_DEG}deg)`
const TS_HARD = '0 1px 2px rgba(0,0,0,.55), 0 2px 12px rgba(0,0,0,.35)'

// ─── ETIQUETAS ──────────────────────────────────────────────────────────────
const ROUND_LABELS: Record<string, string> = {
  F: 'Final', SF: 'Semifinal', QF: 'Cuartos de final', R16: 'Octavos de final',
  R32: 'Dieciseisavos', RR: 'Fase de grupos', GRP: 'Fase de grupos', CON: 'Consolación',
  Q1: 'Clasificatoria 1', Q2: 'Clasificatoria 2',
}
const ROUND_SHORT: Record<string, string> = {
  F: 'FINAL', SF: 'SEMIFINAL', QF: 'QUARTERFINAL', R16: 'ROUND OF 16', R32: 'ROUND OF 32',
}
const roundLabel = (r: any): string => ROUND_LABELS[r ?? ''] ?? (r ?? '')

// ─── HELPERS DE SCORE ──────────────────────────────────────────────────────
const PTS = ['0','15','30','40']
function gamePoint(score: Score | null, team: 1|2): string {
  if (!score) return '0'
  const k = team === 1 ? 't1' : 't2'
  if (score.super_tiebreak_active || score.tiebreak_active) return String(score.tiebreak_score?.[k] ?? 0)
  if (score.deuce) return '40'
  return PTS[score.current_game?.[k] ?? 0] ?? '0'
}
function setsFor(score: Score | null, team: 1|2, n: number = 3): Array<number|null> {
  const out: Array<number|null> = Array(n).fill(null)
  if (!score) return out
  const k = team === 1 ? 't1' : 't2'
  const sets = score.sets ?? []
  for (let i = 0; i < Math.min(n, sets.length); i++) out[i] = sets[i][k]
  return out
}
function setsWonCount(score: Score | null, team: 1|2): number {
  if (!score?.sets?.length) return 0
  const k = team === 1 ? 't1' : 't2'
  const ok = team === 1 ? 't2' : 't1'
  return score.sets.reduce((acc: number, s: any) => acc + ((s[k] ?? 0) > (s[ok] ?? 0) ? 1 : 0), 0)
}
function ageFrom(iso: string) {
  const d = new Date(iso); const now = new Date(); let a = now.getFullYear()-d.getFullYear()
  const m = now.getMonth()-d.getMonth()
  if (m<0 || (m===0 && now.getDate()<d.getDate())) a--
  return a
}
function lateralityShortEs(laterality: string|null|undefined) {
  if (laterality === 'left') return 'ZURDO'
  if (laterality === 'ambidextrous') return 'AMBIDIESTRO'
  return 'DIESTRO'
}

// ─── ESTILOS BASE REUTILIZABLES ────────────────────────────────────────────
// IMPORTANTE: NO incluyo `position` aquí — cada componente lo define como
// `absolute` con su anchor (top/left/bottom/right). Si pongo `position:
// relative` aquí y luego hago spread con `...cardStyle()` DESPUES de
// `position:absolute`, el spread sobrescribe el absolute, todas las cards
// se vuelven relative y se apilan arriba-izquierda. Bug encontrado.
//
// Los hijos absolutos (Sheen, Accents, SpeedLines) funcionan igual con
// padre `position: absolute` que con `position: relative` — ambos crean
// un containing block.
const cardStyle = (radius: number = 30): React.CSSProperties => ({
  background: 'linear-gradient(135deg, rgba(12,24,32,.72) 0%, rgba(12,24,32,.42) 100%)',
  border: `1px solid ${BC.stroke}`,
  borderRadius: radius,
  backdropFilter: 'blur(24px) saturate(1.16)',
  WebkitBackdropFilter: 'blur(24px) saturate(1.16)',
  boxShadow: '0 28px 90px rgba(0,0,0,.40)',
  overflow: 'hidden',
})

// Sheen brillante que barre el card cada 5.2s
function Sheen() {
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      background: 'linear-gradient(110deg, transparent 20%, rgba(255,255,255,.16) 47%, transparent 64%)',
      animation: 'bcSheen 5.2s ease-in-out infinite',
      zIndex: 1,
    }}/>
  )
}

// Doble accent al pie: cyan izquierda, coral derecha
function Accents() {
  return (
    <>
      <div style={{ position: 'absolute', left: 0, bottom: 0, height: 3, width: '34%', background: BC.cyan, boxShadow: `0 0 20px ${BC.cyan}`, zIndex: 2 }}/>
      <div style={{ position: 'absolute', right: 0, bottom: 0, height: 3, width: '34%', background: BC.coral, boxShadow: `0 0 20px ${BC.coral}`, zIndex: 2 }}/>
    </>
  )
}

// Speed lines en background — solo para gráficos takeover (matches presentation, etc)
function SpeedLines() {
  const lines = [
    { top: '14%', left: '-42%', delay: '0s', width: 560, color: 'rgba(255,255,255,.5)' },
    { top: '36%', left: '-54%', delay: '1s', width: 560, color: `${BC.cyan}bb` },
    { top: '70%', left: '-48%', delay: '2.1s', width: 560, color: `${BC.coral}aa` },
    { top: '52%', left: '-68%', delay: '3s', width: 720, color: 'rgba(255,255,255,.5)' },
  ]
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: .56, zIndex: 1, overflow: 'hidden' }}>
      {lines.map((l, i) => (
        <div key={i} style={{
          position: 'absolute', top: l.top, left: l.left,
          width: l.width, height: 1,
          background: `linear-gradient(90deg, transparent, ${l.color}, transparent)`,
          transform: 'rotate(-13deg)',
          animation: `bcStreak 4.8s linear infinite`,
          animationDelay: l.delay,
        }}/>
      ))}
    </div>
  )
}

// Animaciones de entrada/salida con skew
const animSkew = (visible: boolean, dir: 'L'|'R'|'U'|'Z', ms: number = 750): React.CSSProperties => {
  const enterMap = { L: 'bcInLeftSkew', R: 'bcInRightSkew', U: 'bcInUpSkew', Z: 'bcInZoomSkew' }
  const exitMap  = { L: 'bcOutLeftSkew', R: 'bcOutRightSkew', U: 'bcOutUpSkew', Z: 'bcOutZoomSkew' }
  const name = visible ? enterMap[dir] : exitMap[dir]
  return {
    animation: `${name} ${ms}ms cubic-bezier(.2,.9,.18,1) both`,
    willChange: 'transform, opacity',
  }
}

// ─── PILL CELL (set / game / point) ────────────────────────────────────────
function PillCell({ value, kind, accent, height = 31 }: {
  value: string | number, kind: 'set' | 'game' | 'point', accent?: string, height?: number,
}) {
  const fontSize = kind === 'set' ? 14 : kind === 'point' ? 18 : 22
  const color = accent ?? (kind === 'set' ? 'rgba(255,255,255,.72)' : BC.white)
  const glow = accent ? `0 0 18px ${hexAlpha(accent, .34)}` : 'none'
  return (
    <div style={{
      height, display: 'grid', placeItems: 'center',
      borderRadius: 999, background: 'rgba(255,255,255,.09)',
      border: '1px solid rgba(255,255,255,.13)',
      fontWeight: 950, fontSize, color, textShadow: glow,
      fontVariantNumeric: 'tabular-nums', minWidth: kind === 'point' ? 56 : 44,
      padding: '0 10px',
    }}>
      {value}
    </div>
  )
}

// ─── KICKER / SUBTLE ────────────────────────────────────────────────────────
const kickerStyle = (color: string = BC.cyan): React.CSSProperties => ({
  textTransform: 'uppercase', letterSpacing: '.22em', fontSize: 11, fontWeight: 950,
  color, textShadow: TS_HARD,
})
const subtleStyle = (size = 10, color = BC.muted): React.CSSProperties => ({
  textTransform: 'uppercase', letterSpacing: '.16em', fontSize: size, fontWeight: 900,
  color, textShadow: TS_HARD,
})
const italicNameStyle = (size: number, color: string = BC.white): React.CSSProperties => ({
  textTransform: 'uppercase', fontSize: size, fontWeight: 950, fontStyle: 'italic',
  letterSpacing: '.06em', lineHeight: .95, color, textShadow: TS_HARD,
})

// ════════════════════════════════════════════════════════════════════════════
// 01 · SCOREBUG BROADCAST — top-left, 510×128, skewed
// ════════════════════════════════════════════════════════════════════════════
const STAT_LABELS: Record<string, string> = {
  aces: 'Aces', double_faults: 'Dobles faltas',
  serve_points_won_pct: '% pts saque', return_points_won_pct: '% pts resto',
  break_points_won: 'Breaks ganados', total_points_won: 'Puntos totales',
}
function statValue(stats: any, stat: string, team: 1|2): string|number {
  const t = team === 1 ? stats?.t1 : stats?.t2
  const v = t?.[stat]
  if (v == null) return '—'
  if (stat.endsWith('_pct')) return `${Math.round(v)}%`
  return v
}

export function ScorebugBroadcast({ visible, match, tournament, tickerStat }: {
  visible: boolean, match: any, tournament: Tournament | null, tickerStat?: string | null,
}) {
  if (!match) return null
  const score = match.score as Score | null
  const isDoubles = match.match_type === 'doubles'
  const serving = match.serving_team as 1|2|null
  const inProgress = score?.match_status === 'in_progress'

  const setsPlayed = score?.sets?.length ?? 0
  const cs = score?.current_set ?? { t1: 0, t2: 0 }
  const tb = score?.tiebreak_score ?? { t1: 0, t2: 0 }
  const tbActive = !!(score?.tiebreak_active || score?.super_tiebreak_active)
  const cT1 = tbActive ? (tb.t1 ?? 0) : (cs.t1 ?? 0)
  const cT2 = tbActive ? (tb.t2 ?? 0) : (cs.t2 ?? 0)

  // El bug muestra: SET (sets ganados), GAME (games del set actual o tb), POINT (juego)
  const setLabel = inProgress
    ? `${setsPlayed + 1}º SET${tbActive ? ' · TB' : ''}`
    : (setsPlayed === 0 ? 'PRE-MATCH' : 'FINAL')

  const showTicker = !!tickerStat && !!match.stats
  const tickerLabel = tickerStat ? (STAT_LABELS[tickerStat] ?? tickerStat.toUpperCase()) : ''

  function teamName(t: 1|2) {
    const e = t === 1 ? match.entry1 : match.entry2
    if (!e) return ''
    if (isDoubles) {
      return [e.player1, e.player2].map((p:any) => firstSurname(p)).filter(Boolean).join(' / ')
    }
    return e.player1?.last_name ?? ''
  }
  function teamFlag(t: 1|2) {
    const e = t === 1 ? match.entry1 : match.entry2
    return e?.player1?.nationality
  }

  return (
    <div style={{
      position: 'absolute', top: 42, left: 42,
      width: 510, height: 128,
      ...cardStyle(28),
      transform: SKEW_OUTER,
      fontFamily: FONT,
      ...animSkew(visible, 'L', 700),
    }}>
      <Sheen/>

      {/* Title pill flotante encima del card */}
      <div style={{
        position: 'absolute', left: 24, top: -11, zIndex: 5,
        padding: '6px 15px', borderRadius: 999,
        background: 'rgba(8,18,25,.82)',
        border: `1px solid ${BC.stroke}`,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        transform: SKEW_INNER,
        ...subtleStyle(8, BC.white),
        letterSpacing: '.20em',
      }}>
        {setLabel}
      </div>

      {/* Inner content (counter-skewed) */}
      <div style={{
        height: '100%', padding: '22px 25px 16px',
        transform: SKEW_INNER,
        display: 'grid',
        gridTemplateColumns: '1fr 44px 54px 66px',
        gridTemplateRows: '18px 38px 38px',
        columnGap: 10, alignItems: 'center',
        position: 'relative', zIndex: 2,
      }}>
        {/* Labels row */}
        <span style={{ ...subtleStyle(8, 'rgba(255,255,255,.52)'), paddingLeft: 30 }}>
          {showTicker ? tickerLabel : 'JUGADORES'}
        </span>
        <span style={{ ...subtleStyle(8, 'rgba(255,255,255,.52)'), textAlign: 'center' }}>SET</span>
        <span style={{ ...subtleStyle(8, 'rgba(255,255,255,.52)'), textAlign: 'center' }}>{tbActive ? 'TB' : 'GAME'}</span>
        <span style={{ ...subtleStyle(8, 'rgba(255,255,255,.52)'), textAlign: 'center' }}>{showTicker ? 'STAT' : 'PTS'}</span>

        {/* Team 1 row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          minWidth: 0, whiteSpace: 'nowrap',
          fontSize: 13, fontWeight: 950, letterSpacing: '.07em', textTransform: 'uppercase',
          fontStyle: 'italic',
        }}>
          {serving === 1 ? <ServeDot color={BC.cyan}/> : <span style={{ width: 8 }}/>}
          <span style={{ fontSize: 16 }}>{flagEmoji(teamFlag(1))}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', textShadow: TS_HARD }}>{teamName(1).toUpperCase()}</span>
        </div>
        <PillCell value={setsWonCount(score, 1)} kind="set"/>
        <PillCell value={cT1} kind="game" accent={BC.cyan}/>
        <PillCell
          value={showTicker ? statValue(match.stats, tickerStat!, 1) : gamePoint(score, 1)}
          kind="point" accent={tbActive ? '#fbbf24' : undefined}
        />

        {/* Team 2 row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          minWidth: 0, whiteSpace: 'nowrap',
          fontSize: 13, fontWeight: 950, letterSpacing: '.07em', textTransform: 'uppercase',
          fontStyle: 'italic',
        }}>
          {serving === 2 ? <ServeDot color={BC.coral}/> : <span style={{ width: 8 }}/>}
          <span style={{ fontSize: 16 }}>{flagEmoji(teamFlag(2))}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', textShadow: TS_HARD }}>{teamName(2).toUpperCase()}</span>
        </div>
        <PillCell value={setsWonCount(score, 2)} kind="set"/>
        <PillCell value={cT2} kind="game" accent={BC.coral}/>
        <PillCell
          value={showTicker ? statValue(match.stats, tickerStat!, 2) : gamePoint(score, 2)}
          kind="point" accent={tbActive ? '#fbbf24' : undefined}
        />
      </div>

      <Accents/>
    </div>
  )
}

function ServeDot({ color }: { color: string }) {
  return (
    <span style={{
      width: 8, height: 8, borderRadius: '50%',
      background: color, boxShadow: `0 0 16px ${color}`,
      animation: 'bcServePulse 1.15s ease-in-out infinite',
      flex: 'none',
    }}/>
  )
}

// Bandera como emoji (regional indicators) — más simple que la imagen
function flagEmoji(nat: string | null | undefined): string {
  const n = (nat ?? 'ESP').toUpperCase()
  // Mapeo común
  const FLAGS: Record<string, string> = {
    ESP: '🇪🇸', ITA: '🇮🇹', FRA: '🇫🇷', POR: '🇵🇹', GER: '🇩🇪', BRA: '🇧🇷',
    ARG: '🇦🇷', USA: '🇺🇸', GBR: '🇬🇧', NED: '🇳🇱', BEL: '🇧🇪', SUI: '🇨🇭',
    AUT: '🇦🇹', POL: '🇵🇱', RUS: '🇷🇺', UKR: '🇺🇦', CZE: '🇨🇿', JPN: '🇯🇵',
    AUS: '🇦🇺', MEX: '🇲🇽', COL: '🇨🇴', CHI: '🇨🇱', URU: '🇺🇾', PER: '🇵🇪',
    VEN: '🇻🇪', ECU: '🇪🇨', BOL: '🇧🇴', PAR: '🇵🇾',
  }
  return FLAGS[n] ?? '🏳️'
}

// ════════════════════════════════════════════════════════════════════════════
// 02 · BIG SCOREBOARD BROADCAST — lower third 960×178, skewed -10deg
// ════════════════════════════════════════════════════════════════════════════
export function BigScoreboardBroadcast({ visible, match, tournament, sponsor }: {
  visible: boolean, match: any, tournament: Tournament | null, sponsor?: Sponsor | null, opts?: any,
}) {
  if (!match) return null
  const score = match.score as Score | null
  const isDoubles = match.match_type === 'doubles'

  const setsT1 = setsWonCount(score, 1)
  const setsT2 = setsWonCount(score, 2)
  const round = ROUND_SHORT[match.round] ?? roundLabel(match.round)
  const cat = (CATEGORY_LABELS[match.category as Category] ?? match.category ?? '').toUpperCase()

  function pairLines(t: 1|2): string[] {
    const e = t === 1 ? match.entry1 : match.entry2
    if (!e) return ['—']
    if (isDoubles) {
      const p1 = firstSurname(e.player1)
      const p2 = firstSurname(e.player2)
      return [p1, p2].filter(Boolean)
    }
    return [e.player1?.last_name ?? '—']
  }
  function flag(t: 1|2) {
    const e = t === 1 ? match.entry1 : match.entry2
    return e?.player1?.nationality
  }
  function countryName(nat: string | null | undefined): string {
    const n = (nat ?? 'ESP').toUpperCase()
    const N: Record<string, string> = {
      ESP: 'España', ITA: 'Italia', FRA: 'Francia', POR: 'Portugal',
      GER: 'Alemania', BRA: 'Brasil', ARG: 'Argentina', USA: 'EE.UU.',
      GBR: 'Reino Unido', NED: 'Países Bajos', BEL: 'Bélgica', SUI: 'Suiza',
      AUT: 'Austria', POL: 'Polonia', JPN: 'Japón', MEX: 'México',
    }
    return N[n] ?? n
  }

  return (
    <div style={{
      position: 'absolute', left: '50%', bottom: 64,
      width: 960, height: 178,
      ...cardStyle(34),
      transform: 'translateX(-50%) skewX(-10deg)',
      fontFamily: FONT,
      animation: visible ? 'bcInUpSkew 850ms cubic-bezier(.2,.9,.18,1) both' : 'bcOutUpSkew 700ms cubic-bezier(.2,.9,.18,1) both',
      willChange: 'transform, opacity',
    }}>
      <Sheen/>

      <div style={{
        height: '100%', padding: '18px 46px',
        transform: 'skewX(10deg)',
        display: 'grid',
        gridTemplateColumns: '1.15fr 116px 34px 116px 1.15fr',
        gridTemplateRows: '40px 88px 42px',
        alignItems: 'center', position: 'relative', zIndex: 2,
      }}>
        {/* Round label */}
        <div style={{ gridColumn: '1 / -1', textAlign: 'center', ...subtleStyle(12, 'rgba(255,255,255,.66)'), letterSpacing: '.24em' }}>
          {[match.match_type === 'doubles' ? 'DOBLES' : 'INDIVIDUAL', round, cat].filter(Boolean).join(' · ')}
        </div>

        {/* Pair 1 */}
        <div style={{ ...italicNameStyle(21), lineHeight: 1.15 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7, fontSize: 11, fontStyle: 'normal', color: BC.muted, letterSpacing: '.18em', fontWeight: 700 }}>
            <span style={{ fontSize: 16 }}>{flagEmoji(flag(1))}</span>
            <span>{countryName(flag(1)).toUpperCase()}</span>
          </div>
          {pairLines(1).map((l, i) => <div key={i}>{l.toUpperCase()}</div>)}
        </div>

        {/* Big sets */}
        <BigGameCell value={setsT1} accent={BC.cyan}/>
        <div style={{ width: 1, height: 86, background: 'rgba(255,255,255,.34)', justifySelf: 'center' }}/>
        <BigGameCell value={setsT2} accent={BC.coral}/>

        {/* Pair 2 */}
        <div style={{ ...italicNameStyle(21), lineHeight: 1.15, textAlign: 'right' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7, fontSize: 11, fontStyle: 'normal', color: BC.muted, letterSpacing: '.18em', fontWeight: 700, justifyContent: 'flex-end' }}>
            <span>{countryName(flag(2)).toUpperCase()}</span>
            <span style={{ fontSize: 16 }}>{flagEmoji(flag(2))}</span>
          </div>
          {pairLines(2).map((l, i) => <div key={i}>{l.toUpperCase()}</div>)}
        </div>

        {/* Sponsor pill */}
        {sponsor?.name && (
          <div style={{
            gridColumn: '1 / -1', justifySelf: 'center',
            display: 'flex', alignItems: 'center', gap: 13,
            padding: '8px 20px', borderRadius: 999,
            background: 'rgba(0,0,0,.18)',
            border: `1px solid ${BC.stroke}`,
            ...subtleStyle(10, BC.muted),
          }}>
            <span>PRESENTED BY</span>
            {sponsor.logo_url
              ? <img src={sponsor.logo_url} alt="" style={{ height: 22, objectFit: 'contain' }}/>
              : <b style={{ color: BC.white, letterSpacing: '.22em', fontSize: 12, fontWeight: 950 }}>{sponsor.name.toUpperCase()}</b>
            }
          </div>
        )}
      </div>

      <Accents/>
    </div>
  )
}

function BigGameCell({ value, accent }: { value: number, accent: string }) {
  return (
    <div style={{
      display: 'grid', placeItems: 'center', height: 82, borderRadius: 24,
      background: 'rgba(255,255,255,.10)',
      border: '1px solid rgba(255,255,255,.15)',
      fontSize: 68, lineHeight: 1, fontWeight: 950, letterSpacing: '-.07em',
      color: accent, textShadow: `0 0 32px ${hexAlpha(accent, .55)}`,
      fontVariantNumeric: 'tabular-nums',
    }}>
      {value}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 03 · MATCH PRESENTATION BROADCAST — 1010×438, centrado
// ════════════════════════════════════════════════════════════════════════════
export function MatchPresentationBroadcast({ visible, match, tournament }: {
  visible: boolean, match: any, tournament: Tournament | null,
}) {
  if (!match) return null
  const isDoubles = match.match_type === 'doubles'
  const round = ROUND_SHORT[match.round] ?? roundLabel(match.round).toUpperCase()
  const cat = (CATEGORY_LABELS[match.category as Category] ?? match.category ?? '').toUpperCase()

  function pairLines(t: 1|2): string[] {
    const e = t === 1 ? match.entry1 : match.entry2
    if (!e) return ['—']
    if (isDoubles) return [firstSurname(e.player1), firstSurname(e.player2)].filter(Boolean)
    return [e.player1?.last_name ?? '—']
  }
  function flagOf(t: 1|2) { return (t === 1 ? match.entry1 : match.entry2)?.player1?.nationality }
  function seedOf(t: 1|2) { return (t === 1 ? match.entry1 : match.entry2)?.seed }
  const courtName = match.court?.name ?? '—'
  const session = match.scheduled_at
    ? new Date(match.scheduled_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : '—'

  return (
    <div style={{
      position: 'absolute', left: '50%', top: '50%',
      width: 1010, height: 438,
      ...cardStyle(42),
      transform: 'translate(-50%,-50%) skewX(-8deg)',
      fontFamily: FONT,
      animation: visible ? 'bcInZoomSkew 900ms cubic-bezier(.2,.9,.18,1) both' : 'bcOutZoomSkew 700ms cubic-bezier(.2,.9,.18,1) both',
      willChange: 'transform, opacity',
    }}>
      <SpeedLines/>
      <Sheen/>

      <div style={{
        height: '100%', padding: '42px 56px',
        transform: SKEW_INNER,
        display: 'grid',
        gridTemplateColumns: '1fr 1px 1fr',
        gridTemplateRows: 'auto 1fr auto',
        columnGap: 44, position: 'relative', zIndex: 2,
      }}>
        <div style={{
          gridColumn: '1 / -1', textAlign: 'center',
          ...subtleStyle(13, 'rgba(255,255,255,.66)'), letterSpacing: '.32em',
          marginBottom: 18,
        }}>
          PRESENTACIÓN DEL PARTIDO · {isDoubles ? 'DOBLES' : 'INDIVIDUAL'}
        </div>

        {/* Pair A */}
        <PresPair flag={flagOf(1)} pair={pairLines(1)} seed={seedOf(1)} align="left"/>
        <div style={{ width: 1, height: '100%', background: 'linear-gradient(transparent, rgba(255,255,255,.38), transparent)' }}/>
        {/* Pair B */}
        <PresPair flag={flagOf(2)} pair={pairLines(2)} seed={seedOf(2)} align="right"/>

        {/* Match meta */}
        <div style={{
          gridColumn: '1 / -1',
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 14, marginTop: 26,
        }}>
          <MetaBox label="Formato" value={isDoubles ? 'Dobles' : 'Individual'}/>
          <MetaBox label="Ronda" value={round}/>
          <MetaBox label="Pista" value={courtName}/>
          <MetaBox label="Hora" value={session}/>
        </div>
      </div>

      <Accents/>
    </div>
  )
}

function PresPair({ flag, pair, seed, align }: { flag: any, pair: string[], seed: any, align: 'left'|'right' }) {
  const isRight = align === 'right'
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      gap: 18, alignItems: isRight ? 'flex-end' : 'flex-start',
      textAlign: isRight ? 'right' : 'left',
    }}>
      <div style={{
        display: 'flex', gap: 12, alignItems: 'center',
        textTransform: 'uppercase', letterSpacing: '.18em',
        color: 'rgba(255,255,255,.7)', fontSize: 13, fontWeight: 900,
        flexDirection: isRight ? 'row-reverse' : 'row',
        textShadow: TS_HARD,
      }}>
        <span style={{ fontSize: 22 }}>{flagEmoji(flag)}</span>
        <span>{(flag ?? 'ESP').toUpperCase()}</span>
      </div>
      <h2 style={italicNameStyle(46)}>
        {pair.map((l, i) => <div key={i}>{l.toUpperCase()}</div>)}
      </h2>
      {seed && (
        <div style={{
          display: 'inline-flex', gap: 14, alignItems: 'center',
          width: 'fit-content', padding: '10px 16px', borderRadius: 999,
          background: 'rgba(255,255,255,.09)', border: `1px solid ${BC.stroke}`,
          textTransform: 'uppercase', letterSpacing: '.12em',
          fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,.74)',
          textShadow: TS_HARD,
        }}>
          <span>SEED #{seed}</span>
        </div>
      )}
    </div>
  )
}

function MetaBox({ label, value }: { label: string, value: string }) {
  return (
    <div style={{
      padding: '14px 16px', borderRadius: 18,
      background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.13)',
      textTransform: 'uppercase',
    }}>
      <small style={{ display: 'block', color: 'rgba(255,255,255,.52)', letterSpacing: '.16em', fontSize: 9, fontWeight: 900, marginBottom: 6, textShadow: TS_HARD }}>{label}</small>
      <strong style={{ display: 'block', letterSpacing: '.08em', fontSize: 13, fontWeight: 950, color: BC.white, textShadow: TS_HARD }}>{value}</strong>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 04 · PLAYER BIO BROADCAST — 720×235, lateral
// ════════════════════════════════════════════════════════════════════════════
export function PlayerBioBroadcast({ visible, player, team, category, tournament }: {
  visible: boolean, player: Player | null, team: 1|2, category?: Category, tournament: Tournament | null,
}) {
  if (!player) return null
  const side: 'left'|'right' = team === 1 ? 'left' : 'right'
  const accent = team === 1 ? BC.cyan : BC.coral

  // Bio facts
  const facts: Array<[string, string]> = []
  if (player.birth_date) facts.push(['Edad', String(ageFrom(player.birth_date))])
  else if (player.age_manual) facts.push(['Edad', String(player.age_manual)])
  if (player.laterality) facts.push(['Mano', lateralityShortEs(player.laterality)])
  if (player.ranking_rfet) facts.push(['Ranking', `#${player.ranking_rfet}`])
  if (player.height_cm) facts.push(['Altura', `${player.height_cm} cm`])
  if (player.club) facts.push(['Club', player.club])

  const pos: React.CSSProperties = side === 'left'
    ? { left: 78, bottom: 86 }
    : { right: 78, bottom: 86 }

  return (
    <div style={{
      position: 'absolute', ...pos,
      width: 720, height: 235,
      ...cardStyle(34),
      transform: SKEW_OUTER,
      fontFamily: FONT,
      ...animSkew(visible, side === 'left' ? 'L' : 'R', 800),
    }}>
      <Sheen/>

      <div style={{
        height: '100%', transform: SKEW_INNER,
        display: 'grid', gridTemplateColumns: '150px 1fr 190px',
        gap: 30, alignItems: 'center', padding: '34px 42px',
        position: 'relative', zIndex: 2,
      }}>
        {/* Photo */}
        {player.photo_url ? (
          <div style={{
            width: 148, height: 148, borderRadius: 32, overflow: 'hidden',
            border: `1px solid ${BC.stroke}`,
            boxShadow: `0 12px 28px ${hexAlpha(accent, .35)}`,
          }}>
            <img src={player.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
          </div>
        ) : (
          <div style={{
            width: 148, height: 148, borderRadius: 32,
            background: `linear-gradient(135deg, rgba(255,255,255,.64), rgba(255,255,255,.08)),
                         radial-gradient(circle at 50% 26%, rgba(255,255,255,.4), transparent 32%),
                         linear-gradient(135deg, ${hexAlpha(BC.cyan, .35)}, ${hexAlpha(BC.coral, .22)})`,
            border: `1px solid ${BC.stroke}`,
            display: 'grid', placeItems: 'center',
            fontSize: 58, fontWeight: 950, fontStyle: 'italic',
            color: 'rgba(255,255,255,.62)',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.1)',
            textShadow: TS_HARD,
          }}>
            {(player.first_name?.[0] ?? '?').toUpperCase()}
          </div>
        )}

        {/* Main */}
        <div>
          <div style={{
            display: 'flex', gap: 12, alignItems: 'center',
            ...subtleStyle(11, 'rgba(255,255,255,.7)'), letterSpacing: '.18em',
            marginBottom: 12,
          }}>
            <span style={{ fontSize: 20 }}>{flagEmoji(player.nationality)}</span>
            <span>{(player.nationality ?? 'ESP').toUpperCase()}</span>
          </div>
          <h3 style={{ ...italicNameStyle(40), marginBottom: 18, lineHeight: .9 }}>
            <div>{(player.first_name ?? '').toUpperCase()}</div>
            <div>{(player.last_name ?? '').toUpperCase()}</div>
          </h3>
          <div style={{
            display: 'flex', gap: 12, alignItems: 'center',
            textTransform: 'uppercase', letterSpacing: '.14em',
            fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,.64)',
            textShadow: TS_HARD,
          }}>
            <span>{category?.endsWith('_f') ? 'JUGADORA' : 'JUGADOR'}</span>
            <b style={{ color: accent }}>DOBLES</b>
          </div>
        </div>

        {/* Facts */}
        <div style={{ display: 'grid', gap: 11, textTransform: 'uppercase' }}>
          {facts.slice(0, 5).map(([k, v]) => (
            <div key={k} style={{
              display: 'grid', gridTemplateColumns: '1fr auto',
              gap: 16, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,.13)',
            }}>
              <small style={{ fontSize: 9, letterSpacing: '.16em', fontWeight: 900, color: 'rgba(255,255,255,.46)', textShadow: TS_HARD }}>{k}</small>
              <strong style={{ fontSize: 14, letterSpacing: '.08em', fontWeight: 950, textAlign: 'right', color: BC.white, textShadow: TS_HARD }}>{v}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* Single accent (color del equipo) */}
      <div style={{ position: 'absolute', left: 0, bottom: 0, height: 3, width: '100%', background: accent, boxShadow: `0 0 20px ${accent}`, zIndex: 2 }}/>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 05 · WEATHER BROADCAST — 430×220, bottom-left
// ════════════════════════════════════════════════════════════════════════════
export function WeatherBroadcast({ visible, weather, tournament }: {
  visible: boolean, weather: WeatherData | null, tournament: Tournament | null,
}) {
  if (!weather) return null
  return (
    <div style={{
      position: 'absolute', left: 58, bottom: 58,
      width: 430, height: 220,
      ...cardStyle(32),
      transform: SKEW_OUTER,
      fontFamily: FONT,
      ...animSkew(visible, 'L', 750),
    }}>
      <Sheen/>

      <div style={{
        height: '100%', padding: '34px 40px',
        transform: SKEW_INNER,
        display: 'grid', gridTemplateColumns: '110px 1fr',
        gap: 28, alignItems: 'center',
        position: 'relative', zIndex: 2,
      }}>
        {/* Animated sun */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          border: '4px solid rgba(255,255,255,.86)',
          position: 'relative',
          animation: 'bcSunSpin 14s linear infinite',
        }}>
          <div style={{
            position: 'absolute', inset: -22,
            background: 'repeating-conic-gradient(rgba(255,255,255,.86) 0 8deg, transparent 8deg 22deg)',
            mask: 'radial-gradient(circle, transparent 0 47px, #000 48px 52px, transparent 53px)',
            WebkitMask: 'radial-gradient(circle, transparent 0 47px, #000 48px 52px, transparent 53px)',
          }}/>
        </div>

        <div>
          <div style={kickerStyle(BC.cyan)}>WEATHER · {(tournament?.venue_city ?? '').toUpperCase()}</div>
          <div style={{ fontSize: 58, lineHeight: .9, fontWeight: 900, letterSpacing: '-.06em', color: BC.white, textShadow: TS_HARD }}>
            {Math.round(weather.temperature_c)}°
          </div>
          <div style={{
            marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: '10px 20px', textTransform: 'uppercase',
          }}>
            <WxKv label="Wind" value={`${Math.round(weather.wind_speed_kmh)} km/h`}/>
            <WxKv label="Humidity" value={`${weather.humidity_pct}%`}/>
            <WxKv label="UV Index" value={String(weather.uv_index)}/>
            <WxKv label="Feels" value={`${Math.round(weather.feels_like_c)}°`}/>
          </div>
        </div>
      </div>

      <Accents/>
    </div>
  )
}

function WxKv({ label, value }: { label: string, value: string }) {
  return (
    <div>
      <small style={{ display: 'block', color: BC.muted, fontSize: 9, letterSpacing: '.16em', fontWeight: 900, marginBottom: 4, textShadow: TS_HARD }}>{label.toUpperCase()}</small>
      <strong style={{ fontSize: 13, letterSpacing: '.08em', fontWeight: 950, color: BC.white, textShadow: TS_HARD }}>{value}</strong>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 06 · VENUE PRESENTATION BROADCAST — 940×310, centrado
// ════════════════════════════════════════════════════════════════════════════
export function VenueCardBroadcast({ visible, tournament }: {
  visible: boolean, tournament: Tournament | null,
}) {
  if (!tournament) return null
  const venueLines = (tournament.venue_name ?? 'Pista Central').split(' ')
  const split = Math.ceil(venueLines.length / 2)
  const line1 = venueLines.slice(0, split).join(' ')
  const line2 = venueLines.slice(split).join(' ')

  return (
    <div style={{
      position: 'absolute', left: '50%', top: '50%',
      width: 940, height: 310,
      ...cardStyle(38),
      transform: 'translate(-50%,-50%) skewX(-8deg)',
      fontFamily: FONT,
      animation: visible ? 'bcInZoomSkew 900ms cubic-bezier(.2,.9,.18,1) both' : 'bcOutZoomSkew 700ms cubic-bezier(.2,.9,.18,1) both',
    }}>
      <SpeedLines/>
      <Sheen/>

      <div style={{
        height: '100%', padding: '44px 54px',
        transform: SKEW_INNER,
        display: 'grid', gridTemplateColumns: '1.2fr .8fr',
        gap: 46, alignItems: 'center',
        position: 'relative', zIndex: 2,
      }}>
        <div>
          <div style={kickerStyle(BC.cyan)}>SEDE OFICIAL</div>
          <h2 style={{ ...italicNameStyle(52), marginTop: 14 }}>
            <div>{(line1 || tournament.venue_name || '').toUpperCase()}</div>
            {line2 && <div>{line2.toUpperCase()}</div>}
          </h2>
          <div style={subtleStyle(12, BC.muted)}>
            {[tournament.venue_city, 'España'].filter(Boolean).join(' · ')}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <DataLine label="Superficie" value="Arena"/>
          <DataLine label="Sesión" value={(() => {
            if (!tournament.start_date) return '—'
            return new Date(tournament.start_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }).toUpperCase()
          })()}/>
          {tournament.end_date && (
            <DataLine label="Hasta" value={new Date(tournament.end_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }).toUpperCase()}/>
          )}
        </div>
      </div>

      <Accents/>
    </div>
  )
}

function DataLine({ label, value }: { label: string, value: string }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '120px 1fr', gap: 18,
      alignItems: 'baseline', padding: '10px 0',
      borderBottom: '1px solid rgba(255,255,255,.12)',
      textTransform: 'uppercase',
    }}>
      <small style={{ color: 'rgba(255,255,255,.48)', letterSpacing: '.16em', fontSize: 9, fontWeight: 900, textShadow: TS_HARD }}>{label.toUpperCase()}</small>
      <strong style={{ letterSpacing: '.08em', fontSize: 14, fontWeight: 950, color: BC.white, textShadow: TS_HARD }}>{value}</strong>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 07 · TOURNAMENT INTRO BROADCAST — 460×196, top-right
// ════════════════════════════════════════════════════════════════════════════
export function TournamentIntroBroadcast({ visible, tournament }: {
  visible: boolean, tournament: Tournament | null,
}) {
  if (!tournament) return null
  const lines = (tournament.name ?? '').split(' ')
  const split = Math.ceil(lines.length / 2)
  const line1 = lines.slice(0, split).join(' ')
  const line2 = lines.slice(split).join(' ')

  return (
    <div style={{
      position: 'absolute', right: 48, top: 44,
      width: 460, height: 196,
      ...cardStyle(30),
      transform: SKEW_OUTER,
      fontFamily: FONT,
      ...animSkew(visible, 'R', 800),
    }}>
      <Sheen/>

      <div style={{
        height: '100%', padding: '32px 36px',
        transform: SKEW_INNER,
        position: 'relative', zIndex: 2,
        textTransform: 'uppercase',
      }}>
        <div style={kickerStyle(BC.cyan)}>PRESENTACIÓN DEL TORNEO</div>
        <div style={{ ...italicNameStyle(31), margin: '11px 0 24px', lineHeight: 1 }}>
          {line1 && <div>{line1.toUpperCase()}</div>}
          {line2 && <div>{line2.toUpperCase()}</div>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <DataLine label="Categoría" value="Pro Doubles"/>
          <DataLine label="Sede" value={(tournament.venue_city ?? '—')}/>
        </div>
      </div>

      <div style={{ position: 'absolute', left: 0, bottom: 0, height: 3, width: '100%', background: BC.cyan, boxShadow: `0 0 20px ${BC.cyan}`, zIndex: 2 }}/>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 08 · REFEREE LOWER THIRD BROADCAST — 520×150, bottom-right
// ════════════════════════════════════════════════════════════════════════════
export function RefereeLowerThirdBroadcast({ visible, referee }: {
  visible: boolean, referee: { full_name: string, federacion?: string|null } | null, tournament: Tournament | null,
}) {
  if (!referee) return null
  const parts = referee.full_name.split(' ')
  const first = parts.slice(0, Math.ceil(parts.length / 2)).join(' ')
  const last = parts.slice(Math.ceil(parts.length / 2)).join(' ')

  return (
    <div style={{
      position: 'absolute', right: 62, bottom: 64,
      width: 520, height: 150,
      ...cardStyle(30),
      transform: SKEW_OUTER,
      fontFamily: FONT,
      ...animSkew(visible, 'R', 800),
    }}>
      <Sheen/>

      <div style={{
        height: '100%', padding: '28px 34px',
        transform: SKEW_INNER,
        display: 'grid', gridTemplateColumns: '78px 1fr',
        gap: 24, alignItems: 'center',
        position: 'relative', zIndex: 2,
      }}>
        <div style={{
          width: 78, height: 78, borderRadius: '50%',
          background: 'rgba(255,255,255,.10)',
          border: '1px solid rgba(255,255,255,.18)',
          display: 'grid', placeItems: 'center',
          fontSize: 34, color: BC.white, textShadow: TS_HARD,
        }}>
          ⚖
        </div>
        <div>
          <div style={kickerStyle(BC.cyan)}>JUEZ ÁRBITRO</div>
          <div style={{ ...italicNameStyle(28), marginTop: 8, lineHeight: .95 }}>
            {first && <div>{first.toUpperCase()}</div>}
            {last && <div>{last.toUpperCase()}</div>}
          </div>
          {referee.federacion && (
            <div style={subtleStyle(10, BC.muted)}>{referee.federacion.toUpperCase()}</div>
          )}
        </div>
      </div>

      <div style={{ position: 'absolute', right: 0, bottom: 0, height: 3, width: '100%', background: BC.coral, boxShadow: `0 0 20px ${BC.coral}`, zIndex: 2 }}/>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 09 · STATS PANEL BROADCAST — centrado, takeover
// ════════════════════════════════════════════════════════════════════════════
function autoScope(match: any): 'set_1'|'set_2'|'set_3'|'match' {
  const sets = match?.score?.sets?.length ?? 0
  if (match?.status === 'finished') return 'match'
  if (sets <= 1) return 'set_1'
  if (sets === 2) return 'set_2'
  return 'set_3'
}
const SCOPE_TITLE: Record<string, string> = { set_1: 'PRIMER SET', set_2: 'SEGUNDO SET', set_3: 'TERCER SET', match: 'PARTIDO' }

export function StatsPanelBroadcast({ visible, match, tournament, scope }: {
  visible: boolean, match: any, tournament: Tournament | null, scope: 'set_1'|'set_2'|'set_3'|'match'|'auto',
}) {
  if (!match?.stats) return null
  const advanced = !!tournament?.advanced_stats_enabled
  const resolvedScope = scope === 'auto' ? autoScope(match) : scope
  const s = match.stats

  const breaksWonA = s.t1.break_points_won
  const breaksWonTotA = s.t1.break_points_played_on_return ?? 0
  const breaksWonB = s.t2.break_points_won
  const breaksWonTotB = s.t2.break_points_played_on_return ?? 0
  const breaksSavedA = s.t1.break_points_saved
  const breaksFacedA = s.t1.break_points_faced ?? 0
  const breaksSavedB = s.t2.break_points_saved
  const breaksFacedB = s.t2.break_points_faced ?? 0

  const rows = [
    { label: 'ACES', a: s.t1.aces, b: s.t2.aces },
    { label: 'DOBLES FALTAS', a: s.t1.double_faults, b: s.t2.double_faults },
    ...(advanced ? [
      { label: 'WINNERS', a: s.t1.winners, b: s.t2.winners },
      { label: 'ERR. NO FORZADOS', a: s.t1.unforced_errors, b: s.t2.unforced_errors },
    ] : []),
    { label: '% PTS SAQUE', a: `${Math.round(s.t1.serve_points_won_pct||0)}%`, b: `${Math.round(s.t2.serve_points_won_pct||0)}%` },
    { label: '% PTS RESTO', a: `${Math.round(s.t1.return_points_won_pct||0)}%`, b: `${Math.round(s.t2.return_points_won_pct||0)}%` },
    { label: 'BREAKS', a: `${breaksWonA}/${breaksWonTotA}`, b: `${breaksWonB}/${breaksWonTotB}` },
    { label: 'BREAKS SALV.', a: `${breaksSavedA}/${breaksFacedA}`, b: `${breaksSavedB}/${breaksFacedB}` },
    { label: 'PUNTOS', a: s.t1.total_points_won, b: s.t2.total_points_won },
  ] as Array<{ label: string, a: number|string, b: number|string }>

  return (
    <div style={{
      position: 'absolute', left: '50%', top: '50%',
      width: 1100, maxHeight: 880,
      ...cardStyle(40),
      transform: 'translate(-50%,-50%) skewX(-8deg)',
      fontFamily: FONT,
      animation: visible ? 'bcInZoomSkew 900ms cubic-bezier(.2,.9,.18,1) both' : 'bcOutZoomSkew 700ms cubic-bezier(.2,.9,.18,1) both',
    }}>
      <SpeedLines/>
      <Sheen/>

      <div style={{ padding: '40px 56px', transform: SKEW_INNER, position: 'relative', zIndex: 2 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={kickerStyle(BC.cyan)}>ESTADÍSTICAS</div>
          <div style={{ ...italicNameStyle(40), marginTop: 6 }}>{SCOPE_TITLE[resolvedScope] ?? ''}</div>
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          {rows.map((r, i) => {
            const numA = parseFloat(String(r.a).replace('%', '').split('/')[0]) || 0
            const numB = parseFloat(String(r.b).replace('%', '').split('/')[0]) || 0
            const aWins = numA > numB
            const bWins = numB > numA
            return (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1fr 2fr 1fr',
                alignItems: 'center', gap: 22, padding: '14px 18px',
                borderRadius: 18,
                background: 'rgba(255,255,255,.05)',
                border: '1px solid rgba(255,255,255,.10)',
              }}>
                <span style={{
                  fontSize: 32, fontWeight: 950, fontStyle: 'italic',
                  textAlign: 'right', fontVariantNumeric: 'tabular-nums', lineHeight: 1,
                  color: aWins ? BC.cyan : BC.white,
                  textShadow: aWins ? `0 0 18px ${hexAlpha(BC.cyan, .55)}` : TS_HARD,
                }}>{r.a}</span>
                <span style={subtleStyle(12, BC.muted)}>{r.label}</span>
                <span style={{
                  fontSize: 32, fontWeight: 950, fontStyle: 'italic',
                  textAlign: 'left', fontVariantNumeric: 'tabular-nums', lineHeight: 1,
                  color: bWins ? BC.coral : BC.white,
                  textShadow: bWins ? `0 0 18px ${hexAlpha(BC.coral, .55)}` : TS_HARD,
                }}>{r.b}</span>
              </div>
            )
          })}
        </div>
      </div>

      <Accents/>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 10 · RESULTS GRID BROADCAST — solo fase actual
// ════════════════════════════════════════════════════════════════════════════
export function ResultsGridBroadcast({ visible, matches, highlightMatchId, tournament, category }: {
  visible: boolean, matches: any[], highlightMatchId?: string|null, tournament: Tournament | null, category?: string,
}) {
  const ROUND_ORDER = ['F','SF','QF','R16','R32','RR','GRP','CON','Q1','Q2']
  const cat = (category ?? matches[0]?.category) as Category | undefined
  const catMatches = cat ? matches.filter((m: any) => m.category === cat) : matches
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
  const isDoubles = filtered[0]?.match_type === 'doubles'

  return (
    <div style={{
      position: 'absolute', left: '50%', top: '50%',
      width: 1500, maxHeight: 920,
      ...cardStyle(40),
      transform: 'translate(-50%,-50%) skewX(-8deg)',
      fontFamily: FONT,
      animation: visible ? 'bcInZoomSkew 900ms cubic-bezier(.2,.9,.18,1) both' : 'bcOutZoomSkew 700ms cubic-bezier(.2,.9,.18,1) both',
    }}>
      <SpeedLines/>
      <Sheen/>

      <div style={{ padding: '40px 56px', transform: SKEW_INNER, position: 'relative', zIndex: 2 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={kickerStyle(BC.cyan)}>ORDEN DE JUEGO</div>
          <div style={{ ...italicNameStyle(40), marginTop: 6 }}>
            {(ROUND_LABELS[activeRound ?? ''] ?? activeRound ?? '').toUpperCase()}
          </div>
          <div style={subtleStyle(11, BC.muted)}>
            {(CATEGORY_LABELS[(category ?? matches[0]?.category) as Category] ?? '').toUpperCase()}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 28px' }}>
          {filtered.map((m: any) => (
            <BroadcastResultRow key={m.id} m={m} highlight={m.id === highlightMatchId} isDoubles={isDoubles}/>
          ))}
        </div>
      </div>

      <Accents/>
    </div>
  )
}

function BroadcastResultRow({ m, highlight, isDoubles }: { m: any, highlight: boolean, isDoubles: boolean }) {
  const score = m.score as Score | null
  const winnerTeam = score?.winner_team
  const finished = m.status === 'finished'
  const inProgress = m.status === 'in_progress'

  const teamLabel = (entry: any) => {
    if (!entry) return 'POR DETERMINAR'
    const players = [entry.player1, isDoubles ? entry.player2 : null].filter(Boolean)
    return players.map((p: any) => firstSurname(p)).filter(Boolean).join(' / ').toUpperCase()
  }
  const setsLine = (team: 1|2) => {
    if (!score || !score.sets?.length) return ''
    return score.sets.map((s: any) => team === 1 ? s.t1 : s.t2).join('  ')
  }

  return (
    <div style={{
      padding: '14px 20px', borderRadius: 18,
      background: highlight
        ? `linear-gradient(135deg, ${hexAlpha(BC.cyan, .18)}, ${hexAlpha(BC.coral, .18)})`
        : 'rgba(255,255,255,.05)',
      border: highlight ? `1.5px solid ${hexAlpha(BC.cyan, .55)}` : '1px solid rgba(255,255,255,.10)',
    }}>
      {[1, 2].map(tn => {
        const team = tn as 1|2
        const entry = team === 1 ? m.entry1 : m.entry2
        const isWinner = finished && winnerTeam === team
        return (
          <div key={team} style={{
            display: 'grid', gridTemplateColumns: '1fr auto', gap: 12,
            alignItems: 'baseline', padding: '4px 0',
          }}>
            <span style={{
              fontSize: 18, fontWeight: isWinner ? 950 : 700, fontStyle: 'italic',
              letterSpacing: '.06em',
              color: isWinner ? BC.white : BC.muted,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              textShadow: TS_HARD,
            }}>
              {teamLabel(entry)}
            </span>
            <span style={{
              fontSize: 18, fontWeight: 950,
              color: isWinner ? (team === 1 ? BC.cyan : BC.coral) : BC.muted,
              fontVariantNumeric: 'tabular-nums', letterSpacing: '.05em',
              textShadow: TS_HARD,
            }}>
              {setsLine(team)}
            </span>
          </div>
        )
      })}
      <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,.10)', textAlign: 'right' }}>
        {finished
          ? <span style={subtleStyle(10, BC.muted)}>FINAL</span>
          : inProgress
          ? <span style={subtleStyle(10, BC.coral)}>● EN JUEGO</span>
          : <span style={subtleStyle(10, BC.muted)}>{m.scheduled_at ? new Date(m.scheduled_at).toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' }) : 'POR CONFIRMAR'}</span>}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 11 · BRACKET BROADCAST — QF/SF/F
// ════════════════════════════════════════════════════════════════════════════
const BC_KO = ['QF', 'SF', 'F'] as const
type BcKoRound = typeof BC_KO[number]
const BC_KO_LBL: Record<BcKoRound, string> = { QF: 'CUARTOS', SF: 'SEMIS', F: 'FINAL' }
const BC_KO_SLOTS: Record<BcKoRound, number> = { QF: 4, SF: 2, F: 1 }

export function BracketViewBroadcast({ visible, matches, highlightMatchId, tournament, category }: {
  visible: boolean, matches: any[], highlightMatchId?: string|null, tournament: Tournament | null, category?: string,
}) {
  const cat = (category ?? matches[0]?.category) as Category | undefined
  const catMatches = cat ? matches.filter((m: any) => m.category === cat) : matches
  const isDoubles = catMatches[0]?.match_type === 'doubles'

  const byRound: Record<string, any[]> = { QF: [], SF: [], F: [] }
  catMatches.forEach((m: any) => { if (byRound[m.round]) byRound[m.round].push(m) })
  BC_KO.forEach(r => byRound[r].sort((a, b) => (a.match_number||0) - (b.match_number||0)))

  const visibleRounds: BcKoRound[] = ['QF', 'SF', 'F']
  const roundsData = visibleRounds.map(r => {
    const expected = BC_KO_SLOTS[r]
    const byNum: Record<number, any> = {}
    byRound[r].forEach((m: any) => { if (m.match_number) byNum[m.match_number] = m })
    const slots: any[] = []
    for (let i = 1; i <= expected; i++) slots.push(byNum[i] ?? null)
    return { round: r, slots }
  })
  const totalRows = BC_KO_SLOTS.QF * 2

  const colTracks: string[] = []
  for (let i = 0; i < visibleRounds.length; i++) {
    if (i > 0) colTracks.push('60px')
    colTracks.push('1fr')
  }
  const gridCols = colTracks.join(' ')
  const LC = 'rgba(255,255,255,.30)'

  return (
    <div style={{
      position: 'absolute', left: '50%', top: '50%',
      width: 1700, height: 880,
      ...cardStyle(40),
      transform: 'translate(-50%,-50%) skewX(-8deg)',
      fontFamily: FONT,
      animation: visible ? 'bcInZoomSkew 900ms cubic-bezier(.2,.9,.18,1) both' : 'bcOutZoomSkew 700ms cubic-bezier(.2,.9,.18,1) both',
    }}>
      <SpeedLines/>
      <Sheen/>

      <div style={{ padding: '32px 48px', transform: SKEW_INNER, position: 'relative', zIndex: 2 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={kickerStyle(BC.cyan)}>CUADRO</div>
          <div style={{ ...italicNameStyle(36), marginTop: 6 }}>
            {(CATEGORY_LABELS[(category ?? matches[0]?.category) as Category] ?? '').toUpperCase()}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: gridCols, padding: '0 0 8px' }}>
          {visibleRounds.map((r, i) => (
            <React.Fragment key={r}>
              {i > 0 && <div/>}
              <div style={{ textAlign: 'center', ...subtleStyle(11, BC.cyan), letterSpacing: '.30em' }}>{BC_KO_LBL[r]}</div>
            </React.Fragment>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: gridCols, gridTemplateRows: `repeat(${totalRows}, 1fr)`, height: 660 }}>
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
                      <BcBracketSlot m={m} hot={m?.id === highlightMatchId} isFinal={round === 'F'} isDoubles={isDoubles}/>
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

      <Accents/>
    </div>
  )
}

function BcBracketSlot({ m, hot, isFinal, isDoubles }: { m: any, hot: boolean, isFinal: boolean, isDoubles: boolean }) {
  if (!m) {
    return (
      <div style={{
        flex: 1, padding: '12px 14px', borderRadius: 16,
        background: 'rgba(255,255,255,.03)',
        border: '1px dashed rgba(255,255,255,.20)',
        textAlign: 'center',
      }}>
        <span style={subtleStyle(10, BC.muted)}>POR DETERMINAR</span>
      </div>
    )
  }
  const score = m.score as Score | null
  return (
    <div style={{
      flex: 1, padding: '10px 14px', borderRadius: 16,
      background: hot
        ? `linear-gradient(135deg, ${hexAlpha(BC.cyan, .22)}, ${hexAlpha(BC.coral, .22)})`
        : isFinal ? hexAlpha(BC.coral, .12) : 'rgba(255,255,255,.05)',
      border: hot
        ? `1.5px solid ${hexAlpha(BC.cyan, .60)}`
        : isFinal ? `1px solid ${hexAlpha(BC.coral, .50)}` : '1px solid rgba(255,255,255,.12)',
    }}>
      <BcBracketLine entry={m.entry1} score={score} team={1} isDoubles={isDoubles}/>
      <div style={{ height: 1, background: 'rgba(255,255,255,.12)', margin: '5px 0' }}/>
      <BcBracketLine entry={m.entry2} score={score} team={2} isDoubles={isDoubles}/>
    </div>
  )
}
function BcBracketLine({ entry, score, team, isDoubles }: { entry: any, score: Score|null, team: 1|2, isDoubles: boolean }) {
  if (!entry) return <div style={{ ...subtleStyle(11, BC.muted), padding: '4px 0' }}>—</div>
  const players = [entry?.player1, isDoubles ? entry?.player2 : null].filter(Boolean)
  const sets = setsFor(score, team)
  const winner = (score?.winner_team ?? null) === team
  const nameStr = isDoubles
    ? players.map((p: any) => firstSurname(p)).filter(Boolean).join(' / ')
    : (players[0]?.last_name ?? '')
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', alignItems: 'center', gap: 8 }}>
      <span style={{
        fontSize: 16, fontWeight: winner ? 950 : 700, fontStyle: 'italic',
        letterSpacing: '.06em', textTransform: 'uppercase',
        color: winner ? BC.white : BC.muted,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        textShadow: TS_HARD,
      }}>
        {nameStr.toUpperCase()}
      </span>
      {sets.map((v, i) => (
        <span key={i} style={{
          minWidth: 18, textAlign: 'center',
          fontSize: 16, fontWeight: 950,
          color: winner ? (team === 1 ? BC.cyan : BC.coral) : BC.muted,
          fontVariantNumeric: 'tabular-nums',
          textShadow: TS_HARD,
        }}>
          {v == null ? '' : v}
        </span>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 12 · COIN TOSS BROADCAST
// ════════════════════════════════════════════════════════════════════════════
export function CoinTossBroadcast({ visible, match, tournament }: {
  visible: boolean, match: any, tournament: Tournament | null,
}) {
  if (!match) return null
  const winnerTeam = match.toss_winner_team as 1|2|null
  const choice = match.toss_choice as 'serve'|'receive'|'side'|null
  const won = winnerTeam ? (winnerTeam === 1 ? match.entry1 : match.entry2) : null
  const players = won ? [won.player1, match.match_type === 'doubles' ? won.player2 : null].filter(Boolean) : []
  const choiceText = choice === 'serve' ? 'SACAR' : choice === 'receive' ? 'RESTAR' : choice === 'side' ? 'ELEGIR LADO' : ''

  return (
    <div style={{
      position: 'absolute', left: '50%', top: '50%',
      width: 'fit-content', minWidth: 800,
      ...cardStyle(40),
      transform: 'translate(-50%,-50%) skewX(-8deg)',
      fontFamily: FONT,
      padding: '50px 80px', textAlign: 'center',
      animation: visible ? 'bcInZoomSkew 900ms cubic-bezier(.2,.9,.18,1) both' : 'bcOutZoomSkew 700ms cubic-bezier(.2,.9,.18,1) both',
    }}>
      <SpeedLines/>
      <Sheen/>

      <div style={{ transform: SKEW_INNER, position: 'relative', zIndex: 2 }}>
        <div style={{ ...kickerStyle(BC.cyan), marginBottom: 18 }}>SORTEO</div>
        <div style={subtleStyle(13, BC.muted)}>GANA EL SORTEO</div>
        <div style={{ ...italicNameStyle(64), margin: '20px 0 28px', whiteSpace: 'nowrap' }}>
          {players.map((p: any, i: number) => (
            <div key={i}>
              <span style={{ fontWeight: 700, color: BC.muted, marginRight: 14 }}>{(p?.first_name ?? '').toUpperCase()}</span>
              {(p?.last_name ?? '').toUpperCase()}
            </div>
          ))}
        </div>
        {choiceText && (<>
          <div style={{ ...kickerStyle(BC.coral), marginBottom: 14 }}>Y ELIGE</div>
          <div style={{
            display: 'inline-block', padding: '14px 40px', borderRadius: 999,
            background: `linear-gradient(135deg, ${BC.cyan}, ${BC.coral})`,
            ...italicNameStyle(46),
            letterSpacing: '.18em',
            boxShadow: `0 16px 40px rgba(0,0,0,.30)`,
          }}>
            {choiceText}
          </div>
        </>)}
      </div>

      <Accents/>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 13 · AWARDS PODIUM BROADCAST
// ════════════════════════════════════════════════════════════════════════════
export function AwardsPodiumBroadcast({ visible, data, tournament }: {
  visible: boolean, data: any, tournament: Tournament | null,
}) {
  if (!data) return null
  const champion = data.champion as { name: string, photo_url?: string|null } | null
  const finalist = data.finalist as { name: string, photo_url?: string|null } | null
  return (
    <div style={{
      position: 'absolute', left: '50%', top: '50%',
      width: 1300, height: 720,
      ...cardStyle(44),
      transform: 'translate(-50%,-50%) skewX(-8deg)',
      fontFamily: FONT,
      animation: visible ? 'bcInZoomSkew 900ms cubic-bezier(.2,.9,.18,1) both' : 'bcOutZoomSkew 700ms cubic-bezier(.2,.9,.18,1) both',
    }}>
      <SpeedLines/>
      <Sheen/>

      <div style={{
        height: '100%', padding: '50px 60px',
        transform: SKEW_INNER,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 28, textAlign: 'center',
        position: 'relative', zIndex: 2,
      }}>
        <div style={kickerStyle(BC.cyan)}>PODIO · {(tournament?.name ?? '').toUpperCase()}</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'end', width: '100%' }}>
          {/* Finalist */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ ...subtleStyle(12, BC.muted), marginBottom: 14 }}>FINALISTA</div>
            {finalist?.photo_url && (
              <div style={{
                width: 200, height: 200, margin: '0 auto 16px',
                borderRadius: 32, overflow: 'hidden',
                border: `2px solid ${BC.stroke}`,
                boxShadow: `0 16px 40px ${hexAlpha(BC.cyan, .35)}`,
              }}>
                <img src={finalist.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
              </div>
            )}
            <div style={italicNameStyle(40)}>{(finalist?.name ?? '').toUpperCase()}</div>
          </div>
          {/* Champion */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ ...kickerStyle(BC.coral), marginBottom: 14 }}>CAMPEÓN</div>
            {champion?.photo_url && (
              <div style={{
                width: 240, height: 240, margin: '0 auto 16px',
                borderRadius: 36, overflow: 'hidden',
                border: `3px solid ${BC.coral}`,
                boxShadow: `0 0 80px ${hexAlpha(BC.coral, .55)}`,
              }}>
                <img src={champion.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
              </div>
            )}
            <div style={italicNameStyle(56)}>{(champion?.name ?? '').toUpperCase()}</div>
          </div>
        </div>
      </div>

      <Accents/>
    </div>
  )
}
