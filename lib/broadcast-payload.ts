import { createServiceSupabase } from './supabase-server'
import { isBreakPoint, isSetPoint, isMatchPoint } from './score-engine'
import type { Score } from '@/types'

/**
 * Canonical BTTMS v2.0 broadcast payload — what vMix / CasparCG / OBS
 * integrations consume. Served by GET /api/broadcast/export and pushed
 * by pushBroadcastEvent on every point / warning / retire / finish.
 */
export async function buildBroadcastPayload(tournamentId: string, matchId?: string) {
  const service = createServiceSupabase()

  const { data: tournament } = await service
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single()
  if (!tournament) return null

  // Pick current match: explicit > broadcast_active > any in_progress
  let match: any = null
  if (matchId) {
    const { data } = await service.from('matches').select(matchSelect()).eq('id', matchId).single()
    match = data
  } else {
    const { data: active } = await service.from('matches').select(matchSelect())
      .eq('tournament_id', tournamentId).eq('broadcast_active', true).limit(1).maybeSingle()
    if (active) match = active
    else {
      const { data: inProgress } = await service.from('matches').select(matchSelect())
        .eq('tournament_id', tournamentId).eq('status', 'in_progress')
        .order('started_at', { ascending: false }).limit(1).maybeSingle()
      match = inProgress
    }
  }

  // Load the full draw of the current match (if any) for the bracket view
  let drawEntries: any[] = []
  let drawMatches: any[] = []
  if (match?.draw_id) {
    const [{ data: entries }, { data: matches }] = await Promise.all([
      service.from('draw_entries').select(`*,
        player1:players!player1_id(*),
        player2:players!player2_id(*)
      `).eq('draw_id', match.draw_id),
      service.from('matches').select(matchSelectCompact())
        .eq('draw_id', match.draw_id).order('round').order('match_number'),
    ])
    drawEntries = entries ?? []
    drawMatches = matches ?? []
  }

  // Judge full name — required by broadcast graphics
  let judge: any = null
  if (match?.judge_id) {
    const { data } = await service.from('app_users')
      .select('id, full_name, email, role').eq('id', match.judge_id).single()
    judge = data ? { id: data.id, name: data.full_name, role: data.role } : null
  }

  // Weather (best-effort; table may not exist — swallow errors)
  let weather: any = null
  try {
    const { data: weatherRow } = await service.from('weather_cache')
      .select('data, updated_at').eq('tournament_id', tournamentId).maybeSingle()
    if (weatherRow) weather = (weatherRow as any).data
  } catch {}

  return {
    meta: {
      version: '2.0',
      generated_at: new Date().toISOString(),
      tournament_id: tournamentId,
      current_match_id: match?.id ?? null,
    },
    tournament: {
      id: tournament.id,
      name: tournament.name,
      edition: tournament.edition,
      venue: { name: tournament.venue_name, city: tournament.venue_city, lat: tournament.venue_lat, lng: tournament.venue_lng },
      start_date: tournament.start_date,
      end_date: tournament.end_date,
      logo_url: tournament.logo_url,
      sponsors: tournament.sponsors ?? [],
      status: tournament.status,
      scoreboard_config: tournament.scoreboard_config ?? null,
      weather,
    },
    judge,
    current_match: match ? formatMatch(match, true) : null,
    draw: match?.draw_id ? {
      id: match.draw_id,
      category: match.category,
      entries: drawEntries.map(formatEntry),
      matches: drawMatches.map((m: any) => ({
        ...formatMatch(m, false),
        is_current: m.id === match.id,
      })),
    } : null,
    stats: match?.stats ?? null,
  }
}

function matchSelect() {
  return `*,
    court:courts(id, name, is_center_court),
    entry1:draw_entries!entry1_id(*, player1:players!player1_id(*), player2:players!player2_id(*)),
    entry2:draw_entries!entry2_id(*, player1:players!player1_id(*), player2:players!player2_id(*))
  `
}

function matchSelectCompact() {
  return `id, round, match_number, status, score, draw_id, category, scheduled_at, started_at, finished_at,
    entry1:draw_entries!entry1_id(id, seed, player1:players!player1_id(id, first_name, last_name, nationality), player2:players!player2_id(id, first_name, last_name, nationality)),
    entry2:draw_entries!entry2_id(id, seed, player1:players!player1_id(id, first_name, last_name, nationality), player2:players!player2_id(id, first_name, last_name, nationality))
  `
}

function formatEntry(e: any) {
  if (!e) return null
  return {
    id: e.id,
    seed: e.seed,
    entry_type: e.entry_type,
    status: e.status,
    draw_position: e.draw_position,
    players: [e.player1, e.player2].filter(Boolean).map((p: any) => formatPlayer(p, true)),
  }
}

function formatPlayer(p: any, includeBio: boolean) {
  if (!p) return null
  const base = {
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    nationality: p.nationality,
    photo_url: p.photo_url ?? null,
    ranking_rfet: p.ranking_rfet ?? null,
    ranking_itf: p.ranking_itf ?? null,
  }
  if (!includeBio) return base
  return {
    ...base,
    birth_date: p.birth_date,
    age: p.age_manual ?? (p.birth_date ? ageFromDOB(p.birth_date) : null),
    height_cm: p.height_cm,
    laterality: p.laterality,
    club: p.club,
    federacion_autonomica: p.federacion_autonomica,
    bio: p.bio,
    social_instagram: p.social_instagram,
    titles: p.titles ?? [],
  }
}

function ageFromDOB(dob: string): number | null {
  try {
    const d = new Date(dob); if (isNaN(d.getTime())) return null
    const diff = Date.now() - d.getTime()
    return Math.floor(diff / (365.25 * 24 * 3600 * 1000))
  } catch { return null }
}

function formatMatch(m: any, includeBio: boolean) {
  const score: Score | null = m.score ?? null
  const serving: 1 | 2 = (m.serving_team ?? 1) as 1 | 2
  return {
    id: m.id,
    status: m.status,
    category: m.category,
    round: m.round,
    match_number: m.match_number,
    match_type: m.match_type,
    broadcast_active: m.broadcast_active ?? false,
    court: m.court ? { id: m.court.id, name: m.court.name, is_center: m.court.is_center_court } : null,
    scheduled_at: m.scheduled_at,
    time: {
      scheduled_at: m.scheduled_at,
      started_at: m.started_at,
      finished_at: m.finished_at,
      judge_on_court_at: m.judge_on_court_at,
      players_on_court_at: m.players_on_court_at,
      warmup_started_at: m.warmup_started_at,
      elapsed_ms: m.started_at && !m.finished_at
        ? Date.now() - new Date(m.started_at).getTime()
        : (m.started_at && m.finished_at
            ? new Date(m.finished_at).getTime() - new Date(m.started_at).getTime()
            : 0),
    },
    toss: { winner: m.toss_winner, choice: m.toss_choice, side_entry1: m.side_entry1 },
    teams: [
      buildTeam(1, m.entry1, m.serving_team === 1, includeBio),
      buildTeam(2, m.entry2, m.serving_team === 2, includeBio),
    ],
    score: score ? {
      sets:           score.sets ?? [],
      sets_won:       score.sets_won ?? { t1: 0, t2: 0 },
      current_set:    score.current_set ?? { t1: 0, t2: 0 },
      current_game:   score.current_game ?? { t1: 0, t2: 0 },
      deuce:          score.deuce ?? false,
      tiebreak:       score.tiebreak_active ?? false,
      super_tiebreak: score.super_tiebreak_active ?? false,
      tiebreak_score: score.tiebreak_score ?? { t1: 0, t2: 0 },
      scoring_system: score.scoring_system,
      winner_team:    score.winner_team ?? null,
      break_point:    isFlag(() => isBreakPoint(score, serving)),
      set_point_t1:   isFlag(() => isSetPoint(score, 1)),
      set_point_t2:   isFlag(() => isSetPoint(score, 2)),
      match_point_t1: isFlag(() => isMatchPoint(score, 1)),
      match_point_t2: isFlag(() => isMatchPoint(score, 2)),
    } : null,
    stats: m.stats ?? null,
    warnings: m.warnings ?? { t1: [], t2: [] },
    retired_team: m.retired_team ?? null,
    retire_reason: m.retire_reason ?? null,
    net_height: m.net_height,
    forbidden_zone_serving: m.forbidden_zone_serving,
  }
}

function isFlag(fn: () => boolean): boolean {
  try { return !!fn() } catch { return false }
}

function buildTeam(side: 1 | 2, entry: any, serving: boolean, includeBio: boolean) {
  return {
    side,
    serving,
    seed: entry?.seed ?? null,
    entry_type: entry?.entry_type ?? null,
    players: entry ? [entry.player1, entry.player2].filter(Boolean).map((p: any) => formatPlayer(p, includeBio)) : [],
  }
}
