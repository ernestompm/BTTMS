-- ───────────────────────────────────────────────────────────────────
-- Match close: judge signature (base64 data URL), notes, signed_at.
-- The chair umpire signs on the tablet when closing the match; the
-- signature is stored inline as a small PNG data URL (typical < 25 KB).
-- ───────────────────────────────────────────────────────────────────
ALTER TABLE matches ADD COLUMN IF NOT EXISTS judge_signature_url text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS judge_notes          text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS signed_at             timestamptz;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS signed_by             uuid REFERENCES app_users(id);

-- ───────────────────────────────────────────────────────────────────
-- Broadcast delivery log. Every push attempt (success or failure)
-- leaves a row here so the operator can audit what was sent, when,
-- and whether the downstream graphics server acked it.
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS broadcast_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id  uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  match_id       uuid REFERENCES matches(id) ON DELETE SET NULL,
  event          text NOT NULL,
  endpoint       text NOT NULL,
  method         text NOT NULL,
  status         integer,
  ok             boolean NOT NULL DEFAULT false,
  error          text,
  retries        integer NOT NULL DEFAULT 0,
  payload_bytes  integer,
  duration_ms    integer,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_logs_created
  ON broadcast_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcast_logs_tournament_created
  ON broadcast_logs (tournament_id, created_at DESC);

-- RLS: readable by any authenticated staff, writable only via service role
ALTER TABLE broadcast_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS broadcast_logs_read ON broadcast_logs;
CREATE POLICY broadcast_logs_read ON broadcast_logs FOR SELECT
  TO authenticated USING (true);
