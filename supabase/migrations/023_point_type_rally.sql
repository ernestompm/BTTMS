-- ============================================================================
-- 023 - Amplía el CHECK constraint de points.point_type para incluir 'rally'
-- ============================================================================
-- Bug detectado: el schema original (001_schema.sql) define
--   CHECK (point_type IN ('ace','winner','unforced_error','forced_error',
--                          'double_fault','serve_fault','let_replay','correction'))
--
-- pero el código TypeScript (types/index.ts) usa también:
--   - 'rally'         (default cuando el árbitro pulsa el botón sin clasificar)
--   - 'forbidden_zone'
--   - 'foot_fault'
--
-- Cualquier INSERT con esos valores devuelve error 23514 y el punto NO se
-- persiste. Como el route handler hacía Promise.all sin comprobar el
-- resultado del INSERT, la app aparentaba funcionar (el match.score se
-- actualizaba en memoria + UPDATE), pero la fila del punto nunca entraba
-- a la tabla. Síntomas visibles:
--   - El undo dice "No hay puntos para deshacer" aunque el marcador
--     muestre puntos jugados.
--   - El log de puntos del CIS / Singular sale vacío.
--   - Las stats por set no se calculan (statsFromPoints lee de points).
-- ============================================================================

ALTER TABLE points DROP CONSTRAINT IF EXISTS points_point_type_check;

ALTER TABLE points ADD CONSTRAINT points_point_type_check
  CHECK (point_type IN (
    'rally',
    'ace',
    'winner',
    'unforced_error',
    'forced_error',
    'double_fault',
    'serve_fault',
    'forbidden_zone',
    'foot_fault',
    'let_replay',
    'correction'
  ));
