package moderation

import (
	"context"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/logic/adminsupport"
	"discover_world/internal/svc"
	"discover_world/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type AdminHideCommentLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewAdminHideCommentLogic(ctx context.Context, svcCtx *svc.ServiceContext) *AdminHideCommentLogic {
	return &AdminHideCommentLogic{Logger: logx.WithContext(ctx), ctx: ctx, svcCtx: svcCtx}
}

func (l *AdminHideCommentLogic) AdminHideComment(req *types.AdminModeratePostRequest) error {
	if req == nil {
		return commonresponse.BadRequest("request cannot be empty")
	}
	adminUser, err := adminsupport.RequireAdminCapability(l.ctx, l.svcCtx, adminsupport.CapabilityContentModerate)
	if err != nil {
		return err
	}
	commentID, err := parseRequiredID(req.Id, "id")
	if err != nil {
		return err
	}
	if err := l.svcCtx.CommentRecordModel.SetStatus(l.ctx, commentID, "hidden"); err != nil {
		return commonresponse.InternalServerError("hide comment failed")
	}
	return adminsupport.RecordOperation(l.ctx, l.svcCtx, adminsupport.OperationLogInput{
		OperatorUserID: adminUser.Id,
		Action:         "comment.hide",
		TargetType:     adminTargetComment,
		TargetID:       commentID,
		Reason:         req.Reason,
		Metadata:       map[string]any{"reportId": req.ReportId},
	})
}
