// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package admin

import (
	"context"

	"discover_world/internal/common/adminsupport"
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

	adminUser, err := adminsupport.RequireAdminCapability(l.ctx, l.svcCtx, adminsupport.CapabilityOperationManage)
	if err != nil {
		return nil, err
	}

	ids, err := homepageLogic.ParseFeaturedAssetIDs(req.MediaAssetIds)
	if err != nil {
		return nil, err
	}

	// Every selected work must currently be public + approved (site-wide; an
	// admin may feature any user's published work).
	if len(ids) > 0 {
		assetsByID, err := l.svcCtx.Models.Media.MediaAsset.FindPublicApprovedByIDs(l.ctx, ids)
		if err != nil {
			return nil, commonresponse.InternalServerError("查询已发布作品失败")
		}
		for _, id := range ids {
			if assetsByID[id] == nil {
				return nil, commonresponse.BadRequest("首页精选必须从已公开的作品中选择")
			}
		}
	}

	existing, err := l.svcCtx.Models.Media.AssetLink.FindActiveAssetIDsByOwner(l.ctx, homepageLogic.OwnerTypeSite, homepageLogic.OwnerIDSite, homepageLogic.LinkRoleHomepageFeatured, homepageLogic.MaxHomepageFeaturedCount)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询首页精选失败")
	}

	if err := adminsupport.TransactOperation(l.ctx, l.svcCtx, adminsupport.OperationLogInput{
		OperatorUserID: adminUser.Id,
		Action:         "homepage.featured.update",
		TargetType:     "homepage",
		TargetID:       homepageLogic.OwnerIDSite,
		Before:         map[string]any{"featuredIds": existing},
		After:          map[string]any{"featuredIds": ids},
	}, func(ctx context.Context, txSvcCtx *svc.ServiceContext) error {
		if err := txSvcCtx.Models.Media.AssetLink.ReplaceActiveAssetIDsByOwner(ctx, homepageLogic.OwnerTypeSite, homepageLogic.OwnerIDSite, homepageLogic.LinkRoleHomepageFeatured, ids); err != nil {
			return commonresponse.InternalServerError("保存首页精选失败")
		}
		return nil
	}); err != nil {
		return nil, err
	}
	if err := l.svcCtx.InvalidateHomepageCache(l.ctx); err != nil {
		l.Errorf("invalidate homepage cache after featured update failed: %v", err)
	}

	return homepageLogic.BuildHomepageConfigResponse(l.ctx, l.svcCtx, types.MediaVariantRequest{CompressType: 2})
}
