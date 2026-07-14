package statistics

import (
	"context"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

type (
	SiteStatsModel interface {
		GetOverviewStats(ctx context.Context) (*OverviewStats, error)
	}

	defaultSiteStatsModel struct {
		conn sqlx.SqlConn
	}

	OverviewStats struct {
		PublicMediaAssetCount int64 `db:"public_media_asset_count"`
		CreatorCount          int64 `db:"creator_count"`
		PublicPostCount       int64 `db:"public_post_count"`
		PublicAlbumCount      int64 `db:"public_album_count"`
	}
)

func NewSiteStatsModel(conn sqlx.SqlConn) SiteStatsModel {
	return &defaultSiteStatsModel{conn: conn}
}

func (m *defaultSiteStatsModel) GetOverviewStats(ctx context.Context) (*OverviewStats, error) {
	query := `
select
	(select count(1) from user_account where status = 'active' and deleted_at is null) as creator_count,
	(select count(1) from media_asset where status = 'active' and visibility = 'public' and audit_status = 'approved' and deleted_at is null) as public_media_asset_count,
	(select count(1) from post where status = 'active' and visibility = 'public' and deleted_at is null) as public_post_count,
	(select count(1) from album where status = 'active' and visibility = 'public' and deleted_at is null) as public_album_count
`
	var resp OverviewStats
	if err := m.conn.QueryRowCtx(ctx, &resp, query); err != nil {
		return nil, err
	}
	return &resp, nil
}
