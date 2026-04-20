-- ── Fix: ensure player-photos storage bucket exists and has correct policies ──
-- Root cause of photo upload failures: bucket missing or no RLS policies.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'player-photos',
  'player-photos',
  true,
  5242880,   -- 5 MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop old policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "player_photos_public_read"  ON storage.objects;
DROP POLICY IF EXISTS "player_photos_auth_insert"  ON storage.objects;
DROP POLICY IF EXISTS "player_photos_auth_update"  ON storage.objects;
DROP POLICY IF EXISTS "player_photos_auth_delete"  ON storage.objects;

-- Public read (scoreboard, profiles)
CREATE POLICY "player_photos_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'player-photos');

-- Authenticated users (staff) can upload and replace
CREATE POLICY "player_photos_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'player-photos' AND auth.role() = 'authenticated');

CREATE POLICY "player_photos_auth_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'player-photos' AND auth.role() = 'authenticated');

-- Service role can always write (used by player invite API)
CREATE POLICY "player_photos_service_all" ON storage.objects
  FOR ALL USING (bucket_id = 'player-photos' AND auth.role() = 'service_role');

-- ── Player invite tokens (24-hour self-service profile links) ──────────────

CREATE TABLE IF NOT EXISTS player_invite_tokens (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id  uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  token      text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE player_invite_tokens ENABLE ROW LEVEL SECURITY;

-- Staff can read tokens they created (for copy-link UI)
CREATE POLICY "tokens_staff_manage" ON player_invite_tokens
  FOR ALL USING (get_user_role() IN ('super_admin','tournament_director','staff'));
