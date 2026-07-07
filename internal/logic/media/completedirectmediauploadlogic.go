// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package media

import (
	"context"

	"discover_world/internal/svc"
	"discover_world/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type CompleteDirectMediaUploadLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewCompleteDirectMediaUploadLogic(ctx context.Context, svcCtx *svc.ServiceContext) *CompleteDirectMediaUploadLogic {
	return &CompleteDirectMediaUploadLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *CompleteDirectMediaUploadLogic) CompleteDirectMediaUpload(req *types.MediaAssetDirectUploadCompleteRequest, authorization string) (resp *types.MediaAssetResponse, err error) {
	return completeDirectMediaUpload(l.ctx, l.svcCtx, req, authorization)
}
