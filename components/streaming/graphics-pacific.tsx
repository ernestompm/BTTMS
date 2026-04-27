'use client'
// ============================================================================
// Streaming Graphics — PACIFIC skin (v2: organic, contrast-safe)
// ============================================================================
// Lenguaje visual: blobs SVG, splashes en esquinas, capsules orgánicas,
// numeros flotantes sin marco. Preparado para fondos CLAROS (sunset beach,
// daylight) — todas las cards usan glass NAVY oscuro y todo el texto blanco
// lleva text-shadow para legibilidad sobre cualquier fondo.
//
// Estructura intacta (mismas posiciones / dimensiones que classic+tour):
// vMix no necesita re-rigging al cambiar de skin.
// ============================================================================

import React, { useEffect, useState } from 'react'
import type { Player, Score, Sponsor, Tournament, WeatherData, Category } from '@/types'
import { CATEGORY_LABELS } from '@/types'
import { animStyle, hexAlpha, flagPath, palette, firstSurname } from './stage-shared'

// ─── PALETA ─────────────────────────────────────────────────────────────────
const PAC = {
  cyan:    '#5fc4cc',
  cyanLt:  '#7dd3d8',
  blue:    '#4a90c2',
  coral:   '#ff8a72',
  coralLt: '#ffb39d',
  amber:   '#ffd07a',
  ink:     '#0e1c29',
}

// Texto SIEMPRE con text-shadow — legible sobre fondos claros y oscuros
const TEXT_SHADOW = '0 1px 2px rgba(0,0,0,.55), 0 2px 12px rgba(0,0,0,.35)'
const TEXT_SHADOW_LIGHT = '0 1px 2px rgba(0,0,0,.45)'

const COLORS = {
  white:   '#ffffff',
  textHi:  '#ffffff',
  textMid: 'rgba(255,255,255,.82)',
  textLo:  'rgba(255,255,255,.62)',
}

// Glass NAVY oscuro — funciona en fondos claros/sunset/daylight
const GLASS_DARK = 'linear-gradient(135deg, rgba(8,18,32,.72) 0%, rgba(15,28,52,.68) 100%)'
const GLASS_BORDER = '1px solid rgba(255,255,255,.22)'

// Gradientes acento (para pills y splashes)
const GRAD_HORIZ = `linear-gradient(90deg, ${hexAlpha(PAC.cyan,.85)} 0%, ${hexAlpha(PAC.blue,.85)} 50%, ${hexAlpha(PAC.coral,.85)} 100%)`
const GRAD_CYAN_CORAL = `linear-gradient(135deg, ${PAC.cyan} 0%, ${PAC.coral} 100%)`

const PAC_FONT = "'Inter', 'SF Pro Display', system-ui, -apple-system, sans-serif"

// ─── HELPERS DE TEXTO ───────────────────────────────────────────────────────
const text = (size: number, weight: number = 500, color: string = COLORS.textHi): React.CSSProperties => ({
  fontSize: size, fontWeight: weight, color, textShadow: TEXT_SHADOW,
})
const kicker = (color: string = COLORS.textLo, size: number = 13): React.CSSProperties => ({
  fontSize: size, letterSpacing: '.24em', textTransform: 'uppercase',
  fontWeight: 500, color, textShadow: TEXT_SHADOW_LIGHT,
})

// ─── BLOBS ORGÁNICOS REUTILIZABLES ──────────────────────────────────────────
// Path SVG de blob (en viewBox 100x100). Extremos asimetricos para que se vea
// claramente como una "gota" liquida y no como un rectangulo redondeado.
const BLOB_PATHS = [
  'M58.8,8.4 C75.5,12.3 91.2,24.5 92.4,42.8 C93.6,61.1 80.5,80.0 60.5,87.6 C40.5,95.2 13.7,91.4 6.6,73.6 C-0.5,55.8 12.0,24.0 30.5,12.5 C38.5,7.5 47.5,5.6 58.8,8.4 Z',
  'M42.7,9.5 C61.7,5.0 81.5,15.2 89.5,33.4 C97.5,51.6 93.7,77.8 76.6,86.8 C59.5,95.8 28.0,87.6 13.5,72.4 C-1.0,57.2 6.5,34.0 17.5,21.5 C25.0,13.0 32.0,12.0 42.7,9.5 Z',
  'M50.0,5.0 C72.0,8.0 92.0,22.0 91.0,46.0 C90.0,70.0 70.0,90.0 50.0,92.0 C30.0,94.0 8.0,82.0 7.0,58.0 C6.0,34.0 28.0,2.0 50.0,5.0 Z',
  'M48,12 C70,8 90,28 88,52 C86,76 64,90 42,86 C20,82 6,62 10,40 C14,18 30,16 48,12 Z',
]
const SPLASH_WAVE = 'M0,40 C20,15 45,55 70,30 C90,12 100,30 100,30 L100,100 L0,100 Z'

function Blob({
  path, fill, width = 200, height = 200, opacity = 1, blur = 0,
  style,
}: { path: string, fill: string, width?: number, height?: number, opacity?: number, blur?: number, style?: React.CSSProperties }) {
  return (
    <svg width={width} height={height} viewBox="0 0 100 100" preserveAspectRatio="none"
         style={{ position: 'absolute', filter: blur ? `blur(${blur}px)` : undefined, opacity, pointerEvents: 'none', ...style }}>
      <path d={path} fill={fill}/>
    </svg>
  )
}

// Decoracion: splash en una esquina del card (wave gradient)
function CornerSplash({ pos, color = PAC.cyan, size = 220, opacity = .55 }: {
  pos: 'tl' | 'tr' | 'bl' | 'br', color?: string, size?: number, opacity?: number
}) {
  const positions: Record<typeof pos, React.CSSProperties> = {
    tl: { top: -size*0.4, left: -size*0.4, transform: 'rotate(0deg)' },
    tr: { top: -size*0.4, right: -size*0.4, transform: 'rotate(90deg)' },
    bl: { bottom: -size*0.4, left: -size*0.4, transform: 'rotate(-90deg)' },
    br: { bottom: -size*0.4, right: -size*0.4, transform: 'rotate(180deg)' },
  } as any
  return <Blob path={BLOB_PATHS[0]} fill={color} width={size} height={size} opacity={opacity} blur={28}
    style={positions[pos]}/>
}

// Card orgánica: glass NAVY + border-radius asimetrico extremo + 2 blobs
// decorativos internos (uno cyan, otro coral) suaves para dar el rollo
// "fluido". Texto blanco con shadow garantiza contraste.
function OrganicCard({
  children, style, blobSeed = 0, decorate = true, radius,
}: {
  children: React.ReactNode, style?: React.CSSProperties, blobSeed?: number,
  decorate?: boolean, radius?: string,
}) {
  const radii = [
    '52% 48% 42% 58% / 56% 42% 58% 44%',
    '46% 54% 38% 62% / 50% 56% 44% 50%',
    '60% 40% 56% 44% / 44% 60% 40% 56%',
    '50% 50% 38% 62% / 60% 40% 60% 40%',
  ]
  const r = radius ?? radii[blobSeed % radii.length]
  return (
    <div style={{
      position: 'relative',
      background: GLASS_DARK,
      border: GLASS_BORDER,
      borderRadius: r,
      backdropFilter: 'blur(24px) saturate(1.3)',
      WebkitBackdropFilter: 'blur(24px) saturate(1.3)',
      boxShadow: '0 24px 60px rgba(0,0,0,.40), inset 0 1px 0 rgba(255,255,255,.18)',
      overflow: 'hidden',
      ...style,
    }}>
      {decorate && (
        <>
          <Blob path={BLOB_PATHS[(blobSeed+1) % BLOB_PATHS.length]} fill={PAC.cyan}
            width={300} height={300} opacity={.30} blur={32}
            style={{ top: -120, left: -100 }}/>
          <Blob path={BLOB_PATHS[(blobSeed+2) % BLOB_PATHS.length]} fill={PAC.coral}
            width={260} height={260} opacity={.32} blur={32}
            style={{ bottom: -100, right: -80 }}/>
        </>
      )}
      <div style={{ position: 'relative', zIndex: 1, height: '100%' }}>{children}</div>
    </div>
  )
}

// Pill horizontal — capsule con gradiente cyan→coral
function pacPillStyle(): React.CSSProperties {
  return {
    background: GRAD_HORIZ,
    border: '1px solid rgba(255,255,255,.35)',
    borderRadius: 999,
    boxShadow: '0 8px 24px rgba(0,0,0,.30), inset 0 1px 0 rgba(255,255,255,.30)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
  }
}

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
// 1) SCOREBUG PACIFIC — capsule organica top-left
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
      <OrganicCard blobSeed={1} style={{ padding: '14px 22px', minWidth: 400, fontFamily: PAC_FONT }}>
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
          // Sets de derecha a izquierda
          const visualPositions = Array.from({ length: setCount }, (_, p) => setCount - 1 - p)

          return (
            <div key={team} style={{
              display: 'grid',
              gridTemplateColumns: `22px auto 1fr ${setCount > 0 ? `repeat(${setCount}, 36px)` : ''} 56px`,
              alignItems: 'center', gap: 10,
              padding: '8px 0',
              borderTop: tn === 2 ? '1px solid rgba(255,255,255,.14)' : 'none',
            }}>
              {/* Serve dot ámbar */}
              <div>
                {isServe && (
                  <span style={{
                    display: 'block', width: 11, height: 11, borderRadius: '50%',
                    background: PAC.amber, boxShadow: `0 0 14px ${PAC.amber}`,
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
                  <img src={flagPath(players[0]?.nationality)} alt="" style={{ width: 30, height: 20, borderRadius: 3, objectFit: 'cover' }}/>
                )}
              </div>
              {/* Names */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, whiteSpace: 'nowrap', minWidth: 220 }}>
                <span style={{ ...text(22, 600), letterSpacing: '-.005em' }}>
                  {isDoubles
                    ? players.map((p:any) => firstSurname(p)).join(' / ')
                    : (players[0]?.last_name ?? '')}
                </span>
                {entry?.seed && <span style={{ ...text(12, 500, COLORS.textLo) }}>({entry.seed})</span>}
              </div>
              {/* Set tabs (derecha→izquierda) */}
              {visualPositions.map((actualIdx, p) => {
                const v = setsT[actualIdx]
                const opV = setsOp[actualIdx]
                const isFinishedSet = actualIdx < finishedSetCount
                const isCurrent = !isFinishedSet
                const isWonSet = isFinishedSet && v != null && opV != null && v > opV
                return (
                  <div key={p} style={{
                    width: 32, height: 28, display: 'grid', placeItems: 'center',
                    background: isWonSet
                      ? GRAD_CYAN_CORAL
                      : isCurrent ? hexAlpha(accent, .35) : 'rgba(255,255,255,.10)',
                    border: isCurrent && !isWonSet ? `1px solid ${accent}` : '1px solid rgba(255,255,255,.18)',
                    borderRadius: '40% 60% 40% 60% / 60% 40% 60% 40%',
                    color: COLORS.white, fontSize: 17, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                    textShadow: TEXT_SHADOW_LIGHT,
                  }}>
                    {v == null ? '' : v}
                  </div>
                )
              })}
              {/* Points / Ticker — capsule fluida */}
              <div style={{
                height: 32, padding: '0 12px', display: 'grid', placeItems: 'center',
                background: showTicker
                  ? 'rgba(255,255,255,.10)'
                  : tbActive ? PAC.amber : GRAD_CYAN_CORAL,
                color: showTicker ? COLORS.white : tbActive ? PAC.ink : COLORS.white,
                borderRadius: 999,
                fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
                textShadow: tbActive ? 'none' : TEXT_SHADOW_LIGHT,
              }}>
                {showTicker ? tickerVal : pt}
              </div>
            </div>
          )
        })}
        {showTicker && (
          <div style={{ paddingTop: 6, marginTop: 4, borderTop: '1px solid rgba(255,255,255,.14)', textAlign: 'right' }}>
            <span style={kicker(PAC.coralLt, 11)}>{tickerLabel}</span>
          </div>
        )}
      </OrganicCard>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 2) BIG SCOREBOARD PACIFIC — capsule organica horizontal centrada bottom 50
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
  const visualToActual = (p: number) => setCount - 1 - p

  const setColW = 86
  const sponsorColW = 220
  const cardMaxW = showSponsor ? 1500 : 1100

  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 50,
      display: 'flex', justifyContent: 'center', pointerEvents: 'none',
    }}>
      <div style={{ width: 'fit-content', maxWidth: cardMaxW, pointerEvents: 'auto', fontFamily: PAC_FONT,
        ...animStyle(visible, 'sgInU', 'sgOutU', 700) }}>
        {/* Capsule organica con border-radius pill para que parezca fluida */}
        <div style={{
          background: GLASS_DARK,
          border: GLASS_BORDER,
          borderRadius: '60px 60px 60px 60px / 80px 80px 80px 80px',
          backdropFilter: 'blur(28px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(28px) saturate(1.3)',
          boxShadow: '0 28px 70px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.18)',
          overflow: 'hidden',
          position: 'relative',
        }}>
          {/* Splashes decorativos */}
          <CornerSplash pos="bl" color={PAC.cyan} size={300} opacity={.40}/>
          <CornerSplash pos="tr" color={PAC.coral} size={280} opacity={.35}/>

          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* HEADER */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'auto 1fr auto',
              alignItems: 'center', padding: '12px 36px', gap: 18,
              borderBottom: '1px solid rgba(255,255,255,.14)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {tournament?.logo_url && <img src={tournament.logo_url} alt="" style={{ height: 40, objectFit: 'contain' }}/>}
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
                  <span style={{ ...text(20, 600), letterSpacing: '-.005em', whiteSpace: 'nowrap' }}>
                    {tournament?.name}
                  </span>
                  <span style={kicker(COLORS.textLo, 12)}>
                    {CATEGORY_LABELS[match.category as Category] ?? match.category}
                  </span>
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{
                  ...pacPillStyle(),
                  padding: '6px 24px', fontSize: 16, fontWeight: 600, letterSpacing: '.18em',
                  textTransform: 'uppercase', color: COLORS.white, whiteSpace: 'nowrap', display: 'inline-block',
                  textShadow: TEXT_SHADOW_LIGHT,
                }}>
                  {roundLabel(match.round) || '—'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.05 }}>
                <span style={kicker(COLORS.textLo, 11)}>TIEMPO</span>
                <span style={{ ...text(22, 600), fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
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
              {setCount > 0 && (
                <>
                  <div style={{ gridColumn: '1 / span 2', gridRow: 1 }}/>
                  {Array.from({ length: setCount }).map((_, p) => {
                    const actual = visualToActual(p)
                    const dur = opts?.set_durations?.[actual]
                    return (
                      <div key={`st${p}`} style={{
                        gridColumn: 3 + p, gridRow: 1,
                        display: 'grid', placeItems: 'center',
                        ...kicker(COLORS.textLo, 12),
                      }}>
                        SET {actual+1}{dur ? ` · ${fmtClock(dur)}` : ''}
                      </div>
                    )
                  })}
                </>
              )}

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
                const rowBg = won
                  ? `linear-gradient(90deg, ${hexAlpha(PAC.cyan,.18)} 0%, ${hexAlpha(PAC.coral,.18)} 100%)`
                  : isServingTeam ? hexAlpha(accent, .08) : 'transparent'
                return (
                  <div key={team} style={{ display: 'contents' }}>
                    {/* Accent bar */}
                    <div style={{ gridColumn: 1, gridRow: row, background: `linear-gradient(180deg, ${accent} 0%, ${hexAlpha(accent,.5)} 100%)` }}/>
                    {/* Names */}
                    <div style={{
                      gridColumn: 2, gridRow: row,
                      display: 'flex', flexDirection: 'column', justifyContent: 'center',
                      gap: isDoubles ? 4 : 0, padding: '12px 22px',
                      background: rowBg,
                      borderTop: team === 2 ? '1px solid rgba(255,255,255,.10)' : 'none',
                    }}>
                      {players.map((p:any, i:number) => {
                        const isServer = isServingTeam && (!isDoubles || p.id === match.current_server_id)
                        return (
                          <PacificPlayerLine key={i} player={p} accent={accent} isDoubles={isDoubles} isServer={isServer}/>
                        )
                      })}
                    </div>
                    {/* Set scores */}
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
                          fontSize: 50, fontWeight: 500,
                          borderTop: team === 2 ? '1px solid rgba(255,255,255,.10)' : 'none',
                          background: isSetWon
                            ? GRAD_CYAN_CORAL
                            : isCurrent ? hexAlpha(accent, .14) : 'transparent',
                          color: v == null ? COLORS.textLo : COLORS.white,
                          fontVariantNumeric: 'tabular-nums',
                          textShadow: TEXT_SHADOW,
                        }}>
                          {v == null ? '–' : v}
                        </div>
                      )
                    })}
                  </div>
                )
              })}

              {showSponsor && (
                <div style={{
                  gridColumn: setCount > 0 ? `${3 + setCount} / ${4 + setCount}` : '3 / 4',
                  gridRow: setCount > 0 ? '1 / 4' : '1 / 3',
                  borderLeft: '1px solid rgba(255,255,255,.14)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: 14,
                }}>
                  <div style={kicker(COLORS.textLo, 10)}>Patrocinador oficial</div>
                  <div style={{ flex: 1, display: 'grid', placeItems: 'center', width: '100%', marginTop: 6 }}>
                    {sponsor?.logo_url
                      ? <img src={sponsor.logo_url} alt={sponsor?.name} style={{ maxWidth: 180, maxHeight: 80, objectFit: 'contain' }}/>
                      : <span style={{ ...text(18, 700), letterSpacing: '.04em', textAlign: 'center', textTransform: 'uppercase' }}>{sponsor?.name ?? ''}</span>
                    }
                  </div>
                </div>
              )}
            </div>
          </div>
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
        <span style={{ ...text(firstFs, 400, COLORS.textMid), letterSpacing: '.01em', textTransform: 'uppercase' }}>
          {player.first_name.toUpperCase()}
        </span>
      )}
      <span style={{ ...text(lastFs, 600), letterSpacing: '-.01em', textTransform: 'uppercase' }}>
        {(player.last_name ?? '').toUpperCase()}
      </span>
      {isServer && (
        <span aria-label="saca" style={{
          alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '3px 10px 3px 6px', borderRadius: 999,
          background: hexAlpha(PAC.amber, .20),
          border: `1px solid ${hexAlpha(PAC.amber, .60)}`,
          marginLeft: 6,
        }}>
          <span style={{
            width: 12, height: 12, borderRadius: '50%', background: PAC.amber,
            boxShadow: `0 0 10px ${PAC.amber}`, animation: 'sgSrvPulse 1.3s infinite',
            display: 'inline-block',
          }}/>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.18em', color: PAC.amber, textShadow: TEXT_SHADOW_LIGHT }}>SAQUE</span>
        </span>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 3) WEATHER PACIFIC — blob organico real
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
      position: 'absolute', right: 90, bottom: 90, width: 340,
      ...animStyle(visible, 'sgInL', 'sgOutL', 650),
    }}>
      {/* Blob real con SVG path como mascara — forma totalmente irregular */}
      <div style={{ position: 'relative', padding: '24px 28px', fontFamily: PAC_FONT }}>
        {/* Background blob — ocupa todo y es la "card" */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none"
             style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', filter: 'drop-shadow(0 18px 40px rgba(0,0,0,.40))' }}>
          <defs>
            <linearGradient id="weatherBg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgb(8,18,32)" stopOpacity=".78"/>
              <stop offset="100%" stopColor="rgb(15,28,52)" stopOpacity=".74"/>
            </linearGradient>
          </defs>
          <path d={BLOB_PATHS[1]} fill="url(#weatherBg)" stroke="rgba(255,255,255,.22)" strokeWidth=".4"/>
        </svg>
        {/* Splash decorativo */}
        <Blob path={BLOB_PATHS[2]} fill={PAC.coral} width={140} height={140} opacity={.40} blur={20}
              style={{ top: -30, right: -20 }}/>
        {/* Content */}
        <div style={{ position: 'relative', padding: '8px 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
            <span style={{ fontSize: 48, lineHeight: 1, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.4))' }}>{icon}</span>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
              <span style={{ ...text(58, 200), letterSpacing: '-.03em' }}>
                {Math.round(weather.temperature_c)}°
              </span>
              <span style={kicker(PAC.coralLt, 12)}>{weather.condition}</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.18)' }}>
            <div>
              <div style={kicker(COLORS.textLo, 10)}>Sensación</div>
              <div style={{ ...text(20, 500), marginTop: 2 }}>{Math.round(weather.feels_like_c)}°</div>
            </div>
            <div>
              <div style={kicker(COLORS.textLo, 10)}>Viento</div>
              <div style={{ ...text(20, 500), marginTop: 2 }}>{Math.round(weather.wind_speed_kmh)} km/h</div>
            </div>
            <div>
              <div style={kicker(COLORS.textLo, 10)}>Humedad</div>
              <div style={{ ...text(20, 500), marginTop: 2 }}>{weather.humidity_pct}%</div>
            </div>
            <div>
              <div style={kicker(COLORS.textLo, 10)}>Sede</div>
              <div style={{ ...text(16, 500), marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {tournament?.venue_city ?? '—'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 4) TOURNAMENT INTRO — composicion minimal con blobs flotantes
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
      fontFamily: PAC_FONT,
      ...animStyle(visible, 'sgInZC', 'sgOutZC', 750),
    }}>
      {/* Glass card con border-radius asimetrico organico (no es un rectangulo redondeado) */}
      <div style={{
        position: 'absolute', inset: 0,
        background: GLASS_DARK,
        border: GLASS_BORDER,
        borderRadius: '54% 46% 50% 50% / 38% 50% 50% 62%',
        backdropFilter: 'blur(28px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(28px) saturate(1.3)',
        boxShadow: '0 30px 80px rgba(0,0,0,.45)',
        overflow: 'hidden',
      }}>
        {/* Splashes decorativos grandes en esquinas */}
        <Blob path={BLOB_PATHS[0]} fill={PAC.cyan} width={460} height={460} opacity={.40} blur={40}
              style={{ top: -180, left: -140 }}/>
        <Blob path={BLOB_PATHS[2]} fill={PAC.coral} width={500} height={500} opacity={.35} blur={42}
              style={{ bottom: -220, right: -160 }}/>
        <Blob path={BLOB_PATHS[3]} fill={PAC.blue} width={300} height={300} opacity={.20} blur={36}
              style={{ top: 80, right: -50 }}/>
      </div>

      {/* Contenido encima */}
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 32, padding: '60px 80px', textAlign: 'center', zIndex: 1,
      }}>
        {tournament.logo_url && (
          <img src={tournament.logo_url} alt="" style={{ maxWidth: 280, maxHeight: 240, objectFit: 'contain', filter: 'drop-shadow(0 8px 24px rgba(0,0,0,.4))' }}/>
        )}
        <div style={{ ...text(108, 300), lineHeight: .92, letterSpacing: '-.025em' }}>
          {tournament.name}
        </div>
        <div style={{ ...pacPillStyle(), display: 'inline-block', padding: '12px 36px' }}>
          <span style={{ ...text(22, 500), letterSpacing: '.08em', textTransform: 'uppercase' }}>{subtitle}</span>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 5) VENUE CARD — blob orgánico bottom-right
// ════════════════════════════════════════════════════════════════════════════
export function VenueCardPacific({ visible, tournament }: { visible: boolean, tournament: Tournament | null }) {
  if (!tournament) return null
  return (
    <div style={{
      position: 'absolute', right: 90, bottom: 90, width: 560,
      fontFamily: PAC_FONT,
      ...animStyle(visible, 'sgInL', 'sgOutL', 650),
    }}>
      <div style={{ position: 'relative', padding: '28px 36px' }}>
        {/* Blob background con SVG path real */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none"
             style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', filter: 'drop-shadow(0 20px 40px rgba(0,0,0,.42))' }}>
          <defs>
            <linearGradient id="venueBg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgb(8,18,32)" stopOpacity=".74"/>
              <stop offset="100%" stopColor="rgb(15,28,52)" stopOpacity=".70"/>
            </linearGradient>
          </defs>
          <path d={BLOB_PATHS[2]} fill="url(#venueBg)" stroke="rgba(255,255,255,.22)" strokeWidth=".4"/>
        </svg>
        <Blob path={BLOB_PATHS[1]} fill={PAC.cyan} width={180} height={180} opacity={.40} blur={22}
              style={{ top: -30, left: -30 }}/>
        <div style={{ position: 'relative', zIndex: 1, padding: '14px 18px' }}>
          <div style={kicker(PAC.coralLt, 14)}>SEDE</div>
          <div style={{ ...text(40, 500), marginTop: 8, lineHeight: .98, letterSpacing: '-.01em' }}>
            {tournament.venue_name || tournament.venue_city}
          </div>
          <div style={{ ...text(22, 500, PAC.cyanLt), marginTop: 6, letterSpacing: '.06em', textTransform: 'uppercase' }}>
            {tournament.venue_city}
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 6) MATCH PRESENTATION
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
      fontFamily: PAC_FONT,
      ...animStyle(visible, 'sgInZ', 'sgOutZ', 750),
    }}>
      {/* Background blob organico */}
      <div style={{
        position: 'absolute', inset: 0,
        background: GLASS_DARK,
        border: GLASS_BORDER,
        borderRadius: '46% 54% 50% 50% / 50% 46% 54% 50%',
        backdropFilter: 'blur(28px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(28px) saturate(1.3)',
        boxShadow: '0 30px 80px rgba(0,0,0,.45)',
        overflow: 'hidden',
      }}>
        <Blob path={BLOB_PATHS[0]} fill={PAC.cyan} width={500} height={500} opacity={.32} blur={42}
              style={{ top: -200, left: -180 }}/>
        <Blob path={BLOB_PATHS[3]} fill={PAC.coral} width={520} height={520} opacity={.32} blur={44}
              style={{ bottom: -220, right: -180 }}/>
      </div>

      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', zIndex: 1 }}>
        {/* Header */}
        <div style={{ padding: '36px 60px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 36, borderBottom: '1px solid rgba(255,255,255,.14)' }}>
          {tournament?.logo_url && <img src={tournament.logo_url} alt="" style={{ height: 100, width: 100, objectFit: 'contain', flex: 'none', filter: 'drop-shadow(0 6px 18px rgba(0,0,0,.4))' }}/>}
          <div style={{ ...text(64, 300), lineHeight: .98, letterSpacing: '-.018em', textAlign: 'center', maxWidth: 1100 }}>
            {tournament?.name}
          </div>
        </div>
        {pillText && (
          <div style={{ textAlign: 'center', padding: '24px 0 12px' }}>
            <span style={{
              ...pacPillStyle(),
              display: 'inline-block', padding: '12px 36px',
              ...text(22, 500), letterSpacing: '.18em', textTransform: 'uppercase',
            }}>
              {pillText}
            </span>
          </div>
        )}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 240px 1fr', alignItems: 'center', padding: '12px 40px 36px' }}>
          <PacTeamBlock entry={match.entry1} accent={pal.accentA} align="right" isDoubles={isDoubles}/>
          <div style={{ display: 'grid', placeItems: 'center' }}>
            <div style={{
              fontSize: 200, fontWeight: 200, lineHeight: .85, letterSpacing: '-.05em',
              background: GRAD_CYAN_CORAL,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              filter: 'drop-shadow(0 4px 10px rgba(0,0,0,.4))',
            }}>vs</div>
          </div>
          <PacTeamBlock entry={match.entry2} accent={pal.accentB} align="left" isDoubles={isDoubles}/>
        </div>
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
              // FORMA ORGANICA real (no circulo, no cuadrado)
              borderRadius: '52% 48% 42% 58% / 58% 44% 56% 42%',
              overflow: 'hidden',
              border: `2px solid ${hexAlpha(PAC.cyan, .55)}`,
              boxShadow: `0 16px 40px ${hexAlpha(accent,.40)}`,
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
                <span style={{ ...text(players.length === 1 ? 26 : 20, 400, COLORS.textMid), letterSpacing: '.02em', textTransform: 'uppercase' }}>
                  {p.first_name}
                </span>
              )}
              <span style={{ ...text(players.length === 1 ? 70 : 50, 600), lineHeight: .95, textTransform: 'uppercase', whiteSpace: 'nowrap', letterSpacing: '-.01em' }}>
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
// 7) PLAYER BIO — capsule organica lateral
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

  const sectionTitle: React.CSSProperties = { ...kicker(PAC.coralLt, 16) }
  const divider: React.CSSProperties = { height: 1, background: 'rgba(255,255,255,.14)', margin: '20px 0' }

  // Border-radius asimetrico segun lado (entra desde el otro lado)
  const cardRadius = side === 'left'
    ? '52% 48% 38% 62% / 56% 44% 56% 44%'
    : '48% 52% 62% 38% / 44% 56% 44% 56%'

  return (
    <div style={{ ...pos, fontFamily: PAC_FONT, ...animStyle(visible, enter, exit, 700) } as any}>
      <div style={{
        position: 'absolute', inset: 0,
        background: GLASS_DARK,
        border: GLASS_BORDER,
        borderRadius: cardRadius,
        backdropFilter: 'blur(28px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(28px) saturate(1.3)',
        boxShadow: '0 24px 60px rgba(0,0,0,.42)',
        overflow: 'hidden',
      }}>
        <Blob path={BLOB_PATHS[0]} fill={PAC.cyan} width={320} height={320} opacity={.32} blur={36}
              style={{ top: -140, [side === 'left' ? 'right' : 'left']: -100 } as any}/>
        <Blob path={BLOB_PATHS[2]} fill={PAC.coral} width={280} height={280} opacity={.32} blur={36}
              style={{ bottom: -120, [side === 'left' ? 'left' : 'right']: -100 } as any}/>
      </div>

      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', zIndex: 1 }}>
        <div style={{ padding: '28px 36px 24px', display: 'flex', gap: 22, alignItems: 'center' }}>
          {hasPhoto && (
            <div style={{
              flex: 'none', width: 220, height: 220,
              borderRadius: '52% 48% 38% 62% / 56% 44% 56% 44%',
              overflow: 'hidden',
              border: `3px solid ${hexAlpha(PAC.cyan, .60)}`,
              boxShadow: `0 16px 40px ${hexAlpha(accent,.40)}`,
            }}>
              <img src={player.photo_url!} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
            </div>
          )}
          <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: 18 }}>
            <img src={flagPath(player.nationality)} alt="" style={{ flex: 'none', width: 84, height: 56, borderRadius: 5, objectFit: 'cover' }}/>
            <div style={{ minWidth: 0 }}>
              <div style={{ ...text(32, 400, COLORS.textMid), lineHeight: 1, textTransform: 'uppercase', letterSpacing: '.02em' }}>
                {player.first_name}
              </div>
              <div style={{ ...text(70, 500), lineHeight: .92, textTransform: 'uppercase', letterSpacing: '-.01em' }}>
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
                  <div style={kicker(COLORS.textLo, 12)}>{k}</div>
                  <div style={{ ...text(28, 500), marginTop: 2 }}>{v}</div>
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
                  flex: 1, padding: '14px 22px',
                  borderRadius: '40% 60% 38% 62% / 50% 56% 44% 50%',
                  background: `linear-gradient(135deg, ${hexAlpha(PAC.cyan,.18)} 0%, ${hexAlpha(PAC.coral,.20)} 100%)`,
                  border: `1px solid ${hexAlpha(PAC.cyan, .40)}`,
                }}>
                  <div style={kicker(PAC.cyanLt, 14)}>RFET</div>
                  <div style={{ ...text(64, 300), lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>#{player.ranking_rfet}</div>
                </div>
              )}
              {player.ranking_itf && (
                <div style={{
                  flex: 1, padding: '14px 22px',
                  borderRadius: '60% 40% 62% 38% / 56% 44% 56% 44%',
                  background: `linear-gradient(135deg, ${hexAlpha(PAC.cyan,.18)} 0%, ${hexAlpha(PAC.coral,.20)} 100%)`,
                  border: `1px solid ${hexAlpha(PAC.cyan, .40)}`,
                }}>
                  <div style={kicker(PAC.cyanLt, 14)}>ITF</div>
                  <div style={{ ...text(64, 300), lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>#{player.ranking_itf}</div>
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
                  <span style={{ ...text(24, 600, PAC.coralLt), fontVariantNumeric: 'tabular-nums' }}>{t.year}</span>
                  <span style={{ ...text(22, 400), lineHeight: 1.2 }}>{t.name}</span>
                </div>
              ))}
            </div>
          </>)}

          {hasBio && (<>
            <div style={divider}/>
            <div style={sectionTitle}>BIO</div>
            <div style={{ ...text(20, 300, COLORS.textMid), marginTop: 10, lineHeight: 1.45, overflow: 'hidden', flex: 1 }}>
              {player.bio}
            </div>
          </>)}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 8) REFEREE LOWER THIRD
// ════════════════════════════════════════════════════════════════════════════
export function RefereeLowerThirdPacific({ visible, referee }: {
  visible: boolean, referee: { full_name: string, federacion?: string|null } | null, tournament: Tournament | null,
}) {
  if (!referee) return null
  return (
    <div style={{
      position: 'absolute', left: '50%', bottom: 100, transform: 'translateX(-50%)',
      width: 1240, height: 140,
      fontFamily: PAC_FONT,
      ...animStyle(visible, 'sgInClip', 'sgOutClip', 700),
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: GLASS_DARK,
        border: GLASS_BORDER,
        borderRadius: '60% 40% 50% 50% / 50% 60% 40% 50%',
        backdropFilter: 'blur(28px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(28px) saturate(1.3)',
        boxShadow: '0 18px 50px rgba(0,0,0,.42)',
        overflow: 'hidden',
        display: 'grid', gridTemplateColumns: '260px 1fr',
      }}>
        <div style={{ background: GRAD_HORIZ, display: 'grid', placeItems: 'center', position: 'relative' }}>
          <Blob path={BLOB_PATHS[1]} fill={PAC.cyanLt} width={200} height={200} opacity={.30} blur={20}
                style={{ top: -60, left: -40 }}/>
          <span style={{ ...text(24, 600), letterSpacing: '.30em', textTransform: 'uppercase', position: 'relative', zIndex: 1 }}>ÁRBITRO</span>
        </div>
        <div style={{ padding: '0 32px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, position: 'relative' }}>
          <Blob path={BLOB_PATHS[2]} fill={PAC.coral} width={240} height={240} opacity={.25} blur={28}
                style={{ bottom: -100, right: -60 }}/>
          <span style={{ ...text(50, 500), lineHeight: .95, textTransform: 'uppercase', letterSpacing: '-.01em', position: 'relative', zIndex: 1 }}>{referee.full_name}</span>
          {referee.federacion && <span style={{ ...kicker(PAC.cyanLt, 18), position: 'relative', zIndex: 1 }}>{referee.federacion}</span>}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 9) STATS PANEL
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

  const rows = [
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
  ] as Array<{ label: string, a: number|string, b: number|string }>

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
      width: 1180,
      fontFamily: PAC_FONT,
      ...animStyle(visible, 'sgInZC', 'sgOutZC', 700),
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: GLASS_DARK, border: GLASS_BORDER,
        borderRadius: '46% 54% 50% 50% / 50% 46% 54% 50%',
        backdropFilter: 'blur(28px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(28px) saturate(1.3)',
        boxShadow: '0 30px 80px rgba(0,0,0,.45)',
        overflow: 'hidden',
      }}>
        <Blob path={BLOB_PATHS[0]} fill={PAC.cyan} width={400} height={400} opacity={.32} blur={40}
              style={{ top: -180, left: -120 }}/>
        <Blob path={BLOB_PATHS[3]} fill={PAC.coral} width={420} height={420} opacity={.32} blur={40}
              style={{ bottom: -180, right: -120 }}/>
      </div>

      <div style={{ position: 'relative', padding: '32px 48px', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ ...text(44, 300), letterSpacing: '-.01em' }}>Estadísticas</div>
          <div style={kicker(PAC.coralLt, 16)}>{SCOPE_TITLE[resolvedScope] ?? ''}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 28, alignItems: 'center', marginBottom: 22 }}>
          <PacPlayerSmall entry={match.entry1} align="right" doubles={isDoubles}/>
          <PacScoreMini visibleSets={visibleSets}/>
          <PacPlayerSmall entry={match.entry2} align="left" doubles={isDoubles}/>
        </div>

        <div>
          <div style={{ height: 1, background: 'rgba(255,255,255,.14)' }}/>
          {rows.map((r, i) => <PacStatRow key={i} label={r.label} a={r.a} b={r.b}/>)}
        </div>

        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <span style={kicker(PAC.coralLt, 16)}>{roundLabel(match.round)}</span>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,.4)' }}/>
          <span style={kicker(COLORS.textMid, 14)}>{CATEGORY_LABELS[match.category as Category] ?? match.category}</span>
        </div>
      </div>
    </div>
  )
}

function PacPlayerSmall({ entry, align, doubles }: { entry: any, align: 'left'|'right', doubles: boolean }) {
  const players = [entry?.player1, doubles ? entry?.player2 : null].filter(Boolean)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: align === 'right' ? 'flex-end' : 'flex-start' }}>
      {players.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: align === 'right' ? 'row-reverse' : 'row' }}>
          <img src={flagPath(p?.nationality)} alt="" style={{ flex: 'none', width: 50, height: 34, borderRadius: 4, objectFit: 'cover' }}/>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1, alignItems: align === 'right' ? 'flex-end' : 'flex-start' }}>
            {p?.first_name && (
              <span style={{ ...text(players.length === 1 ? 18 : 15, 400, COLORS.textMid), letterSpacing: '.02em', textTransform: 'uppercase' }}>{p.first_name}</span>
            )}
            <span style={{ ...text(players.length === 1 ? 42 : 30, 500), lineHeight: .95, textTransform: 'uppercase', whiteSpace: 'nowrap', letterSpacing: '-.005em' }}>
              {(p?.last_name ?? '').toUpperCase()}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
function PacScoreMini({ visibleSets }: { visibleSets: Array<{ num: number, t1: number, t2: number, isCurrent: boolean }> }) {
  if (visibleSets.length === 0) return <div style={{ ...text(26, 400, COLORS.textLo) }}>—</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', minWidth: 200 }}>
      {visibleSets.map(s => (
        <div key={s.num} style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span style={kicker(COLORS.textLo, 14)}>SET {s.num}</span>
          <span style={{ ...text(30, 500), fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {s.t1}<span style={{ opacity: .4, margin: '0 10px' }}>—</span>{s.t2}
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
        <span style={{ ...text(32, 600, aWins ? PAC.cyanLt : COLORS.textMid), textAlign: 'right', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{a}</span>
        <span style={kicker(COLORS.textMid, 14)}>{label}</span>
        <span style={{ ...text(32, 600, bWins ? PAC.coralLt : COLORS.textMid), textAlign: 'left', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{b}</span>
      </div>
      <div style={{ height: 1, background: 'rgba(255,255,255,.08)' }}/>
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 10) RESULTS GRID — fase actual
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
      fontFamily: PAC_FONT,
      ...animStyle(visible, 'sgInZC', 'sgOutZC', 700),
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: GLASS_DARK, border: GLASS_BORDER,
        borderRadius: '50% 50% 40% 60% / 40% 50% 60% 50%',
        backdropFilter: 'blur(28px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(28px) saturate(1.3)',
        boxShadow: '0 30px 80px rgba(0,0,0,.45)',
        overflow: 'hidden',
      }}>
        <Blob path={BLOB_PATHS[0]} fill={PAC.cyan} width={520} height={520} opacity={.30} blur={42}
              style={{ top: -240, left: -180 }}/>
        <Blob path={BLOB_PATHS[2]} fill={PAC.coral} width={500} height={500} opacity={.30} blur={42}
              style={{ bottom: -240, right: -180 }}/>
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ padding: '24px 40px', borderBottom: '1px solid rgba(255,255,255,.14)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={kicker(PAC.coralLt, 14)}>Orden de juego · {ROUND_LABELS[activeRound ?? ''] ?? activeRound ?? ''}</div>
            <div style={{ ...text(42, 300), lineHeight: .98, letterSpacing: '-.01em', marginTop: 6 }}>
              {CATEGORY_LABELS[(category ?? matches[0]?.category) as Category] ?? tournament?.name}
            </div>
          </div>
          {tournament?.logo_url && <img src={tournament.logo_url} alt="" style={{ height: 60, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,.4))' }}/>}
        </div>

        <div style={{ padding: '20px 40px 30px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 28px' }}>
          {filtered.map((m: any) => (
            <PacResultRow key={m.id} m={m} highlight={m.id === highlightMatchId}/>
          ))}
        </div>
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
      padding: '12px 20px',
      // Capsule organica
      borderRadius: highlight ? '40% 60% 50% 50% / 50% 50% 50% 50%' : 999,
      background: highlight
        ? `linear-gradient(135deg, ${hexAlpha(PAC.cyan,.20)} 0%, ${hexAlpha(PAC.coral,.20)} 100%)`
        : 'rgba(255,255,255,.06)',
      border: highlight ? `1px solid ${hexAlpha(PAC.cyan, .55)}` : '1px solid rgba(255,255,255,.14)',
    }}>
      <div>
        {[1, 2].map(tn => {
          const team = tn as 1|2
          const entry = team === 1 ? m.entry1 : m.entry2
          const isWinner = finished && winnerTeam === team
          return (
            <div key={team} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'baseline', padding: '2px 0' }}>
              <span style={{ ...text(22, isWinner ? 600 : 400, isWinner ? COLORS.white : COLORS.textMid), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {teamLabel(entry)}
              </span>
              <span style={{ ...text(22, 600, isWinner ? PAC.cyanLt : COLORS.textLo), fontVariantNumeric: 'tabular-nums', letterSpacing: '.04em' }}>
                {setsLine(team)}
              </span>
            </div>
          )
        })}
      </div>
      <div style={{ textAlign: 'right' }}>
        {finished
          ? <span style={kicker(COLORS.textLo, 12)}>FINAL</span>
          : inProgress
          ? <span style={kicker(PAC.coralLt, 12)}>EN JUEGO</span>
          : <span style={kicker(COLORS.textLo, 12)}>{fmtSchedule(m.scheduled_at, m.court?.name)}</span>
        }
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 11) BRACKET — QF/SF/F
// ════════════════════════════════════════════════════════════════════════════
const PAC_KO = ['QF', 'SF', 'F'] as const
type PacKoRound = typeof PAC_KO[number]
const PAC_KO_LBL: Record<PacKoRound, string> = { QF: 'CUARTOS', SF: 'SEMIFINALES', F: 'FINAL' }
const PAC_KO_SLOTS: Record<PacKoRound, number> = { QF: 4, SF: 2, F: 1 }

export function BracketViewPacific({ visible, matches, highlightMatchId, tournament, category }: {
  visible: boolean, matches: any[], highlightMatchId?: string|null, tournament: Tournament | null, category?: string,
}) {
  const LC = 'rgba(255,255,255,.30)'
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

  const totalRows = PAC_KO_SLOTS.QF * 2
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
      fontFamily: PAC_FONT,
      ...animStyle(visible, 'sgInZC', 'sgOutZC', 700),
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: GLASS_DARK, border: GLASS_BORDER,
        borderRadius: '50% 50% 38% 62% / 40% 50% 50% 60%',
        backdropFilter: 'blur(28px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(28px) saturate(1.3)',
        boxShadow: '0 30px 80px rgba(0,0,0,.45)',
        overflow: 'hidden',
      }}>
        <Blob path={BLOB_PATHS[1]} fill={PAC.cyan} width={520} height={520} opacity={.28} blur={42}
              style={{ top: -240, left: -180 }}/>
        <Blob path={BLOB_PATHS[3]} fill={PAC.coral} width={500} height={500} opacity={.28} blur={42}
              style={{ bottom: -240, right: -180 }}/>
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ padding: '22px 40px', borderBottom: '1px solid rgba(255,255,255,.14)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={kicker(PAC.coralLt, 16)}>CUADRO</div>
            <div style={{ ...text(38, 300), letterSpacing: '-.01em', marginTop: 4 }}>
              {CATEGORY_LABELS[(category ?? matches[0]?.category) as Category] ?? ''}
            </div>
          </div>
          {tournament?.logo_url && <img src={tournament.logo_url} alt="" style={{ height: 60, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,.4))' }}/>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: gridCols, padding: '14px 40px 0' }}>
          {visibleRounds.map((r, i) => (
            <React.Fragment key={r}>
              {i > 0 && <div/>}
              <div style={{ textAlign: 'center', ...kicker(PAC.coralLt, 16) }}>{PAC_KO_LBL[r]}</div>
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
    </div>
  )
}

function PacBracketSlot({ m, hot, isFinal = false }: { m: any, hot: boolean, isFinal?: boolean }) {
  if (!m) {
    return (
      <div style={{
        flex: 1, padding: '14px 14px',
        borderRadius: '40% 60% 50% 50% / 50% 50% 50% 50%',
        background: 'rgba(255,255,255,.04)',
        border: '1px dashed rgba(255,255,255,.22)',
        textAlign: 'center',
      }}>
        <span style={kicker(COLORS.textLo, 14)}>Por determinar</span>
      </div>
    )
  }
  const score = m.score as Score | null
  const isDoubles = m.match_type === 'doubles'
  return (
    <div style={{
      flex: 1, padding: '10px 14px',
      // Cada slot es una capsule fluida (no rectangulo)
      borderRadius: '40% 60% 38% 62% / 50% 56% 44% 50%',
      background: hot
        ? `linear-gradient(135deg, ${hexAlpha(PAC.cyan,.28)} 0%, ${hexAlpha(PAC.coral,.28)} 100%)`
        : isFinal ? hexAlpha(PAC.coral, .14) : 'rgba(255,255,255,.06)',
      border: hot
        ? `1.5px solid ${hexAlpha(PAC.cyan, .60)}`
        : isFinal ? `1px solid ${hexAlpha(PAC.coral, .55)}` : '1px solid rgba(255,255,255,.14)',
    }}>
      <PacBracketLine entry={m.entry1} score={score} team={1} isDoubles={isDoubles}/>
      <div style={{ height: 1, background: 'rgba(255,255,255,.14)', margin: '4px 0' }}/>
      <PacBracketLine entry={m.entry2} score={score} team={2} isDoubles={isDoubles}/>
    </div>
  )
}
function PacBracketLine({ entry, score, team, isDoubles }: { entry: any, score: Score|null, team: 1|2, isDoubles: boolean }) {
  if (!entry) return <div style={{ ...text(18, 400, COLORS.textLo), padding: '4px 0' }}>—</div>
  const players = [entry?.player1, isDoubles ? entry?.player2 : null].filter(Boolean)
  const sets = threeSetsFor(score, team)
  const winner = (score?.winner_team ?? null) === team
  const nameStr = isDoubles
    ? players.map((p: any) => firstSurname(p)).filter(Boolean).join(' / ')
    : (players[0]?.last_name ?? '')
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', alignItems: 'center', gap: 8 }}>
      <span style={{
        ...text(18, winner ? 600 : 400, winner ? COLORS.white : COLORS.textMid),
        textTransform: 'uppercase', letterSpacing: '-.005em',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {nameStr.toUpperCase()}
      </span>
      {sets.map((v, i) => (
        <span key={i} style={{
          minWidth: 18, textAlign: 'center',
          ...text(18, 600, winner ? PAC.cyanLt : COLORS.textLo),
          fontVariantNumeric: 'tabular-nums',
        }}>
          {v == null ? '' : v}
        </span>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 12) COIN TOSS
// ════════════════════════════════════════════════════════════════════════════
export function CoinTossPacific({ visible, match }: { visible: boolean, match: any, tournament: Tournament | null }) {
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
      fontFamily: PAC_FONT,
      ...animStyle(visible, 'sgInZC', 'sgOutZC', 700),
    }}>
      <div style={{
        position: 'relative',
        background: GLASS_DARK, border: GLASS_BORDER,
        borderRadius: '52% 48% 38% 62% / 56% 44% 56% 44%',
        backdropFilter: 'blur(28px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(28px) saturate(1.3)',
        boxShadow: '0 30px 80px rgba(0,0,0,.45)',
        overflow: 'hidden',
        padding: '60px 80px',
        textAlign: 'center',
      }}>
        <Blob path={BLOB_PATHS[0]} fill={PAC.cyan} width={420} height={420} opacity={.32} blur={40}
              style={{ top: -200, left: -160 }}/>
        <Blob path={BLOB_PATHS[2]} fill={PAC.coral} width={400} height={400} opacity={.32} blur={40}
              style={{ bottom: -200, right: -140 }}/>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ ...kicker(PAC.coralLt, 18), marginBottom: 20 }}>SORTEO</div>
          <div style={{ ...text(36, 300, COLORS.textMid), marginBottom: 14 }}>Gana el sorteo</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 28 }}>
            {players.map((p: any, i: number) => (
              <div key={i} style={{ ...text(56, 500), lineHeight: 1, textTransform: 'uppercase', whiteSpace: 'nowrap', letterSpacing: '-.01em' }}>
                <span style={{ fontWeight: 300, color: COLORS.textMid, textShadow: TEXT_SHADOW }}>{(p?.first_name ?? '')} </span>
                {(p?.last_name ?? '').toUpperCase()}
              </div>
            ))}
          </div>
          {choiceText && (<>
            <div style={{ ...kicker(PAC.coralLt, 16), marginBottom: 12 }}>Y ELIGE</div>
            <div style={{
              ...pacPillStyle(),
              display: 'inline-block', padding: '14px 40px',
              ...text(50, 600), letterSpacing: '.16em', textTransform: 'uppercase',
            }}>
              {choiceText}
            </div>
          </>)}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 13) AWARDS PODIUM
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
      fontFamily: PAC_FONT,
      ...animStyle(visible, 'sgInZC', 'sgOutZC', 750),
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: GLASS_DARK, border: GLASS_BORDER,
        borderRadius: '46% 54% 50% 50% / 50% 46% 54% 50%',
        backdropFilter: 'blur(28px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(28px) saturate(1.3)',
        boxShadow: '0 30px 80px rgba(0,0,0,.45)',
        overflow: 'hidden',
      }}>
        <Blob path={BLOB_PATHS[0]} fill={PAC.cyan} width={500} height={500} opacity={.32} blur={42}
              style={{ top: -200, left: -160 }}/>
        <Blob path={BLOB_PATHS[2]} fill={PAC.coral} width={520} height={520} opacity={.36} blur={42}
              style={{ bottom: -220, right: -160 }}/>
      </div>

      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32, padding: '50px 60px', textAlign: 'center', zIndex: 1 }}>
        <div style={kicker(PAC.coralLt, 18)}>PODIO</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'end', width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ ...kicker(COLORS.textLo, 14), marginBottom: 10 }}>FINALISTA</div>
            {finalist?.photo_url && (
              <div style={{
                width: 200, height: 200, margin: '0 auto 16px',
                borderRadius: '52% 48% 42% 58% / 58% 44% 56% 42%',
                overflow: 'hidden', border: `3px solid ${hexAlpha(PAC.cyan, .60)}`,
                boxShadow: `0 16px 40px ${hexAlpha(PAC.cyan, .35)}`,
              }}>
                <img src={finalist.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
              </div>
            )}
            <div style={{ ...text(44, 400), lineHeight: .98, textTransform: 'uppercase', letterSpacing: '-.01em' }}>{finalist?.name}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ ...kicker(PAC.coralLt, 18), marginBottom: 10 }}>🏆 CAMPEÓN</div>
            {champion?.photo_url && (
              <div style={{
                width: 240, height: 240, margin: '0 auto 16px',
                borderRadius: '46% 54% 38% 62% / 50% 56% 44% 50%',
                overflow: 'hidden',
                border: `4px solid ${PAC.coralLt}`,
                boxShadow: `0 0 60px ${hexAlpha(PAC.coral, .60)}`,
              }}>
                <img src={champion.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
              </div>
            )}
            <div style={{ ...text(56, 500), lineHeight: .98, textTransform: 'uppercase', letterSpacing: '-.015em' }}>{champion?.name}</div>
          </div>
        </div>

        <div style={kicker(COLORS.textLo, 16)}>{tournament?.name}</div>
      </div>
    </div>
  )
}
