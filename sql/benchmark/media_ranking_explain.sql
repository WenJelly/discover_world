-- P2-07 media hot/rising ranking verification (MySQL 8.x).
-- Run after loading 10k, 100k, and 1m eligible media rows and refreshing entity_ranking.
-- Record actual rows, loops, temporary table/filesort use, and wall time for each plan.

EXPLAIN ANALYZE
SELECT ma.*
FROM `entity_ranking` er FORCE INDEX (`idx_entity_ranking_hot`)
STRAIGHT_JOIN `media_asset` ma ON ma.`id` = er.`target_id`
WHERE er.`target_type` = 'media_asset'
  AND ma.`status` = 'active'
  AND ma.`visibility` = 'public'
  AND ma.`audit_status` = 'approved'
  AND ma.`asset_usage` = 'work'
  AND ma.`deleted_at` IS NULL
ORDER BY er.`hot_score` DESC, er.`target_id` DESC
LIMIT 60;

EXPLAIN ANALYZE
SELECT ma.*
FROM `entity_ranking` er FORCE INDEX (`idx_entity_ranking_rising`)
STRAIGHT_JOIN `media_asset` ma ON ma.`id` = er.`target_id`
WHERE er.`target_type` = 'media_asset'
  AND ma.`status` = 'active'
  AND ma.`visibility` = 'public'
  AND ma.`audit_status` = 'approved'
  AND ma.`asset_usage` = 'work'
  AND ma.`deleted_at` IS NULL
ORDER BY er.`rising_score` DESC, er.`target_id` DESC
LIMIT 60;

-- Cursor-page verification: replace the values with a score/id returned by page 1.
SET @cursor_score = 0.0;
SET @cursor_id = 0;

EXPLAIN ANALYZE
SELECT ma.*
FROM `entity_ranking` er FORCE INDEX (`idx_entity_ranking_hot`)
STRAIGHT_JOIN `media_asset` ma ON ma.`id` = er.`target_id`
WHERE er.`target_type` = 'media_asset'
  AND (er.`hot_score` < @cursor_score OR (er.`hot_score` = @cursor_score AND er.`target_id` < @cursor_id))
  AND ma.`status` = 'active'
  AND ma.`visibility` = 'public'
  AND ma.`audit_status` = 'approved'
  AND ma.`asset_usage` = 'work'
  AND ma.`deleted_at` IS NULL
ORDER BY er.`hot_score` DESC, er.`target_id` DESC
LIMIT 60;
