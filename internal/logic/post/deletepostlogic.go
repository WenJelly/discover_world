// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package post

import (
	"context"
	"errors"
	"time"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"discover_world/model"

	"github.com/zeromicro/go-zero/core/logx"
)

type DeletePostLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewDeletePostLogic(ctx context.Context, svcCtx *svc.ServiceContext) *DeletePostLogic {
	return &DeletePostLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *DeletePostLogic) DeletePost(req *types.DeletePostRequest) error {
	if req == nil {
		return commonresponse.BadRequest("request cannot be empty")
	}
	postID, err := parseRequiredID(req.Id, "id")
	if err != nil {
		return err
	}
	loginUser, err := loadLoginUser(l.ctx, l.svcCtx)
	if err != nil {
		return err
	}
	post, err := l.svcCtx.PostModel.FindOneActive(l.ctx, postID)
	if err != nil {
		if errors.Is(err, model.ErrNotFound) {
			return commonresponse.NotFound("post not found")
		}
		return commonresponse.InternalServerError("query post failed")
	}
	if !canManagePost(post, loginUser, l.svcCtx) {
		return commonresponse.Forbidden("no permission to delete this post")
	}

	err = l.svcCtx.Transact(l.ctx, func(ctx context.Context, txSvc *svc.ServiceContext) error {
		if err := txSvc.PostModel.SoftDelete(ctx, post.Id, time.Now()); err != nil {
			return err
		}
		return txSvc.AssetLinkModel.DeactivateByOwner(ctx, ownerTypePost, post.Id, linkRoleAttachment)
	})
	if err != nil {
		return commonresponse.InternalServerError("delete post failed")
	}
	return nil
}
