// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package media

import (
	"context"
	"errors"

	commonauth "discover_world/internal/common/auth"
	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"discover_world/model"

	"github.com/zeromicro/go-zero/core/logx"
)

type ToggleMediaReactionLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewToggleMediaReactionLogic(ctx context.Context, svcCtx *svc.ServiceContext) *ToggleMediaReactionLogic {
	return &ToggleMediaReactionLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *ToggleMediaReactionLogic) ToggleMediaReaction(req *types.ToggleMediaReactionRequest) (*types.MediaAssetToggleResponse, error) {
	if req == nil {
		return nil, commonresponse.BadRequest("request cannot be empty")
	}
	assetID, err := parseRequiredID(req.Id, "id")
	if err != nil {
		return nil, err
	}
	loginUser, err := commonauth.LoadRequiredLoginUser(l.ctx, l.svcCtx, "")
	if err != nil {
		return nil, err
	}
	asset, err := l.svcCtx.MediaAssetModel.FindOneActive(l.ctx, assetID)
	if err != nil {
		if errors.Is(err, model.ErrNotFound) {
			return nil, commonresponse.NotFound("media asset not found")
		}
		return nil, commonresponse.InternalServerError("query media asset failed")
	}
	if !canViewMediaAsset(asset, loginUser, l.svcCtx) {
		return nil, commonresponse.Forbidden("no permission to view this media asset")
	}

	reactionType, err := normalizeMediaReactionType(req.ReactionType)
	if err != nil {
		return nil, err
	}
	active := false
	err = l.svcCtx.Transact(l.ctx, func(ctx context.Context, txSvc *svc.ServiceContext) error {
		nextActive, delta, err := txSvc.ReactionModel.ToggleStatus(ctx, loginUser.Id, targetTypeMediaAsset, asset.Id, reactionType)
		if err != nil {
			return err
		}
		active = nextActive
		return txSvc.EntityStatModel.IncrementCounter(ctx, targetTypeMediaAsset, asset.Id, "reaction_count", delta)
	})
	if err != nil {
		return nil, commonresponse.InternalServerError("toggle media reaction failed")
	}
	stat, _ := l.svcCtx.EntityStatModel.FindOneByTargetTypeTargetId(l.ctx, targetTypeMediaAsset, asset.Id)
	return &types.MediaAssetToggleResponse{Active: active, Stats: buildMediaStats(stat)}, nil
}
