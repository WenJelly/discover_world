package admin

import (
	"context"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/logic/adminsupport"
	"discover_world/internal/svc"
	"discover_world/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type UnfeatureAdminContentLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewUnfeatureAdminContentLogic(ctx context.Context, svcCtx *svc.ServiceContext) *UnfeatureAdminContentLogic {
	return &UnfeatureAdminContentLogic{Logger: logx.WithContext(ctx), ctx: ctx, svcCtx: svcCtx}
}

func (l *UnfeatureAdminContentLogic) UnfeatureAdminContent(req *types.AdminFeatureContentRequest) error {
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
	if err := l.svcCtx.AssetLinkModel.DeactivateActiveByAssetIDAndOwnerRole(l.ctx, targetID, adminOwnerTypeSite, adminLinkRoleFeatured); err != nil {
		return commonresponse.InternalServerError("取消精选内容失败")
	}
	return adminsupport.RecordOperation(l.ctx, l.svcCtx, adminsupport.OperationLogInput{
		OperatorUserID: adminUser.Id,
		Action:         "content.unfeature",
		TargetType:     adminTargetMediaAsset,
		TargetID:       targetID,
		Reason:         req.Reason,
	})
}
