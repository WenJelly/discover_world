// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package overview

import (
	"context"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type GetOverviewStatsLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewGetOverviewStatsLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetOverviewStatsLogic {
	return &GetOverviewStatsLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetOverviewStatsLogic) GetOverviewStats() (resp *types.OverviewStatsResponse, err error) {
	stats, err := l.svcCtx.SiteStatsModel.GetOverviewStats(l.ctx)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询站点统计失败")
	}

	return &types.OverviewStatsResponse{
		PublicMediaAssetCount: stats.PublicMediaAssetCount,
		CreatorCount:          stats.CreatorCount,
		PublicPostCount:       stats.PublicPostCount,
		PublicAlbumCount:      stats.PublicAlbumCount,
	}, nil
}
