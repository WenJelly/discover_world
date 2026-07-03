// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package admin

import (
	"context"

	commonauth "discover_world/internal/common/auth"
	mediaLogic "discover_world/internal/logic/media"
	"discover_world/internal/svc"
	"discover_world/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type GetAdminMediaAssetListLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewGetAdminMediaAssetListLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetAdminMediaAssetListLogic {
	return &GetAdminMediaAssetListLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetAdminMediaAssetListLogic) GetAdminMediaAssetList(req *types.AdminQueryMediaAssetRequest) (resp *types.MediaAssetPageResponse, err error) {
	if req == nil {
		req = &types.AdminQueryMediaAssetRequest{}
	}

	adminUser, err := commonauth.LoadRequiredAdminUser(l.ctx, l.svcCtx, "")
	if err != nil {
		return nil, err
	}

	pageNum, pageSize, err := mediaLogic.NormalizeAdminMediaPage(req.PageNum, req.PageSize)
	if err != nil {
		return nil, err
	}

	whereSQL, args, err := mediaLogic.BuildAdminMediaAssetListWhere(req)
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

	list, err := mediaLogic.BuildMediaAssetListResponse(l.ctx, l.svcCtx, assets, adminUser, req.Variant)
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
