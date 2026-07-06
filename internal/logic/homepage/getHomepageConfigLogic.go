// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package homepage

import (
	"context"

	"discover_world/internal/svc"
	"discover_world/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type GetHomepageConfigLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewGetHomepageConfigLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetHomepageConfigLogic {
	return &GetHomepageConfigLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetHomepageConfigLogic) GetHomepageConfig(req *types.GetHomepageConfigRequest) (resp *types.HomepageConfigResponse, err error) {
	if req == nil {
		req = &types.GetHomepageConfigRequest{}
	}

	return BuildHomepageConfigResponse(l.ctx, l.svcCtx, req.Variant)
}
