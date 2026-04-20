'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import type { Match, Score, Sponsor, ScoreboardConfig } from '@/types'
import { DEFAULT_SCOREBOARD_CONFIG } from '@/types'

interface Props {
  initialMatch: Match & { entry1: any; entry2: any; court: any }
  config: ScoreboardConfig | null
  tournamentName: string
  sponsors: Sponsor[]
  weather: any
}

const PTS_LABEL = ['0', '15', '30', '40']
const ROUND_LABELS: Record<string, string> = {
  F: 'FINAL', SF: 'SEMIFINAL', QF: 'CUARTOS DE FINAL',
  R16: 'OCTAVOS DE FINAL', R32: 'DIECISEISAVOS',
}
const SKIN_BG: Record<string, string> = {
  marbella: 'radial-gradient(1400px 700px at 50% 0%, #1d3a5f 0%, #0a1627 70%), #0a1627',
  noche:    'radial-gradient(1400px 700px at 50% 0%, #122a4a 0%, #04070e 70%), #04070e',
  arena:    'radial-gradient(1400px 700px at 50% 0%, #f3e4c7 0%, #d9bf8a 70%), #d9bf8a',
}

function hexAlpha(hex: string, alpha: number): string {
  return hex + Math.round(alpha * 255).toString(16).padStart(2, '0')
}

function gameLabel(score: Score | null, team: 1 | 2): string {
  if (!score) return '0'
  const key = (`t${team}`) as 't1' | 't2'
  if (score.super_tiebreak_active || score.tiebreak_active) {
    return String(score.tiebreak_score?.[key] ?? 0)
  }
  if (score.advantage_team === team) return 'AD'
  if (score.advantage_team && score.advantage_team !== team) return '40'
  if (score.deuce) return '40'
  const pts = score.current_game?.[key] ?? 0
  return PTS_LABEL[pts] ?? '0'
}

export function VenueScoreboard({ initialMatch, config, tournamentName, sponsors: propSponsors }: Props) {
  const supabase = createClient()
  const [match, setMatch] = useState(initialMatch)
  const [clock, setClock] = useState('')
  const [matchTime, setMatchTime] = useState('00:00')
  const stageRef = useRef<HTMLDivElement>(null)

  const cfg = (config as any) ?? DEFAULT_SCOREBOARD_CONFIG
  const skin: string = cfg.skin ?? 'marbella'
  const showSeed = cfg.display?.show_rankings !== false
  const showFlags = cfg.display?.show_flags !== false
  const showServeIndicator = cfg.display?.show_serve_indicator !== false
  const showRound = cfg.display?.show_round !== false
  const showCourtName = cfg.display?.show_court_name !== false
  const showSponsors = cfg.sponsors?.enabled !== false
  const accentA: string = cfg.colors?.team1_accent ?? '#ef6a4c'
  const accentB: string = cfg.colors?.team2_accent ?? '#5fb7d6'
  const srvColor: string = cfg.colors?.serving_indicator ?? accentA
  const carouselSpeed: number = cfg.sponsors?.rotation_interval_seconds ?? 10

  // Realtime subscription
  useEffect(() => {
    const channel = supabase.channel(`venue-${match.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${match.id}` },
        (payload) => setMatch((prev) => ({ ...prev, ...payload.new }))
      ).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [match.id])

  // Clock & match timer
  useEffect(() => {
    const tick = () => {
      const d = new Date()
      setClock(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
      if (match.started_at && !match.finished_at) {
        const secs = Math.floor((Date.now() - new Date(match.started_at).getTime()) / 1000)
        const m = Math.floor(secs / 60), s = secs % 60
        setMatchTime(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [match.started_at, match.finished_at])

  // 1920×1080 stage scaling — always fills 100% of screen
  useEffect(() => {
    const scale = () => {
      const s = stageRef.current
      if (!s) return
      const kx = window.innerWidth / 1920
      const ky = window.innerHeight / 1080
      s.style.transform = `scaleX(${kx}) scaleY(${ky})`
    }
    scale()
    window.addEventListener('resize', scale)
    return () => window.removeEventListener('resize', scale)
  }, [])

  const score = match.score as Score | null
  const entry1 = (match as any).entry1
  const entry2 = (match as any).entry2
  const isDoubles = (match as any).match_type === 'doubles'

  const teamA = {
    seed: entry1?.seed,
    players: isDoubles
      ? [entry1?.player1, entry1?.player2].filter(Boolean)
      : [entry1?.player1].filter(Boolean),
    games: score?.current_set?.t1 ?? 0,
    point: gameLabel(score, 1),
  }
  const teamB = {
    seed: entry2?.seed,
    players: isDoubles
      ? [entry2?.player1, entry2?.player2].filter(Boolean)
      : [entry2?.player1].filter(Boolean),
    games: score?.current_set?.t2 ?? 0,
    point: gameLabel(score, 2),
  }

  // Dynamic set columns: only completed sets + 1 current (no future empty columns)
  const scoringSystem = (match as any).scoring_system ?? ''
  const maxSets = (scoringSystem === 'pro_set' || scoringSystem === '7_games_tb') ? 1 : 3
  const completedSets = score?.sets?.length ?? 0
  const numSetCols = Math.min(completedSets + 1, maxSets)
  const setCols = Array.from({ length: numSetCols }, (_, i) => {
    const s = score?.sets?.[i]
    const isCurrent = i === completedSets
    return {
      a: isCurrent ? null : (s?.t1 ?? null),
      b: isCurrent ? null : (s?.t2 ?? null),
      done: !isCurrent,
      current: isCurrent,
    }
  })

  // Grid: [seed?] [names] [set cols...] [points]
  const setColW = numSetCols === 1 ? 210 : numSetCols === 2 ? 180 : 160
  const gridCols = `${showSeed ? '110px ' : ''}minmax(0,1fr) ${Array(numSetCols).fill(`${setColW}px`).join(' ')} 220px`

  const roundLabel = ROUND_LABELS[match.round ?? ''] ?? (match.round ?? '—')
  const courtLabel = [
    showCourtName ? (match.court?.name ?? 'PISTA') : null,
    isDoubles ? 'DOBLES' : 'INDIVIDUAL',
  ].filter(Boolean).join(' · ')

  const sponsorList = propSponsors?.length ? propSponsors : []

  return (
    <>
      <style jsx global>{`
        html, body {
          margin: 0; padding: 0; background: #000; color: #fff;
          font-family: 'Barlow Condensed', system-ui, sans-serif;
          overflow: hidden; height: 100%;
        }
        @keyframes vsbBlink { 0%,100% { opacity: 1 } 50% { opacity: .2 } }
        @keyframes vsbMarquee { from { transform: translateX(0) } to { transform: translateX(-33.333%) } }
        @keyframes vsbSrvPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,106,76,.7); }
          50% { box-shadow: 0 0 0 18px rgba(239,106,76,0); }
        }
      `}</style>

      <div className="fixed inset-0 bg-black overflow-hidden">
        <div
          ref={stageRef}
          className="absolute"
          style={{
            width: 1920, height: 1080, top: 0, left: 0, transformOrigin: 'top left',
            background: SKIN_BG[skin] ?? SKIN_BG.marbella,
          }}
        >
          {/* LED grid texture */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,.22) 0 1px, transparent 1px 4px), repeating-linear-gradient(90deg, rgba(0,0,0,.22) 0 1px, transparent 1px 4px)',
            mixBlendMode: 'multiply', opacity: 0.35,
          }} />

          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-10" style={{ height: 160, padding: '0 64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 56, background: 'linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,0) 100%)' }}>
            <div className="flex items-center" style={{ gap: 26 }}>
              <div style={{ width: 78, height: 78, borderRadius: 14, background: 'radial-gradient(circle at 30% 30%, #f3e4c7 0 20px, transparent 20.5px), linear-gradient(135deg, #ef6a4c 0%, #d94a2e 100%)', boxShadow: '0 10px 32px rgba(239,106,76,.55)' }} />
              <div className="flex flex-col" style={{ gap: 6, lineHeight: 1 }}>
                <span style={{ fontWeight: 600, fontSize: 22, letterSpacing: '.32em', textTransform: 'uppercase', opacity: .85 }}>EDICIÓN 2026</span>
                <span style={{ fontWeight: 900, fontSize: 44, letterSpacing: '.1em', textTransform: 'uppercase' }}>{(tournamentName || 'TENIS PLAYA').toUpperCase()}</span>
              </div>
            </div>
            <div className="flex flex-col items-center" style={{ gap: 12, lineHeight: 1 }}>
              {showRound && (
                <span style={{ padding: '14px 34px', background: accentA, color: '#fff', borderRadius: 999, fontWeight: 900, fontSize: 32, letterSpacing: '.24em', textTransform: 'uppercase', boxShadow: `0 8px 24px ${hexAlpha(accentA, 0.45)}` }}>
                  {roundLabel}
                </span>
              )}
              {courtLabel && (
                <span style={{ fontWeight: 700, fontSize: 22, letterSpacing: '.3em', opacity: .95, textTransform: 'uppercase' }}>{courtLabel}</span>
              )}
            </div>
            <div className="flex items-center" style={{ gap: 18, fontFamily: "'JetBrains Mono', monospace", fontSize: 30, letterSpacing: '.14em', opacity: .95 }}>
              <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#ff3b30', boxShadow: '0 0 22px #ff3b30', animation: 'vsbBlink 1.2s infinite' }} />
              <span>{clock}</span>
              <span style={{ opacity: .5, marginLeft: 6 }}>{matchTime}</span>
            </div>
          </div>

          {/* Column labels */}
          <div className="absolute z-10" style={{ left: 64, right: 64, top: 190, height: 30, display: 'grid', gridTemplateColumns: gridCols, alignItems: 'center', pointerEvents: 'none' }}>
            {showSeed && <div />}
            <div />
            {setCols.map((_, i) => (
              <div key={i} style={{ fontWeight: 700, letterSpacing: '.3em', fontSize: 20, opacity: .55, textAlign: 'center', textTransform: 'uppercase' }}>SET {i + 1}</div>
            ))}
            <div style={{ fontWeight: 700, letterSpacing: '.3em', fontSize: 20, opacity: .55, textAlign: 'center', textTransform: 'uppercase' }}>PUNTOS</div>
          </div>

          {/* Scoreboard rows */}
          <div className="absolute z-10" style={{ left: 64, right: 64, top: 230, bottom: showSponsors && sponsorList.length > 0 ? 260 : 60, display: 'grid', gridTemplateRows: '1fr 1fr', gap: 26 }}>
            {(['A', 'B'] as const).map((key) => {
              const t = key === 'A' ? teamA : teamB
              const accent = key === 'A' ? accentA : accentB
              const serving = (match.serving_team === 1 && key === 'A') || (match.serving_team === 2 && key === 'B')
              return (
                <TeamRowLED
                  key={key}
                  team={t}
                  serving={serving}
                  setCols={setCols}
                  teamKey={key}
                  isDoubles={isDoubles}
                  servingPlayerId={match.current_server_id ?? null}
                  gridCols={gridCols}
                  accentColor={accent}
                  servingColor={srvColor}
                  showSeed={showSeed}
                  showFlags={showFlags}
                  showServeIndicator={showServeIndicator}
                />
              )
            })}
          </div>

          {/* Sponsors bar */}
          {showSponsors && sponsorList.length > 0 && (
            <div className="absolute z-10" style={{ left: 0, right: 0, bottom: 0, height: 240, background: 'linear-gradient(180deg, rgba(0,0,0,.1) 0%, rgba(0,0,0,.4) 100%)', borderTop: '3px solid rgba(255,255,255,.08)', display: 'grid', gridTemplateRows: '48px 1fr' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28, fontWeight: 700, letterSpacing: '.42em', fontSize: 24, opacity: .7, textTransform: 'uppercase' }}>
                <i style={{ display: 'block', width: 40, height: 2, background: 'currentColor', opacity: .4 }} />
                Patrocinadores oficiales
                <i style={{ display: 'block', width: 40, height: 2, background: 'currentColor', opacity: .4 }} />
              </div>
              <div style={{ position: 'relative', overflow: 'hidden', height: 192 }}>
                <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', display: 'flex', alignItems: 'center', animation: `vsbMarquee ${carouselSpeed}s linear infinite` }}>
                  {[...sponsorList, ...sponsorList, ...sponsorList].map((sp, i) => (
                    <div key={i} style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, width: 420, height: 150, margin: '0 14px', padding: '0 28px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, fontWeight: 800, fontSize: 28, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,.9)', whiteSpace: 'nowrap' }}>
                      {sp.logo_url ? <img src={sp.logo_url} alt={sp.name} style={{ maxHeight: 80, maxWidth: 140, objectFit: 'contain' }} /> : null}
                      <span>{sp.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

interface TeamRowProps {
  team: {
    seed: number | undefined
    players: any[]
    games: number
    point: string
  }
  serving: boolean
  setCols: Array<{ a: number | null; b: number | null; done: boolean; current: boolean }>
  teamKey: 'A' | 'B'
  isDoubles: boolean
  servingPlayerId: string | null
  gridCols: string
  accentColor: string
  servingColor: string
  showSeed: boolean
  showFlags: boolean
  showServeIndicator: boolean
}

function TeamRowLED({ team, serving, setCols, teamKey, isDoubles, servingPlayerId, gridCols, accentColor, servingColor, showSeed, showFlags, showServeIndicator }: TeamRowProps) {
  const bg = serving
    ? `linear-gradient(90deg, ${hexAlpha(accentColor, 0.18)} 0%, ${hexAlpha(accentColor, 0.04)} 100%)`
    : `linear-gradient(90deg, rgba(255,255,255,.04) 0%, rgba(255,255,255,.02) 100%)`

  return (
    <div style={{
      position: 'relative', display: 'grid',
      gridTemplateColumns: gridCols,
      alignItems: 'stretch', background: bg, borderLeft: `12px solid ${accentColor}`,
      borderRadius: 10, overflow: 'hidden',
    }}>
      {/* Seed */}
      {showSeed && (
        <div style={{ display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 52, color: 'rgba(255,255,255,.55)', fontVariantNumeric: 'tabular-nums', borderRight: '1px solid rgba(255,255,255,.06)' }}>
          {team.seed ?? ''}
        </div>
      )}

      {/* Names + flags */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 22px 0 32px', minWidth: 0, gap: 10, overflow: 'hidden', borderRight: '1px solid rgba(255,255,255,.06)' }}>
        {team.players.map((p: any, i: number) => {
          const active = isDoubles && serving && p.id === servingPlayerId
          const nationality = (p.nationality ?? 'ESP').toUpperCase()
          return (
            <div key={p.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 22, minWidth: 0 }}>
              {showFlags && (
                <span style={{ flex: 'none', width: 64, height: 44, borderRadius: 5, boxShadow: '0 2px 8px rgba(0,0,0,.4), inset 0 0 0 1px rgba(0,0,0,.25)', overflow: 'hidden' }}>
                  <img src={`/Flags/${nationality}.jpg`} alt={nationality} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: 5 }} />
                </span>
              )}
              <span style={{ fontWeight: 800, fontSize: team.players.length === 1 ? 118 : 86, lineHeight: .9, letterSpacing: '.015em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 18, flex: 1 }}>
                {showServeIndicator && ((!isDoubles && serving) || active) && (
                  <span style={{ flex: 'none', width: 26, height: 26, borderRadius: '50%', background: servingColor, animation: 'vsbSrvPulse 1.4s infinite' }} />
                )}
                {(p.last_name ?? p.name ?? '').toUpperCase()}
              </span>
            </div>
          )
        })}
      </div>

      {/* Set score columns */}
      {setCols.map((s, i) => {
        const my = teamKey === 'A' ? s.a : s.b
        const op = teamKey === 'A' ? s.b : s.a
        const won = s.done && my != null && op != null && my > op
        const lost = s.done && my != null && op != null && my < op
        return (
          <div key={i} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 168, lineHeight: .92, letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums',
            position: 'relative', overflow: 'hidden', borderRight: '1px solid rgba(255,255,255,.06)',
            background: s.current ? hexAlpha(accentColor, 0.16) : 'rgba(0,0,0,.18)',
            opacity: lost ? .4 : 1,
          }}>
            <span style={{ position: 'relative', zIndex: 1 }}>
              {s.current ? team.games : (my != null ? my : '–')}
            </span>
            {won && <span style={{ position: 'absolute', left: '16%', right: '16%', bottom: 16, height: 8, borderRadius: 4, background: accentColor }} />}
          </div>
        )
      })}

      {/* Points (current game) */}
      <div style={{ position: 'relative', display: 'grid', placeItems: 'center', background: accentColor, color: '#fff', fontWeight: 900, fontSize: 158, lineHeight: 1, letterSpacing: '-.01em', fontVariantNumeric: 'tabular-nums' }}>
        {team.point}
      </div>
    </div>
  )
}
