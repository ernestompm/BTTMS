import { createServiceSupabase } from './supabase-server'
import { isBreakPoint, isSetPoint, isMatchPoint } from './score-engine'
import { applyPointToStats, applyBreakPointStats, emptyStats } from './stats-engine'
import type { Score, MatchStats } from '@/types'

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

/**
 * Modos internos de payload — schema SIEMPRE el mismo. Solo cambia
 * qué se carga de BBDD para optimizar latencia.
 *  - 'lite' (point_scored / point_undone): salta stats_by_set y draw
 *    (las queries más caras). Esos campos vienen como [] y null en
 *    el JSON. ~300ms de generación.
 *  - 'full' (resto de eventos): incluye todo, incluido stats_by_set
 *    completo y draw entero. ~1s de generación.
 */
export type PayloadMode = 'lite' | 'full'

export async function buildBroadcastPayload(
  tournamentId: string,
  matchId?: string,
  mode: PayloadMode = 'full',
) {
  const service = createServiceSupabase()

  // ── PASO 1: tournament + match en paralelo ───────────────────────────
  // Antes era secuencial (1º tournament, luego match). Ahora simultáneo.
  const matchQuery = matchId
    ? service.from('matches').select(matchSelect()).eq('id', matchId).single()
    : service.from('matches').select(matchSelect())
        .eq('tournament_id', tournamentId).eq('broadcast_active', true).limit(1).maybeSingle()

  const [
    { data: tournament },
    { data: matchPrimary },
  ] = await Promise.all([
    service.from('tournaments').select('*').eq('id', tournamentId).single(),
    matchQuery,
  ])

  if (!tournament) return null

  // Fallback secundario al match más reciente in_progress si no había
  // broadcast_active y no se pasó matchId explícito.
  let match: any = matchPrimary
  if (!match && !matchId) {
    const { data: inProgress } = await service.from('matches').select(matchSelect())
      .eq('tournament_id', tournamentId).eq('status', 'in_progress')
      .order('started_at', { ascending: false }).limit(1).maybeSingle()
    match = inProgress
  }

  // ── PASO 2: queries auxiliares ─────────────────────────────────────
  // En modo 'lite' (point_scored/point_undone) saltamos las queries más
  // caras: stats_by_set (replay de todos los puntos) y draw (entries +
  // todos los matches del cuadro). Esos campos salen en el JSON como []
  // y null. El receptor sigue viendo el MISMO schema en todos los eventos.
  // En modo 'full' cargamos todo en paralelo.
  const isLite = mode === 'lite'
  const wantStatsBySet = !isLite
  const wantDraw = !isLite

  let reconciledScore: any = match?.score ?? null
  let judge: any = null
  let weather: any = null
  let statsBySet: Array<any> = []
  let drawEntries: any[] = []
  let drawMatches: any[] = []

  if (match) {
    // Judge y weather siempre se cargan — son pequeños y el receptor
    // espera que estén presentes en cada push (no quiero el caso "el
    // juez aparece a null en el primer push y luego cambia").
    const judgePromise = match?.judge_id
      ? service.from('app_users')
          .select('id, full_name, email, role').eq('id', match.judge_id).single()
          .then(({ data }: any) => data ? { id: data.id, name: data.full_name, role: data.role } : null)
      : Promise.resolve(null)

    const weatherPromise = (async () => {
      try {
        const { data } = await service.from('weather_cache')
          .select('data, updated_at').eq('tournament_id', tournamentId).maybeSingle()
        return data ? (data as any).data : null
      } catch { return null }
    })()

    // Reconcile siempre — si match.score está corrupto, no queremos
    // mandar datos malos al endpoint en NINGÚN evento.
    const reconcilePromise = match.id
      ? reconcileScore(service, match.id, match.score)
      : Promise.resolve(match.score ?? null)

    // by_set y draw solo en modo full. En lite quedan vacíos en el JSON
    // pero el receptor sigue viendo las claves del schema.
    const statsBySetPromise = wantStatsBySet
      ? computeStatsBySet(service, match.id, (match.score?.sets ?? []) as Array<{ t1: number, t2: number }>)
      : Promise.resolve([])

    const drawPromise = (wantDraw && match.draw_id)
      ? Promise.all([
          service.from('draw_entries').select(`*,
            player1:players!player1_id(*),
            player2:players!player2_id(*)
          `).eq('draw_id', match.draw_id),
          service.from('matches').select(matchSelectCompact())
            .eq('draw_id', match.draw_id).order('round').order('match_number'),
        ]).then(([{ data: entries }, { data: matches }]: any) => ({
          entries: entries ?? [],
          matches: matches ?? [],
        }))
      : Promise.resolve({ entries: [], matches: [] })

    const [r, j, w, sb, draw] = await Promise.all([
      reconcilePromise, judgePromise, weatherPromise, statsBySetPromise, drawPromise,
    ])
    reconciledScore = r
    judge = j
    weather = w
    statsBySet = sb
    drawEntries = draw.entries
    drawMatches = draw.matches
  }

  if (match?.id) match.score = reconciledScore

  const meta = {
    version: PAYLOAD_VERSION,
    generated_at: new Date().toISOString(),
    tournament_id: tournamentId,
    match_id: match?.id ?? null,
    mode,
  }

  const tournamentBlock = {
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
  }

  // ── Payload único v3.0 — schema completo siempre ──────────────────
  // En lite mode by_set queda [] y draw queda null (queries más caras
  // saltadas para hot-path point_scored/point_undone). El resto del
  // JSON es siempre el mismo schema.
  return {
    meta,
    tournament: tournamentBlock,
    judge,
    match: match ? formatMatch(match, /*includeBio*/ true, statsBySet) : null,
    draw: (wantDraw && match?.draw_id) ? {
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

function formatMatch(
  m: any,
  includeBio: boolean,
  statsBySet: Array<{
    set_number: number,
    started_at: string | null,
    finished_at: string | null,
    duration_ms: number,
    t1: any,
    t2: any,
  }> = [],
) {
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
    // Stats reestructuradas:
    //  - total: acumulado del partido completo (lo que antes era match.stats)
    //  - by_set: array de stats reseteadas por set ({set_number, t1, t2})
    // by_set se computa replayando los points por set (incluye set en juego
    // con los puntos jugados hasta ahora).
    stats: m.stats ? {
      total: { t1: m.stats.t1, t2: m.stats.t2 },
      by_set: statsBySet,
    } : null,
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

/**
 * Replay de los puntos del match agrupados por set para sacar stats
 * desglosadas y timing por set. Cada set se computa de cero (no es un
 * acumulado, son las stats de ESE set en concreto). El set en juego
 * incluye solo los puntos jugados hasta ahora.
 *
 * Tiempos por set:
 *  - started_at:  created_at del primer punto del set
 *  - finished_at: created_at del último punto del set (= punto que cerró
 *                 el set). Para el set en curso queda null porque aún
 *                 no ha terminado.
 *  - duration_ms: ms entre started_at y finished_at (en el set en curso,
 *                 ms entre started_at y "ahora").
 *
 * Nota de coste: lee todos los puntos del match (ordenados por sequence).
 * En un partido típico < 200 puntos. Razonable para un push por evento.
 */
async function computeStatsBySet(
  service: any,
  matchId: string,
  matchScoreSets: Array<{ t1: number, t2: number }>,
): Promise<Array<{
  set_number: number,
  started_at: string | null,
  finished_at: string | null,
  duration_ms: number,
  t1: any,
  t2: any,
}>> {
  const { data: points } = await service
    .from('points')
    .select('set_number, server_team, winner_team, point_type, shot_direction, score_before, is_break_point, created_at')
    .eq('match_id', matchId)
    .eq('is_undone', false)
    .order('sequence', { ascending: true })

  if (!points || points.length === 0) return []

  // Para cada set acumulamos stats + primera/última marca de tiempo
  type SetAccum = {
    stats: MatchStats,
    started_at: string | null,
    last_point_at: string | null,
  }
  const bySet = new Map<number, SetAccum>()

  for (const p of points as any[]) {
    const setN = p.set_number as number
    if (setN == null) continue
    let acc = bySet.get(setN)
    if (!acc) {
      acc = { stats: emptyStats(), started_at: p.created_at ?? null, last_point_at: p.created_at ?? null }
      bySet.set(setN, acc)
    }
    acc.last_point_at = p.created_at ?? acc.last_point_at
    acc.stats = applyPointToStats(acc.stats, {
      winnerTeam: p.winner_team,
      serverTeam: p.server_team,
      pointType: p.point_type,
      shotDirection: p.shot_direction,
      scoreBefore: p.score_before,
    })
    if (p.is_break_point) {
      acc.stats = applyBreakPointStats(acc.stats, p.server_team, true, p.winner_team)
    }
  }

  // Sets cerrados = los que están en matchScoreSets. El último set
  // visto en bySet puede ser el que está en curso (sin cerrar). Para
  // los cerrados, finished_at = last_point_at. Para el en curso,
  // finished_at queda null.
  const completedSetCount = matchScoreSets.length
  const now = Date.now()

  return Array.from(bySet.entries())
    .sort(([a], [b]) => a - b)
    .map(([set_number, acc]) => {
      const isCompleted = set_number <= completedSetCount
      const startMs = acc.started_at ? new Date(acc.started_at).getTime() : 0
      const endMs = isCompleted && acc.last_point_at
        ? new Date(acc.last_point_at).getTime()
        : now
      return {
        set_number,
        started_at: acc.started_at,
        finished_at: isCompleted ? acc.last_point_at : null,
        duration_ms: startMs > 0 ? Math.max(0, endMs - startMs) : 0,
        t1: acc.stats.t1,
        t2: acc.stats.t2,
      }
    })
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
