// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package media

import (
	"context"

	"discover_world/internal/svc"
	"discover_world/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type UploadMediaAssetByUrlLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewUploadMediaAssetByUrlLogic(ctx context.Context, svcCtx *svc.ServiceContext) *UploadMediaAssetByUrlLogic {
	return &UploadMediaAssetByUrlLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *UploadMediaAssetByUrlLogic) UploadMediaAssetByUrl(req *types.MediaAssetUploadByUrlRequest) (resp *types.MediaAssetResponse, err error) {
	return storeRemoteMediaAsset(l.ctx, l.svcCtx, req, "")
}
