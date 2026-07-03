// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package media

import (
	"context"
	"mime/multipart"

	"discover_world/internal/svc"
	"discover_world/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type UploadMediaAssetLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewUploadMediaAssetLogic(ctx context.Context, svcCtx *svc.ServiceContext) *UploadMediaAssetLogic {
	return &UploadMediaAssetLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *UploadMediaAssetLogic) UploadMediaAsset(file multipart.File, header *multipart.FileHeader, req mediaWriteRequest, authorization string) (resp *types.MediaAssetResponse, err error) {
	return storeMultipartMediaAsset(l.ctx, l.svcCtx, file, header, req, authorization)
}
