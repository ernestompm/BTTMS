'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import type { Match, Score, ScoreboardConfig, Sponsor, WeatherData } from '@/types'
import { DEFAULT_SCOREBOARD_CONFIG } from '@/types'
import Image from 'next/image'

interface Props {
  initialMatch: Match & { entry1: any; entry2: any; court: any }
  config: ScoreboardConfig | null
  tournamentName: string
  sponsors: Sponsor[]
  weather: WeatherData | null
}

const GAME_POINTS = ['0', '15', '30', '40']

function getGameDisplay(score: Score, team: 1 | 2): string {
  if (!score) return '0'
  if (score.super_tiebreak_active) return String(score.tiebreak_score?.[`t${team}` as 't1'|'t2'] ?? 0)
  if (score.tiebreak_active) return String(score.tiebreak_score?.[`t${team}` as 't1'|'t2'] ?? 0)
  if (score.advantage_team === team) return 'ADV'
  if (score.advantage_team !== null && score.advantage_team !== team) return '40'
  if (score.deuce) return 'DUC'
  const pts = score.current_game?.[`t${team}` as 't1'|'t2'] ?? 0
  return GAME_POINTS[pts] ?? '0'
}

function TeamRow({ match, team, cfg, score }: { match: any; team: 1 | 2; cfg: ScoreboardConfig; score: Score | null }) {
  const entry = team === 1 ? match.entry1 : match.entry2
  const p1 = entry?.player1
  const p2 = entry?.player2
  const setsWon = score?.sets_won?.[`t${team}` as 't1'|'t2'] ?? 0
  const isServing = match.serving_team === team
  const accent = team === 1 ? cfg.colors.team1_accent : cfg.colors.team2_accent

  return (
    <div className="flex items-center gap-4 py-3 px-5" style={{ borderBottom: `2px solid ${accent}22` }}>
      {/* Serving indicator */}
      <div className="w-4 flex-shrink-0">
        {isServing && (
          <div className="w-3 h-3 rounded-full serving-pulse" style={{ background: cfg.colors.serving_indicator }} />
        )}
      </div>

      {/* Player photos */}
      {cfg.display.show_player_photos && (
        <div className="flex gap-1 flex-shrink-0">
          {[p1, p2].filter(Boolean).map((p: any, i: number) => (
            <div key={i} className="w-10 h-10 rounded-full overflow-hidden bg-gray-800 border-2" style={{ borderColor: accent + '66' }}>
              {p.photo_url ? (
                <img src={p.photo_url} alt={p.first_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">👤</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Player names */}
      <div className="flex-1 min-w-0">
        {[p1, p2].filter(Boolean).map((p: any, i: number) => (
          <div key={i} className="flex items-center gap-2">
            {cfg.display.show_flags && p.nationality && (
              <img src={`https://flagcdn.com/20x15/${p.nationality.toLowerCase()}.png`}
                alt={p.nationality} className="w-5 h-3.5 rounded-sm flex-shrink-0" />
            )}
            <span className="font-score font-bold text-2xl truncate" style={{ color: cfg.colors.text_primary }}>
              {p.first_name?.toUpperCase()} <span style={{ color: accent }}>{p.last_name?.toUpperCase()}</span>
            </span>
            {cfg.display.show_rankings && p.ranking_rfet && (
              <span className="text-xs" style={{ color: cfg.colors.text_secondary }}>#{p.ranking_rfet}</span>
            )}
          </div>
        ))}
      </div>

      {/* Sets history */}
      {score?.sets && score.sets.length > 0 && (
        <div className="flex gap-2 flex-shrink-0">
          {score.sets.map((s, i) => (
            <div key={i} className="text-center w-8">
              <span className="font-score font-bold text-2xl" style={{ color: cfg.colors.text_secondary }}>
                {s[`t${team}` as 't1'|'t2']}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Current set */}
      <div className="w-12 text-center flex-shrink-0">
        <span className="font-score font-black text-4xl" style={{ color: cfg.colors.text_primary }}>
          {score?.current_set?.[`t${team}` as 't1'|'t2'] ?? 0}
        </span>
      </div>

      {/* Game score */}
      <div className="w-16 text-center flex-shrink-0">
        <span className="font-score font-black text-4xl" style={{ color: isServing ? accent : cfg.colors.text_secondary }}>
          {score ? getGameDisplay(score, team) : '0'}
        </span>
      </div>

      {/* Sets won */}
      <div className="w-10 text-center flex-shrink-0">
        <span className="font-score font-black text-5xl" style={{ color: accent }}>
          {setsWon}
        </span>
      </div>
    </div>
  )
}

export function VenueScoreboard({ initialMatch, config, tournamentName, sponsors, weather }: Props) {
  const supabase = createClient()
  const [match, setMatch] = useState(initialMatch)
  const [sponsorIdx, setSponsorIdx] = useState(0)
  const cfg = { ...DEFAULT_SCOREBOARD_CONFIG, ...config }
  const score = match.score
  const isActive = match.status === 'in_progress'
  const isFinished = match.status === 'finished'
  const activeSponsor = sponsors[sponsorIdx]

  // Realtime subscription
  useEffect(() => {
    const channel = supabase.channel(`scoreboard-${match.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${match.id}` },
        (payload) => setMatch((prev) => ({ ...prev, ...payload.new as any }))
      ).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [match.id])

  // Sponsor rotation
  useEffect(() => {
    if (!sponsors.length) return
    const interval = setInterval(() => setSponsorIdx((i) => (i + 1) % sponsors.length),
      (cfg.sponsors.rotation_interval_seconds ?? 10) * 1000)
    return () => clearInterval(interval)
  }, [sponsors.length])

  const bgStyle = cfg.colors.background.length >= 2
    ? { background: `linear-gradient(135deg, ${cfg.colors.background[0]} 0%, ${cfg.colors.background[1]} 100%)` }
    : { backgroundColor: cfg.colors.background[0] }

  const isTB = score?.tiebreak_active
  const isSuperTB = score?.super_tiebreak_active

  return (
    <div className="min-h-screen flex flex-col overflow-hidden font-score" style={bgStyle}>
      {/* Top bar: tournament + court + round */}
      <div className="flex items-center justify-between px-6 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
        <div className="flex items-center gap-3">
          {cfg.logos.tournament_logo_url && (
            <img src={cfg.logos.tournament_logo_url} alt="Tournament" className="h-8 w-auto" />
          )}
          <span className="font-bold text-sm tracking-wider" style={{ color: cfg.colors.text_secondary }}>
            {tournamentName}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {cfg.display.show_round && match.round && (
            <span className="text-sm font-bold tracking-widest" style={{ color: cfg.colors.text_secondary }}>
              {match.round}
            </span>
          )}
          {cfg.display.show_court_name && match.court?.name && (
            <span className="text-sm" style={{ color: cfg.colors.text_secondary }}>{match.court.name}</span>
          )}
          {(isTB || isSuperTB) && (
            <span className="px-3 py-0.5 rounded-full text-xs font-bold" style={{ background: '#fc6f4333', color: '#fc6f43', border: '1px solid #fc6f4366' }}>
              {isSuperTB ? 'SUPER TIE-BREAK' : 'TIE-BREAK'}
            </span>
          )}
        </div>
        {/* Weather */}
        {cfg.display.show_weather && weather && (
          <div className="flex items-center gap-2 text-sm" style={{ color: cfg.colors.text_secondary }}>
            <span>{weather.condition}</span>
            <span className="font-bold" style={{ color: cfg.colors.text_primary }}>{weather.temperature_c}°C</span>
            <span>💨 {weather.wind_speed_kmh}km/h</span>
          </div>
        )}
      </div>

      {/* Main score area */}
      <div className="flex-1 flex flex-col justify-center">
        {/* Column headers */}
        <div className="flex items-center justify-end gap-2 px-5 pb-1" style={{ color: cfg.colors.text_secondary, fontSize: '0.65rem', letterSpacing: '0.1em' }}>
          {score?.sets && score.sets.length > 0 && score.sets.map((_: any, i: number) => (
            <div key={i} className="w-8 text-center">S{i+1}</div>
          ))}
          <div className="w-12 text-center">SET</div>
          <div className="w-16 text-center">JUE</div>
          <div className="w-10 text-center">SETS</div>
        </div>

        {/* Team rows */}
        <TeamRow match={match} team={1} cfg={cfg} score={score} />
        <div className="h-px mx-5" style={{ background: 'rgba(255,255,255,0.08)' }} />
        <TeamRow match={match} team={2} cfg={cfg} score={score} />

        {/* Finished banner */}
        {isFinished && score?.winner_team && (
          <div className="mx-5 mt-6 rounded-2xl p-4 text-center" style={{ background: `${cfg.colors.team1_accent}22`, border: `1px solid ${cfg.colors.team1_accent}44` }}>
            <p className="text-2xl font-black tracking-wider fade-in" style={{ color: cfg.colors.text_primary }}>
              PARTIDO FINALIZADO
            </p>
            <p className="text-sm mt-1" style={{ color: cfg.colors.text_secondary }}>
              Ganador: Equipo {score.winner_team}
            </p>
          </div>
        )}

        {/* Not started */}
        {!isActive && !isFinished && (
          <div className="text-center mt-8" style={{ color: cfg.colors.text_secondary }}>
            <p className="text-lg">Partido próximo</p>
            {match.scheduled_at && (
              <p className="text-3xl font-black mt-2" style={{ color: cfg.colors.text_primary }}>
                {new Date(match.scheduled_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Sponsors bar */}
      {cfg.sponsors.enabled && sponsors.length > 0 && (
        <div className="px-6 py-3 border-t flex items-center justify-center gap-6" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          <span className="text-xs tracking-widest" style={{ color: cfg.colors.text_secondary }}>PATROCINADORES</span>
          {activeSponsor?.logo_url ? (
            <img src={activeSponsor.logo_url} alt={activeSponsor.name} className="h-8 w-auto object-contain transition-all" />
          ) : (
            <span className="font-bold text-sm" style={{ color: cfg.colors.text_secondary }}>
              {activeSponsor?.name}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
