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

  // ── BLOQUE EN MEMORIA: cálculo de TODO el estado nuevo sin tocar BBDD ─
  // Esto se hace ANTES de cualquier query para que el push pueda salir
  // hacia Singular Live lo antes posible.

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

  // ── DISPARO INMEDIATO del push a Singular ──────────────────────────
  // Sale ANTES de queries de BBDD (sequence, insert, update).
  // El receptor recibe el JSON al instante; las escrituras a BBDD
  // viajan en paralelo y se completan después.
  if (match.broadcast_active) {
    const eventName = matchFinished ? 'match_finished' : 'point_scored'
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

  // ── Escrituras a BBDD en paralelo (después del push) ────────────────
  // Sequence query → insert point → update match. El update no depende
  // del insert para empezar, pero ambos van en paralelo.
  const setNumber = (scoreBefore.sets?.length ?? 0) + 1
  const isTB = scoreBefore.tiebreak_active || scoreBefore.super_tiebreak_active
  const gameNumber = isTB
    ? -1
    : (scoreBefore.current_set?.t1 ?? 0) + (scoreBefore.current_set?.t2 ?? 0) + 1

  // Insert se hace tras conocer la sequence — encadenado.
  const insertPointPromise = (async () => {
    const { data: maxRow } = await service
      .from('points')
      .select('sequence')
      .eq('match_id', matchId)
      .eq('is_undone', false)
      .order('sequence', { ascending: false })
      .limit(1)
      .single()
    const sequence = ((maxRow as any)?.sequence ?? 0) + 1
    return service.from('points').insert({
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
  })()

  // Update del match — independiente del insert. Va en paralelo.
  const updatePromise = service.from('matches').update({
    score: scoreAfter,
    stats: statsAfter,
    serving_team: nextServingTeam,
    status: matchFinished ? 'finished' : 'in_progress',
    finished_at: matchFinished ? new Date().toISOString() : null,
  }).eq('id', matchId).select('*').single()

  const [_pointResult, { data: updatedMatch }] = await Promise.all([
    insertPointPromise,
    updatePromise,
  ])

  // Auto-advance del ganador al siguiente partido del cuadro cuando este
  // punto cierra el match (independiente del trigger SQL 018).
  if (matchFinished && updatedMatch) {
    try { await advanceWinnerToNextRound(service, matchId) } catch (e) { console.error('advance failed', e) }
  }

  return NextResponse.json({ ...updatedMatch, _context })
}
