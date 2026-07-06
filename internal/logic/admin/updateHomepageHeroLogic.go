// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package admin

import (
	"context"
	"strings"

	commonauth "discover_world/internal/common/auth"
	commonresponse "discover_world/internal/common/response"
	homepageLogic "discover_world/internal/logic/homepage"
	"discover_world/internal/svc"
	"discover_world/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type UpdateHomepageHeroLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewUpdateHomepageHeroLogic(ctx context.Context, svcCtx *svc.ServiceContext) *UpdateHomepageHeroLogic {
	return &UpdateHomepageHeroLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *UpdateHomepageHeroLogic) UpdateHomepageHero(req *types.UpdateHomepageHeroRequest) (resp *types.HomepageConfigResponse, err error) {
	if req == nil {
		req = &types.UpdateHomepageHeroRequest{}
	}

	adminUser, err := commonauth.LoadRequiredAdminUser(l.ctx, l.svcCtx, "")
	if err != nil {
		return nil, err
	}

	// Empty assetId clears the hero selection.
	var assetID uint64
	if strings.TrimSpace(req.AssetId) != "" {
		assetID, err = homepageLogic.ParseAssetID(req.AssetId, "assetId")
		if err != nil {
			return nil, err
		}
		assetsByID, err := l.svcCtx.MediaAssetModel.FindPublicApprovedByIDs(l.ctx, []uint64{assetID})
		if err != nil {
			return nil, commonresponse.InternalServerError("查询已发布作品失败")
		}
		if assetsByID[assetID] == nil {
			return nil, commonresponse.BadRequest("Hero 图必须从已公开的作品中选择")
		}
	}

	valueJSON, err := homepageLogic.MarshalHeroConfig(assetID, req.FocalX, req.FocalY)
	if err != nil {
		return nil, err
	}

	if err := l.svcCtx.SiteConfigModel.UpsertByKey(l.ctx, homepageLogic.SiteConfigKeyHero, valueJSON, adminUser.Id); err != nil {
		return nil, commonresponse.InternalServerError("保存 Hero 配置失败")
	}

	return homepageLogic.BuildHomepageConfigResponse(l.ctx, l.svcCtx, types.MediaVariantRequest{CompressType: 2})
}
