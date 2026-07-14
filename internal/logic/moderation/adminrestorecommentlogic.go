package moderation

import (
	"context"

	"discover_world/internal/common/adminsupport"
	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type AdminRestoreCommentLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewAdminRestoreCommentLogic(ctx context.Context, svcCtx *svc.ServiceContext) *AdminRestoreCommentLogic {
	return &AdminRestoreCommentLogic{Logger: logx.WithContext(ctx), ctx: ctx, svcCtx: svcCtx}
}

func (l *AdminRestoreCommentLogic) AdminRestoreComment(req *types.AdminModeratePostRequest) error {
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
	return adminsupport.TransactOperation(l.ctx, l.svcCtx, adminsupport.OperationLogInput{
		OperatorUserID: adminUser.Id,
		Action:         "comment.restore",
		TargetType:     adminTargetComment,
		TargetID:       commentID,
		Reason:         req.Reason,
		Metadata:       map[string]any{"reportId": req.ReportId},
	}, func(ctx context.Context, txSvcCtx *svc.ServiceContext) error {
		if err := txSvcCtx.Models.Post.CommentRecord.SetStatus(ctx, commentID, "active"); err != nil {
			return commonresponse.InternalServerError("restore comment failed")
		}
		return nil
	})
}
