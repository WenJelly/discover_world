// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package post

import (
	"context"
	"database/sql"
	notificationmodel "discover_world/model/notification"

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
	notificationCreated := false
	err = l.svcCtx.Transact(l.ctx, func(ctx context.Context, txSvc *svc.ServiceContext) error {
		nextActive, delta, err := txSvc.Models.Interaction.Favorite.ToggleStatus(ctx, loginUser.Id, targetTypePost, post.Id)
		if err != nil {
			return err
		}
		active = nextActive
		if err := txSvc.Models.Statistics.EntityStat.IncrementCounter(ctx, targetTypePost, post.Id, "favorite_count", delta); err != nil {
			return err
		}
		if err := txSvc.Models.Statistics.EntityStatHourly.IncrementCounter(ctx, targetTypePost, post.Id, "favorite_count", delta); err != nil {
			return err
		}
		if nextActive && post.UserId != loginUser.Id {
			if _, err := txSvc.Models.Notification.Notification.Insert(ctx, &notificationmodel.Notification{
				RecipientUserId: post.UserId,
				ActorUserId:     sql.NullInt64{Int64: int64(loginUser.Id), Valid: true},
				EventType:       "post_favorite",
				TargetType:      targetTypePost,
				TargetId:        post.Id,
				Title:           "新的收藏",
			}); err != nil {
				logx.WithContext(ctx).Errorf("create post favorite notification failed: postId=%d actorId=%d err=%v", post.Id, loginUser.Id, err)
			} else {
				notificationCreated = true
			}
		}
		return nil
	})
	if err != nil {
		return nil, commonresponse.InternalServerError("toggle post favorite failed")
	}
	if notificationCreated {
		if err := l.svcCtx.InvalidateNotificationUnread(l.ctx, post.UserId); err != nil {
			l.Errorf("invalidate unread cache after post favorite notification failed: ownerId=%d err=%v", post.UserId, err)
		}
	}
	stat, _ := l.svcCtx.Models.Statistics.EntityStat.FindOneByTargetTypeTargetId(l.ctx, targetTypePost, post.Id)
	return &types.PostToggleResponse{
		Active:  active,
		Stats:   buildStats(stat),
		LikedBy: []types.AccountSummary{},
	}, nil
}
