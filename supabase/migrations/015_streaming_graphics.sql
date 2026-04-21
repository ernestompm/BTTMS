-- ============================================================================
-- 015 - Streaming Graphics Engine (vMix alpha overlays)
-- ============================================================================
-- Introduces a complete TV-grade graphics layer over matches:
--   * stream_sessions    — per-match streaming session (toggleable)
--   * stream_state       — live graphics state (realtime updated by operator)
--   * stream_automation_rules — per-tournament rule engine (event -> actions)
--   * stream_events      — audit log of automation + manual commands
--
-- Communication model:
--   operator UI (PATCH stream_state.graphics)
--        ↓  Supabase Realtime (postgres_changes)
--   overlay page (renders alpha-channel SVG/HTML)
--
-- One session per match => one overlay URL per match (parallel streams OK).
-- ============================================================================

-- ─── SESSIONS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stream_sessions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id      UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  match_id           UUID NOT NULL REFERENCES matches(id)      ON DELETE CASCADE,
  active             BOOLEAN     NOT NULL DEFAULT true,
  automation_enabled BOOLEAN     NOT NULL DEFAULT false,
  operator_notes     TEXT,
  created_by         UUID REFERENCES auth.users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id)
);
CREATE INDEX IF NOT EXISTS idx_stream_sessions_tournament ON stream_sessions(tournament_id);
CREATE INDEX IF NOT EXISTS idx_stream_sessions_active     ON stream_sessions(active) WHERE active;

-- ─── LIVE STATE ────────────────────────────────────────────────────────────
-- graphics shape:
--   { "<graphic_key>": { "visible": bool, "data": jsonb, "since": iso } }
-- Keys in sync with lib/streaming/catalog.ts GRAPHICS.
CREATE TABLE IF NOT EXISTS stream_state (
  session_id  UUID PRIMARY KEY REFERENCES stream_sessions(id) ON DELETE CASCADE,
  graphics    JSONB NOT NULL DEFAULT '{}'::jsonb,
  theme       JSONB,                  -- per-session theme override (skin, accents)
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES auth.users(id)
);

-- ─── AUTOMATION RULES ──────────────────────────────────────────────────────
-- trigger_type examples:
--   'match_status:warmup', 'match_status:in_progress', 'match_status:finished'
--   'game_end', 'set_end', 'match_end', 'toss_set', 'first_point'
-- actions: ordered array of { type:'show'|'hide'|'toggle', graphic, delay_ms, hold_ms?, data? }
CREATE TABLE IF NOT EXISTS stream_automation_rules (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id  UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  trigger_type   TEXT NOT NULL,
  actions        JSONB NOT NULL,
  enabled        BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stream_rules_tournament ON stream_automation_rules(tournament_id, trigger_type) WHERE enabled;

-- ─── EVENT LOG ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stream_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES stream_sessions(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,     -- 'manual_show','manual_hide','auto_trigger','auto_action','error'
  graphic     TEXT,
  payload     JSONB,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stream_events_session ON stream_events(session_id, created_at DESC);

-- ─── TOUCH TRIGGERS ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_stream_session() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stream_session_touch ON stream_sessions;
CREATE TRIGGER trg_stream_session_touch BEFORE UPDATE ON stream_sessions
FOR EACH ROW EXECUTE FUNCTION touch_stream_session();

CREATE OR REPLACE FUNCTION touch_stream_state() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stream_state_touch ON stream_state;
CREATE TRIGGER trg_stream_state_touch BEFORE UPDATE ON stream_state
FOR EACH ROW EXECUTE FUNCTION touch_stream_state();

-- ─── AUTO-CREATE state row on session insert ──────────────────────────────
CREATE OR REPLACE FUNCTION init_stream_state() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO stream_state (session_id, graphics)
  VALUES (NEW.id, '{}'::jsonb)
  ON CONFLICT (session_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stream_session_init ON stream_sessions;
CREATE TRIGGER trg_stream_session_init AFTER INSERT ON stream_sessions
FOR EACH ROW EXECUTE FUNCTION init_stream_state();

-- ─── REALTIME ──────────────────────────────────────────────────────────────
-- Add tables to supabase_realtime publication (guarded)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'stream_state'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE stream_state';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'stream_sessions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE stream_sessions';
  END IF;
END $$;

-- ─── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE stream_sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_state             ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_automation_rules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_events            ENABLE ROW LEVEL SECURITY;

-- Overlay pages are public (read-only) so vMix / browser without session auth can render.
DROP POLICY IF EXISTS stream_sessions_read_public ON stream_sessions;
CREATE POLICY stream_sessions_read_public ON stream_sessions FOR SELECT USING (true);

DROP POLICY IF EXISTS stream_state_read_public ON stream_state;
CREATE POLICY stream_state_read_public ON stream_state FOR SELECT USING (true);

DROP POLICY IF EXISTS stream_rules_read_public ON stream_automation_rules;
CREATE POLICY stream_rules_read_public ON stream_automation_rules FOR SELECT USING (true);

-- Writes restricted to authenticated staff (super_admin, tournament_director, staff, judge).
DROP POLICY IF EXISTS stream_sessions_write_staff ON stream_sessions;
CREATE POLICY stream_sessions_write_staff ON stream_sessions
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app_users u WHERE u.id = auth.uid() AND u.role IN ('super_admin','tournament_director','staff','judge'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM app_users u WHERE u.id = auth.uid() AND u.role IN ('super_admin','tournament_director','staff','judge'))
  );

DROP POLICY IF EXISTS stream_state_write_staff ON stream_state;
CREATE POLICY stream_state_write_staff ON stream_state
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app_users u WHERE u.id = auth.uid() AND u.role IN ('super_admin','tournament_director','staff','judge'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM app_users u WHERE u.id = auth.uid() AND u.role IN ('super_admin','tournament_director','staff','judge'))
  );

DROP POLICY IF EXISTS stream_rules_write_admin ON stream_automation_rules;
CREATE POLICY stream_rules_write_admin ON stream_automation_rules
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app_users u WHERE u.id = auth.uid() AND u.role IN ('super_admin','tournament_director'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM app_users u WHERE u.id = auth.uid() AND u.role IN ('super_admin','tournament_director'))
  );

DROP POLICY IF EXISTS stream_events_read_public ON stream_events;
CREATE POLICY stream_events_read_public ON stream_events FOR SELECT USING (true);

DROP POLICY IF EXISTS stream_events_insert_staff ON stream_events;
CREATE POLICY stream_events_insert_staff ON stream_events
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM app_users u WHERE u.id = auth.uid() AND u.role IN ('super_admin','tournament_director','staff','judge'))
  );

-- ─── CONVENIENCE RPC ───────────────────────────────────────────────────────
-- Atomically patch the graphics JSON (merge + bump timestamp) to avoid races.
CREATE OR REPLACE FUNCTION stream_patch_graphic(
  p_session_id UUID,
  p_key TEXT,
  p_patch JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_merged JSONB;
BEGIN
  UPDATE stream_state
     SET graphics = jsonb_set(
        COALESCE(graphics, '{}'::jsonb),
        ARRAY[p_key],
        COALESCE(graphics->p_key, '{}'::jsonb) || p_patch || jsonb_build_object('since', to_jsonb(NOW()::text)),
        true
     )
   WHERE session_id = p_session_id
   RETURNING graphics INTO v_merged;
  RETURN v_merged;
END $$;

-- Hide-all convenience
CREATE OR REPLACE FUNCTION stream_hide_all(p_session_id UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE k TEXT; g JSONB;
BEGIN
  SELECT graphics INTO g FROM stream_state WHERE session_id = p_session_id;
  IF g IS NULL THEN RETURN; END IF;
  FOR k IN SELECT jsonb_object_keys(g) LOOP
    g := jsonb_set(g, ARRAY[k,'visible'], 'false'::jsonb, true);
  END LOOP;
  UPDATE stream_state SET graphics = g WHERE session_id = p_session_id;
END $$;

-- ─── DEFAULT AUTOMATION PRESETS per tournament (seed on tournament create) ─
CREATE OR REPLACE FUNCTION seed_default_stream_rules(p_tournament_id UUID) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO stream_automation_rules (tournament_id, name, trigger_type, actions, enabled) VALUES
  (p_tournament_id, 'Árbitro en pista → Lower third árbitro', 'match_status:judge_on_court',
     '[{"type":"show","graphic":"referee_lower_third","delay_ms":500,"hold_ms":8000},
       {"type":"hide","graphic":"referee_lower_third","delay_ms":8500}]'::jsonb, true),
  (p_tournament_id, 'Calentamiento → Presentación partido', 'match_status:warmup',
     '[{"type":"show","graphic":"match_presentation","delay_ms":0,"hold_ms":12000},
       {"type":"hide","graphic":"match_presentation","delay_ms":12000}]'::jsonb, true),
  (p_tournament_id, 'Sorteo registrado → Coin toss', 'toss_set',
     '[{"type":"show","graphic":"coin_toss","delay_ms":200,"hold_ms":7000},
       {"type":"hide","graphic":"coin_toss","delay_ms":7200}]'::jsonb, true),
  (p_tournament_id, 'Partido en juego → Scorebug persistente', 'match_status:in_progress',
     '[{"type":"show","graphic":"scorebug","delay_ms":0}]'::jsonb, true),
  (p_tournament_id, 'Fin de juego → flash big scoreboard', 'game_end',
     '[{"type":"show","graphic":"big_scoreboard","delay_ms":2000,"hold_ms":10000},
       {"type":"hide","graphic":"big_scoreboard","delay_ms":12000}]'::jsonb, true),
  (p_tournament_id, 'Fin de set → Estadísticas', 'set_end',
     '[{"type":"hide","graphic":"scorebug","delay_ms":0},
       {"type":"show","graphic":"stats_panel","delay_ms":1500,"hold_ms":15000},
       {"type":"hide","graphic":"stats_panel","delay_ms":16500},
       {"type":"show","graphic":"scorebug","delay_ms":17000}]'::jsonb, true),
  (p_tournament_id, 'Fin de partido → Marcador final + stats totales', 'match_end',
     '[{"type":"hide","graphic":"scorebug","delay_ms":0},
       {"type":"show","graphic":"big_scoreboard","delay_ms":1000,"hold_ms":20000},
       {"type":"show","graphic":"stats_panel","delay_ms":4000,"data":{"scope":"match"},"hold_ms":17000}]'::jsonb, true)
  ON CONFLICT DO NOTHING;
END $$;

-- Seed for existing tournament (default one)
SELECT seed_default_stream_rules(id) FROM tournaments;

-- ============================================================================
-- END migration 015
-- ============================================================================
