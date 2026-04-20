'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import type { Match, Score, Sponsor } from '@/types'

interface Props {
  initialMatch: Match & { entry1: any; entry2: any; court: any }
  config: any
  tournamentName: string
  sponsors: Sponsor[]
  weather: any
}

const PTS_LABEL = ['0', '15', '30', '40']
const ROUND_LABELS: Record<string, string> = {
  F: 'FINAL', SF: 'SEMIFINAL', QF: 'CUARTOS DE FINAL',
  R16: 'OCTAVOS DE FINAL', R32: 'DIECISEISAVOS',
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

export function VenueScoreboard({ initialMatch, tournamentName, sponsors }: Props) {
  const supabase = createClient()
  const [match, setMatch] = useState(initialMatch)
  const [clock, setClock] = useState('')
  const [matchTime, setMatchTime] = useState('00:00')
  const stageRef = useRef<HTMLDivElement>(null)

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

  // 1920x1080 stage scaling — always fills 100% of screen
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
    country: entry1?.player1?.nationality ?? 'ESP',
    players: isDoubles
      ? [entry1?.player1, entry1?.player2].filter(Boolean)
      : [entry1?.player1].filter(Boolean),
    sets: score?.sets ?? [],
    games: score?.current_set?.t1 ?? 0,
    point: gameLabel(score, 1),
    setsWon: score?.sets_won?.t1 ?? 0,
  }
  const teamB = {
    seed: entry2?.seed,
    country: entry2?.player1?.nationality ?? 'ESP',
    players: isDoubles
      ? [entry2?.player1, entry2?.player2].filter(Boolean)
      : [entry2?.player1].filter(Boolean),
    sets: score?.sets ?? [],
    games: score?.current_set?.t2 ?? 0,
    point: gameLabel(score, 2),
    setsWon: score?.sets_won?.t2 ?? 0,
  }

  // Number of set columns depends on format (pro_set/7_games = 1, else 3)
  const scoringSystem = (match as any).scoring_system ?? ''
  const numSetCols = (scoringSystem === 'pro_set' || scoringSystem === '7_games_tb') ? 1 : 3
  const setCols = Array.from({ length: numSetCols }, (_, i) => {
    const s = score?.sets?.[i]
    return {
      a: s ? s.t1 : null,
      b: s ? s.t2 : null,
      done: !!s,
      current: !s && i === (score?.sets?.length ?? 0),
    }
  })

  const setColWidth = 170
  const gridCols = `110px minmax(0,1fr) ${Array(numSetCols).fill(`${setColWidth}px`).join(' ')} 220px`

  const roundLabel = ROUND_LABELS[match.round ?? ''] ?? (match.round ?? '—')

  const courtLabel = `${match.court?.name ?? 'PISTA'} · ${isDoubles ? 'DOBLES' : 'INDIVIDUAL'}`

  const sponsorList = sponsors && sponsors.length ? sponsors : [
    { name: 'RFET', logo_url: '', tier: '', display_order: 0 },
    { name: 'TENIS PLAYA', logo_url: '', tier: '', display_order: 1 },
    { name: 'VINTEON', logo_url: '', tier: '', display_order: 2 },
  ]

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
            background: 'radial-gradient(1400px 700px at 50% 0%, #1d3a5f 0%, #0a1627 70%), #0a1627',
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
              <span style={{ padding: '14px 34px', background: '#ef6a4c', color: '#fff', borderRadius: 999, fontWeight: 900, fontSize: 32, letterSpacing: '.24em', textTransform: 'uppercase', boxShadow: '0 8px 24px rgba(239,106,76,.45)' }}>{roundLabel}</span>
              <span style={{ fontWeight: 700, fontSize: 22, letterSpacing: '.3em', opacity: .95, textTransform: 'uppercase' }}>{courtLabel}</span>
            </div>
            <div className="flex items-center" style={{ gap: 18, fontFamily: "'JetBrains Mono', monospace", fontSize: 30, letterSpacing: '.14em', opacity: .95 }}>
              <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#ff3b30', boxShadow: '0 0 22px #ff3b30', animation: 'vsbBlink 1.2s infinite' }} />
              <span>{clock}</span>
              <span style={{ opacity: .5, marginLeft: 6 }}>{matchTime}</span>
            </div>
          </div>

          {/* Column labels */}
          <div className="absolute z-10" style={{ left: 64, right: 64, top: 190, height: 30, display: 'grid', gridTemplateColumns: gridCols, alignItems: 'center', pointerEvents: 'none' }}>
            <div /><div />
            {setCols.map((_, i) => (
              <div key={i} style={{ fontWeight: 700, letterSpacing: '.3em', fontSize: 20, opacity: .55, textAlign: 'center', textTransform: 'uppercase' }}>SET {i + 1}</div>
            ))}
            <div style={{ fontWeight: 700, letterSpacing: '.3em', fontSize: 20, opacity: .55, textAlign: 'center', textTransform: 'uppercase' }}>PUNTOS</div>
          </div>

          {/* Scoreboard rows */}
          <div className="absolute z-10" style={{ left: 64, right: 64, top: 230, bottom: 360, display: 'grid', gridTemplateRows: '1fr 1fr', gap: 26 }}>
            {(['A', 'B'] as const).map((key) => {
              const t = key === 'A' ? teamA : teamB
              const serving = (match.serving_team === 1 && key === 'A') || (match.serving_team === 2 && key === 'B')
              return (
                <TeamRowLED key={key} team={t} serving={serving} setCols={setCols} teamKey={key} isDoubles={isDoubles} servingPlayerId={match.current_server_id ?? null} gridCols={gridCols} />
              )
            })}
          </div>

          {/* Sponsors */}
          <div className="absolute z-10" style={{ left: 0, right: 0, bottom: 0, height: 240, background: 'linear-gradient(180deg, rgba(0,0,0,.1) 0%, rgba(0,0,0,.4) 100%)', borderTop: '3px solid rgba(255,255,255,.08)', display: 'grid', gridTemplateRows: '48px 1fr' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28, fontWeight: 700, letterSpacing: '.42em', fontSize: 24, opacity: .7, textTransform: 'uppercase' }}>
              <i style={{ display: 'block', width: 40, height: 2, background: 'currentColor', opacity: .4 }} />Patrocinadores oficiales<i style={{ display: 'block', width: 40, height: 2, background: 'currentColor', opacity: .4 }} />
            </div>
            <div style={{ position: 'relative', overflow: 'hidden', height: 192 }}>
              <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', display: 'flex', alignItems: 'center', animation: 'vsbMarquee 40s linear infinite' }}>
                {[...sponsorList, ...sponsorList, ...sponsorList].map((sp, i) => (
                  <div key={i} style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, width: 420, height: 150, margin: '0 14px', padding: '0 28px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, fontWeight: 800, fontSize: 28, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,.9)', whiteSpace: 'nowrap' }}>
                    {sp.logo_url ? <img src={sp.logo_url} alt={sp.name} style={{ maxHeight: 80, maxWidth: 140, objectFit: 'contain' }} /> : null}
                    <span>{sp.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

interface TeamRowProps {
  team: {
    seed: number | undefined
    country: string
    players: any[]
    games: number
    point: string
    setsWon: number
  }
  serving: boolean
  setCols: Array<{ a: number | null; b: number | null; done: boolean; current: boolean }>
  teamKey: 'A' | 'B'
  isDoubles: boolean
  servingPlayerId: string | null
  gridCols: string
}

function TeamRowLED({ team, serving, setCols, teamKey, isDoubles, servingPlayerId, gridCols }: TeamRowProps) {
  const accentColor = '#ef6a4c'
  const bg = serving
    ? `linear-gradient(90deg, rgba(239,106,76,.18) 0%, rgba(239,106,76,.04) 100%)`
    : `linear-gradient(90deg, rgba(255,255,255,.04) 0%, rgba(255,255,255,.02) 100%)`

  return (
    <div style={{
      position: 'relative', display: 'grid',
      gridTemplateColumns: gridCols,
      alignItems: 'stretch', background: bg, borderLeft: `12px solid ${accentColor}`,
      borderRadius: 10, overflow: 'hidden',
    }}>
      {/* Seed */}
      <div style={{ display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 52, color: 'rgba(255,255,255,.55)', fontVariantNumeric: 'tabular-nums', borderRight: '1px solid rgba(255,255,255,.06)' }}>
        {team.seed ?? ''}
      </div>

      {/* Names */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 22px 0 32px', minWidth: 0, gap: 10, overflow: 'hidden', borderRight: '1px solid rgba(255,255,255,.06)' }}>
        {team.players.map((p: any, i: number) => {
          const active = isDoubles && serving && p.id === servingPlayerId
          return (
            <div key={p.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 22, minWidth: 0 }}>
              <span style={{ flex: 'none', width: 64, height: 44, borderRadius: 5, boxShadow: '0 2px 8px rgba(0,0,0,.4), inset 0 0 0 1px rgba(0,0,0,.25)', overflow: 'hidden' }}>
                <img src={`/Flags/${(team.country || 'ESP').toUpperCase()}.jpg`} alt={team.country} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: 5 }} />
              </span>
              <span style={{ fontWeight: 800, fontSize: team.players.length === 1 ? 118 : 86, lineHeight: .9, letterSpacing: '.015em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 18, flex: 1 }}>
                {(!isDoubles && serving) || active ? (
                  <span style={{ flex: 'none', width: 26, height: 26, borderRadius: '50%', background: accentColor, animation: 'vsbSrvPulse 1.4s infinite' }} />
                ) : null}
                {(p.last_name ?? p.name ?? '').toUpperCase()}
              </span>
            </div>
          )
        })}
      </div>

      {/* Set columns (3) */}
      {setCols.map((s, i) => {
        const my = teamKey === 'A' ? s.a : s.b
        const op = teamKey === 'A' ? s.b : s.a
        const isCurrent = s.current
        const bgCell = isCurrent ? 'rgba(239,106,76,.16)' : 'rgba(0,0,0,.18)'
        const won = s.done && my != null && op != null && my > op
        const lost = s.done && my != null && op != null && my < op
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 168, lineHeight: .92, letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums', position: 'relative', background: bgCell, overflow: 'hidden', borderRight: '1px solid rgba(255,255,255,.06)', opacity: lost ? .4 : 1 }}>
            <span style={{ position: 'relative', zIndex: 1 }}>
              {isCurrent ? (team.games ?? 0) : (my != null ? my : '–')}
            </span>
            {won && <span style={{ position: 'absolute', left: '16%', right: '16%', bottom: 16, height: 8, borderRadius: 4, background: accentColor }} />}
          </div>
        )
      })}

      {/* Current game score */}
      <div style={{ position: 'relative', display: 'grid', placeItems: 'center', background: accentColor, color: '#fff', fontWeight: 900, fontSize: 158, lineHeight: 1, letterSpacing: '-.01em', fontVariantNumeric: 'tabular-nums' }}>
        {team.point}
      </div>
    </div>
  )
}
