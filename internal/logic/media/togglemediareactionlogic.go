// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package media

import (
	"context"
	"database/sql"
	notificationmodel "discover_world/model/notification"
	"errors"
	"github.com/zeromicro/go-zero/core/stores/sqlx"

	commonauth "discover_world/internal/common/auth"
	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"
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
	asset, err := l.svcCtx.Models.Media.MediaAsset.FindOneActive(l.ctx, assetID)
	if err != nil {
		if errors.Is(err, sqlx.ErrNotFound) {
			return nil, commonresponse.NotFound("media asset not found")
		}
		return nil, commonresponse.InternalServerError("query media asset failed")
	}
	if !canViewMediaAsset(l.ctx, asset, loginUser, l.svcCtx) {
		return nil, commonresponse.Forbidden("no permission to view this media asset")
	}

	reactionType, err := normalizeMediaReactionType(req.ReactionType)
	if err != nil {
		return nil, err
	}
	active := false
	notificationCreated := false
	err = l.svcCtx.Transact(l.ctx, func(ctx context.Context, txSvc *svc.ServiceContext) error {
		nextActive, delta, err := txSvc.Models.Interaction.Reaction.ToggleStatus(ctx, loginUser.Id, targetTypeMediaAsset, asset.Id, reactionType)
		if err != nil {
			return err
		}
		active = nextActive
		if err := txSvc.Models.Statistics.EntityStat.IncrementCounter(ctx, targetTypeMediaAsset, asset.Id, "reaction_count", delta); err != nil {
			return err
		}
		if txSvc.Models.Statistics.EntityStatHourly != nil {
			if err := txSvc.Models.Statistics.EntityStatHourly.IncrementCounter(ctx, targetTypeMediaAsset, asset.Id, "reaction_count", delta); err != nil {
				logx.WithContext(ctx).Errorf("record media hourly reaction stat failed: assetId=%d err=%v", asset.Id, err)
			}
		}
		refreshMediaRanking(ctx, txSvc, asset.Id)
		if nextActive && asset.OwnerUserId != loginUser.Id {
			if _, err := txSvc.Models.Notification.Notification.Insert(ctx, &notificationmodel.Notification{
				RecipientUserId: asset.OwnerUserId,
				ActorUserId:     sql.NullInt64{Int64: int64(loginUser.Id), Valid: true},
				EventType:       "media_reaction",
				TargetType:      targetTypeMediaAsset,
				TargetId:        asset.Id,
				Title:           "新的点赞",
				Content:         sql.NullString{String: reactionType, Valid: reactionType != ""},
			}); err != nil {
				logx.WithContext(ctx).Errorf("create media reaction notification failed: assetId=%d actorId=%d err=%v", asset.Id, loginUser.Id, err)
			} else {
				notificationCreated = true
			}
		}
		return nil
	})
	if err != nil {
		return nil, commonresponse.InternalServerError("toggle media reaction failed")
	}
	if notificationCreated {
		if err := l.svcCtx.InvalidateNotificationUnread(l.ctx, asset.OwnerUserId); err != nil {
			l.Errorf("invalidate unread cache after media reaction notification failed: ownerId=%d err=%v", asset.OwnerUserId, err)
		}
	}
	stat, _ := l.svcCtx.Models.Statistics.EntityStat.FindOneByTargetTypeTargetId(l.ctx, targetTypeMediaAsset, asset.Id)
	return &types.MediaAssetToggleResponse{Active: active, Stats: buildMediaStats(stat)}, nil
}
