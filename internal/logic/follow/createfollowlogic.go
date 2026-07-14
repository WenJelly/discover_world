package follow

import (
	"context"
	"database/sql"
	notificationmodel "discover_world/model/notification"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"github.com/zeromicro/go-zero/core/logx"
)

type CreateFollowLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewCreateFollowLogic(ctx context.Context, svcCtx *svc.ServiceContext) *CreateFollowLogic {
	return &CreateFollowLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *CreateFollowLogic) CreateFollow(req *types.FollowTargetRequest) (*types.FollowStatusResponse, error) {
	loginUser, err := loadLoginUser(l.ctx, l.svcCtx)
	if err != nil {
		return nil, err
	}
	targetID, err := parseRequiredID(req.TargetUserId, "targetUserId")
	if err != nil {
		return nil, err
	}
	target, err := validateFollowTarget(l.ctx, l.svcCtx, loginUser, targetID)
	if err != nil {
		return nil, err
	}
	wasFollowing, err := l.svcCtx.Models.Follow.UserFollow.IsFollowing(l.ctx, loginUser.Id, target.Id)
	if err != nil {
		return nil, commonresponse.InternalServerError("query follow status failed")
	}
	if err := l.svcCtx.Models.Follow.UserFollow.Follow(l.ctx, loginUser.Id, target.Id); err != nil {
		return nil, err
	}
	if !wasFollowing {
		if _, err := l.svcCtx.Models.Notification.Notification.Insert(l.ctx, &notificationmodel.Notification{
			RecipientUserId: target.Id,
			ActorUserId:     sql.NullInt64{Int64: int64(loginUser.Id), Valid: true},
			EventType:       "follow",
			TargetType:      "user_account",
			TargetId:        loginUser.Id,
			Title:           "新的关注",
			Content:         sql.NullString{String: loginUser.Username + " 关注了你", Valid: true},
		}); err != nil {
			l.Errorf("create follow notification failed: followerId=%d followingId=%d err=%v", loginUser.Id, target.Id, err)
		} else if err := l.svcCtx.InvalidateNotificationUnread(l.ctx, target.Id); err != nil {
			l.Errorf("invalidate unread cache after follow notification failed: targetId=%d err=%v", target.Id, err)
		}
	}
	return buildFollowStatus(l.ctx, l.svcCtx, loginUser, target)
}
