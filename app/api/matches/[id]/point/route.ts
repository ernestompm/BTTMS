import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { applyPoint, INITIAL_SCORE, isBreakPoint, isSetPoint, isMatchPoint, isTBSideChange, isSuperTBSideChange } from '@/lib/score-engine'
import { applyPointToStats, applyBreakPointStats, emptyStats } from '@/lib/stats-engine'
import { pushBroadcastEvent } from '@/lib/broadcast-push'
import { advanceWinnerToNextRound } from '@/lib/bracket-advance'
import { MATCH_FULL_SELECT } from '@/lib/queries'
import type { Score, PointType, ShotDirection, ScoringSystem } from '@/types'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = await params
  const supabase = await createServerSupabase()
  const service = createServiceSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: appUser } = await supabase.from('app_users').select('role').eq('id', user.id).single()
  if (!appUser) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 403 })

  // Cargamos el match CON joins (court, entry1, entry2, players) en una
  // sola query — el push del broadcast reusa estos joins en memoria
  // y se ahorra su propio SELECT, recortando ~150ms de latencia.
  const { data: match } = await service.from('matches').select(MATCH_FULL_SELECT).eq('id', matchId).single()
  if (!match) return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 })
  if (match.status !== 'in_progress') return NextResponse.json({ error: 'El partido no está en juego' }, { status: 400 })

  if (appUser.role === 'judge' && match.judge_id !== user.id) {
    return NextResponse.json({ error: 'No es tu partido' }, { status: 403 })
  }

  const body = await req.json()
  const { winner_team, point_type, shot_direction }: {
    winner_team: 1 | 2; point_type: PointType; shot_direction: ShotDirection | null
  } = body

  if (!winner_team || !point_type) {
    return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
  }

  const scoreBefore: Score = match.score ?? INITIAL_SCORE((match.scoring_system ?? 'best_of_2_sets_super_tb') as ScoringSystem)
  const serverTeam: 1 | 2 = match.serving_team ?? winner_team

  // Check break point BEFORE applying the point
  const wasBreakPoint = isBreakPoint(scoreBefore, serverTeam)

  const scoreAfter = applyPoint(scoreBefore, winner_team)

  // Update stats
  let statsAfter = applyPointToStats(match.stats ?? emptyStats(), {
    winnerTeam: winner_team,
    serverTeam,
    pointType: point_type,
    shotDirection: shot_direction,
    scoreBefore,
  })

  // Wire break point stats
  if (wasBreakPoint) {
    statsAfter = applyBreakPointStats(statsAfter, serverTeam, true, winner_team)
  }

  // Sequence: use MAX to be more reliable than COUNT under concurrent writes
  const { data: maxRow } = await service
    .from('points')
    .select('sequence')
    .eq('match_id', matchId)
    .eq('is_undone', false)
    .order('sequence', { ascending: false })
    .limit(1)
    .single()

  const sequence = ((maxRow as any)?.sequence ?? 0) + 1

  // Derive set/game context for the point log
  const setNumber = (scoreBefore.sets?.length ?? 0) + 1
  const isTB = scoreBefore.tiebreak_active || scoreBefore.super_tiebreak_active
  const gameNumber = isTB
    ? -1  // tiebreak points are not numbered like regular games
    : (scoreBefore.current_set?.t1 ?? 0) + (scoreBefore.current_set?.t2 ?? 0) + 1

  // El insert del point lo lanzamos pero NO esperamos aún — se ejecuta
  // en paralelo con el update del match y el push de broadcast. Más
  // abajo hacemos await del Promise.all para mantener la semántica.
  const insertPointPromise = service.from('points').insert({
    match_id: matchId,
    sequence,
    set_number: setNumber,
    game_number: gameNumber,
    server_team: serverTeam,
    server_player_id: match.current_server_id,
    winner_team,
    winner_player_id: null,
    point_type,
    shot_direction: shot_direction ?? null,
    fault_type: null,
    is_break_point: wasBreakPoint,
    is_game_point: false,
    is_set_point: false,
    is_match_point: false,
    was_break_point_saved: wasBreakPoint && winner_team === serverTeam,
    score_before: scoreBefore,
    score_after: scoreAfter,
    stats_after: statsAfter,
    judge_id: user.id,
    is_undone: false,
  })

  // Determine next serving team (alternates on game change)
  let nextServingTeam: 1 | 2 = serverTeam
  const setChanged = (scoreAfter.sets?.length ?? 0) > (scoreBefore.sets?.length ?? 0)
  const gameChanged =
    scoreAfter.current_set?.t1 !== scoreBefore.current_set?.t1 ||
    scoreAfter.current_set?.t2 !== scoreBefore.current_set?.t2 ||
    setChanged ||
    (scoreAfter.super_tiebreak_active && !scoreBefore.super_tiebreak_active)

  if (gameChanged) {
    nextServingTeam = serverTeam === 1 ? 2 : 1
  }

  const matchFinished = scoreAfter.match_status === 'finished'

  // --- Build _context for judge notifications and broadcast ---
  let sideChange = false
  if (setChanged) {
    sideChange = true
  } else if (scoreAfter.tiebreak_active) {
    sideChange = isTBSideChange(scoreAfter.tiebreak_score)
  } else if (scoreAfter.super_tiebreak_active) {
    sideChange = isSuperTBSideChange(scoreAfter.tiebreak_score)
  } else if (gameChanged) {
    const totalGamesAfter = (scoreAfter.current_set?.t1 ?? 0) + (scoreAfter.current_set?.t2 ?? 0)
    sideChange = totalGamesAfter % 2 === 1
  }

  const notFinished = !matchFinished
  const _context = {
    golden_point:         notFinished && (scoreAfter.deuce === true),
    break_point:          notFinished && isBreakPoint(scoreAfter, nextServingTeam),
    set_point_t1:         notFinished && isSetPoint(scoreAfter, 1),
    set_point_t2:         notFinished && isSetPoint(scoreAfter, 2),
    match_point_t1:       isMatchPoint(scoreAfter, 1),
    match_point_t2:       isMatchPoint(scoreAfter, 2),
    serving_team_changed: gameChanged,
    new_serving_team:     nextServingTeam,
    side_change:          sideChange,
    new_set:              setChanged,
    new_tb:               scoreAfter.tiebreak_active && !scoreBefore.tiebreak_active,
    new_super_tb:         scoreAfter.super_tiebreak_active && !scoreBefore.super_tiebreak_active,
    match_finished:       matchFinished,
  }

  // ── DISPARO PARALELO: broadcast push + escrituras BBDD ─────────────
  // El push usa los datos YA calculados en memoria (scoreAfter,
  // statsAfter, _context, match con joins) — NO necesita esperar a
  // que Supabase confirme la escritura. Por eso lo lanzamos en
  // paralelo con el UPDATE: Singular recibe el JSON al mismo tiempo
  // que la BBDD persiste el cambio, no después.
  //
  // Ahorro de latencia: ~250ms (el tiempo que tardaba el UPDATE en
  // completar antes de empezar el push).
  if (match.broadcast_active) {
    const eventName = matchFinished ? 'match_finished' : 'point_scored'
    // Construimos el match "predicho" con los joins originales + score nuevo
    const predictedMatch = {
      ...match,
      score: scoreAfter,
      stats: statsAfter,
      serving_team: nextServingTeam,
      status: matchFinished ? 'finished' : 'in_progress',
      finished_at: matchFinished ? new Date().toISOString() : null,
    }
    pushBroadcastEvent(match.tournament_id, matchId, eventName, _context, { preBuiltMatch: predictedMatch })
  }

  // Esperamos las dos escrituras a BBDD en paralelo. El push de
  // broadcast ya viaja por su cuenta vía waitUntil.
  const updatePromise = service.from('matches').update({
    score: scoreAfter,
    stats: statsAfter,
    serving_team: nextServingTeam,
    status: matchFinished ? 'finished' : 'in_progress',
    finished_at: matchFinished ? new Date().toISOString() : null,
  }).eq('id', matchId).select('*').single()

  const [pointResult, { data: updatedMatch }] = await Promise.all([
    insertPointPromise,
    updatePromise,
  ])

  // ── Comprobación crítica del INSERT del punto ──
  // Si el INSERT falla (por ejemplo, un CHECK constraint que no incluye un
  // point_type nuevo, o cualquier otra violación) y NO se comprueba el
  // error, la app aparentaba funcionar: el match.score y match.stats se
  // actualizaban pero la fila en points nunca se persistía. Eso rompe:
  //   - undo (no encuentra punto que marcar)
  //   - log de puntos (Singular y CIS leen de points)
  //   - stats por set (statsFromPoints recorre points)
  //
  // Si pointResult tiene error, devolvemos 500 con detalle para que se
  // vea inmediatamente en la consola del navegador del árbitro y en
  // los logs de Vercel.
  if ((pointResult as any)?.error) {
    const err = (pointResult as any).error
    console.error('points INSERT failed', err)
    return NextResponse.json({
      error: `No se pudo guardar el punto: ${err.message ?? 'error de BD'}`,
      code: err.code,
      hint: err.code === '23514'
        ? 'CHECK constraint violado. Revisa point_type permitidos (migración 023).'
        : undefined,
    }, { status: 500 })
  }

  // Auto-advance del ganador al siguiente partido del cuadro cuando este
  // punto cierra el match (independiente del trigger SQL 018).
  if (matchFinished && updatedMatch) {
    try { await advanceWinnerToNextRound(service, matchId) } catch (e) { console.error('advance failed', e) }
  }

  return NextResponse.json({ ...updatedMatch, _context })
}
