-- Enable Supabase Realtime for the matches table
-- Without this, postgres_changes subscriptions will never fire.

ALTER TABLE matches REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE matches;
