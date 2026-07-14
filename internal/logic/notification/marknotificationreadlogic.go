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

type MarkNotificationReadLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewMarkNotificationReadLogic(ctx context.Context, svcCtx *svc.ServiceContext) *MarkNotificationReadLogic {
	return &MarkNotificationReadLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *MarkNotificationReadLogic) MarkNotificationRead(req *types.MarkNotificationReadRequest) error {
	if req == nil {
		return commonresponse.BadRequest("request cannot be empty")
	}
	loginUser, err := loadLoginUser(l.ctx, l.svcCtx)
	if err != nil {
		return err
	}
	id, err := parseRequiredID(req.Id, "id")
	if err != nil {
		return err
	}
	if err := l.svcCtx.NotificationModel.MarkRead(l.ctx, loginUser.Id, id); err != nil {
		return commonresponse.InternalServerError("mark notification read failed")
	}
	if err := l.svcCtx.InvalidateNotificationUnread(l.ctx, loginUser.Id); err != nil {
		l.Errorf("invalidate unread cache after mark read failed: userId=%d err=%v", loginUser.Id, err)
	}
	return nil
}
