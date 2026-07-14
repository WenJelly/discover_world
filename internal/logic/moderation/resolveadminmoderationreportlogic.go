package moderation

import (
	"context"
	moderationmodel "discover_world/model/moderation"
	"errors"
	"github.com/zeromicro/go-zero/core/stores/sqlx"
	"strings"
	"time"

	"discover_world/internal/common/adminsupport"
	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"github.com/zeromicro/go-zero/core/logx"
)

type ResolveAdminModerationReportLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewResolveAdminModerationReportLogic(ctx context.Context, svcCtx *svc.ServiceContext) *ResolveAdminModerationReportLogic {
	return &ResolveAdminModerationReportLogic{Logger: logx.WithContext(ctx), ctx: ctx, svcCtx: svcCtx}
}

func (l *ResolveAdminModerationReportLogic) ResolveAdminModerationReport(req *types.AdminModerationReportResolveRequest) (*types.AdminModerationReportResponse, error) {
	if req == nil {
		return nil, commonresponse.BadRequest("request cannot be empty")
	}
	adminUser, err := adminsupport.RequireAdminCapability(l.ctx, l.svcCtx, adminsupport.CapabilityContentModerate)
	if err != nil {
		return nil, err
	}
	reportID, err := parseRequiredID(req.Id, "id")
	if err != nil {
		return nil, err
	}
	status, resolution, err := resolveStatusAndResolution(req.Resolution)
	if err != nil {
		return nil, err
	}
	report, err := l.svcCtx.Models.Moderation.ModerationReport.FindOne(l.ctx, reportID)
	if err != nil {
		if errors.Is(err, sqlx.ErrNotFound) {
			return nil, commonresponse.NotFound("举报不存在")
		}
		return nil, commonresponse.InternalServerError("查询举报失败")
	}
	targetType := strings.TrimSpace(req.TargetType)
	if targetType == "" {
		targetType = report.TargetType
	}
	targetID, err := parseOptionalID(req.TargetId, "targetId")
	if err != nil {
		return nil, err
	}
	if targetID == 0 {
		targetID = report.TargetId
	}
	after := &types.AdminModerationReportResponse{}
	if err := adminsupport.TransactOperation(l.ctx, l.svcCtx, adminsupport.OperationLogInput{
		OperatorUserID: adminUser.Id,
		Action:         adminActionReportResolve,
		TargetType:     adminTargetReport,
		TargetID:       reportID,
		Reason:         req.ResolutionNote,
		Before:         buildAdminModerationReportResponse(report),
		After:          after,
		Metadata:       map[string]any{"action": req.Action, "targetType": targetType, "targetId": formatID(targetID)},
	}, func(ctx context.Context, txSvcCtx *svc.ServiceContext) error {
		if err := applyModerationAction(ctx, txSvcCtx, req.Action, targetType, targetID); err != nil {
			return err
		}
		if err := txSvcCtx.Models.Moderation.ModerationReport.Resolve(ctx, moderationmodel.ResolveModerationReportRequest{
			Id:             reportID,
			HandlerUserId:  adminUser.Id,
			Status:         status,
			Resolution:     resolution,
			ResolutionNote: optionalSQLString(req.ResolutionNote),
			ResolvedAt:     time.Now(),
		}); err != nil {
			return commonresponse.InternalServerError("处理举报失败")
		}
		updated, err := txSvcCtx.Models.Moderation.ModerationReport.FindOne(ctx, reportID)
		if err != nil {
			return commonresponse.InternalServerError("查询举报处理结果失败")
		}
		*after = buildAdminModerationReportResponse(updated)
		return nil
	}); err != nil {
		return nil, err
	}
	return after, nil
}
