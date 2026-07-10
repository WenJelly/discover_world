// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package post

import (
	"context"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type GetPublicPostCursorListLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewGetPublicPostCursorListLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetPublicPostCursorListLogic {
	return &GetPublicPostCursorListLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetPublicPostCursorListLogic) GetPublicPostCursorList(req *types.PublicPostListRequest) (*types.PublicPostCursorPageResponse, error) {
	if req == nil {
		req = &types.PublicPostListRequest{}
	}

	pageSize, err := normalizePublicPostPageSize(req.PageSize)
	if err != nil {
		return nil, err
	}
	sort := normalizePublicPostSort(req.Sort)
	cursor, err := decodePublicPostCursor(req.Cursor)
	if err != nil {
		return nil, err
	}
	postType, err := normalizePostTypeFilter(req.PostType)
	if err != nil {
		return nil, err
	}

	posts, err := l.svcCtx.PostModel.FindPublicBeforeCursor(l.ctx, cursor, sort, req.SearchText, postType, pageSize+1)
	if err != nil {
		return nil, commonresponse.InternalServerError("query public posts failed")
	}

	hasMore := int64(len(posts)) > pageSize
	if hasMore {
		posts = posts[:pageSize]
	}

	// Public post responses include Author and reuse shared post media/stat assembly.
	list, err := buildPublicPostResponses(l.ctx, l.svcCtx, posts, nil)
	if err != nil {
		return nil, err
	}

	nextCursor := ""
	if hasMore && len(posts) > 0 {
		nextCursor, err = encodePublicPostCursor(posts[len(posts)-1])
		if err != nil {
			return nil, commonresponse.InternalServerError("encode cursor failed")
		}
	}

	return &types.PublicPostCursorPageResponse{
		PageSize:   pageSize,
		HasMore:    hasMore,
		NextCursor: nextCursor,
		List:       list,
	}, nil
}
