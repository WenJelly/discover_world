// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package media

import (
	"context"

	"discover_world/internal/svc"
	"discover_world/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type GetMediaAssetCursorListLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewGetMediaAssetCursorListLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetMediaAssetCursorListLogic {
	return &GetMediaAssetCursorListLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetMediaAssetCursorListLogic) GetMediaAssetCursorList(req *types.CursorQueryMediaAssetRequest) (resp *types.MediaAssetCursorPageResponse, err error) {
	if req == nil {
		req = &types.CursorQueryMediaAssetRequest{}
	}

	pageSize, err := normalizeMediaCursorPage(req.PageSize)
	if err != nil {
		return nil, err
	}

	cursorID, err := decodeMediaCursor(req.Cursor)
	if err != nil {
		return nil, err
	}

	whereSQL, args, err := buildPublicMediaAssetListWhere(cursorRequestToFilter(req))
	if err != nil {
		return nil, err
	}

	assets, err := l.svcCtx.MediaAssetModel.FindByWhereBeforeID(l.ctx, whereSQL, "`id` desc", int64(cursorID), pageSize+1, args...)
	if err != nil {
		return nil, err
	}

	hasMore := int64(len(assets)) > pageSize
	if hasMore {
		assets = assets[:pageSize]
	}

	nextCursor := ""
	if hasMore && len(assets) > 0 {
		nextCursor, err = encodeMediaCursor(assets[len(assets)-1].Id)
		if err != nil {
			return nil, err
		}
	}

	list, err := buildMediaAssetListResponse(l.ctx, l.svcCtx, assets, nil, req.Variant)
	if err != nil {
		return nil, err
	}

	return &types.MediaAssetCursorPageResponse{
		PageSize:   pageSize,
		HasMore:    hasMore,
		NextCursor: nextCursor,
		List:       list,
	}, nil
}
