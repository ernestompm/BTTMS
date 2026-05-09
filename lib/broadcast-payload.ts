import { createServiceSupabase } from './supabase-server'
import { isBreakPoint, isSetPoint, isMatchPoint } from './score-engine'
import type { Score } from '@/types'

// ════════════════════════════════════════════════════════════════════════════
// BTTMS v3.0 broadcast payload
// ════════════════════════════════════════════════════════════════════════════
// Schema canónico que se sirve por GET /api/broadcast/export y se empuja por
// pushBroadcastEvent en cada transición del match.
//
// Cambios respecto a v2.0:
// - Sin redundancias: stats solo en match.stats (no en root); scheduled_at
//   solo en match.times (no duplicado); meta es un header pequeño y nada más.
// - score reestructurado en grupos lógicos: completed_sets, current_set,
//   current_game (con displays "0|15|30|40|ORO"), tiebreak (objeto que
//   agrupa active+type+score), flags (todas las banderas juntas).
// - Auto-recuperación: si match.score tiene corrupción (ej. sets array
//   poblado pero sets_won = 0-0), recomputamos sets_won desde sets, y si
//   match.score parece muy corrupto, fallback al score_after del último
//   punto no anulado (que es la fuente autorizada).
// - Nuevas flags: championship_point_t1/t2 (= match_point en la final).
// ════════════════════════════════════════════════════════════════════════════

const PAYLOAD_VERSION = '3.0'
const PTS_DISPLAY = ['0', '15', '30', '40']

export async function buildBroadcastPayload(tournamentId: string, matchId?: string) {
  const service = createServiceSupabase()

  const { data: tournament } = await service
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single()
  if (!tournament) return null

  // Selección del match: explícito > broadcast_active > último in_progress
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

  // Auto-recuperación del score si parece corrupto. La BBDD es source of
  // truth, pero si match.score tiene inconsistencias evidentes, fallback al
  // último punto registrado (cuyo score_after es siempre el resultado limpio
  // de aplicar el engine).
  if (match?.id) {
    match.score = await reconcileScore(service, match.id, match.score)
  }

  // Cuadro completo del match actual (si hay draw asignado)
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

  // Juez de silla
  let judge: any = null
  if (match?.judge_id) {
    const { data } = await service.from('app_users')
      .select('id, full_name, email, role').eq('id', match.judge_id).single()
    judge = data ? { id: data.id, name: data.full_name, role: data.role } : null
  }

  // Weather (best-effort)
  let weather: any = null
  try {
    const { data: weatherRow } = await service.from('weather_cache')
      .select('data, updated_at').eq('tournament_id', tournamentId).maybeSingle()
    if (weatherRow) weather = (weatherRow as any).data
  } catch {}

  return {
    meta: {
      version: PAYLOAD_VERSION,
      generated_at: new Date().toISOString(),
      tournament_id: tournamentId,
      match_id: match?.id ?? null,
    },
    tournament: {
      id: tournament.id,
      name: tournament.name,
      edition: tournament.edition,
      status: tournament.status,
      venue: {
        name: tournament.venue_name,
        city: tournament.venue_city,
        lat: tournament.venue_lat,
        lng: tournament.venue_lng,
      },
      dates: {
        start: tournament.start_date,
        end: tournament.end_date,
      },
      logo_url: tournament.logo_url,
      sponsors: tournament.sponsors ?? [],
      scoreboard_config: tournament.scoreboard_config ?? null,
      weather,
    },
    judge,
    match: match ? formatMatch(match, /*includeBio*/ true) : null,
    draw: match?.draw_id ? {
      id: match.draw_id,
      category: match.category,
      entries: drawEntries.map(formatEntry),
      matches: drawMatches.map((m: any) => ({
        ...formatMatch(m, /*includeBio*/ false),
        is_current: m.id === match.id,
      })),
    } : null,
  }
}

// ── Auto-recuperación del score ────────────────────────────────────────────
// Devuelve el score "real" usando match.score si es coherente, o el
// score_after del último punto no anulado si match.score parece corrupto.
async function reconcileScore(service: any, matchId: string, matchScore: any) {
  const score = (matchScore ?? {}) as any

  const sets = (score.sets ?? []) as Array<{ t1: number, t2: number }>
  const computedSetsWon = {
    t1: sets.filter((s) => (s?.t1 ?? 0) > (s?.t2 ?? 0)).length,
    t2: sets.filter((s) => (s?.t2 ?? 0) > (s?.t1 ?? 0)).length,
  }
  const storedSetsWon = score.sets_won ?? { t1: 0, t2: 0 }

  // Inconsistencia obvia: hay sets registrados pero sets_won no cuadra
  const setsWonMismatch =
    sets.length > 0 && (
      storedSetsWon.t1 !== computedSetsWon.t1 ||
      storedSetsWon.t2 !== computedSetsWon.t2
    )

  if (setsWonMismatch) {
    // Carga el último punto y usa SU score_after (lo que el engine generó
    // tras la última jugada). Si tampoco existe, recomputamos solo
    // sets_won desde el array.
    const { data: lastPoint } = await service
      .from('points')
      .select('score_after')
      .eq('match_id', matchId)
      .eq('is_undone', false)
      .order('sequence', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastPoint?.score_after) {
      return lastPoint.score_after
    }
    return { ...score, sets_won: computedSetsWon }
  }

  return score
}

// ── Selectors SQL ──────────────────────────────────────────────────────────
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

// ── Formatters ─────────────────────────────────────────────────────────────
function formatEntry(e: any) {
  if (!e) return null
  return {
    id: e.id,
    seed: e.seed ?? null,
    entry_type: e.entry_type ?? null,
    status: e.status ?? null,
    draw_position: e.draw_position ?? null,
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
    birth_date: p.birth_date ?? null,
    age: p.age_manual ?? (p.birth_date ? ageFromDOB(p.birth_date) : null),
    height_cm: p.height_cm ?? null,
    laterality: p.laterality ?? null,
    club: p.club ?? null,
    federacion_autonomica: p.federacion_autonomica ?? null,
    bio: p.bio ?? null,
    social_instagram: p.social_instagram ?? null,
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
  const isFinal = m.round === 'F'
  const status = m.status as string
  const inProgress = status === 'in_progress'
  const finished = status === 'finished' || status === 'retired' || status === 'walkover'

  return {
    id: m.id,
    status: m.status,
    category: m.category,
    round: m.round,
    is_final: isFinal,
    match_number: m.match_number,
    type: m.match_type,                                  // 'singles' | 'doubles'
    broadcast_active: m.broadcast_active ?? false,
    scoring_system: m.scoring_system,
    rules: {
      net_height_cm: m.net_height ?? null,
      forbidden_zone_serving_m: m.forbidden_zone_serving ?? null,
    },
    court: m.court ? { id: m.court.id, name: m.court.name, is_center: m.court.is_center_court } : null,
    times: {
      scheduled_at: m.scheduled_at ?? null,
      judge_on_court_at: m.judge_on_court_at ?? null,
      players_on_court_at: m.players_on_court_at ?? null,
      warmup_started_at: m.warmup_started_at ?? null,
      started_at: m.started_at ?? null,
      finished_at: m.finished_at ?? null,
      elapsed_ms: m.started_at && !m.finished_at
        ? Date.now() - new Date(m.started_at).getTime()
        : (m.started_at && m.finished_at
            ? new Date(m.finished_at).getTime() - new Date(m.started_at).getTime()
            : 0),
    },
    toss: {
      winner: m.toss_winner ?? null,
      choice: m.toss_choice ?? null,
      side_entry1: m.side_entry1 ?? null,
    },
    teams: [
      buildTeam(1, m.entry1, m.serving_team === 1, includeBio),
      buildTeam(2, m.entry2, m.serving_team === 2, includeBio),
    ],
    score: formatScore(m.score, m.serving_team ?? 1, isFinal),
    stats: m.stats ?? null,
    warnings: m.warnings ?? { t1: [], t2: [] },
    retire: (m.retired_team || m.retire_reason) ? {
      team: m.retired_team ?? null,
      reason: m.retire_reason ?? null,
    } : null,
  }
}

function formatScore(score: Score | null, serving: 1 | 2, isFinal: boolean) {
  if (!score) return null

  const sets = score.sets ?? []
  const setsWon = score.sets_won ?? { t1: 0, t2: 0 }
  const currentSet = score.current_set ?? { t1: 0, t2: 0 }
  const currentGame = score.current_game ?? { t1: 0, t2: 0 }
  const tbActive = !!score.tiebreak_active
  const stbActive = !!score.super_tiebreak_active
  const tbScore = score.tiebreak_score ?? { t1: 0, t2: 0 }

  const flagBP = isFlag(() => isBreakPoint(score, serving))
  const flagSP1 = isFlag(() => isSetPoint(score, 1))
  const flagSP2 = isFlag(() => isSetPoint(score, 2))
  const flagMP1 = isFlag(() => isMatchPoint(score, 1))
  const flagMP2 = isFlag(() => isMatchPoint(score, 2))

  return {
    // Cuántos sets ha ganado cada equipo (saneado: si la BBDD trae cero
    // pero el array de sets dice otra cosa, aquí ya viene corregido por
    // reconcileScore).
    sets_won: { t1: setsWon.t1 ?? 0, t2: setsWon.t2 ?? 0 },

    // Histórico de sets cerrados — array de { t1, t2 }
    completed_sets: sets,

    // Set actualmente en juego — games por equipo. Si el match está
    // finished, refleja el último set jugado antes del cierre.
    current_set_number: sets.length + (inProgressMatch(score) ? 1 : 0),
    current_set: { t1: currentSet.t1 ?? 0, t2: currentSet.t2 ?? 0 },

    // Punto/game actualmente en juego — UNA SOLA fuente para los puntos,
    // sea game normal, tiebreak o super tiebreak.
    //   phase = 'game'           → t1/t2 = "0" | "15" | "30" | "40" | "AD" | "ORO"
    //   phase = 'tiebreak'       → t1/t2 = "0" | "1" | "2" | "3" | "4" ...
    //   phase = 'super_tiebreak' → t1/t2 = "0" | "1" | "2" ... (super TB a 10)
    // null cuando match terminado (no hay game en curso).
    current_game: score.match_status === 'finished' ? null : {
      t1: gameDisplay(score, 1),
      t2: gameDisplay(score, 2),
      phase: stbActive ? 'super_tiebreak' : (tbActive ? 'tiebreak' : 'game'),
      deuce: !!score.deuce,
      advantage_team: score.advantage_team ?? null,
    },

    scoring_system: score.scoring_system,
    match_status: score.match_status ?? 'in_progress',
    winner_team: score.winner_team ?? null,

    // Flags — TODAS agrupadas. championship_point = match point en la final
    // del torneo (round === 'F').
    flags: {
      golden_point: !!score.deuce,
      break_point: flagBP,
      set_point_t1: flagSP1,
      set_point_t2: flagSP2,
      match_point_t1: flagMP1,
      match_point_t2: flagMP2,
      championship_point_t1: flagMP1 && isFinal,
      championship_point_t2: flagMP2 && isFinal,
    },
  }
}

function inProgressMatch(score: Score): boolean {
  return score.match_status === 'in_progress'
}

/**
 * Devuelve el valor para mostrar en el marcador de current_game.
 *  - Game normal:                 "0" | "15" | "30" | "40"
 *  - Game con ventaja (raro):     "AD" en el equipo con ventaja, "40" en el otro
 *  - Punto de oro (40-40 beach):  "40" en ambos (el flag golden_point lo indica)
 *  - Tiebreak / Super TB:         "0" | "1" | "2" | "3" | ...
 */
function gameDisplay(score: Score, team: 1 | 2): string {
  if (score.super_tiebreak_active || score.tiebreak_active) {
    return String(score.tiebreak_score?.[team === 1 ? 't1' : 't2'] ?? 0)
  }
  if (score.deuce) {
    return score.advantage_team === team ? 'AD' : '40'
  }
  const idx = score.current_game?.[team === 1 ? 't1' : 't2'] ?? 0
  return PTS_DISPLAY[idx] ?? '0'
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
