// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package media

import (
	"context"

	"discover_world/internal/svc"
	"discover_world/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type InitDirectMediaUploadLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewInitDirectMediaUploadLogic(ctx context.Context, svcCtx *svc.ServiceContext) *InitDirectMediaUploadLogic {
	return &InitDirectMediaUploadLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *InitDirectMediaUploadLogic) InitDirectMediaUpload(req *types.MediaAssetDirectUploadInitRequest, authorization string) (resp *types.MediaAssetDirectUploadInitResponse, err error) {
	return initDirectMediaUpload(l.ctx, l.svcCtx, req, authorization)
}
