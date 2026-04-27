'use client'
// ============================================================================
// Streaming Graphics — PACIFIC (rediseño completo, no es un re-skin)
// ============================================================================
// Cada gráfico tiene una COMPOSICIÓN nueva, no la misma layout con colores.
//
// Filosofía:
//  - "Takeover" graphics (BigScoreboard, MatchPresentation, Bracket, Results,
//    Stats, Awards, CoinToss, Intro): la pantalla entera se viste como una
//    transmisión completa — multiples elementos posicionados, números
//    flotantes sin marco, splashes orgánicos en esquinas inferiores.
//  - Partial graphics (Scorebug, Weather, Bio, Venue, Referee LT): elementos
//    flotantes mínimos, sin invadir el resto.
//
// Solo el Weather es un BLOB ORGÁNICO de verdad (path SVG asimétrico). El
// resto usa rectángulos con rounding suave 32-40px (las "cards" del reference
// también son rectángulos suaves, no blobs).
//
// Contraste: glass NAVY oscuro + text-shadow en blanco — legible sobre
// sunset, daylight, beach.
// ============================================================================

import React, { useEffect, useState } from 'react'
import type { Player, Score, Sponsor, Tournament, WeatherData, Category } from '@/types'
import { CATEGORY_LABELS } from '@/types'
import { animStyle, hexAlpha, flagPath, palette, firstSurname } from './stage-shared'

// ─── PALETA ─────────────────────────────────────────────────────────────────
const PAC = {
  cyan: '#5fc4cc', cyanLt: '#7dd3d8',
  blue: '#4a90c2', blueDk: '#3a72a0',
  coral: '#ff8a72', coralLt: '#ffb39d',
  amber: '#ffd07a',
  ink: '#0e1c29',
}
const TS_HARD = '0 1px 2px rgba(0,0,0,.55), 0 2px 12px rgba(0,0,0,.40)'
const TS_SOFT = '0 1px 2px rgba(0,0,0,.45)'
const C = {
  hi: '#ffffff',
  mid: 'rgba(255,255,255,.82)',
  lo: 'rgba(255,255,255,.62)',
  faint: 'rgba(255,255,255,.40)',
}
const FONT = "'Inter', 'SF Pro Display', system-ui, -apple-system, sans-serif"

// Glass dark — base de las cards (legible sobre fondos claros)
const GLASS = 'linear-gradient(135deg, rgba(8,18,32,.68) 0%, rgba(15,28,52,.62) 100%)'
const GLASS_BORDER = '1px solid rgba(255,255,255,.18)'
const GLASS_SHADOW = '0 24px 60px rgba(0,0,0,.40), inset 0 1px 0 rgba(255,255,255,.16)'

// Gradient horizontal cyan→blue→coral (top pill, LIVE pill, etc.)
const GRAD_HORIZ = `linear-gradient(90deg, ${PAC.cyan} 0%, ${PAC.blue} 50%, ${PAC.coral} 100%)`
const GRAD_CYAN_CORAL = `linear-gradient(135deg, ${PAC.cyan} 0%, ${PAC.coral} 100%)`

const pacText = (size: number, weight: number = 500, color: string = C.hi): React.CSSProperties => ({
  fontSize: size, fontWeight: weight, color, textShadow: TS_HARD,
})
const pacKicker = (color: string = C.lo, size: number = 12): React.CSSProperties => ({
  fontSize: size, letterSpacing: '.24em', textTransform: 'uppercase',
  fontWeight: 500, color, textShadow: TS_SOFT,
})

// ─── BLOB SVG REAL (path asimétrico, no border-radius) ──────────────────────
const BLOB_PATHS = [
  'M58,8 C76,12 92,25 92,43 C93,62 80,80 60,88 C40,95 14,91 7,73 C-1,55 12,24 30,12 C38,7 47,5 58,8 Z',
  'M50,5 C72,8 92,22 91,46 C90,70 70,90 50,92 C30,94 8,82 7,58 C6,34 28,2 50,5 Z',
  'M48,12 C70,8 90,28 88,52 C86,76 64,90 42,86 C20,82 6,62 10,40 C14,18 30,16 48,12 Z',
]

// Splash decorativo de esquina (wave gradient turquesa o coral)
function CornerSplash({ corner, color, size = 480, opacity = .55 }: {
  corner: 'bl' | 'br', color: string, size?: number, opacity?: number,
}) {
  const positions: Record<typeof corner, React.CSSProperties> = {
    bl: { left: -size * 0.35, bottom: -size * 0.35, transform: 'rotate(-15deg)' },
    br: { right: -size * 0.35, bottom: -size * 0.35, transform: 'rotate(15deg) scaleX(-1)' },
  } as any
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"
         style={{ position: 'absolute', filter: `blur(28px)`, opacity, pointerEvents: 'none', zIndex: 0, ...positions[corner] }}>
      <defs>
        <radialGradient id={`cs-${corner}-${color.replace('#','')}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity="1"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </radialGradient>
      </defs>
      <path d={BLOB_PATHS[0]} fill={`url(#cs-${corner}-${color.replace('#','')})`}/>
    </svg>
  )
}

// Splashes globales en las esquinas inferiores — la firma visual del skin.
// Se incluyen en todos los graficos "takeover".
function StageSplashes() {
  return (
    <>
      <CornerSplash corner="bl" color={PAC.cyan} size={520} opacity={.62}/>
      <CornerSplash corner="br" color={PAC.coral} size={520} opacity={.55}/>
    </>
  )
}

// Top-left brand corner (logo + tournament name)
function BrandCorner({ tournament }: { tournament: Tournament | null }) {
  return (
    <div style={{ position: 'absolute', top: 36, left: 56, display: 'flex', alignItems: 'center', gap: 14, zIndex: 5 }}>
      {tournament?.logo_url && <img src={tournament.logo_url} alt="" style={{ height: 44, objectFit: 'contain', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,.4))' }}/>}
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
        <span style={{ ...pacKicker(C.lo, 11) }}>BEACH TENNIS LIVE</span>
        <span style={{ ...pacText(15, 700, C.hi), letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 2 }}>
          {tournament?.name ?? ''}
        </span>
      </div>
    </div>
  )
}

// Top-right LIVE pill (only when match is in progress)
function LivePill({ inProgress }: { inProgress: boolean }) {
  if (!inProgress) return null
  return (
    <div style={{ position: 'absolute', top: 40, right: 56, zIndex: 5 }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        padding: '8px 18px 8px 14px', borderRadius: 999,
        background: 'rgba(255,138,114,.92)',
        boxShadow: '0 8px 24px rgba(255,138,114,.40), inset 0 1px 0 rgba(255,255,255,.30)',
        border: '1px solid rgba(255,255,255,.30)',
      }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff', boxShadow: '0 0 10px #fff', animation: 'sgBlink 1.4s infinite' }}/>
        <span style={{ ...pacText(14, 800, C.hi), letterSpacing: '.18em' }}>LIVE</span>
      </div>
    </div>
  )
}

// ─── ETIQUETAS ──────────────────────────────────────────────────────────────
const ROUND_LABELS: Record<string, string> = {
  F: 'Final', SF: 'Semifinal', QF: 'Cuartos de final', R16: 'Octavos de final',
  R32: 'Dieciseisavos', RR: 'Fase de grupos', GRP: 'Fase de grupos', CON: 'Consolación',
  Q1: 'Clasificatoria 1', Q2: 'Clasificatoria 2',
}
const ROUND_SHORT: Record<string, string> = {
  F: 'FINAL', SF: 'SEMIFINAL', QF: 'CUARTOS', R16: 'OCTAVOS', R32: '1/16',
  RR: 'GRUPOS', GRP: 'GRUPOS', CON: 'CONSOLACIÓN', Q1: 'Q1', Q2: 'Q2',
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
function lateralityShort(laterality: string|null|undefined) {
  if (laterality === 'left') return 'LEFT HANDED'
  if (laterality === 'ambidextrous') return 'AMBIDEXTROUS'
  return 'RIGHT HANDED'
}

// Set scoring summary helpers
function teamSetsFinished(score: Score | null, team: 1|2): number {
  if (!score?.sets?.length) return 0
  const k = team === 1 ? 't1' : 't2'
  const ok = team === 1 ? 't2' : 't1'
  return score.sets.reduce((acc: number, s: any) => acc + ((s[k] ?? 0) > (s[ok] ?? 0) ? 1 : 0), 0)
}

// ════════════════════════════════════════════════════════════════════════════
//  SHARED — CARD JUGADOR LATERAL (usado por BigScoreboard y MatchPresentation)
// ════════════════════════════════════════════════════════════════════════════
function PacPlayerCard({ entry, side, isDoubles, accent, teamLabel }: {
  entry: any, side: 'left'|'right', isDoubles: boolean, accent: string, teamLabel?: string,
}) {
  const players = [entry?.player1, isDoubles ? entry?.player2 : null].filter(Boolean)
  const align = side === 'left' ? 'flex-start' : 'flex-end'
  return (
    <div style={{
      width: 460,
      background: GLASS,
      border: GLASS_BORDER,
      borderRadius: 28,
      backdropFilter: 'blur(18px) saturate(1.2)',
      WebkitBackdropFilter: 'blur(18px) saturate(1.2)',
      boxShadow: GLASS_SHADOW,
      padding: '24px 28px',
      fontFamily: FONT,
    }}>
      {players.map((p: any, i: number) => (
        <React.Fragment key={i}>
          {i > 0 && <div style={{ height: 1, background: 'rgba(255,255,255,.12)', margin: '14px 0' }}/>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Foto CIRCULAR — clave del reference */}
            {p?.photo_url ? (
              <div style={{
                flex: 'none', width: 72, height: 72, borderRadius: '50%', overflow: 'hidden',
                border: '2px solid rgba(255,255,255,.30)', boxShadow: '0 6px 18px rgba(0,0,0,.40)',
              }}>
                <img src={p.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
              </div>
            ) : (
              <div style={{
                flex: 'none', width: 72, height: 72, borderRadius: '50%',
                background: hexAlpha(accent, .25), border: '2px solid rgba(255,255,255,.30)',
                display: 'grid', placeItems: 'center',
                ...pacText(28, 600, C.hi),
              }}>
                {(p?.first_name?.[0] ?? '?').toUpperCase()}
              </div>
            )}
            {/* Nombre + meta */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...pacKicker(C.lo, 11) }}>{(p?.first_name ?? '').toUpperCase()}</div>
              <div style={{ ...pacText(28, 600), letterSpacing: '-.005em', lineHeight: 1, marginTop: 2 }}>
                {(p?.last_name ?? '').toUpperCase()}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, ...pacKicker(C.lo, 10) }}>
                {p?.birth_date && <span>AGE {ageFrom(p.birth_date)}</span>}
                {p?.ranking_rfet && <span>RANK #{p.ranking_rfet}</span>}
                {p?.nationality && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <img src={flagPath(p.nationality)} alt="" style={{ width: 18, height: 12, borderRadius: 2, objectFit: 'cover' }}/>
                    {p.nationality.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
            {/* Lateralidad pill (right side) */}
            {p?.laterality && (
              <div style={{ ...pacKicker(C.lo, 9), textAlign: 'right', whiteSpace: 'nowrap' }}>
                <span aria-hidden style={{ marginRight: 4 }}>🎾</span>
                {lateralityShort(p.laterality)}
              </div>
            )}
          </div>
        </React.Fragment>
      ))}
      {/* Footer team label */}
      {teamLabel && (
        <div style={{
          marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.12)',
          display: 'flex', alignItems: 'center', justifyContent: side === 'left' ? 'flex-start' : 'flex-end', gap: 10,
        }}>
          <span style={pacKicker(C.lo, 11)}>TEAM</span>
          <span style={{ ...pacText(14, 700, accent), letterSpacing: '.16em', textTransform: 'uppercase' }}>
            {teamLabel}
          </span>
        </div>
      )}
    </div>
  )
}

// Top center pill: team summary + score (compact line)
function TopScorePill({ match, score, isDoubles }: { match: any, score: Score | null, isDoubles: boolean }) {
  const setsT1 = teamSetsFinished(score, 1)
  const setsT2 = teamSetsFinished(score, 2)
  const t1Name = isDoubles
    ? [match.entry1?.player1, match.entry1?.player2].map((p:any) => firstSurname(p)).filter(Boolean).join(' / ')
    : (match.entry1?.player1?.last_name ?? '')
  const t2Name = isDoubles
    ? [match.entry2?.player1, match.entry2?.player2].map((p:any) => firstSurname(p)).filter(Boolean).join(' / ')
    : (match.entry2?.player1?.last_name ?? '')

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 24,
      padding: '12px 36px', borderRadius: 999,
      background: GRAD_HORIZ,
      boxShadow: '0 12px 36px rgba(0,0,0,.30), inset 0 1px 0 rgba(255,255,255,.35)',
      border: '1px solid rgba(255,255,255,.30)',
    }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#fff', boxShadow: '0 0 10px rgba(255,255,255,.6)' }}/>
      <span style={{ ...pacText(20, 700), letterSpacing: '.16em', textTransform: 'uppercase' }}>{t1Name.toUpperCase()}</span>
      <span style={{ ...pacText(28, 800), fontVariantNumeric: 'tabular-nums' }}>{setsT1}</span>
      <span style={{ ...pacText(14, 500, C.hi), opacity: .85, letterSpacing: '.18em', textTransform: 'uppercase' }}>vs</span>
      <span style={{ ...pacText(28, 800), fontVariantNumeric: 'tabular-nums' }}>{setsT2}</span>
      <span style={{ ...pacText(20, 700), letterSpacing: '.16em', textTransform: 'uppercase' }}>{t2Name.toUpperCase()}</span>
    </div>
  )
}

// Bottom center pill: court name + round
function CourtRoundPill({ match }: { match: any }) {
  const courtName = match.court?.name
  const round = ROUND_SHORT[match.round] ?? ''
  return (
    <div style={{
      display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    }}>
      {courtName && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 12,
          padding: '12px 32px', borderRadius: 999,
          background: GLASS, border: GLASS_BORDER,
          backdropFilter: 'blur(18px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(18px) saturate(1.2)',
          boxShadow: GLASS_SHADOW,
        }}>
          <span aria-hidden style={{ ...pacText(16, 500), opacity: .8 }}>📍</span>
          <span style={{ ...pacText(20, 600), letterSpacing: '.10em', textTransform: 'uppercase' }}>{courtName}</span>
        </div>
      )}
      {round && <span style={{ ...pacKicker(C.mid, 12) }}>{round}</span>}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 1) BIG SCOREBOARD PACIFIC — Takeover broadcast composition
// ════════════════════════════════════════════════════════════════════════════
export function BigScoreboardPacific({ visible, match, tournament, sponsor }: {
  visible: boolean, match: any, tournament: Tournament | null, sponsor?: Sponsor | null, opts?: any,
}) {
  if (!match) return null
  const pal = palette(tournament?.scoreboard_config)
  const score = match.score as Score | null
  const isDoubles = match.match_type === 'doubles'
  const inProgress = score?.match_status === 'in_progress' && match.status === 'in_progress'

  // Que números mostrar en el centro?
  // Si hay set en juego con anotación → score del set actual.
  // Si no, último set terminado.
  // Si no hay sets aún → 0-0 con label "PRE-MATCH"
  const finishedSets = score?.sets ?? []
  const cs = score?.current_set ?? { t1: 0, t2: 0 }
  const tb = score?.tiebreak_score ?? { t1: 0, t2: 0 }
  const tbActive = !!(score?.tiebreak_active || score?.super_tiebreak_active)
  const cT1 = tbActive ? (tb.t1 ?? 0) : (cs.t1 ?? 0)
  const cT2 = tbActive ? (tb.t2 ?? 0) : (cs.t2 ?? 0)
  const currentHasScore = inProgress && (cT1 > 0 || cT2 > 0)

  let centerT1: number, centerT2: number, setLabel: string
  if (currentHasScore) {
    centerT1 = cT1; centerT2 = cT2
    setLabel = `${finishedSets.length + 1}${tbActive ? ' · TIE-BREAK' : ' · IN PLAY'}`
  } else if (finishedSets.length > 0) {
    const last = finishedSets[finishedSets.length - 1]
    centerT1 = last.t1; centerT2 = last.t2
    setLabel = match.status === 'finished' ? 'FINAL · MATCH' : `SET ${finishedSets.length} · FINISHED`
  } else {
    centerT1 = 0; centerT2 = 0
    setLabel = 'PRE-MATCH'
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, fontFamily: FONT,
      ...animStyle(visible, 'sgInF', 'sgOutF', 700),
    }}>
      {/* Bottom corner splashes */}
      <StageSplashes/>
      {/* Top-left brand */}
      <BrandCorner tournament={tournament}/>
      {/* Top-right LIVE */}
      <LivePill inProgress={inProgress}/>

      {/* Top center: team summary pill */}
      <div style={{ position: 'absolute', top: 56, left: '50%', transform: 'translateX(-50%)', zIndex: 4,
        animation: 'sgInD .8s cubic-bezier(.22,.9,.25,1) both' }}>
        <TopScorePill match={match} score={score} isDoubles={isDoubles}/>
      </div>

      {/* Center: HUGE numbers floating, no card */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
        display: 'flex', alignItems: 'center', gap: 80,
        zIndex: 3,
        animation: 'sgInZC 1s cubic-bezier(.22,.9,.25,1) .15s both',
      }}>
        <span style={{
          ...pacText(280, 200, C.hi),
          letterSpacing: '-.04em', lineHeight: .85,
          fontVariantNumeric: 'tabular-nums',
          textShadow: '0 4px 24px rgba(0,0,0,.50), 0 12px 48px rgba(0,0,0,.30)',
        }}>{centerT1}</span>
        {/* thin vertical separator */}
        <span style={{ width: 2, height: 240, background: 'rgba(255,255,255,.30)', boxShadow: '0 0 12px rgba(255,255,255,.20)' }}/>
        <span style={{
          ...pacText(280, 200, C.hi),
          letterSpacing: '-.04em', lineHeight: .85,
          fontVariantNumeric: 'tabular-nums',
          textShadow: '0 4px 24px rgba(0,0,0,.50), 0 12px 48px rgba(0,0,0,.30)',
        }}>{centerT2}</span>
      </div>

      {/* Below numbers: tiny set label */}
      <div style={{ position: 'absolute', left: '50%', top: 'calc(50% + 160px)', transform: 'translateX(-50%)', zIndex: 3 }}>
        <span style={pacKicker(C.mid, 14)}>{setLabel}</span>
      </div>

      {/* Left card: team 1 */}
      <div style={{ position: 'absolute', left: 56, top: '50%', transform: 'translateY(-50%)', zIndex: 2,
        animation: 'sgInR .8s cubic-bezier(.22,.9,.25,1) .25s both' }}>
        <PacPlayerCard entry={match.entry1} side="left" isDoubles={isDoubles} accent={pal.accentA}
          teamLabel={isDoubles
            ? [match.entry1?.player1, match.entry1?.player2].map((p:any) => firstSurname(p)).filter(Boolean).join(' / ')
            : (match.entry1?.player1?.last_name ?? '')}/>
      </div>

      {/* Right card: team 2 */}
      <div style={{ position: 'absolute', right: 56, top: '50%', transform: 'translateY(-50%)', zIndex: 2,
        animation: 'sgInL .8s cubic-bezier(.22,.9,.25,1) .25s both' }}>
        <PacPlayerCard entry={match.entry2} side="right" isDoubles={isDoubles} accent={pal.accentB}
          teamLabel={isDoubles
            ? [match.entry2?.player1, match.entry2?.player2].map((p:any) => firstSurname(p)).filter(Boolean).join(' / ')
            : (match.entry2?.player1?.last_name ?? '')}/>
      </div>

      {/* Bottom center: court + round */}
      <div style={{ position: 'absolute', left: '50%', bottom: 80, transform: 'translateX(-50%)', zIndex: 3,
        animation: 'sgInU .8s cubic-bezier(.22,.9,.25,1) .35s both' }}>
        <CourtRoundPill match={match}/>
      </div>

      {/* Sponsor — bottom-right small pill */}
      {sponsor?.logo_url && (
        <div style={{
          position: 'absolute', right: 56, bottom: 56, zIndex: 4,
          padding: '8px 16px', borderRadius: 999,
          background: 'rgba(255,255,255,.85)',
          boxShadow: '0 8px 24px rgba(0,0,0,.20)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.20em', color: '#0e1c29', textTransform: 'uppercase' }}>SPONSOR</span>
          <img src={sponsor.logo_url} alt={sponsor.name} style={{ height: 24, objectFit: 'contain' }}/>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 2) SCOREBUG PACIFIC — Pill flotante TOP-CENTER (no en esquina)
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

  const t1Name = isDoubles
    ? [match.entry1?.player1, match.entry1?.player2].map((p:any) => firstSurname(p)).filter(Boolean).join(' / ')
    : (match.entry1?.player1?.last_name ?? '')
  const t2Name = isDoubles
    ? [match.entry2?.player1, match.entry2?.player2].map((p:any) => firstSurname(p)).filter(Boolean).join(' / ')
    : (match.entry2?.player1?.last_name ?? '')

  // Sets right→left
  const visualToActual = (p: number) => setCount - 1 - p

  function teamSet(team: 1|2, idx: number) {
    return threeSetsFor(score, team)[idx]
  }

  return (
    <div style={{
      position: 'absolute', top: 40, left: '50%', transform: 'translateX(-50%)',
      fontFamily: FONT, zIndex: 6,
      ...animStyle(visible, 'sgInD', 'sgOutD', 600),
    }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 0,
        padding: 4, borderRadius: 999,
        background: GLASS, border: GLASS_BORDER,
        backdropFilter: 'blur(20px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
        boxShadow: GLASS_SHADOW,
      }}>
        {/* Team 1 chip */}
        <TeamChip
          serving={serving === 1} accent={pal.accentA} name={t1Name}
          flag={match.entry1?.player1?.nationality}
        />
        {/* Sets — RIGHT TO LEFT visually */}
        <div style={{ display: 'flex', gap: 4, padding: '0 12px' }}>
          {Array.from({ length: setCount }).map((_, p) => {
            const actual = visualToActual(p)
            const v1 = teamSet(1, actual)
            const v2 = teamSet(2, actual)
            const isFinishedSet = actual < setsPlayed
            return (
              <div key={p} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                padding: '4px 10px', borderRadius: 12,
                background: isFinishedSet ? 'rgba(255,255,255,.10)' : 'transparent',
                minWidth: 36,
              }}>
                <span style={{ ...pacText(20, 600), fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{v1 ?? '–'}</span>
                <span style={{ ...pacText(20, 600), fontVariantNumeric: 'tabular-nums', lineHeight: 1, color: C.mid }}>{v2 ?? '–'}</span>
              </div>
            )
          })}
        </div>
        {/* Points / Ticker */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 2,
          padding: '4px 14px', borderRadius: 999,
          background: showTicker ? 'rgba(255,255,255,.08)' : tbActive ? PAC.amber : GRAD_CYAN_CORAL,
          minWidth: 56, alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontSize: 18, fontWeight: 700,
            color: showTicker ? C.hi : tbActive ? PAC.ink : C.hi,
            textShadow: tbActive ? 'none' : TS_SOFT,
            fontVariantNumeric: 'tabular-nums', lineHeight: 1,
          }}>
            {showTicker ? statValue(match.stats, tickerStat!, 1) : gamePoint(score, 1)}
          </span>
          <span style={{
            fontSize: 18, fontWeight: 700,
            color: showTicker ? C.mid : tbActive ? hexAlpha(PAC.ink,.7) : 'rgba(255,255,255,.85)',
            textShadow: tbActive ? 'none' : TS_SOFT,
            fontVariantNumeric: 'tabular-nums', lineHeight: 1,
          }}>
            {showTicker ? statValue(match.stats, tickerStat!, 2) : gamePoint(score, 2)}
          </span>
        </div>
        {/* Team 2 chip */}
        <TeamChip
          serving={serving === 2} accent={pal.accentB} name={t2Name}
          flag={match.entry2?.player1?.nationality}
        />
      </div>
      {/* Ticker label below */}
      {showTicker && (
        <div style={{ textAlign: 'center', marginTop: 6 }}>
          <span style={pacKicker(PAC.coralLt, 11)}>{tickerLabel}</span>
        </div>
      )}
    </div>
  )
}

function TeamChip({ serving, accent, name, flag }: { serving: boolean, accent: string, name: string, flag?: string }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 10,
      padding: '6px 16px', borderRadius: 999,
    }}>
      {serving && (
        <span style={{
          width: 9, height: 9, borderRadius: '50%', background: PAC.amber,
          boxShadow: `0 0 10px ${PAC.amber}`, animation: 'sgSrvPulse 1.4s infinite',
        }}/>
      )}
      {flag && <img src={flagPath(flag)} alt="" style={{ width: 22, height: 15, borderRadius: 2, objectFit: 'cover' }}/>}
      <span style={{ ...pacText(18, 600), letterSpacing: '-.005em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
        {name.toUpperCase()}
      </span>
      <span style={{
        width: 4, height: 4, borderRadius: '50%',
        background: accent, opacity: .8,
      }}/>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 3) WEATHER PACIFIC — Blob orgánico SVG real (top-left si no hay scorebug,
//    else top-left moved un poco abajo. Aqui: top-right por simplicidad)
// ════════════════════════════════════════════════════════════════════════════
export function WeatherPacific({ visible, weather, tournament }: {
  visible: boolean, weather: WeatherData | null, tournament: Tournament | null,
}) {
  if (!weather) return null
  const ICONS: Record<string, string> = {
    Despejado: '☀️', 'Parcialmente nublado': '⛅', Niebla: '🌫', Llovizna: '🌦', Lluvia: '🌧',
    Nieve: '❄️', Chubascos: '🌦', Tormenta: '⛈', Desconocido: '🌡',
    clear: '☀️', cloudy: '⛅', rain: '🌧', snow: '❄️', fog: '🌫', storm: '⛈',
  }
  const icon = ICONS[weather.condition] ?? '☀️'
  return (
    <div style={{
      position: 'absolute', left: 56, top: 220,  // debajo del brand corner
      width: 320, height: 280, fontFamily: FONT,
      ...animStyle(visible, 'sgInR', 'sgOutR', 700),
    }}>
      {/* Background BLOB real (path SVG, no rectángulo) */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none"
           style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', filter: 'drop-shadow(0 18px 40px rgba(0,0,0,.40))' }}>
        <defs>
          <linearGradient id="wxBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={PAC.cyan} stopOpacity=".35"/>
            <stop offset="50%" stopColor="rgb(8,18,32)" stopOpacity=".55"/>
            <stop offset="100%" stopColor={PAC.coral} stopOpacity=".30"/>
          </linearGradient>
        </defs>
        <path d={BLOB_PATHS[1]} fill="url(#wxBg)" stroke="rgba(255,255,255,.20)" strokeWidth=".4"/>
      </svg>

      {/* Content */}
      <div style={{ position: 'relative', padding: '46px 50px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 40, lineHeight: 1, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,.4))' }}>{icon}</span>
          <div>
            <div style={{ ...pacText(48, 200), letterSpacing: '-.03em', lineHeight: 1 }}>{Math.round(weather.temperature_c)}°</div>
            <div style={pacKicker(PAC.coralLt, 11)}>{weather.condition}</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,.18)' }}>
          <div>
            <div style={pacKicker(C.lo, 9)}>FEELS LIKE</div>
            <div style={{ ...pacText(16, 500), marginTop: 2 }}>{Math.round(weather.feels_like_c)}°</div>
          </div>
          <div>
            <div style={pacKicker(C.lo, 9)}>WIND</div>
            <div style={{ ...pacText(16, 500), marginTop: 2 }}>{Math.round(weather.wind_speed_kmh)} km/h</div>
          </div>
          <div>
            <div style={pacKicker(C.lo, 9)}>HUMIDITY</div>
            <div style={{ ...pacText(16, 500), marginTop: 2 }}>{weather.humidity_pct}%</div>
          </div>
          <div>
            <div style={pacKicker(C.lo, 9)}>VENUE</div>
            <div style={{ ...pacText(13, 600), marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {tournament?.venue_city ?? '—'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 4) MATCH PRESENTATION — Takeover pre-partido (similar al BigScoreboard
//    pero con VS gigante en lugar de números)
// ════════════════════════════════════════════════════════════════════════════
export function MatchPresentationPacific({ visible, match, tournament }: {
  visible: boolean, match: any, tournament: Tournament | null,
}) {
  if (!match) return null
  const pal = palette(tournament?.scoreboard_config)
  const isDoubles = match.match_type === 'doubles'
  const phase = ROUND_SHORT[match.round] ?? roundLabel(match.round)
  const cat = CATEGORY_LABELS[match.category as Category] ?? match.category ?? ''

  return (
    <div style={{
      position: 'absolute', inset: 0, fontFamily: FONT,
      ...animStyle(visible, 'sgInF', 'sgOutF', 700),
    }}>
      <StageSplashes/>
      <BrandCorner tournament={tournament}/>

      {/* Top center: phase + category pill */}
      <div style={{ position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 4,
        animation: 'sgInD .8s cubic-bezier(.22,.9,.25,1) both' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 18,
          padding: '12px 36px', borderRadius: 999,
          background: GRAD_HORIZ,
          boxShadow: '0 12px 36px rgba(0,0,0,.30), inset 0 1px 0 rgba(255,255,255,.30)',
          border: '1px solid rgba(255,255,255,.30)',
        }}>
          <span style={{ ...pacText(18, 700), letterSpacing: '.20em', textTransform: 'uppercase' }}>{phase}</span>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,.6)' }}/>
          <span style={{ ...pacText(18, 600), letterSpacing: '.16em', textTransform: 'uppercase' }}>{cat}</span>
        </div>
      </div>

      {/* Center: massive "VS" */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
        zIndex: 3,
        animation: 'sgInZC 1s cubic-bezier(.22,.9,.25,1) .15s both',
      }}>
        <span style={{
          fontSize: 320, fontWeight: 200, lineHeight: .82, letterSpacing: '-.05em',
          background: GRAD_CYAN_CORAL,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          filter: 'drop-shadow(0 6px 32px rgba(0,0,0,.40))',
        }}>vs</span>
      </div>

      {/* Below VS: "PRÓXIMO PARTIDO" or scheduled time */}
      <div style={{ position: 'absolute', left: '50%', top: 'calc(50% + 180px)', transform: 'translateX(-50%)', zIndex: 3 }}>
        <span style={pacKicker(C.mid, 16)}>
          {match.scheduled_at
            ? `INICIO ${new Date(match.scheduled_at).toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' })}`
            : 'PRÓXIMO PARTIDO'}
        </span>
      </div>

      {/* Left card: team 1 */}
      <div style={{ position: 'absolute', left: 56, top: '50%', transform: 'translateY(-50%)', zIndex: 2,
        animation: 'sgInR .8s cubic-bezier(.22,.9,.25,1) .25s both' }}>
        <PacPlayerCard entry={match.entry1} side="left" isDoubles={isDoubles} accent={pal.accentA}/>
      </div>

      {/* Right card: team 2 */}
      <div style={{ position: 'absolute', right: 56, top: '50%', transform: 'translateY(-50%)', zIndex: 2,
        animation: 'sgInL .8s cubic-bezier(.22,.9,.25,1) .25s both' }}>
        <PacPlayerCard entry={match.entry2} side="right" isDoubles={isDoubles} accent={pal.accentB}/>
      </div>

      {/* Bottom center: court + tournament */}
      <div style={{ position: 'absolute', left: '50%', bottom: 80, transform: 'translateX(-50%)', zIndex: 3,
        animation: 'sgInU .8s cubic-bezier(.22,.9,.25,1) .35s both' }}>
        <CourtRoundPill match={match}/>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 5) PLAYER BIO — Card lateral limpia con foto circular + accent blob
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

  const hasRanking = !!(player.ranking_rfet || player.ranking_itf)
  const hasTitles = (player.titles?.length ?? 0) > 0
  const hasBio = !!player.bio

  const pos: React.CSSProperties = { position: 'absolute', top: 100, bottom: 100, width: 640 }
  if (side === 'left') pos.left = 80
  if (side === 'right') pos.right = 80

  return (
    <div style={{ ...pos, fontFamily: FONT, ...animStyle(visible, enter, exit, 700) } as any}>
      {/* Decorative blob outside the card */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none"
           style={{
             position: 'absolute', width: 280, height: 280,
             [side === 'left' ? 'right' : 'left']: -120, top: -100,
             filter: `blur(20px)`, opacity: .55, pointerEvents: 'none', zIndex: 0,
           } as any}>
        <path d={BLOB_PATHS[2]} fill={PAC.cyan}/>
      </svg>

      {/* Card */}
      <div style={{
        position: 'relative', height: '100%',
        background: GLASS, border: GLASS_BORDER,
        borderRadius: 36,
        backdropFilter: 'blur(22px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(22px) saturate(1.3)',
        boxShadow: GLASS_SHADOW,
        padding: '40px 36px',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Photo + name header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {player.photo_url ? (
            <div style={{
              flex: 'none', width: 160, height: 160, borderRadius: '50%',
              overflow: 'hidden',
              border: `3px solid ${hexAlpha(PAC.cyan,.55)}`,
              boxShadow: `0 14px 36px ${hexAlpha(accent,.40)}`,
            }}>
              <img src={player.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
            </div>
          ) : (
            <div style={{
              flex: 'none', width: 160, height: 160, borderRadius: '50%',
              background: hexAlpha(accent, .25), border: `3px solid ${hexAlpha(PAC.cyan,.55)}`,
              display: 'grid', placeItems: 'center', ...pacText(56, 600, C.hi),
            }}>
              {(player.first_name?.[0] ?? '?').toUpperCase()}
            </div>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <img src={flagPath(player.nationality)} alt="" style={{ width: 36, height: 24, borderRadius: 3, objectFit: 'cover' }}/>
              <span style={pacKicker(PAC.coralLt, 12)}>{(player.nationality ?? 'ESP').toUpperCase()}</span>
            </div>
            <div style={{ ...pacText(24, 400, C.mid), lineHeight: 1, letterSpacing: '.02em', textTransform: 'uppercase' }}>
              {player.first_name}
            </div>
            <div style={{ ...pacText(56, 500), lineHeight: .92, letterSpacing: '-.01em', textTransform: 'uppercase' }}>
              {player.last_name}
            </div>
          </div>
        </div>

        {/* Sections */}
        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 20, flex: 1, overflow: 'hidden' }}>
          {ficha.length > 0 && (
            <div>
              <div style={pacKicker(PAC.coralLt, 12)}>FICHA</div>
              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
                {ficha.map(([k, v]) => (
                  <div key={k}>
                    <div style={pacKicker(C.lo, 10)}>{k}</div>
                    <div style={{ ...pacText(22, 500), marginTop: 2 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasRanking && (
            <div>
              <div style={pacKicker(PAC.coralLt, 12)}>RANKING</div>
              <div style={{ marginTop: 12, display: 'flex', gap: 14 }}>
                {player.ranking_rfet && (
                  <div style={{
                    flex: 1, padding: '14px 22px', borderRadius: 18,
                    background: `linear-gradient(135deg, ${hexAlpha(PAC.cyan,.20)} 0%, ${hexAlpha(PAC.coral,.20)} 100%)`,
                    border: `1px solid ${hexAlpha(PAC.cyan, .40)}`,
                  }}>
                    <div style={pacKicker(PAC.cyanLt, 12)}>RFET</div>
                    <div style={{ ...pacText(48, 300), lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>#{player.ranking_rfet}</div>
                  </div>
                )}
                {player.ranking_itf && (
                  <div style={{
                    flex: 1, padding: '14px 22px', borderRadius: 18,
                    background: `linear-gradient(135deg, ${hexAlpha(PAC.cyan,.20)} 0%, ${hexAlpha(PAC.coral,.20)} 100%)`,
                    border: `1px solid ${hexAlpha(PAC.cyan, .40)}`,
                  }}>
                    <div style={pacKicker(PAC.cyanLt, 12)}>ITF</div>
                    <div style={{ ...pacText(48, 300), lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>#{player.ranking_itf}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {hasTitles && (
            <div>
              <div style={pacKicker(PAC.coralLt, 12)}>PALMARÉS</div>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {player.titles!.slice(0, 4).map((t: any, i: number) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 14 }}>
                    <span style={{ ...pacText(20, 600, PAC.coralLt), fontVariantNumeric: 'tabular-nums' }}>{t.year}</span>
                    <span style={{ ...pacText(18, 400) }}>{t.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasBio && (
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={pacKicker(PAC.coralLt, 12)}>BIO</div>
              <div style={{ ...pacText(16, 300, C.mid), marginTop: 8, lineHeight: 1.5, overflow: 'hidden' }}>
                {player.bio}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 6) VENUE CARD — Pill mínimo bottom-right (NO card grande)
// ════════════════════════════════════════════════════════════════════════════
export function VenueCardPacific({ visible, tournament }: { visible: boolean, tournament: Tournament | null }) {
  if (!tournament) return null
  return (
    <div style={{
      position: 'absolute', right: 56, bottom: 56, fontFamily: FONT,
      ...animStyle(visible, 'sgInL', 'sgOutL', 650),
    }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 16,
        padding: '14px 24px', borderRadius: 999,
        background: GLASS, border: GLASS_BORDER,
        backdropFilter: 'blur(20px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
        boxShadow: GLASS_SHADOW,
      }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: PAC.cyan, boxShadow: `0 0 10px ${PAC.cyan}` }}/>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
          <span style={pacKicker(C.lo, 10)}>VENUE</span>
          <span style={{ ...pacText(20, 600), letterSpacing: '-.005em', textTransform: 'uppercase' }}>
            {tournament.venue_name || tournament.venue_city}
          </span>
        </div>
        <span style={{ width: 1, height: 28, background: 'rgba(255,255,255,.20)' }}/>
        <span style={{ ...pacText(16, 500, PAC.cyanLt), letterSpacing: '.10em', textTransform: 'uppercase' }}>
          {tournament.venue_city}
        </span>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 7) TOURNAMENT INTRO — Composición mínima, NO card. Solo logo + título grande
//    flotando, con splashes en esquinas inferiores.
// ════════════════════════════════════════════════════════════════════════════
export function TournamentIntroPacific({ visible, tournament }: { visible: boolean, tournament: Tournament | null }) {
  if (!tournament) return null
  const start = new Date(tournament.start_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
  const end = new Date(tournament.end_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div style={{
      position: 'absolute', inset: 0, fontFamily: FONT,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 36,
      ...animStyle(visible, 'sgInZC', 'sgOutZC', 800),
    }}>
      <StageSplashes/>

      {/* Top kicker */}
      <div style={{ position: 'absolute', top: 100, left: '50%', transform: 'translateX(-50%)' }}>
        <span style={pacKicker(PAC.coralLt, 18)}>BEACH TENNIS LIVE TOUR</span>
      </div>

      {/* Logo + title floating */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, zIndex: 2,
        animation: 'sgInZC 1s cubic-bezier(.22,.9,.25,1) both' }}>
        {tournament.logo_url && (
          <img src={tournament.logo_url} alt="" style={{
            maxWidth: 260, maxHeight: 220, objectFit: 'contain',
            filter: 'drop-shadow(0 12px 36px rgba(0,0,0,.50))',
          }}/>
        )}
        <div style={{
          ...pacText(140, 200), textAlign: 'center',
          letterSpacing: '-.025em', lineHeight: .9,
          maxWidth: 1500,
        }}>
          {tournament.name}
        </div>
      </div>

      {/* Bottom pill: dates + venue */}
      <div style={{ position: 'absolute', bottom: 140, left: '50%', transform: 'translateX(-50%)', zIndex: 2,
        animation: 'sgInU .8s cubic-bezier(.22,.9,.25,1) .25s both' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 24,
          padding: '14px 36px', borderRadius: 999,
          background: GRAD_HORIZ,
          boxShadow: '0 12px 36px rgba(0,0,0,.30), inset 0 1px 0 rgba(255,255,255,.30)',
          border: '1px solid rgba(255,255,255,.30)',
        }}>
          <span style={{ ...pacText(20, 700), letterSpacing: '.18em', textTransform: 'uppercase' }}>
            {tournament.venue_city}
          </span>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,.7)' }}/>
          <span style={{ ...pacText(20, 500), letterSpacing: '.14em', textTransform: 'uppercase' }}>
            {start} — {end}
          </span>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 8) REFEREE LOWER THIRD — Pill bottom-center (NO card grande)
// ════════════════════════════════════════════════════════════════════════════
export function RefereeLowerThirdPacific({ visible, referee }: {
  visible: boolean, referee: { full_name: string, federacion?: string|null } | null, tournament: Tournament | null,
}) {
  if (!referee) return null
  return (
    <div style={{
      position: 'absolute', left: '50%', bottom: 100, transform: 'translateX(-50%)',
      fontFamily: FONT, ...animStyle(visible, 'sgInU', 'sgOutU', 700),
    }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 0,
        background: GLASS, border: GLASS_BORDER,
        borderRadius: 999,
        backdropFilter: 'blur(20px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
        boxShadow: GLASS_SHADOW,
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 30px', background: GRAD_HORIZ,
          borderRadius: '999px 0 0 999px',
        }}>
          <span style={{ ...pacText(18, 700), letterSpacing: '.30em', textTransform: 'uppercase' }}>ÁRBITRO</span>
        </div>
        <div style={{ padding: '12px 32px', display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
          <span style={{ ...pacText(28, 500), letterSpacing: '-.005em', textTransform: 'uppercase' }}>{referee.full_name}</span>
          {referee.federacion && <span style={pacKicker(PAC.cyanLt, 12)}>{referee.federacion}</span>}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 9) STATS PANEL — Takeover con jugadores arriba y stats en filas
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

  const t1Name = isDoubles
    ? [match.entry1?.player1, match.entry1?.player2].map((p:any) => firstSurname(p)).filter(Boolean).join(' / ')
    : (match.entry1?.player1?.last_name ?? '')
  const t2Name = isDoubles
    ? [match.entry2?.player1, match.entry2?.player2].map((p:any) => firstSurname(p)).filter(Boolean).join(' / ')
    : (match.entry2?.player1?.last_name ?? '')

  return (
    <div style={{
      position: 'absolute', inset: 0, fontFamily: FONT,
      ...animStyle(visible, 'sgInF', 'sgOutF', 700),
    }}>
      <StageSplashes/>
      <BrandCorner tournament={tournament}/>

      {/* Title */}
      <div style={{ position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)', textAlign: 'center', zIndex: 3 }}>
        <div style={{ ...pacText(56, 200), letterSpacing: '-.015em' }}>Estadísticas</div>
        <div style={pacKicker(PAC.coralLt, 16)}>{SCOPE_TITLE[resolvedScope] ?? ''}</div>
      </div>

      {/* Player names header */}
      <div style={{
        position: 'absolute', top: 220, left: '50%', transform: 'translateX(-50%)',
        display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 80, alignItems: 'center',
        width: 1480, zIndex: 3,
      }}>
        <div style={{ textAlign: 'right' }}>
          <span style={{ ...pacText(48, 500, pal.accentA), letterSpacing: '-.01em', textTransform: 'uppercase' }}>{t1Name.toUpperCase()}</span>
        </div>
        <span style={{ ...pacText(20, 300, C.mid), letterSpacing: '.20em' }}>VS</span>
        <div style={{ textAlign: 'left' }}>
          <span style={{ ...pacText(48, 500, pal.accentB), letterSpacing: '-.01em', textTransform: 'uppercase' }}>{t2Name.toUpperCase()}</span>
        </div>
      </div>

      {/* Stats rows */}
      <div style={{
        position: 'absolute', left: '50%', top: 320, transform: 'translateX(-50%)',
        width: 1320, display: 'flex', flexDirection: 'column', zIndex: 2,
      }}>
        {rows.map((r, i) => {
          const numA = parseFloat(String(r.a).replace('%', '').split('/')[0]) || 0
          const numB = parseFloat(String(r.b).replace('%', '').split('/')[0]) || 0
          const aWins = numA > numB
          const bWins = numB > numA
          return (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', alignItems: 'center', gap: 32,
              padding: '14px 20px',
              borderBottom: '1px solid rgba(255,255,255,.10)',
              background: i % 2 === 0 ? 'rgba(255,255,255,.03)' : 'transparent',
              borderRadius: 12,
            }}>
              <span style={{ ...pacText(34, 600, aWins ? PAC.cyanLt : C.mid), textAlign: 'right', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {r.a}
              </span>
              <span style={{ ...pacText(16, 500, C.mid), textAlign: 'center', letterSpacing: '.18em', textTransform: 'uppercase' }}>
                {r.label}
              </span>
              <span style={{ ...pacText(34, 600, bWins ? PAC.coralLt : C.mid), textAlign: 'left', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {r.b}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 10) RESULTS GRID — Takeover con fase actual
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
  const isDoubles = filtered[0]?.match_type === 'doubles'

  return (
    <div style={{
      position: 'absolute', inset: 0, fontFamily: FONT,
      ...animStyle(visible, 'sgInF', 'sgOutF', 700),
    }}>
      <StageSplashes/>
      <BrandCorner tournament={tournament}/>

      {/* Title */}
      <div style={{ position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)', textAlign: 'center', zIndex: 3 }}>
        <div style={pacKicker(PAC.coralLt, 16)}>ORDEN DE JUEGO</div>
        <div style={{ ...pacText(56, 200), letterSpacing: '-.015em', marginTop: 4 }}>
          {ROUND_LABELS[activeRound ?? ''] ?? activeRound ?? ''}
        </div>
        <div style={pacKicker(C.mid, 14)}>
          {CATEGORY_LABELS[(category ?? matches[0]?.category) as Category] ?? ''}
        </div>
      </div>

      {/* Match cards in grid */}
      <div style={{
        position: 'absolute', left: '50%', top: 280, transform: 'translateX(-50%)',
        width: 1640, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 32px', zIndex: 2,
      }}>
        {filtered.map((m: any) => (
          <PacResultRow key={m.id} m={m} highlight={m.id === highlightMatchId} isDoubles={isDoubles}/>
        ))}
      </div>
    </div>
  )
}

function PacResultRow({ m, highlight, isDoubles }: { m: any, highlight: boolean, isDoubles: boolean }) {
  const score = m.score as Score | null
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
      padding: '16px 24px',
      borderRadius: 24,
      background: highlight
        ? `linear-gradient(135deg, ${hexAlpha(PAC.cyan,.20)} 0%, ${hexAlpha(PAC.coral,.20)} 100%)`
        : GLASS,
      border: highlight ? `1.5px solid ${hexAlpha(PAC.cyan, .60)}` : GLASS_BORDER,
      backdropFilter: 'blur(16px) saturate(1.2)',
      WebkitBackdropFilter: 'blur(16px) saturate(1.2)',
      boxShadow: highlight ? '0 12px 30px rgba(0,0,0,.30)' : '0 6px 18px rgba(0,0,0,.20)',
    }}>
      {[1, 2].map(tn => {
        const team = tn as 1|2
        const entry = team === 1 ? m.entry1 : m.entry2
        const isWinner = finished && winnerTeam === team
        return (
          <div key={team} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'baseline', padding: '4px 0' }}>
            <span style={{ ...pacText(22, isWinner ? 600 : 400, isWinner ? C.hi : C.mid), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {teamLabel(entry)}
            </span>
            <span style={{ ...pacText(22, 600, isWinner ? PAC.cyanLt : C.lo), fontVariantNumeric: 'tabular-nums', letterSpacing: '.04em' }}>
              {setsLine(team)}
            </span>
          </div>
        )
      })}
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,.10)', textAlign: 'right' }}>
        {finished
          ? <span style={pacKicker(C.lo, 11)}>FINAL</span>
          : inProgress
          ? <span style={pacKicker(PAC.coralLt, 11)}>● EN JUEGO</span>
          : <span style={pacKicker(C.lo, 11)}>{fmtSchedule(m.scheduled_at, m.court?.name)}</span>}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 11) BRACKET — Takeover QF/SF/F
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
  const isDoubles = catMatches[0]?.match_type === 'doubles'

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
      position: 'absolute', inset: 0, fontFamily: FONT,
      ...animStyle(visible, 'sgInF', 'sgOutF', 700),
    }}>
      <StageSplashes/>
      <BrandCorner tournament={tournament}/>

      {/* Title */}
      <div style={{ position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)', textAlign: 'center', zIndex: 3 }}>
        <div style={pacKicker(PAC.coralLt, 16)}>CUADRO</div>
        <div style={{ ...pacText(56, 200), letterSpacing: '-.015em', marginTop: 4 }}>
          {CATEGORY_LABELS[(category ?? matches[0]?.category) as Category] ?? ''}
        </div>
      </div>

      {/* Round headers */}
      <div style={{
        position: 'absolute', left: '50%', top: 240, transform: 'translateX(-50%)',
        width: 1700, display: 'grid', gridTemplateColumns: gridCols, zIndex: 3,
      }}>
        {visibleRounds.map((r, i) => (
          <React.Fragment key={r}>
            {i > 0 && <div/>}
            <div style={{ textAlign: 'center', ...pacKicker(PAC.coralLt, 14) }}>{PAC_KO_LBL[r]}</div>
          </React.Fragment>
        ))}
      </div>

      {/* Bracket */}
      <div style={{
        position: 'absolute', left: '50%', top: 290, transform: 'translateX(-50%)',
        width: 1700, height: 720, display: 'grid', gridTemplateColumns: gridCols,
        gridTemplateRows: `repeat(${totalRows}, 1fr)`, zIndex: 2,
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
                  <div key={`${round}-${i}`} style={{ gridColumn, gridRow: `${startRow}/${endRow}`, display: 'flex', alignItems: 'center', padding: '6px 0' }}>
                    <PacBracketSlot m={m} hot={m?.id === highlightMatchId} isFinal={round === 'F'} isDoubles={isDoubles}/>
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

function PacBracketSlot({ m, hot, isFinal = false, isDoubles }: { m: any, hot: boolean, isFinal?: boolean, isDoubles: boolean }) {
  if (!m) {
    return (
      <div style={{
        flex: 1, padding: '14px 16px', borderRadius: 16,
        background: 'rgba(255,255,255,.04)',
        border: '1px dashed rgba(255,255,255,.22)',
        textAlign: 'center',
      }}>
        <span style={pacKicker(C.lo, 12)}>POR DETERMINAR</span>
      </div>
    )
  }
  const score = m.score as Score | null
  return (
    <div style={{
      flex: 1, padding: '12px 16px',
      borderRadius: 16,
      background: hot
        ? `linear-gradient(135deg, ${hexAlpha(PAC.cyan,.22)} 0%, ${hexAlpha(PAC.coral,.22)} 100%)`
        : isFinal ? hexAlpha(PAC.coral, .12) : GLASS,
      border: hot
        ? `1.5px solid ${hexAlpha(PAC.cyan, .60)}`
        : isFinal ? `1px solid ${hexAlpha(PAC.coral, .50)}` : GLASS_BORDER,
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
    }}>
      <PacBracketLine entry={m.entry1} score={score} team={1} isDoubles={isDoubles}/>
      <div style={{ height: 1, background: 'rgba(255,255,255,.12)', margin: '6px 0' }}/>
      <PacBracketLine entry={m.entry2} score={score} team={2} isDoubles={isDoubles}/>
    </div>
  )
}
function PacBracketLine({ entry, score, team, isDoubles }: { entry: any, score: Score|null, team: 1|2, isDoubles: boolean }) {
  if (!entry) return <div style={{ ...pacText(16, 400, C.lo), padding: '4px 0' }}>—</div>
  const players = [entry?.player1, isDoubles ? entry?.player2 : null].filter(Boolean)
  const sets = threeSetsFor(score, team)
  const winner = (score?.winner_team ?? null) === team
  const nameStr = isDoubles
    ? players.map((p: any) => firstSurname(p)).filter(Boolean).join(' / ')
    : (players[0]?.last_name ?? '')
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', alignItems: 'center', gap: 8 }}>
      <span style={{
        ...pacText(17, winner ? 600 : 400, winner ? C.hi : C.mid),
        textTransform: 'uppercase', letterSpacing: '-.005em',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {nameStr.toUpperCase()}
      </span>
      {sets.map((v, i) => (
        <span key={i} style={{
          minWidth: 18, textAlign: 'center',
          ...pacText(17, 600, winner ? PAC.cyanLt : C.lo),
          fontVariantNumeric: 'tabular-nums',
        }}>
          {v == null ? '' : v}
        </span>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 12) COIN TOSS — Composición centrada minimal
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
      position: 'absolute', inset: 0, fontFamily: FONT,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32, textAlign: 'center',
      ...animStyle(visible, 'sgInF', 'sgOutF', 700),
    }}>
      <StageSplashes/>
      <BrandCorner tournament={tournament}/>

      <div style={{ zIndex: 2, animation: 'sgInZC 1s cubic-bezier(.22,.9,.25,1) both' }}>
        <div style={{ ...pacKicker(PAC.coralLt, 18), marginBottom: 16 }}>SORTEO</div>
        <div style={{ ...pacText(44, 200), letterSpacing: '-.015em', marginBottom: 24 }}>Gana el sorteo</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 36 }}>
          {players.map((p: any, i: number) => (
            <div key={i} style={{ ...pacText(80, 500), letterSpacing: '-.015em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              <span style={{ fontWeight: 200, color: C.mid, marginRight: 16, textShadow: TS_HARD }}>{(p?.first_name ?? '')}</span>
              {(p?.last_name ?? '').toUpperCase()}
            </div>
          ))}
        </div>
        {choiceText && (<>
          <div style={{ ...pacKicker(PAC.coralLt, 16), marginBottom: 14 }}>Y ELIGE</div>
          <div style={{
            display: 'inline-block', padding: '18px 48px', borderRadius: 999,
            background: GRAD_HORIZ,
            boxShadow: '0 16px 44px rgba(0,0,0,.30), inset 0 1px 0 rgba(255,255,255,.30)',
            border: '1px solid rgba(255,255,255,.30)',
            ...pacText(64, 600), letterSpacing: '.18em', textTransform: 'uppercase',
          }}>
            {choiceText}
          </div>
        </>)}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 13) AWARDS PODIUM — Takeover con fotos circulares
// ════════════════════════════════════════════════════════════════════════════
export function AwardsPodiumPacific({ visible, data, tournament }: {
  visible: boolean, data: any, tournament: Tournament | null,
}) {
  if (!data) return null
  const champion = data.champion as { name: string, photo_url?: string|null } | null
  const finalist = data.finalist as { name: string, photo_url?: string|null } | null
  return (
    <div style={{
      position: 'absolute', inset: 0, fontFamily: FONT,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 36, textAlign: 'center',
      ...animStyle(visible, 'sgInF', 'sgOutF', 800),
    }}>
      <StageSplashes/>
      <BrandCorner tournament={tournament}/>

      <div style={{ position: 'absolute', top: 100, left: '50%', transform: 'translateX(-50%)', zIndex: 3 }}>
        <div style={pacKicker(PAC.coralLt, 18)}>PODIO</div>
        <div style={{ ...pacText(56, 200), letterSpacing: '-.015em', marginTop: 4 }}>{tournament?.name}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 100, alignItems: 'end', zIndex: 2,
        animation: 'sgInZC 1s cubic-bezier(.22,.9,.25,1) .15s both' }}>
        {/* FINALIST */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ ...pacKicker(C.lo, 14), marginBottom: 14 }}>FINALISTA</div>
          {finalist?.photo_url && (
            <div style={{
              width: 220, height: 220, margin: '0 auto 18px', borderRadius: '50%', overflow: 'hidden',
              border: `3px solid ${hexAlpha(PAC.cyan, .60)}`, boxShadow: `0 18px 44px ${hexAlpha(PAC.cyan, .35)}`,
            }}>
              <img src={finalist.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
            </div>
          )}
          <div style={{ ...pacText(48, 400), lineHeight: .98, textTransform: 'uppercase', letterSpacing: '-.01em' }}>{finalist?.name}</div>
        </div>
        {/* CHAMPION */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ ...pacKicker(PAC.coralLt, 18), marginBottom: 14 }}>🏆 CAMPEÓN</div>
          {champion?.photo_url && (
            <div style={{
              width: 280, height: 280, margin: '0 auto 18px', borderRadius: '50%', overflow: 'hidden',
              border: `4px solid ${PAC.coralLt}`, boxShadow: `0 0 80px ${hexAlpha(PAC.coral, .60)}`,
            }}>
              <img src={champion.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
            </div>
          )}
          <div style={{ ...pacText(64, 500), lineHeight: .98, textTransform: 'uppercase', letterSpacing: '-.015em' }}>{champion?.name}</div>
        </div>
      </div>
    </div>
  )
}
