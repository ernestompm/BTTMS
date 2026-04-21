'use client'
// ============================================================================
// OverlayStage — alpha-channel canvas for vMix
// ============================================================================
// Exports:
//  - StageCanvas    : renderiza los 12 graficos dada una map de graphics
//  - MiniStage      : StageCanvas escalado a un contenedor concreto (preview)
//  - OverlayStage   : wrapper con subscripcion realtime a stream_state y matches
//                     (lo que usa /overlay/[matchId] para vMix)
// ============================================================================

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Player, Score, Tournament, WeatherData } from '@/types'
import type { GraphicsMap } from '@/types/streaming'
import { STAGE_W, STAGE_H, STREAM_KEYFRAMES } from './stage-shared'
import { Presence } from './presence'
import {
  TournamentIntro, VenueCard, MatchPresentation, PlayerBio,
  RefereeLowerThird, StatsPanel, Scorebug, BigScoreboard,
  ResultsGrid, CoinToss, WeatherCard, BracketView,
} from './graphics'
import { deriveLiveFlag } from '@/lib/streaming/flags'

// ─── StageCanvas ────────────────────────────────────────────────────────────
export interface StageCanvasProps {
  match: any
  tournament: Tournament
  allMatches: any[]
  referee: { full_name: string, federacion?: string|null } | null
  mainSponsor: any
  weather: WeatherData | null
  graphics: GraphicsMap
}
export function StageCanvas({ match, tournament, allMatches, referee, mainSponsor, weather, graphics }: StageCanvasProps) {
  const v = (k: keyof GraphicsMap): boolean => !!graphics[k]?.visible
  const d = (k: keyof GraphicsMap): any => graphics[k]?.data ?? null

  const bioData = d('player_bio') as { player_id?: string, team?: 1|2 } | null
  const bioPlayer: Player | null = (() => {
    const pid = bioData?.player_id
    if (!pid) return null
    for (const entry of [match.entry1, match.entry2]) {
      if (entry?.player1?.id === pid) return entry.player1
      if (entry?.player2?.id === pid) return entry.player2
    }
    return null
  })()
  // Derive team from player_id if data.team is missing — evita que preview y
  // programa aparezcan en lados distintos por un payload sin team.
  const bioTeam: 1|2 = (() => {
    if (bioData?.team === 1 || bioData?.team === 2) return bioData.team
    const pid = bioData?.player_id
    if (pid && (match.entry1?.player1?.id === pid || match.entry1?.player2?.id === pid)) return 1
    return 2
  })()

  const isFinal = match.round === 'F'
  const flag = deriveLiveFlag(match.score as Score | null, { isFinal, servingTeam: match.serving_team })
  const statsScope = ((d('stats_panel') as any)?.scope ?? 'auto') as any
  const bigScoreOpts = (d('big_scoreboard') as any) ?? {}
  const resultsCat = (d('results_grid') as any)?.category ?? match.category
  const bracketCat = (d('bracket') as any)?.category ?? match.category

  return (
    <>
      <Presence show={v('tournament_intro')}    exitMs={700}>{(vis) => <TournamentIntro    visible={vis} tournament={tournament}/>}</Presence>
      <Presence show={v('venue_card')}          exitMs={650}>{(vis) => <VenueCard          visible={vis} tournament={tournament}/>}</Presence>
      <Presence show={v('match_presentation')}  exitMs={750}>{(vis) => <MatchPresentation  visible={vis} match={match} tournament={tournament}/>}</Presence>
      <Presence show={v('results_grid')}        exitMs={700}>{(vis) => <ResultsGrid        visible={vis} matches={allMatches} highlightMatchId={match.id} tournament={tournament} category={resultsCat}/>}</Presence>
      <Presence show={v('bracket')}             exitMs={700}>{(vis) => <BracketView        visible={vis} matches={allMatches} highlightMatchId={match.id} tournament={tournament} category={bracketCat}/>}</Presence>
      <Presence show={v('coin_toss')}           exitMs={700}>{(vis) => <CoinToss           visible={vis} match={match} tournament={tournament}/>}</Presence>
      <Presence show={v('stats_panel')}         exitMs={700}>{(vis) => <StatsPanel         visible={vis} match={match} tournament={tournament} scope={statsScope}/>}</Presence>
      <Presence show={v('player_bio') && !!bioPlayer} exitMs={700}>{(vis) => <PlayerBio    visible={vis} player={bioPlayer!} team={bioTeam} category={match.category} tournament={tournament}/>}</Presence>
      <Presence show={v('weather')}             exitMs={650}>{(vis) => <WeatherCard       visible={vis} weather={weather} tournament={tournament}/>}</Presence>
      <Presence show={v('big_scoreboard')}      exitMs={700}>{(vis) => <BigScoreboard     visible={vis} match={match} tournament={tournament} sponsor={mainSponsor} opts={bigScoreOpts}/>}</Presence>
      <Presence show={v('referee_lower_third')} exitMs={700}>{(vis) => <RefereeLowerThird visible={vis} referee={referee} tournament={tournament}/>}</Presence>
      <Presence show={v('scorebug')}            exitMs={500}>{(vis) => <Scorebug          visible={vis} match={match} tournament={tournament} flag={flag}/>}</Presence>
    </>
  )
}

// ─── MiniStage ──────────────────────────────────────────────────────────────
/** Escala una StageCanvas (1920x1080) dentro de un contenedor flexible.
 *  Se usa para el monitor de PREVIEW en el panel operador. */
export function MiniStage(props: StageCanvasProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = boxRef.current; if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setSize({ w: e.contentRect.width, h: e.contentRect.height })
    })
    ro.observe(el); return () => ro.disconnect()
  }, [])
  const scale = size.w && size.h ? Math.min(size.w / STAGE_W, size.h / STAGE_H) : 0
  return (
    <div ref={boxRef} style={{ position:'relative', width:'100%', height:'100%', overflow:'hidden' }}>
      <div style={{ position:'absolute', left:'50%', top:'50%', width:STAGE_W, height:STAGE_H, transformOrigin:'center center',
        transform:`translate(-50%,-50%) scale(${scale || 0.01})`, opacity: scale ? 1 : 0 }}>
        <StageCanvas {...props}/>
      </div>
    </div>
  )
}

// ─── Full-screen OverlayStage with realtime subscriptions ───────────────────
interface OverlayStageProps {
  sessionId: string
  initialMatch: any
  tournament: Tournament
  allMatches: any[]
  referee: { full_name: string, federacion?: string|null } | null
  mainSponsor: any
  weather: WeatherData | null
}
export function OverlayStage({ sessionId, initialMatch, tournament, allMatches, referee, mainSponsor, weather }: OverlayStageProps) {
  const supabase = createClient()
  const [match, setMatch] = useState<any>(initialMatch)
  const [graphics, setGraphics] = useState<GraphicsMap>({})
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fit = () => {
      const el = stageRef.current; if (!el) return
      const s = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H)
      el.style.transform = `translate(-50%,-50%) scale(${s})`
    }
    fit(); window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit)
  }, [])

  useEffect(() => {
    const ch = supabase.channel(`overlay-state-${sessionId}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'stream_state', filter:`session_id=eq.${sessionId}` },
        (p) => setGraphics(((p.new as any)?.graphics ?? {}) as GraphicsMap))
      .subscribe()
    supabase.from('stream_state').select('graphics').eq('session_id', sessionId).single()
      .then(({ data }) => { if (data?.graphics) setGraphics(data.graphics as any) })
    return () => { supabase.removeChannel(ch) }
  }, [sessionId])

  useEffect(() => {
    const ch = supabase.channel(`overlay-match-${match.id}`)
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'matches', filter:`id=eq.${match.id}` },
        (p) => setMatch((m:any) => ({ ...m, ...(p.new as any) })))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [match.id])

  return (
    <>
      <style jsx global>{`
        html, body, #__next { background: transparent !important; margin:0; padding:0; overflow:hidden; height:100%; color:#fff;
          font-family:'Barlow Condensed', system-ui, sans-serif; }
        ${STREAM_KEYFRAMES}
      `}</style>
      <div style={{ position:'fixed', inset:0, background:'transparent', overflow:'hidden' }}>
        <div ref={stageRef} style={{ position:'absolute', left:'50%', top:'50%', width:STAGE_W, height:STAGE_H, transformOrigin:'center center' }}>
          <StageCanvas graphics={graphics} match={match} tournament={tournament} allMatches={allMatches} referee={referee} mainSponsor={mainSponsor} weather={weather}/>
        </div>
      </div>
    </>
  )
}
