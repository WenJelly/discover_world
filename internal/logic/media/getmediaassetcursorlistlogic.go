// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package media

import (
	"context"

	"discover_world/internal/svc"
	"discover_world/internal/types"
	"discover_world/model"

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

	sort, err := normalizeMediaCursorSort(req.Sort)
	if err != nil {
		return nil, err
	}

	whereSQL, args, err := buildPublicMediaAssetListWhere(cursorRequestToFilter(req))
	if err != nil {
		return nil, err
	}

	var assets []*model.MediaAsset
	switch sort {
	case mediaCursorSortHot:
		cursor, err := decodeHotMediaCursor(req.Cursor)
		if err != nil {
			return nil, err
		}
		assets, err = l.svcCtx.MediaAssetModel.FindByWhereBeforeHotScore(l.ctx, whereSQL, cursor.HotScore, cursor.ID, pageSize+1, args...)
		if err != nil {
			return nil, err
		}
	case mediaCursorSortRising:
		cursor, err := decodeRisingMediaCursor(req.Cursor)
		if err != nil {
			return nil, err
		}
		assets, err = l.svcCtx.MediaAssetModel.FindByWhereBeforeRisingScore(l.ctx, whereSQL, cursor.RisingScore, cursor.ID, pageSize+1, args...)
		if err != nil {
			return nil, err
		}
	case mediaCursorSortCreated:
		cursor, err := decodeCreatedMediaCursor(req.Cursor)
		if err != nil {
			return nil, err
		}
		assets, err = l.svcCtx.MediaAssetModel.FindByWhereBeforeCreatedAt(l.ctx, whereSQL, cursor.CreatedAt, cursor.ID, pageSize+1, args...)
		if err != nil {
			return nil, err
		}
	default:
		cursorID, err := decodeMediaCursor(req.Cursor)
		if err != nil {
			return nil, err
		}
		assets, err = l.svcCtx.MediaAssetModel.FindByWhereBeforeID(l.ctx, whereSQL, "`id` desc", int64(cursorID), pageSize+1, args...)
		if err != nil {
			return nil, err
		}
	}

	hasMore := int64(len(assets)) > pageSize
	if hasMore {
		assets = assets[:pageSize]
	}

	nextCursor := ""
	if hasMore && len(assets) > 0 {
		lastAssetID := assets[len(assets)-1].Id
		switch sort {
		case mediaCursorSortHot:
			hotScore, err := l.svcCtx.MediaAssetModel.FindHotScoreByID(l.ctx, lastAssetID)
			if err != nil {
				return nil, err
			}
			nextCursor, err = encodeHotMediaCursor(lastAssetID, hotScore)
		case mediaCursorSortRising:
			risingScore, err := l.svcCtx.MediaAssetModel.FindRisingScoreByID(l.ctx, lastAssetID)
			if err != nil {
				return nil, err
			}
			nextCursor, err = encodeRisingMediaCursor(lastAssetID, risingScore)
		case mediaCursorSortCreated:
			nextCursor, err = encodeCreatedMediaCursor(lastAssetID, assets[len(assets)-1].CreatedAt)
		default:
			nextCursor, err = encodeMediaCursor(lastAssetID)
		}
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
