// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package feed

import (
	"context"

	commonresponse "discover_world/internal/common/response"
	mediaLogic "discover_world/internal/logic/media"
	"discover_world/internal/svc"
	"discover_world/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type GetFollowingMediaCursorListLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewGetFollowingMediaCursorListLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetFollowingMediaCursorListLogic {
	return &GetFollowingMediaCursorListLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetFollowingMediaCursorListLogic) GetFollowingMediaCursorList(req *types.FollowingMediaListRequest) (*types.MediaAssetCursorPageResponse, error) {
	if req == nil {
		req = &types.FollowingMediaListRequest{}
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

	followingIDs, _, err := l.svcCtx.UserFollowModel.ListFollowingIDs(l.ctx, loginUser.Id, 0, maxFollowingSourceUsers)
	if err != nil {
		return nil, commonresponse.InternalServerError("query following users failed")
	}
	if len(followingIDs) == 0 {
		return &types.MediaAssetCursorPageResponse{
			PageSize:   pageSize,
			HasMore:    false,
			NextCursor: "",
			List:       []types.MediaAssetResponse{},
		}, nil
	}

	assets, err := l.svcCtx.MediaAssetModel.FindPublicWorkByOwnersBeforeID(l.ctx, followingIDs, cursor, pageSize+1)
	if err != nil {
		return nil, commonresponse.InternalServerError("query following media failed")
	}
	hasMore := int64(len(assets)) > pageSize
	if hasMore {
		assets = assets[:pageSize]
	}

	list, err := mediaLogic.BuildMediaAssetListResponse(l.ctx, l.svcCtx, assets, loginUser, req.Variant)
	if err != nil {
		return nil, err
	}

	nextCursor := ""
	if hasMore && len(assets) > 0 {
		nextCursor = formatID(assets[len(assets)-1].Id)
	}

	return &types.MediaAssetCursorPageResponse{
		PageSize:   pageSize,
		HasMore:    hasMore,
		NextCursor: nextCursor,
		List:       list,
	}, nil
}
