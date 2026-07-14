// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package moderation

import (
	"context"
	"database/sql"
	moderationmodel "discover_world/model/moderation"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"github.com/zeromicro/go-zero/core/logx"
)

type CreateModerationReportLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewCreateModerationReportLogic(ctx context.Context, svcCtx *svc.ServiceContext) *CreateModerationReportLogic {
	return &CreateModerationReportLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *CreateModerationReportLogic) CreateModerationReport(req *types.CreateModerationReportRequest) (*types.ModerationReportResponse, error) {
	if req == nil {
		return nil, commonresponse.BadRequest("request cannot be empty")
	}
	loginUser, err := loadLoginUser(l.ctx, l.svcCtx)
	if err != nil {
		return nil, err
	}
	targetType, err := normalizeReportTargetType(req.TargetType)
	if err != nil {
		return nil, err
	}
	targetID, err := parseRequiredID(req.TargetId, "targetId")
	if err != nil {
		return nil, err
	}
	reason, err := normalizeReportReason(req.Reason)
	if err != nil {
		return nil, err
	}
	description, err := normalizeReportDescription(req.Description)
	if err != nil {
		return nil, err
	}

	result, err := l.svcCtx.Models.Moderation.ModerationReport.Insert(l.ctx, &moderationmodel.ModerationReport{
		ReporterUserId: loginUser.Id,
		TargetType:     targetType,
		TargetId:       targetID,
		Reason:         reason,
		Description:    description,
		Status:         moderationStatusOpen,
	})
	if err != nil {
		return nil, commonresponse.InternalServerError("create moderation report failed")
	}
	id, err := result.LastInsertId()
	if err != nil || id <= 0 {
		if err != nil {
			return nil, commonresponse.InternalServerError("create moderation report failed")
		}
		return nil, commonresponse.InternalServerError(sql.ErrNoRows.Error())
	}

	return &types.ModerationReportResponse{
		Id:         formatID(uint64(id)),
		TargetType: targetType,
		TargetId:   formatID(targetID),
		Reason:     reason,
		Status:     moderationStatusOpen,
	}, nil
}
