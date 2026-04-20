-- BTTMS v2.0 - Fixes for reset + seed functionality
-- Run this once in Supabase SQL Editor

-- 1. Drop net_height / forbidden_zone trigger (irrelevant for this app's purposes
--    and the float->text cast produces '1.8' which violates the check constraint)
DROP TRIGGER IF EXISTS trg_set_match_rules ON matches;

-- 2. Drop the "append-only" rules on points so reset can delete them.
--    (Cascades from matches were also blocked, making DB reset impossible.)
DROP RULE IF EXISTS no_delete_points ON points;
DROP RULE IF EXISTS no_update_points ON points;

-- 3. Also relax the net_height check so NULL is fully allowed (it already is,
--    but being explicit). Not strictly necessary after step 1.
