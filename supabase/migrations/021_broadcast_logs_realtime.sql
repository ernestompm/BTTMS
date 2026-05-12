-- Enable realtime on broadcast_logs so the Broadcast Monitor dashboard
-- receives each PUT/POST attempt as it happens (no polling delay).
-- Guarded so it's idempotent if applied more than once.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'broadcast_logs'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_logs';
  END IF;
END $$;
