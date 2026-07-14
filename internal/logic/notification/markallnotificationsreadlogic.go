// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package notification

import (
	"context"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type MarkAllNotificationsReadLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewMarkAllNotificationsReadLogic(ctx context.Context, svcCtx *svc.ServiceContext) *MarkAllNotificationsReadLogic {
	return &MarkAllNotificationsReadLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *MarkAllNotificationsReadLogic) MarkAllNotificationsRead(req *types.MarkAllNotificationsReadRequest) error {
	loginUser, err := loadLoginUser(l.ctx, l.svcCtx)
	if err != nil {
		return err
	}
	if err := l.svcCtx.NotificationModel.MarkAllRead(l.ctx, loginUser.Id); err != nil {
		return commonresponse.InternalServerError("mark all notifications read failed")
	}
	if err := l.svcCtx.InvalidateNotificationUnread(l.ctx, loginUser.Id); err != nil {
		l.Errorf("invalidate unread cache after mark all read failed: userId=%d err=%v", loginUser.Id, err)
	}
	return nil
}
