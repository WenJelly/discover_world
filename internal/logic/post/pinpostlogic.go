// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package post

import (
	"context"
	"errors"
	"github.com/zeromicro/go-zero/core/stores/sqlx"
	"time"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"github.com/zeromicro/go-zero/core/logx"
)

type PinPostLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewPinPostLogic(ctx context.Context, svcCtx *svc.ServiceContext) *PinPostLogic {
	return &PinPostLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *PinPostLogic) PinPost(req *types.PinPostRequest) (*types.ProfilePostResponse, error) {
	if req == nil {
		return nil, commonresponse.BadRequest("request cannot be empty")
	}
	postID, err := parseRequiredID(req.Id, "id")
	if err != nil {
		return nil, err
	}
	loginUser, err := loadLoginUser(l.ctx, l.svcCtx)
	if err != nil {
		return nil, err
	}

	post, err := l.svcCtx.PostModel.FindOneActive(l.ctx, postID)
	if err != nil {
		if errors.Is(err, sqlx.ErrNotFound) {
			return nil, commonresponse.NotFound("post not found")
		}
		return nil, commonresponse.InternalServerError("query post failed")
	}
	if !canManagePost(post, loginUser, l.svcCtx) {
		return nil, commonresponse.Forbidden("no permission to pin this post")
	}

	if err := l.svcCtx.PostModel.SetPinned(l.ctx, post.Id, true, time.Now()); err != nil {
		return nil, commonresponse.InternalServerError("pin post failed")
	}
	updated, err := l.svcCtx.PostModel.FindOneActive(l.ctx, post.Id)
	if err != nil {
		return nil, commonresponse.InternalServerError("load pinned post failed")
	}
	return buildPostResponse(l.ctx, l.svcCtx, updated, loginUser)
}
