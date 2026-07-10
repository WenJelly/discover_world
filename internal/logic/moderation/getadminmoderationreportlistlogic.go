package moderation

import (
	"context"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/logic/adminsupport"
	"discover_world/internal/svc"
	"discover_world/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type GetAdminModerationReportListLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewGetAdminModerationReportListLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetAdminModerationReportListLogic {
	return &GetAdminModerationReportListLogic{Logger: logx.WithContext(ctx), ctx: ctx, svcCtx: svcCtx}
}

func (l *GetAdminModerationReportListLogic) GetAdminModerationReportList(req *types.AdminModerationReportQueryRequest) (*types.AdminModerationReportPageResponse, error) {
	if req == nil {
		req = &types.AdminModerationReportQueryRequest{}
	}
	if _, err := adminsupport.RequireAdminCapability(l.ctx, l.svcCtx, adminsupport.CapabilityContentModerate); err != nil {
		return nil, err
	}
	pageNum, pageSize := adminsupport.NormalizePage(req.PageNum, req.PageSize)
	filter, err := buildModerationReportFilter(req)
	if err != nil {
		return nil, err
	}
	total, err := l.svcCtx.ModerationReportModel.CountByFilter(l.ctx, filter)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询举报数量失败")
	}
	rows, err := l.svcCtx.ModerationReportModel.FindByFilter(l.ctx, filter, pageNum, pageSize)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询举报列表失败")
	}
	list := make([]types.AdminModerationReportResponse, 0, len(rows))
	for _, row := range rows {
		list = append(list, buildAdminModerationReportResponse(row))
	}
	return &types.AdminModerationReportPageResponse{PageNum: pageNum, PageSize: pageSize, Total: total, List: list}, nil
}
