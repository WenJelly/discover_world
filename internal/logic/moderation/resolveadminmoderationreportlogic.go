package moderation

import (
	"context"
	"errors"
	"strings"
	"time"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/logic/adminsupport"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"discover_world/model"

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
	report, err := l.svcCtx.ModerationReportModel.FindOne(l.ctx, reportID)
	if err != nil {
		if errors.Is(err, model.ErrNotFound) {
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
	if err := applyModerationAction(l.ctx, l.svcCtx, req.Action, targetType, targetID); err != nil {
		return nil, err
	}
	if err := l.svcCtx.ModerationReportModel.Resolve(l.ctx, model.ResolveModerationReportRequest{
		Id:             reportID,
		HandlerUserId:  adminUser.Id,
		Status:         status,
		Resolution:     resolution,
		ResolutionNote: optionalSQLString(req.ResolutionNote),
		ResolvedAt:     time.Now(),
	}); err != nil {
		return nil, commonresponse.InternalServerError("处理举报失败")
	}
	updated, err := l.svcCtx.ModerationReportModel.FindOne(l.ctx, reportID)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询举报处理结果失败")
	}
	if err := adminsupport.RecordOperation(l.ctx, l.svcCtx, adminsupport.OperationLogInput{
		OperatorUserID: adminUser.Id,
		Action:         adminActionReportResolve,
		TargetType:     adminTargetReport,
		TargetID:       reportID,
		Reason:         req.ResolutionNote,
		Before:         buildAdminModerationReportResponse(report),
		After:          buildAdminModerationReportResponse(updated),
		Metadata:       map[string]any{"action": req.Action, "targetType": targetType, "targetId": formatID(targetID)},
	}); err != nil {
		return nil, err
	}
	resp := buildAdminModerationReportResponse(updated)
	return &resp, nil
}
