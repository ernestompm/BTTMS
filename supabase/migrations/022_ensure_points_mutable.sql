-- ============================================================================
-- 022 - Asegura que la tabla points es mutable (DROP append-only rules)
-- ============================================================================
-- El schema original (001_schema.sql) creó dos rules:
--   - no_update_points: ON UPDATE TO points DO INSTEAD NOTHING
--   - no_delete_points: ON DELETE TO points DO INSTEAD NOTHING
--
-- Esto rompe en silencio:
--   - /api/matches/[id]/undo (intenta hacer UPDATE points SET is_undone=true)
--   - /api/matches/[id]/classify-point (UPDATE point_type)
--   - reset/delete de matches (cascada bloqueada)
--
-- La migración 005_fixes.sql ya hacía DROP RULE, pero si no se aplicó (BD
-- desplegada solo con 001) los endpoints fallan SIN error visible — el
-- cliente recibe la respuesta normal pero el cambio no se persiste.
--
-- Esta migración es idempotente y defensiva: la pongo aparte para que
-- quede claro en el historial y no se pierda en futuros wipes.
-- ============================================================================

DROP RULE IF EXISTS no_update_points ON points;
DROP RULE IF EXISTS no_delete_points ON points;

-- Verificación: si alguna queda, devuelve error para que se vea en logs.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_rules WHERE schemaname = 'public' AND tablename = 'points'
      AND rulename IN ('no_update_points', 'no_delete_points')
  ) THEN
    RAISE EXCEPTION 'Append-only rules todavía presentes en points — el undo no funcionará';
  END IF;
END $$;
