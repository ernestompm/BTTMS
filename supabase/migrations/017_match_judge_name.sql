-- ============================================================================
-- 017 - matches.judge_name (identificación del árbitro por partido)
-- ============================================================================
-- El usuario "juez" de app_users suele ser un usuario GENÉRICO compartido
-- por varios árbitros físicos. Necesitamos que cada árbitro se identifique
-- con nombre y apellidos al iniciar su partido. Ese nombre queda asociado
-- al partido concreto (no al usuario) y es el que se muestra en el gráfico
-- "referee lower third" y en la firma del acta.
-- ============================================================================

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS judge_name TEXT;
