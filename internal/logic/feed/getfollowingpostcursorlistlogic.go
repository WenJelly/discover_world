// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package feed

import (
	"context"

	commonresponse "discover_world/internal/common/response"
	postlogic "discover_world/internal/logic/post"
	"discover_world/internal/svc"
	"discover_world/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type GetFollowingPostCursorListLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewGetFollowingPostCursorListLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetFollowingPostCursorListLogic {
	return &GetFollowingPostCursorListLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetFollowingPostCursorListLogic) GetFollowingPostCursorList(req *types.FollowingPostListRequest) (*types.PublicPostCursorPageResponse, error) {
	if req == nil {
		req = &types.FollowingPostListRequest{}
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

	followingIDs, _, err := l.svcCtx.Models.Follow.UserFollow.ListFollowingIDs(l.ctx, loginUser.Id, 0, maxFollowingSourceUsers)
	if err != nil {
		return nil, commonresponse.InternalServerError("query following users failed")
	}
	if len(followingIDs) == 0 {
		return &types.PublicPostCursorPageResponse{
			PageSize:   pageSize,
			HasMore:    false,
			NextCursor: "",
			List:       []types.PublicPostResponse{},
		}, nil
	}

	posts, err := l.svcCtx.Models.Post.Post.FindPublicByAuthorsBeforeCursor(l.ctx, followingIDs, cursor, pageSize+1)
	if err != nil {
		return nil, commonresponse.InternalServerError("query following posts failed")
	}
	hasMore := int64(len(posts)) > pageSize
	if hasMore {
		posts = posts[:pageSize]
	}

	list, err := postlogic.BuildPublicPostResponses(l.ctx, l.svcCtx, posts, loginUser)
	if err != nil {
		return nil, err
	}

	nextCursor := ""
	if hasMore && len(posts) > 0 {
		nextCursor = formatID(posts[len(posts)-1].Id)
	}

	return &types.PublicPostCursorPageResponse{
		PageSize:   pageSize,
		HasMore:    hasMore,
		NextCursor: nextCursor,
		List:       list,
	}, nil
}
