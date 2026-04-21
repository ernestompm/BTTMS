-- ============================================================================
-- 016 - Stream preview bus + API helpers
-- ============================================================================
-- 1. Añade una columna `preview_graphics` JSONB a stream_state para que el
--    operador pueda emitir a un "PGM de PREVIEW" consumible via URL externa
--    (vMix input separado) o via API (Stream Deck).
-- 2. Expone RPCs stream_patch_preview / stream_clear_preview.
-- 3. Expone una RPC stream_take_preview: copia preview -> program atomically.
-- 4. Re-habilita realtime sobre la nueva columna.
-- ============================================================================

ALTER TABLE stream_state
  ADD COLUMN IF NOT EXISTS preview_graphics JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Patch atómico de preview_graphics.<key>
CREATE OR REPLACE FUNCTION stream_patch_preview(
  p_session_id UUID,
  p_key TEXT,
  p_patch JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_merged JSONB;
BEGIN
  UPDATE stream_state
     SET preview_graphics = jsonb_set(
        COALESCE(preview_graphics, '{}'::jsonb),
        ARRAY[p_key],
        COALESCE(preview_graphics->p_key, '{}'::jsonb) || p_patch || jsonb_build_object('since', to_jsonb(NOW()::text)),
        true
     )
   WHERE session_id = p_session_id
   RETURNING preview_graphics INTO v_merged;
  RETURN v_merged;
END $$;

-- Vaciar preview por completo
CREATE OR REPLACE FUNCTION stream_clear_preview(p_session_id UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE stream_state SET preview_graphics = '{}'::jsonb WHERE session_id = p_session_id;
END $$;

-- TAKE atómico: mueve todas las visibles del preview al programa y limpia
-- preview. El programa mantiene las visibles que ya tuviera; cualquier
-- clave marcada visible en preview se convierte en visible en programa
-- con su data (replazando).
CREATE OR REPLACE FUNCTION stream_take_preview(p_session_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_graphics JSONB; v_preview JSONB; v_key TEXT;
BEGIN
  SELECT graphics, preview_graphics INTO v_graphics, v_preview
    FROM stream_state WHERE session_id = p_session_id;
  IF v_preview IS NULL THEN RETURN v_graphics; END IF;
  FOR v_key IN SELECT jsonb_object_keys(v_preview) LOOP
    IF (v_preview->v_key->>'visible')::boolean THEN
      v_graphics := jsonb_set(
        COALESCE(v_graphics, '{}'::jsonb),
        ARRAY[v_key],
        (v_preview->v_key) || jsonb_build_object('since', to_jsonb(NOW()::text)),
        true
      );
    END IF;
  END LOOP;
  UPDATE stream_state SET graphics = v_graphics, preview_graphics = '{}'::jsonb
   WHERE session_id = p_session_id;
  RETURN v_graphics;
END $$;

-- RLS: preview se lee público igual que graphics (overlays anónimos)
-- La columna está dentro de stream_state así que hereda sus policies.

-- Realtime: la tabla ya estaba publicada en la migración 015. Los UPDATE
-- emiten el row entero (incluye la nueva columna). Nada más que hacer.

-- ============================================================================
-- END migration 016
-- ============================================================================
