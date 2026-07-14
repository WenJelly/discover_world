package statistics

import (
	"context"
	"fmt"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

var _ EntityRankingModel = (*defaultEntityRankingModel)(nil)

type (
	EntityRankingModel interface {
		RefreshMedia(ctx context.Context, targetID uint64) error
		RefreshMediaBatch(ctx context.Context, afterID uint64, limit int64) (lastID uint64, count int64, err error)
		DeleteStaleMediaRankings(ctx context.Context) error
		withSession(session sqlx.Session) EntityRankingModel
	}

	defaultEntityRankingModel struct {
		conn sqlx.SqlConn
	}

	mediaRankingBatchBoundary struct {
		LastID uint64 `db:"last_id"`
		Count  int64  `db:"count"`
	}
)

func NewEntityRankingModel(conn sqlx.SqlConn) EntityRankingModel {
	return &defaultEntityRankingModel{conn: conn}
}

func (m *defaultEntityRankingModel) withSession(session sqlx.Session) EntityRankingModel {
	return NewEntityRankingModel(sqlx.NewSqlConnFromSession(session))
}

func (m *defaultEntityRankingModel) RefreshMedia(ctx context.Context, targetID uint64) error {
	if targetID == 0 {
		return nil
	}

	if _, err := m.conn.ExecCtx(ctx, mediaRankingRefreshSQL(targetID-1, targetID)); err != nil {
		return err
	}
	_, err := m.conn.ExecCtx(ctx, mediaRankingDeleteStaleSQL(true), targetID)
	return err
}

func (m *defaultEntityRankingModel) RefreshMediaBatch(ctx context.Context, afterID uint64, limit int64) (uint64, int64, error) {
	limit = normalizeMediaRankingBatchSize(limit)

	var boundary mediaRankingBatchBoundary
	if err := m.conn.QueryRowCtx(ctx, &boundary, mediaRankingBatchBoundarySQL(), afterID, limit); err != nil {
		return 0, 0, err
	}
	if boundary.Count == 0 {
		return afterID, 0, nil
	}
	if boundary.LastID <= afterID {
		return 0, 0, fmt.Errorf("media ranking batch did not advance: after=%d last=%d", afterID, boundary.LastID)
	}

	if _, err := m.conn.ExecCtx(ctx, mediaRankingRefreshSQL(afterID, boundary.LastID)); err != nil {
		return 0, 0, err
	}
	return boundary.LastID, boundary.Count, nil
}

func (m *defaultEntityRankingModel) DeleteStaleMediaRankings(ctx context.Context) error {
	_, err := m.conn.ExecCtx(ctx, mediaRankingDeleteStaleSQL(false))
	return err
}

func normalizeMediaRankingBatchSize(limit int64) int64 {
	if limit <= 0 {
		return 1000
	}
	if limit > 5000 {
		return 5000
	}
	return limit
}

func mediaRankingBatchBoundarySQL() string {
	return "select coalesce(max(batch.`id`), 0) as `last_id`, count(1) as `count` from (select ma.`id` from `media_asset` ma force index (`idx_media_asset_usage_public`) where ma.`asset_usage` = 'work' and ma.`status` = 'active' and ma.`visibility` = 'public' and ma.`audit_status` = 'approved' and ma.`deleted_at` is null and ma.`id` > ? order by ma.`id` asc limit ?) batch"
}

func mediaRankingRefreshSQL(afterID, lastID uint64) string {
	hourlyScore := "((ln(1 + esh.`view_count`) * 1) + (esh.`reaction_count` * 4) + (esh.`favorite_count` * 8) + (esh.`comment_count` * 3) + (esh.`share_count` * 6) + (esh.`download_count` * 4))"
	hourlyAggregate := fmt.Sprintf(
		"select esh.`target_id`, coalesce(sum(case when esh.`bucket_hour` >= now() - interval 24 hour and esh.`bucket_hour` < now() then %s else 0 end), 0) as `recent_score`, coalesce(sum(case when esh.`bucket_hour` >= now() - interval 48 hour and esh.`bucket_hour` < now() - interval 24 hour then %s else 0 end), 0) as `previous_score` from `entity_stat_hourly` esh where esh.`target_type` = 'media_asset' and esh.`target_id` > %d and esh.`target_id` <= %d and esh.`bucket_hour` >= now() - interval 48 hour and esh.`bucket_hour` < now() group by esh.`target_id`",
		hourlyScore,
		hourlyScore,
		afterID,
		lastID,
	)

	return fmt.Sprintf(
		"insert into `entity_ranking` (`target_type`,`target_id`,`hot_score`,`rising_score`,`score_updated_at`) select 'media_asset', ma.`id`, %s, %s, now() from `media_asset` ma left join `entity_stat` es on es.`target_type` = 'media_asset' and es.`target_id` = ma.`id` left join (%s) hourly on hourly.`target_id` = ma.`id` where ma.`asset_usage` = 'work' and ma.`status` = 'active' and ma.`visibility` = 'public' and ma.`audit_status` = 'approved' and ma.`deleted_at` is null and ma.`id` > %d and ma.`id` <= %d on duplicate key update `hot_score` = values(`hot_score`), `rising_score` = values(`rising_score`), `score_updated_at` = values(`score_updated_at`)",
		mediaHotScoreSQL(),
		mediaRisingScoreSQL(),
		hourlyAggregate,
		afterID,
		lastID,
	)
}

func mediaRankingDeleteStaleSQL(single bool) string {
	query := "delete er from `entity_ranking` er left join `media_asset` ma on ma.`id` = er.`target_id` and ma.`asset_usage` = 'work' and ma.`status` = 'active' and ma.`visibility` = 'public' and ma.`audit_status` = 'approved' and ma.`deleted_at` is null where er.`target_type` = 'media_asset' and ma.`id` is null"
	if single {
		query += " and er.`target_id` = ?"
	}
	return query
}

func mediaStatCounterSQL(counter string) string {
	return fmt.Sprintf("coalesce(es.`%s`, 0)", counter)
}

func mediaHotScoreSQL() string {
	view := mediaStatCounterSQL("view_count")
	reaction := mediaStatCounterSQL("reaction_count")
	favorite := mediaStatCounterSQL("favorite_count")
	comment := mediaStatCounterSQL("comment_count")
	share := mediaStatCounterSQL("share_count")
	download := mediaStatCounterSQL("download_count")

	return fmt.Sprintf("(((ln(1 + %s) * 1) + (%s * 4) + (%s * 8) + (%s * 3) + (%s * 6) + (%s * 4) + 2) / pow(greatest(1, timestampdiff(hour, ma.`created_at`, now())) + 24, 0.85))", view, reaction, favorite, comment, share, download)
}

func mediaRisingScoreSQL() string {
	recent := "coalesce(hourly.`recent_score`, 0)"
	previous := "coalesce(hourly.`previous_score`, 0)"

	return fmt.Sprintf("((ln(1 + (%[1]s)) * (1 + least(2, greatest(0, ((%[1]s) - (%[2]s)) / ((%[2]s) + 5)))) * (1 - exp(-(%[1]s) / 8))) / pow(greatest(1, timestampdiff(hour, ma.`created_at`, now())) + 12, 0.15))", recent, previous)
}
