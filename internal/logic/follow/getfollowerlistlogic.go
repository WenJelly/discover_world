package follow

import (
	"context"

	"discover_world/internal/svc"
	"discover_world/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type GetFollowerListLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewGetFollowerListLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetFollowerListLogic {
	return &GetFollowerListLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetFollowerListLogic) GetFollowerList(req *types.FollowListRequest) (*types.FollowUserListResponse, error) {
	loginUser, err := loadLoginUser(l.ctx, l.svcCtx)
	if err != nil {
		return nil, err
	}
	targetID, err := parseOptionalID(req.TargetUserId, "targetUserId")
	if err != nil {
		return nil, err
	}
	if targetID == 0 {
		targetID = loginUser.Id
	}
	if _, err := loadFollowTarget(l.ctx, l.svcCtx, targetID); err != nil {
		return nil, err
	}
	cursor, err := parseCursor(req.Cursor)
	if err != nil {
		return nil, err
	}
	pageSize := normalizePageSize(req.PageSize)
	refs, hasMore, err := l.svcCtx.UserFollowModel.ListFollowerRefs(l.ctx, targetID, cursor, pageSize)
	if err != nil {
		return nil, err
	}
	list, err := buildPublicAccountSummaries(l.ctx, l.svcCtx, refUserIDs(refs))
	if err != nil {
		return nil, err
	}
	return &types.FollowUserListResponse{
		PageSize:   pageSize,
		HasMore:    hasMore,
		NextCursor: nextCursor(refs, hasMore),
		List:       list,
	}, nil
}
