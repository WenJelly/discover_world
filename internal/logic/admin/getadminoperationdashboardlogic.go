package admin

import (
	"context"
	moderationmodel "discover_world/model/moderation"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/logic/adminsupport"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"github.com/zeromicro/go-zero/core/logx"
)

type GetAdminOperationDashboardLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewGetAdminOperationDashboardLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetAdminOperationDashboardLogic {
	return &GetAdminOperationDashboardLogic{Logger: logx.WithContext(ctx), ctx: ctx, svcCtx: svcCtx}
}

func (l *GetAdminOperationDashboardLogic) GetAdminOperationDashboard(_ *types.AdminDashboardRequest) (*types.AdminDashboardResponse, error) {
	if _, err := adminsupport.RequireAdminCapability(l.ctx, l.svcCtx, adminsupport.CapabilityOperationManage); err != nil {
		return nil, err
	}
	pendingMedia, err := l.svcCtx.Models.Media.MediaAsset.CountByWhere(l.ctx, "`status` <> 'deleted' and `deleted_at` is null and `audit_status` = ?", "pending")
	if err != nil {
		return nil, commonresponse.InternalServerError("查询待审核媒体数失败")
	}
	openReports, err := l.svcCtx.Models.Moderation.ModerationReport.CountByFilter(l.ctx, moderationmodel.ModerationReportFilter{Status: "open"})
	if err != nil {
		return nil, commonresponse.InternalServerError("查询待处理举报数失败")
	}
	stats, err := l.svcCtx.Models.Statistics.SiteStats.GetOverviewStats(l.ctx)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询站点统计失败")
	}
	return &types.AdminDashboardResponse{
		PendingMediaCount: pendingMedia,
		OpenReportCount:   openReports,
		ActiveUserCount:   stats.CreatorCount,
		PublicMediaCount:  stats.PublicMediaAssetCount,
		PublicPostCount:   stats.PublicPostCount,
	}, nil
}
