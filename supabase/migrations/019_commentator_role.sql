-- ============================================================================
-- 019 — Añadir rol 'commentator' (comentarista de TV/streaming)
-- ============================================================================
-- Acceso de solo-lectura a partidos para producir comentario en directo:
-- listado de partidos, panel CIS con stats, biografias, cuadro, resultados
-- y sugerencias de comentario asistidas por IA.
-- ============================================================================

-- Drop and recreate the role check constraint to add 'commentator'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'app_users_role_check'
      AND table_name = 'app_users'
  ) THEN
    ALTER TABLE app_users DROP CONSTRAINT app_users_role_check;
  END IF;
END $$;

ALTER TABLE app_users
  ADD CONSTRAINT app_users_role_check
  CHECK (role IN ('super_admin','tournament_director','staff','judge','commentator'));
