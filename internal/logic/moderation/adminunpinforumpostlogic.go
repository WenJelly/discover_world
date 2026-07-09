// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package moderation

import (
	"context"
	"time"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type AdminUnpinForumPostLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewAdminUnpinForumPostLogic(ctx context.Context, svcCtx *svc.ServiceContext) *AdminUnpinForumPostLogic {
	return &AdminUnpinForumPostLogic{Logger: logx.WithContext(ctx), ctx: ctx, svcCtx: svcCtx}
}

func (l *AdminUnpinForumPostLogic) AdminUnpinForumPost(req *types.AdminModeratePostRequest) error {
	if req == nil {
		return commonresponse.BadRequest("request cannot be empty")
	}
	postID, err := parseRequiredID(req.Id, "id")
	if err != nil {
		return err
	}
	if err := l.svcCtx.PostDiscussionModel.SetBoardPinned(l.ctx, postID, false, time.Time{}); err != nil {
		return commonresponse.InternalServerError("unpin forum post failed")
	}
	return nil
}
