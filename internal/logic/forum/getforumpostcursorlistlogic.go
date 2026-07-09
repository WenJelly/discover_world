// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package forum

import (
	"context"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type GetForumPostCursorListLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewGetForumPostCursorListLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetForumPostCursorListLogic {
	return &GetForumPostCursorListLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetForumPostCursorListLogic) GetForumPostCursorList(req *types.ForumPostListRequest) (*types.ForumPostCursorPageResponse, error) {
	if req == nil {
		req = &types.ForumPostListRequest{}
	}
	pageSize, err := normalizeForumPageSize(req.PageSize)
	if err != nil {
		return nil, err
	}
	boardID := uint64(0)
	if req.BoardId != "" {
		boardID, err = parseRequiredID(req.BoardId, "boardId")
		if err != nil {
			return nil, err
		}
	}
	cursor := uint64(0)
	if req.Cursor != "" {
		cursor, err = parseRequiredID(req.Cursor, "cursor")
		if err != nil {
			return nil, err
		}
	}

	discussions, err := l.svcCtx.PostDiscussionModel.FindPublicByBoardBeforeCursor(l.ctx, boardID, cursor, pageSize+1)
	if err != nil {
		return nil, commonresponse.InternalServerError("query forum posts failed")
	}
	hasMore := int64(len(discussions)) > pageSize
	if hasMore {
		discussions = discussions[:pageSize]
	}

	// buildForumPostResponses loads post rows through PostModel.FindByIDs.
	list, err := buildForumPostResponses(l.ctx, l.svcCtx, discussions, nil)
	if err != nil {
		return nil, err
	}
	nextCursor := ""
	if hasMore && len(discussions) > 0 {
		nextCursor = formatID(discussions[len(discussions)-1].Id)
	}

	return &types.ForumPostCursorPageResponse{
		PageSize:   pageSize,
		HasMore:    hasMore,
		NextCursor: nextCursor,
		List:       list,
	}, nil
}
