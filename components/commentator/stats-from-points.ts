// ============================================================================
// statsFromPoints — calcula stats por equipo desde el log de puntos
// ============================================================================
// El campo match.stats es el ACUMULADO. Para tener "stats del set 1", "set 2",
// etc. tenemos que recalcular desde la tabla de puntos filtrando por
// set_number. Esta funcion lo hace una vez con todos los puntos, devuelve
// objeto compatible con el formato de match.stats.
// ============================================================================

interface TeamStats {
  total_points_won: number
  aces: number
  double_faults: number
  winners: number
  unforced_errors: number
  serve_points_total: number
  serve_points_won: number
  serve_points_won_pct: number
  return_points_total: number
  return_points_won: number
  return_points_won_pct: number
  break_points_won: number
  break_points_played_on_return: number
  break_points_faced: number
  break_points_saved: number
}

function empty(): TeamStats {
  return {
    total_points_won: 0, aces: 0, double_faults: 0, winners: 0, unforced_errors: 0,
    serve_points_total: 0, serve_points_won: 0, serve_points_won_pct: 0,
    return_points_total: 0, return_points_won: 0, return_points_won_pct: 0,
    break_points_won: 0, break_points_played_on_return: 0,
    break_points_faced: 0, break_points_saved: 0,
  }
}

export function statsFromPoints(points: any[], setNumber?: number): { t1: TeamStats, t2: TeamStats } {
  const filtered = setNumber != null
    ? points.filter(p => p.set_number === setNumber && !p.is_undone)
    : points.filter(p => !p.is_undone)

  const t1 = empty()
  const t2 = empty()
  const teams: Record<1|2, TeamStats> = { 1: t1, 2: t2 }

  for (const p of filtered) {
    const winner = p.winner_team as 1|2
    const server = p.server_team as 1|2
    const returner = (server === 1 ? 2 : 1) as 1|2
    const loser = (winner === 1 ? 2 : 1) as 1|2

    teams[winner].total_points_won++

    // Tipo de punto
    if (p.point_type === 'ace') teams[winner].aces++
    else if (p.point_type === 'double_fault') teams[server].double_faults++
    else if (p.point_type === 'winner') teams[winner].winners++
    else if (p.point_type === 'unforced_error') teams[loser].unforced_errors++

    // Saque y resto
    teams[server].serve_points_total++
    teams[returner].return_points_total++
    if (winner === server) teams[server].serve_points_won++
    else teams[returner].return_points_won++

    // Break points
    if (p.is_break_point) {
      teams[returner].break_points_played_on_return++
      teams[server].break_points_faced++
      if (winner === returner) {
        teams[returner].break_points_won++
      } else if (p.was_break_point_saved) {
        teams[server].break_points_saved++
      }
    }
  }

  // Porcentajes
  for (const tk of [1, 2] as const) {
    const t = teams[tk]
    t.serve_points_won_pct = t.serve_points_total > 0 ? (t.serve_points_won / t.serve_points_total) * 100 : 0
    t.return_points_won_pct = t.return_points_total > 0 ? (t.return_points_won / t.return_points_total) * 100 : 0
  }

  return { t1, t2 }
}
