package moderation

import (
	"context"
	"errors"
	"github.com/zeromicro/go-zero/core/stores/sqlx"

	"discover_world/internal/common/adminsupport"
	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"github.com/zeromicro/go-zero/core/logx"
)

type GetAdminModerationReportDetailLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewGetAdminModerationReportDetailLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetAdminModerationReportDetailLogic {
	return &GetAdminModerationReportDetailLogic{Logger: logx.WithContext(ctx), ctx: ctx, svcCtx: svcCtx}
}

func (l *GetAdminModerationReportDetailLogic) GetAdminModerationReportDetail(req *types.AdminModerationReportDetailRequest) (*types.AdminModerationReportResponse, error) {
	if req == nil {
		return nil, commonresponse.BadRequest("request cannot be empty")
	}
	if _, err := adminsupport.RequireAdminCapability(l.ctx, l.svcCtx, adminsupport.CapabilityContentModerate); err != nil {
		return nil, err
	}
	id, err := parseRequiredID(req.Id, "id")
	if err != nil {
		return nil, err
	}
	row, err := l.svcCtx.Models.Moderation.ModerationReport.FindOne(l.ctx, id)
	if err != nil {
		if errors.Is(err, sqlx.ErrNotFound) {
			return nil, commonresponse.NotFound("举报不存在")
		}
		return nil, commonresponse.InternalServerError("查询举报失败")
	}
	resp := buildAdminModerationReportResponse(row)
	return &resp, nil
}
