'use client'
// ============================================================================
// OverlayStage — the alpha-channel canvas fed to vMix
// ============================================================================
// Renders the 10 graphics stacked on a transparent 1920×1080 stage that scales
// to the viewport. Subscribes to:
//   - stream_state (realtime) -> which graphics are visible + their data
//   - matches (realtime)      -> live match data for live graphics
// The background is transparent (RGBA alpha=0 in vMix). To ship to vMix:
//   1) Set vMix "Input / Web Browser" URL = /overlay/<matchId>
//   2) Enable "Supports transparent backgrounds"
// ============================================================================

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Match, Player, Score, Tournament } from '@/types'
import type { GraphicsMap } from '@/types/streaming'
import { STAGE_W, STAGE_H, STREAM_KEYFRAMES } from './stage-shared'
import {
  TournamentIntro, VenueCard, MatchPresentation, PlayerBio,
  RefereeLowerThird, StatsPanel, Scorebug, BigScoreboard,
  ResultsGrid, CoinToss,
} from './graphics'
import { deriveLiveFlag } from '@/lib/streaming/flags'

interface Props {
  sessionId: string
  initialMatch: any
  tournament: Tournament
  allMatches: any[]
  referee: { full_name: string, federacion?: string|null } | null
  mainSponsor: any
}

export function OverlayStage({ sessionId, initialMatch, tournament, allMatches, referee, mainSponsor }: Props) {
  const supabase = createClient()
  const [match, setMatch] = useState<any>(initialMatch)
  const [graphics, setGraphics] = useState<GraphicsMap>({})
  const stageRef = useRef<HTMLDivElement>(null)

  // Scale stage to viewport (letterbox, aspect preserved).
  useEffect(() => {
    const fit = () => {
      const el = stageRef.current; if (!el) return
      const sx = window.innerWidth / STAGE_W
      const sy = window.innerHeight / STAGE_H
      const s = Math.min(sx, sy)
      el.style.transform = `translate(-50%,-50%) scale(${s})`
    }
    fit(); window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  // Realtime: graphics state
  useEffect(() => {
    let ch = supabase.channel(`overlay-state-${sessionId}`)
      .on('postgres_changes',
        { event: '*', schema:'public', table:'stream_state', filter:`session_id=eq.${sessionId}` },
        (p) => {
          const g = (p.new as any)?.graphics ?? {}
          setGraphics(g)
        })
      .subscribe()
    // Initial fetch (in case the INSERT preceded the subscription).
    supabase.from('stream_state').select('graphics').eq('session_id', sessionId).single()
      .then(({ data }) => { if (data?.graphics) setGraphics(data.graphics as any) })
    return () => { supabase.removeChannel(ch) }
  }, [sessionId])

  // Realtime: match updates (score, status, toss, etc.)
  useEffect(() => {
    let ch = supabase.channel(`overlay-match-${match.id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema:'public', table:'matches', filter:`id=eq.${match.id}` },
        (p) => setMatch((m:any) => ({ ...m, ...(p.new as any) })))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [match.id])

  const v = (k: keyof GraphicsMap): boolean => !!graphics[k]?.visible
  const d = (k: keyof GraphicsMap): any => graphics[k]?.data ?? null

  // Resolve player bio target
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

  // Flag detection (auto)
  const isFinal = match.round === 'F'
  const flag = deriveLiveFlag(match.score as Score | null, { isFinal, servingTeam: match.serving_team })

  // StatsPanel scope from data
  const statsScope = ((d('stats_panel') as any)?.scope ?? 'auto') as any

  return (
    <>
      <style jsx global>{`
        html, body, #__next { background: transparent !important; margin:0; padding:0; overflow:hidden; height:100%; color:#fff;
          font-family:'Barlow Condensed', system-ui, sans-serif; }
        ${STREAM_KEYFRAMES}
      `}</style>
      <div style={{ position:'fixed', inset:0, background:'transparent', overflow:'hidden' }}>
        <div ref={stageRef} style={{ position:'absolute', left:'50%', top:'50%', width:STAGE_W, height:STAGE_H, transformOrigin:'center center' }}>
          {/* Z-order: lower first. Scorebug is last so it sits above everything. */}
          {v('tournament_intro')   && <TournamentIntro   visible={v('tournament_intro')}   tournament={tournament}/>}
          {v('venue_card')         && <VenueCard         visible={v('venue_card')}         tournament={tournament}/>}
          {v('match_presentation') && <MatchPresentation visible={v('match_presentation')} match={match} tournament={tournament}/>}
          {v('results_grid')       && <ResultsGrid       visible={v('results_grid')}       matches={allMatches} highlightMatchId={match.id} tournament={tournament} category={(d('results_grid') as any)?.category}/>}
          {v('coin_toss')          && <CoinToss          visible={v('coin_toss')}          match={match} tournament={tournament}/>}
          {v('stats_panel')        && <StatsPanel        visible={v('stats_panel')}        match={match} tournament={tournament} scope={statsScope}/>}
          {v('player_bio') && bioPlayer && <PlayerBio    visible={v('player_bio')}         player={bioPlayer} team={(bioData?.team ?? 1)} tournament={tournament}/>}
          {v('big_scoreboard')     && <BigScoreboard     visible={v('big_scoreboard')}     match={match} tournament={tournament} sponsor={mainSponsor}/>}
          {v('referee_lower_third')&& <RefereeLowerThird visible={v('referee_lower_third')} referee={referee} tournament={tournament}/>}
          {v('scorebug')           && <Scorebug          visible={v('scorebug')}           match={match} tournament={tournament} flag={flag}/>}
        </div>
      </div>
    </>
  )
}
