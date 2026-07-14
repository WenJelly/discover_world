// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package notification

import (
	"context"
	"time"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type GetUnreadNotificationCountLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewGetUnreadNotificationCountLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetUnreadNotificationCountLogic {
	return &GetUnreadNotificationCountLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetUnreadNotificationCountLogic) GetUnreadNotificationCount(req *types.UnreadNotificationCountRequest) (*types.UnreadNotificationCountResponse, error) {
	loginUser, err := loadLoginUser(l.ctx, l.svcCtx)
	if err != nil {
		return nil, err
	}
	cacheKey := svc.NotificationUnreadCacheKey(loginUser.Id)
	if l.svcCtx.Redis != nil {
		if count, found, cacheErr := l.svcCtx.Redis.GetInt64(l.ctx, cacheKey); cacheErr != nil {
			l.Errorf("read notification unread cache failed: userId=%d err=%v", loginUser.Id, cacheErr)
		} else if found {
			return &types.UnreadNotificationCountResponse{UnreadCount: count}, nil
		}
	}
	count, err := l.svcCtx.NotificationModel.CountUnread(l.ctx, loginUser.Id)
	if err != nil {
		return nil, commonresponse.InternalServerError("count unread notifications failed")
	}
	if l.svcCtx.Redis != nil {
		if cacheErr := l.svcCtx.Redis.SetInt64(l.ctx, cacheKey, count, time.Duration(l.svcCtx.Config.Redis.NotificationUnreadTTLSeconds)*time.Second); cacheErr != nil {
			l.Errorf("write notification unread cache failed: userId=%d err=%v", loginUser.Id, cacheErr)
		}
	}
	return &types.UnreadNotificationCountResponse{UnreadCount: count}, nil
}
