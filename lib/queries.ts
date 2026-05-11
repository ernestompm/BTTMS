/**
 * Selectores SQL canónicos para queries repetidas.
 * Antes el mismo SELECT(*) con joins se duplicaba en 6+ archivos
 * (matches list, schedule, judge, commentator, match detail, stats).
 * Si cambia el esquema en algún join, solo hay un sitio que tocar.
 */

/** Select completo de un match con court + entries + jugadores. */
export const MATCH_FULL_SELECT = `
  *,
  court:courts(*),
  judge:app_users!judge_id(id, full_name),
  entry1:draw_entries!entry1_id(
    *,
    player1:players!player1_id(*),
    player2:players!player2_id(*)
  ),
  entry2:draw_entries!entry2_id(
    *,
    player1:players!player1_id(*),
    player2:players!player2_id(*)
  )
`

/** Select más ligero para listas (matches list, schedule, judge). */
export const MATCH_LIST_SELECT = `
  *,
  court:courts(name),
  entry1:draw_entries!entry1_id(
    player1:players!player1_id(first_name, last_name, nationality),
    player2:players!player2_id(first_name, last_name, nationality)
  ),
  entry2:draw_entries!entry2_id(
    player1:players!player1_id(first_name, last_name, nationality),
    player2:players!player2_id(first_name, last_name, nationality)
  )
`

/** Select mínimo cuando solo se necesita el resultado y estados. */
export const MATCH_COMPACT_SELECT = `
  id, status, category, round, match_number, scheduled_at, started_at, finished_at,
  score, draw_id,
  entry1:draw_entries!entry1_id(
    id, seed,
    player1:players!player1_id(id, first_name, last_name, nationality),
    player2:players!player2_id(id, first_name, last_name, nationality)
  ),
  entry2:draw_entries!entry2_id(
    id, seed,
    player1:players!player1_id(id, first_name, last_name, nationality),
    player2:players!player2_id(id, first_name, last_name, nationality)
  )
`

/** Draw entry con ambos jugadores completos. */
export const DRAW_ENTRY_FULL_SELECT = `
  *,
  player1:players!player1_id(*),
  player2:players!player2_id(*)
`

/** Player select sin campos sensibles (para listas públicas si las hubiera). */
export const PLAYER_PUBLIC_SELECT = 'id, first_name, last_name, nationality, photo_url, ranking_rfet, ranking_itf'
