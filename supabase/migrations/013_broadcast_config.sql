-- Broadcast endpoint can now be either POST or PUT, plus custom headers
-- (vMix/CasparCG/OBS integrations sometimes require Authorization: Bearer …
-- or a webhook-specific token header). Defaults keep existing installs
-- on POST behavior.

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS broadcast_method text
    DEFAULT 'POST'
    CHECK (broadcast_method IN ('POST', 'PUT'));

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS broadcast_headers jsonb
    DEFAULT '{}'::jsonb;
