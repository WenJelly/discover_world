package admin

import (
	"context"
	"errors"
	"github.com/zeromicro/go-zero/core/stores/sqlx"

	"discover_world/internal/common/adminsupport"
	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"github.com/zeromicro/go-zero/core/logx"
)

type FeatureAdminContentLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewFeatureAdminContentLogic(ctx context.Context, svcCtx *svc.ServiceContext) *FeatureAdminContentLogic {
	return &FeatureAdminContentLogic{Logger: logx.WithContext(ctx), ctx: ctx, svcCtx: svcCtx}
}

func (l *FeatureAdminContentLogic) FeatureAdminContent(req *types.AdminFeatureContentRequest) error {
	if req == nil {
		return commonresponse.BadRequest("请求不能为空")
	}
	adminUser, err := adminsupport.RequireAdminCapability(l.ctx, l.svcCtx, adminsupport.CapabilityOperationManage)
	if err != nil {
		return err
	}
	if req.TargetType != adminTargetMediaAsset {
		return commonresponse.BadRequest("targetType 只支持 media_asset")
	}
	targetID, err := parseRequiredID(req.TargetId, "targetId")
	if err != nil {
		return err
	}
	asset, err := l.svcCtx.Models.Media.MediaAsset.FindOneActive(l.ctx, targetID)
	if err != nil {
		if errors.Is(err, sqlx.ErrNotFound) {
			return commonresponse.NotFound("媒体资源不存在")
		}
		return commonresponse.InternalServerError("查询媒体资源失败")
	}
	if asset.AuditStatus != "approved" || asset.AssetUsage != "work" {
		return commonresponse.BadRequest("只能精选已审核通过的作品")
	}
	existing, err := l.svcCtx.Models.Media.AssetLink.FindActiveAssetIDsByOwner(l.ctx, adminOwnerTypeSite, adminOwnerIDSite, adminLinkRoleFeatured, 100)
	if err != nil {
		return commonresponse.InternalServerError("查询精选内容失败")
	}
	next := append(existing, targetID)
	return adminsupport.TransactOperation(l.ctx, l.svcCtx, adminsupport.OperationLogInput{
		OperatorUserID: adminUser.Id,
		Action:         "content.feature",
		TargetType:     adminTargetMediaAsset,
		TargetID:       targetID,
		Reason:         req.Reason,
		Before:         map[string]any{"featuredIds": existing},
		After:          map[string]any{"featuredIds": next},
	}, func(ctx context.Context, txSvcCtx *svc.ServiceContext) error {
		if err := txSvcCtx.Models.Media.AssetLink.ReplaceActiveAssetIDsByOwner(ctx, adminOwnerTypeSite, adminOwnerIDSite, adminLinkRoleFeatured, next); err != nil {
			return commonresponse.InternalServerError("保存精选内容失败")
		}
		return nil
	})
}
