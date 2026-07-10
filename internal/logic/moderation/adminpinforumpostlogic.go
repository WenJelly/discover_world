// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package moderation

import (
	"context"
	"time"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/logic/adminsupport"
	"discover_world/internal/svc"
	"discover_world/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type AdminPinForumPostLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewAdminPinForumPostLogic(ctx context.Context, svcCtx *svc.ServiceContext) *AdminPinForumPostLogic {
	return &AdminPinForumPostLogic{Logger: logx.WithContext(ctx), ctx: ctx, svcCtx: svcCtx}
}

func (l *AdminPinForumPostLogic) AdminPinForumPost(req *types.AdminModeratePostRequest) error {
	if req == nil {
		return commonresponse.BadRequest("request cannot be empty")
	}
	adminUser, err := adminsupport.RequireAdminCapability(l.ctx, l.svcCtx, adminsupport.CapabilityContentModerate)
	if err != nil {
		return err
	}
	postID, err := parseRequiredID(req.Id, "id")
	if err != nil {
		return err
	}
	if err := l.svcCtx.PostDiscussionModel.SetBoardPinned(l.ctx, postID, true, time.Now()); err != nil {
		return commonresponse.InternalServerError("pin forum post failed")
	}
	return adminsupport.RecordOperation(l.ctx, l.svcCtx, adminsupport.OperationLogInput{
		OperatorUserID: adminUser.Id,
		Action:         "forum_post.pin",
		TargetType:     adminTargetForumPost,
		TargetID:       postID,
		Reason:         req.Reason,
		Metadata:       map[string]any{"reportId": req.ReportId},
	})
}
