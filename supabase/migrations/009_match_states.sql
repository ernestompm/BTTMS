-- Match lifecycle states + configurable timers
-- New match flow: scheduled → judge_on_court → players_on_court → warmup → in_progress → finished/retired

-- 1. Extend match status constraint
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_status_check;
ALTER TABLE matches ADD CONSTRAINT matches_status_check
  CHECK (status IN (
    'scheduled','judge_on_court','players_on_court','warmup',
    'in_progress','finished','suspended','walkover','bye','retired'
  ));

-- 2. Timestamp columns for each lifecycle event
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS judge_on_court_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS players_on_court_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS warmup_started_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retired_team        INTEGER CHECK (retired_team IN (1,2)),
  ADD COLUMN IF NOT EXISTS retire_reason       TEXT;

-- 3. Tournament-level configurable timer durations (seconds)
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS warmup_duration_seconds       INTEGER NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS side_change_duration_seconds  INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS set_break_duration_seconds    INTEGER NOT NULL DEFAULT 90;
