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

type GetNotificationCursorListLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewGetNotificationCursorListLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetNotificationCursorListLogic {
	return &GetNotificationCursorListLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetNotificationCursorListLogic) GetNotificationCursorList(req *types.NotificationListRequest) (*types.NotificationCursorPageResponse, error) {
	if req == nil {
		req = &types.NotificationListRequest{}
	}

	loginUser, err := loadLoginUser(l.ctx, l.svcCtx)
	if err != nil {
		return nil, err
	}
	pageSize := normalizePageSize(req.PageSize)
	cursor, err := parseCursor(req.Cursor)
	if err != nil {
		return nil, err
	}

	rows, err := l.svcCtx.NotificationModel.FindByRecipientBeforeID(l.ctx, loginUser.Id, cursor, pageSize+1)
	if err != nil {
		return nil, commonresponse.InternalServerError("query notifications failed")
	}

	hasMore := int64(len(rows)) > pageSize
	if hasMore {
		rows = rows[:pageSize]
	}

	list, err := buildNotificationResponses(l.ctx, l.svcCtx, rows)
	if err != nil {
		return nil, err
	}

	nextCursor := ""
	if hasMore && len(rows) > 0 {
		nextCursor = formatID(rows[len(rows)-1].Id)
	}

	return &types.NotificationCursorPageResponse{
		PageSize:   pageSize,
		HasMore:    hasMore,
		NextCursor: nextCursor,
		List:       list,
	}, nil
}
