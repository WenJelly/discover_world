// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package admin

import (
	"context"

	commonauth "discover_world/internal/common/auth"
	commonresponse "discover_world/internal/common/response"
	homepageLogic "discover_world/internal/logic/homepage"
	"discover_world/internal/svc"
	"discover_world/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type UpdateHomepageFeaturedLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewUpdateHomepageFeaturedLogic(ctx context.Context, svcCtx *svc.ServiceContext) *UpdateHomepageFeaturedLogic {
	return &UpdateHomepageFeaturedLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *UpdateHomepageFeaturedLogic) UpdateHomepageFeatured(req *types.UpdateHomepageFeaturedRequest) (resp *types.HomepageConfigResponse, err error) {
	if req == nil {
		req = &types.UpdateHomepageFeaturedRequest{}
	}

	if _, err = commonauth.LoadRequiredAdminUser(l.ctx, l.svcCtx, ""); err != nil {
		return nil, err
	}

	ids, err := homepageLogic.ParseFeaturedAssetIDs(req.MediaAssetIds)
	if err != nil {
		return nil, err
	}

	// Every selected work must currently be public + approved (site-wide; an
	// admin may feature any user's published work).
	if len(ids) > 0 {
		assetsByID, err := l.svcCtx.MediaAssetModel.FindPublicApprovedByIDs(l.ctx, ids)
		if err != nil {
			return nil, commonresponse.InternalServerError("查询已发布作品失败")
		}
		for _, id := range ids {
			if assetsByID[id] == nil {
				return nil, commonresponse.BadRequest("首页精选必须从已公开的作品中选择")
			}
		}
	}

	if err := l.svcCtx.Transact(l.ctx, func(ctx context.Context, txSvcCtx *svc.ServiceContext) error {
		return txSvcCtx.AssetLinkModel.ReplaceActiveAssetIDsByOwner(ctx, homepageLogic.OwnerTypeSite, homepageLogic.OwnerIDSite, homepageLogic.LinkRoleHomepageFeatured, ids)
	}); err != nil {
		return nil, commonresponse.InternalServerError("保存首页精选失败")
	}

	return homepageLogic.BuildHomepageConfigResponse(l.ctx, l.svcCtx, types.MediaVariantRequest{CompressType: 2})
}
