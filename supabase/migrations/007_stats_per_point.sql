-- Store match stats snapshot per point so that undo can restore them accurately
ALTER TABLE points ADD COLUMN IF NOT EXISTS stats_after jsonb;
