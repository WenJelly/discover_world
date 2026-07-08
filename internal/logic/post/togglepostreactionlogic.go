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

type TogglePostReactionLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewTogglePostReactionLogic(ctx context.Context, svcCtx *svc.ServiceContext) *TogglePostReactionLogic {
	return &TogglePostReactionLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *TogglePostReactionLogic) TogglePostReaction(req *types.TogglePostReactionRequest) (*types.PostToggleResponse, error) {
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

	reactionType, err := normalizeReactionType(req.ReactionType)
	if err != nil {
		return nil, err
	}
	active := false
	err = l.svcCtx.Transact(l.ctx, func(ctx context.Context, txSvc *svc.ServiceContext) error {
		nextActive, delta, err := txSvc.ReactionModel.ToggleStatus(ctx, loginUser.Id, targetTypePost, post.Id, reactionType)
		if err != nil {
			return err
		}
		active = nextActive
		return txSvc.EntityStatModel.IncrementCounter(ctx, targetTypePost, post.Id, "reaction_count", delta)
	})
	if err != nil {
		return nil, commonresponse.InternalServerError("toggle post reaction failed")
	}
	stat, _ := l.svcCtx.EntityStatModel.FindOneByTargetTypeTargetId(l.ctx, targetTypePost, post.Id)
	likedByByPost, err := loadPostLikedBySummaries(l.ctx, l.svcCtx, []uint64{post.Id})
	if err != nil {
		return nil, commonresponse.InternalServerError("query post liked users failed")
	}
	return &types.PostToggleResponse{
		Active:  active,
		Stats:   buildStats(stat),
		LikedBy: nonNilAccountSummaries(likedByByPost[post.Id]),
	}, nil
}
