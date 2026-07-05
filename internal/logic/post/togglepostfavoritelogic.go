// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package post

import (
	"context"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type TogglePostFavoriteLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewTogglePostFavoriteLogic(ctx context.Context, svcCtx *svc.ServiceContext) *TogglePostFavoriteLogic {
	return &TogglePostFavoriteLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *TogglePostFavoriteLogic) TogglePostFavorite(req *types.TogglePostFavoriteRequest) (*types.PostToggleResponse, error) {
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
	post, err := loadVisiblePost(l.ctx, l.svcCtx, postID, loginUser)
	if err != nil {
		return nil, err
	}

	active := false
	err = l.svcCtx.Transact(l.ctx, func(ctx context.Context, txSvc *svc.ServiceContext) error {
		nextActive, delta, err := txSvc.FavoriteModel.ToggleStatus(ctx, loginUser.Id, targetTypePost, post.Id)
		if err != nil {
			return err
		}
		active = nextActive
		return txSvc.EntityStatModel.IncrementCounter(ctx, targetTypePost, post.Id, "favorite_count", delta)
	})
	if err != nil {
		return nil, commonresponse.InternalServerError("toggle post favorite failed")
	}
	stat, _ := l.svcCtx.EntityStatModel.FindOneByTargetTypeTargetId(l.ctx, targetTypePost, post.Id)
	return &types.PostToggleResponse{Active: active, Stats: buildStats(stat)}, nil
}
