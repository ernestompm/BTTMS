-- Add advanced_stats_enabled flag to tournaments
-- When false: referees skip the point classification modal entirely
-- When true: a non-blocking classification panel appears after each point

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS advanced_stats_enabled boolean NOT NULL DEFAULT true;
