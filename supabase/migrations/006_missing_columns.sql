-- BTTMS v2.0 - Columnas faltantes en players y draws
-- Ejecutar en Supabase SQL Editor

-- Columnas del modelo Player que el formulario escribe pero no existían en el schema
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS age_manual integer,
  ADD COLUMN IF NOT EXISTS club text,
  ADD COLUMN IF NOT EXISTS federacion_autonomica text;

-- Columna match_type en draws (ya existe en matches, pero faltaba en draws)
ALTER TABLE draws
  ADD COLUMN IF NOT EXISTS match_type text DEFAULT 'doubles'
  CHECK (match_type IN ('singles', 'doubles'));
