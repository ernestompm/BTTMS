-- Add warnings JSONB column to matches for Code of Conduct tracking (RFET 2026 Rule 27f-g)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS warnings jsonb DEFAULT '{"t1":[],"t2":[]}'::jsonb;
