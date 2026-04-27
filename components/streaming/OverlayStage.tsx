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
  AwardsPodium, StatsTicker,
} from './graphics'
import {
  ScorebugTour, BigScoreboardTour, WeatherBarTour,
  TournamentIntroTour, VenueCardTour, MatchPresentationTour, PlayerBioTour,
  RefereeLowerThirdTour, StatsPanelTour, ResultsGridTour, BracketViewTour,
  CoinTossTour, AwardsPodiumTour,
} from './graphics-tour'
import {
  ScorebugPacific, BigScoreboardPacific, WeatherPacific,
  TournamentIntroPacific, VenueCardPacific, MatchPresentationPacific, PlayerBioPacific,
  RefereeLowerThirdPacific, StatsPanelPacific, ResultsGridPacific, BracketViewPacific,
  CoinTossPacific, AwardsPodiumPacific,
} from './graphics-pacific'
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
  const awardsData = (d('awards_podium') as any) ?? null
  const tickerActive = v('stats_ticker')
  const tickerStat = tickerActive ? ((d('stats_ticker') as any)?.stat ?? 'aces') : null
  // Skin selector — tournament.scoreboard_config.graphics_style ('classic' | 'tour' | 'pacific')
  const skin: 'classic' | 'tour' | 'pacific' = (tournament?.scoreboard_config?.graphics_style ?? 'classic')

  // Helper: enruta cada grafico al render adecuado segun el skin
  // (classic / tour / pacific). Asi el switch de skin afecta a TODOS.
  return (
    <>
      <Presence show={v('tournament_intro')}    exitMs={700}>{(vis) =>
        skin === 'pacific' ? <TournamentIntroPacific visible={vis} tournament={tournament}/>
        : skin === 'tour'  ? <TournamentIntroTour    visible={vis} tournament={tournament}/>
                           : <TournamentIntro       visible={vis} tournament={tournament}/> }</Presence>
      <Presence show={v('venue_card')}          exitMs={650}>{(vis) =>
        skin === 'pacific' ? <VenueCardPacific visible={vis} tournament={tournament}/>
        : skin === 'tour'  ? <VenueCardTour    visible={vis} tournament={tournament}/>
                           : <VenueCard       visible={vis} tournament={tournament}/> }</Presence>
      <Presence show={v('match_presentation')}  exitMs={750}>{(vis) =>
        skin === 'pacific' ? <MatchPresentationPacific visible={vis} match={match} tournament={tournament}/>
        : skin === 'tour'  ? <MatchPresentationTour    visible={vis} match={match} tournament={tournament}/>
                           : <MatchPresentation       visible={vis} match={match} tournament={tournament}/> }</Presence>
      <Presence show={v('results_grid')}        exitMs={700}>{(vis) =>
        skin === 'pacific' ? <ResultsGridPacific visible={vis} matches={allMatches} highlightMatchId={match.id} tournament={tournament} category={resultsCat}/>
        : skin === 'tour'  ? <ResultsGridTour    visible={vis} matches={allMatches} highlightMatchId={match.id} tournament={tournament} category={resultsCat}/>
                           : <ResultsGrid       visible={vis} matches={allMatches} highlightMatchId={match.id} tournament={tournament} category={resultsCat}/> }</Presence>
      <Presence show={v('bracket')}             exitMs={700}>{(vis) =>
        skin === 'pacific' ? <BracketViewPacific visible={vis} matches={allMatches} highlightMatchId={match.id} tournament={tournament} category={bracketCat}/>
        : skin === 'tour'  ? <BracketViewTour    visible={vis} matches={allMatches} highlightMatchId={match.id} tournament={tournament} category={bracketCat}/>
                           : <BracketView       visible={vis} matches={allMatches} highlightMatchId={match.id} tournament={tournament} category={bracketCat}/> }</Presence>
      <Presence show={v('coin_toss')}           exitMs={700}>{(vis) =>
        skin === 'pacific' ? <CoinTossPacific visible={vis} match={match} tournament={tournament}/>
        : skin === 'tour'  ? <CoinTossTour    visible={vis} match={match} tournament={tournament}/>
                           : <CoinToss       visible={vis} match={match} tournament={tournament}/> }</Presence>
      <Presence show={v('stats_panel')}         exitMs={700}>{(vis) =>
        skin === 'pacific' ? <StatsPanelPacific visible={vis} match={match} tournament={tournament} scope={statsScope}/>
        : skin === 'tour'  ? <StatsPanelTour    visible={vis} match={match} tournament={tournament} scope={statsScope}/>
                           : <StatsPanel       visible={vis} match={match} tournament={tournament} scope={statsScope}/> }</Presence>
      <Presence show={v('player_bio') && !!bioPlayer} exitMs={700}>{(vis) =>
        skin === 'pacific' ? <PlayerBioPacific visible={vis} player={bioPlayer!} team={bioTeam} category={match.category} tournament={tournament}/>
        : skin === 'tour'  ? <PlayerBioTour    visible={vis} player={bioPlayer!} team={bioTeam} category={match.category} tournament={tournament}/>
                           : <PlayerBio       visible={vis} player={bioPlayer!} team={bioTeam} category={match.category} tournament={tournament}/> }</Presence>
      <Presence show={v('weather')}             exitMs={650}>{(vis) =>
        skin === 'pacific' ? <WeatherPacific  visible={vis} weather={weather} tournament={tournament}/>
        : skin === 'tour'  ? <WeatherBarTour  visible={vis} weather={weather} tournament={tournament}/>
                           : <WeatherCard    visible={vis} weather={weather} tournament={tournament}/> }</Presence>
      <Presence show={v('big_scoreboard')}      exitMs={700}>{(vis) =>
        skin === 'pacific' ? <BigScoreboardPacific visible={vis} match={match} tournament={tournament} sponsor={mainSponsor} opts={bigScoreOpts}/>
        : skin === 'tour'  ? <BigScoreboardTour    visible={vis} match={match} tournament={tournament} sponsor={mainSponsor} opts={bigScoreOpts}/>
                           : <BigScoreboard       visible={vis} match={match} tournament={tournament} sponsor={mainSponsor} opts={bigScoreOpts}/> }</Presence>
      <Presence show={v('awards_podium') && !!awardsData} exitMs={750}>{(vis) =>
        skin === 'pacific' ? <AwardsPodiumPacific visible={vis} data={awardsData} tournament={tournament}/>
        : skin === 'tour'  ? <AwardsPodiumTour    visible={vis} data={awardsData} tournament={tournament}/>
                           : <AwardsPodium       visible={vis} data={awardsData} tournament={tournament}/> }</Presence>
      {/* stats_ticker se integra en el Scorebug. */}
      <Presence show={v('referee_lower_third')} exitMs={700}>{(vis) =>
        skin === 'pacific' ? <RefereeLowerThirdPacific visible={vis} referee={referee} tournament={tournament}/>
        : skin === 'tour'  ? <RefereeLowerThirdTour    visible={vis} referee={referee} tournament={tournament}/>
                           : <RefereeLowerThird       visible={vis} referee={referee} tournament={tournament}/> }</Presence>
      <Presence show={v('scorebug')}            exitMs={500}>{(vis) =>
        skin === 'pacific' ? <ScorebugPacific visible={vis} match={match} tournament={tournament} tickerStat={tickerStat}/>
        : skin === 'tour'  ? <ScorebugTour    visible={vis} match={match} tournament={tournament} tickerStat={tickerStat}/>
                           : <Scorebug       visible={vis} match={match} tournament={tournament} flag={flag} tickerStat={tickerStat}/> }</Presence>
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
      {/* Fuente forzada a Barlow Condensed (igual que el overlay) — el panel
          operador usa Barlow y sin esto el preview renderiza con tipografia
          mas ancha que el programa, provocando wraps distintos. */}
      <div style={{
        position:'absolute', left:'50%', top:'50%', width:STAGE_W, height:STAGE_H,
        transformOrigin:'center center',
        transform:`translate(-50%,-50%) scale(${scale || 0.01})`,
        opacity: scale ? 1 : 0,
        fontFamily: "'Barlow Condensed', system-ui, sans-serif",
        color: '#fff',
      }}>
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
function OverlayStageBase({ sessionId, initialMatch, tournament, allMatches, referee, mainSponsor, weather, sourceColumn }: OverlayStageProps & { sourceColumn: 'graphics' | 'preview_graphics' }) {
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
    const ch = supabase.channel(`overlay-state-${sessionId}-${sourceColumn}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'stream_state', filter:`session_id=eq.${sessionId}` },
        (p) => setGraphics(((p.new as any)?.[sourceColumn] ?? {}) as GraphicsMap))
      .subscribe()
    supabase.from('stream_state').select(sourceColumn).eq('session_id', sessionId).single()
      .then(({ data }) => { if ((data as any)?.[sourceColumn]) setGraphics((data as any)[sourceColumn] as any) })
    return () => { supabase.removeChannel(ch) }
  }, [sessionId, sourceColumn])

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

export function OverlayStage(props: OverlayStageProps) {
  return <OverlayStageBase {...props} sourceColumn="graphics"/>
}
export function OverlayPreviewStage(props: OverlayStageProps) {
  return <OverlayStageBase {...props} sourceColumn="preview_graphics"/>
}
