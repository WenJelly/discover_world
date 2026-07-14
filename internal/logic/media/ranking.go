package media

import (
	"context"

	"discover_world/internal/svc"

	"github.com/zeromicro/go-zero/core/logx"
)

func refreshMediaRanking(ctx context.Context, svcCtx *svc.ServiceContext, assetID uint64) {
	if svcCtx == nil || svcCtx.Models.Statistics.EntityRanking == nil || assetID == 0 {
		return
	}
	if err := svcCtx.Models.Statistics.EntityRanking.RefreshMedia(ctx, assetID); err != nil {
		logx.WithContext(ctx).Errorf("refresh media ranking failed: assetId=%d err=%v", assetID, err)
	}
}
