// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package media

import (
	"context"

	"discover_world/internal/svc"
	"discover_world/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type GetMediaAssetListLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewGetMediaAssetListLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetMediaAssetListLogic {
	return &GetMediaAssetListLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetMediaAssetListLogic) GetMediaAssetList(req *types.QueryMediaAssetRequest) (resp *types.MediaAssetPageResponse, err error) {
	if req == nil {
		req = &types.QueryMediaAssetRequest{}
	}

	pageNum, pageSize, err := normalizePublicMediaPage(req.PageNum, req.PageSize)
	if err != nil {
		return nil, err
	}

	whereSQL, args, err := buildPublicMediaAssetListWhere(queryRequestToFilter(req))
	if err != nil {
		return nil, err
	}

	total, err := l.svcCtx.MediaAssetModel.CountByWhere(l.ctx, whereSQL, args...)
	if err != nil {
		return nil, err
	}
	if total == 0 {
		return &types.MediaAssetPageResponse{
			PageNum:  pageNum,
			PageSize: pageSize,
			Total:    0,
			List:     []types.MediaAssetResponse{},
		}, nil
	}

	assets, err := l.svcCtx.MediaAssetModel.FindByWhere(l.ctx, whereSQL, "`id` desc", pageSize, (pageNum-1)*pageSize, args...)
	if err != nil {
		return nil, err
	}

	list, err := buildMediaAssetListResponse(l.ctx, l.svcCtx, assets, nil, req.Variant)
	if err != nil {
		return nil, err
	}

	return &types.MediaAssetPageResponse{
		PageNum:  pageNum,
		PageSize: pageSize,
		Total:    total,
		List:     list,
	}, nil
}
