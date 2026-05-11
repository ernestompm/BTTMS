-- Cache de datos meteorológicos por torneo.
-- Se rellena vía /api/cron/refresh-weather (Vercel cron) y se lee desde
-- el broadcast payload (lib/broadcast-payload.ts). Una fila por torneo.

CREATE TABLE IF NOT EXISTS weather_cache (
  tournament_id uuid PRIMARY KEY REFERENCES tournaments(id) ON DELETE CASCADE,
  data jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Index para refrescar todos los torneos vivos eficientemente
CREATE INDEX IF NOT EXISTS weather_cache_updated_at_idx
  ON weather_cache(updated_at DESC);

-- RLS: solo lectura para clientes; escritura solo desde service role
ALTER TABLE weather_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS weather_cache_read ON weather_cache;
CREATE POLICY weather_cache_read ON weather_cache
  FOR SELECT USING (true);
