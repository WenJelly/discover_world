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

type GetForumBoardListLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewGetForumBoardListLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetForumBoardListLogic {
	return &GetForumBoardListLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetForumBoardListLogic) GetForumBoardList(req *types.ForumBoardListRequest) (*types.ForumBoardListResponse, error) {
	if req == nil {
		req = &types.ForumBoardListRequest{}
	}
	pageSize, err := normalizeForumPageSize(req.PageSize)
	if err != nil {
		return nil, err
	}

	boards, err := l.svcCtx.Models.Forum.ForumBoard.FindActive(l.ctx, pageSize)
	if err != nil {
		return nil, commonresponse.InternalServerError("query forum boards failed")
	}
	list := make([]types.ForumBoardResponse, 0, len(boards))
	for _, board := range boards {
		list = append(list, buildForumBoardResponse(board))
	}
	return &types.ForumBoardListResponse{List: list}, nil
}
