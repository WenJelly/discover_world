package follow

import (
	"context"

	"discover_world/internal/svc"
	"discover_world/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type GetFollowingListLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewGetFollowingListLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetFollowingListLogic {
	return &GetFollowingListLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetFollowingListLogic) GetFollowingList(req *types.FollowListRequest) (*types.FollowUserListResponse, error) {
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
	refs, hasMore, err := l.svcCtx.Models.Follow.UserFollow.ListFollowingRefs(l.ctx, targetID, cursor, pageSize)
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
