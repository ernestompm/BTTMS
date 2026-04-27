-- ============================================================================
-- 018 - Auto-advance del ganador al siguiente partido del cuadro
-- ============================================================================
-- Cuando un partido del cuadro de eliminación termina (status = finished /
-- walkover / retired), su ganador se inyecta automáticamente como entry1
-- o entry2 del siguiente partido (según el match_number).
--
-- Pairing estándar: match N → match CEIL(N/2) de la siguiente ronda.
--   * Si N es impar  -> entry1
--   * Si N es par    -> entry2
-- (R16 m1+m2 → QF m1, R16 m3+m4 → QF m2, …)
--
-- Si el siguiente match aún no existe en la tabla, se crea con el ganador
-- ya colocado en su slot. El otro slot queda NULL hasta que su pareja
-- avance.
-- ============================================================================

CREATE OR REPLACE FUNCTION next_round_in_bracket(p_round TEXT) RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN CASE p_round
    WHEN 'R32' THEN 'R16'
    WHEN 'R16' THEN 'QF'
    WHEN 'QF'  THEN 'SF'
    WHEN 'SF'  THEN 'F'
    ELSE NULL
  END;
END $$;

CREATE OR REPLACE FUNCTION advance_match_winner(p_match_id UUID) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  v_match         RECORD;
  v_winner_entry  UUID;
  v_next_round    TEXT;
  v_next_number   INT;
  v_slot          TEXT;       -- 'entry1_id' / 'entry2_id'
  v_next_match_id UUID;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;

  IF NOT FOUND
     OR v_match.status NOT IN ('finished','walkover','retired')
     OR v_match.match_number IS NULL
     OR v_match.draw_id IS NULL THEN
    RETURN;
  END IF;

  v_next_round := next_round_in_bracket(v_match.round);
  IF v_next_round IS NULL THEN RETURN; END IF;

  -- Determinar el equipo ganador
  IF v_match.score IS NOT NULL AND v_match.score ? 'winner_team' THEN
    v_winner_entry := CASE WHEN (v_match.score->>'winner_team')::int = 1
                            THEN v_match.entry1_id ELSE v_match.entry2_id END;
  ELSIF v_match.retired_team IS NOT NULL THEN
    -- Quien NO se retira gana
    v_winner_entry := CASE WHEN v_match.retired_team = 1
                            THEN v_match.entry2_id ELSE v_match.entry1_id END;
  ELSE
    RETURN;
  END IF;

  IF v_winner_entry IS NULL THEN RETURN; END IF;

  v_next_number := CEIL(v_match.match_number::numeric / 2)::int;
  v_slot        := CASE WHEN v_match.match_number % 2 = 1 THEN 'entry1_id' ELSE 'entry2_id' END;

  -- ¿Existe ya el siguiente partido?
  SELECT id INTO v_next_match_id
    FROM matches
   WHERE draw_id      = v_match.draw_id
     AND round        = v_next_round
     AND match_number = v_next_number
   LIMIT 1;

  IF v_next_match_id IS NOT NULL THEN
    -- Solo actualizar si el slot está vacío (no machacar manualmente puesto)
    EXECUTE format(
      'UPDATE matches SET %I = COALESCE(%I, $1) WHERE id = $2',
      v_slot, v_slot
    ) USING v_winner_entry, v_next_match_id;
  ELSE
    -- Crear el siguiente partido con el ganador ya en su slot
    INSERT INTO matches (
      tournament_id, draw_id, category, round, match_number, match_type,
      status, scoring_system, net_height, forbidden_zone_serving,
      entry1_id, entry2_id
    ) VALUES (
      v_match.tournament_id, v_match.draw_id, v_match.category, v_next_round,
      v_next_number, v_match.match_type,
      'scheduled', v_match.scoring_system, v_match.net_height, v_match.forbidden_zone_serving,
      CASE WHEN v_slot = 'entry1_id' THEN v_winner_entry ELSE NULL END,
      CASE WHEN v_slot = 'entry2_id' THEN v_winner_entry ELSE NULL END
    );
  END IF;
END $$;

-- ─── TRIGGER ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_advance_winner_on_finish() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('finished','walkover','retired')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM advance_match_winner(NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_match_finish_advance ON matches;
CREATE TRIGGER trg_match_finish_advance
  AFTER UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION trg_advance_winner_on_finish();

-- ─── BACKFILL ───────────────────────────────────────────────────────────────
-- Procesa los partidos ya terminados que aún no han propagado su ganador
-- (útil cuando se aplica esta migración a un torneo en marcha).
DO $$
DECLARE m RECORD;
BEGIN
  FOR m IN
    SELECT id FROM matches
     WHERE status IN ('finished','walkover','retired')
       AND draw_id IS NOT NULL
       AND match_number IS NOT NULL
  LOOP
    PERFORM advance_match_winner(m.id);
  END LOOP;
END $$;
