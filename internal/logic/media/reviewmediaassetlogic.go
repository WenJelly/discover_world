// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package media

import (
	"context"
	"errors"
	"strings"
	"time"

	commonauth "discover_world/internal/common/auth"
	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"discover_world/model"

	"github.com/zeromicro/go-zero/core/logx"
)

type ReviewMediaAssetLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewReviewMediaAssetLogic(ctx context.Context, svcCtx *svc.ServiceContext) *ReviewMediaAssetLogic {
	return &ReviewMediaAssetLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *ReviewMediaAssetLogic) ReviewMediaAsset(req *types.ReviewMediaAssetRequest) (resp *types.MediaAssetResponse, err error) {
	if req == nil {
		return nil, commonresponse.BadRequest("请求不能为空")
	}

	adminUser, err := commonauth.LoadRequiredAdminUser(l.ctx, l.svcCtx, "")
	if err != nil {
		return nil, err
	}

	id, err := parseRequiredID(req.Id, "id")
	if err != nil {
		return nil, err
	}
	auditStatus, err := normalizeAuditStatus(req.AuditStatus, "")
	if err != nil {
		return nil, err
	}
	if auditStatus == "" || auditStatus == "all" {
		return nil, commonresponse.BadRequest("auditStatus 必须是 pending、approved 或 rejected")
	}

	asset, err := l.svcCtx.MediaAssetModel.FindOneActive(l.ctx, id)
	if err != nil {
		if errors.Is(err, model.ErrNotFound) {
			return nil, commonresponse.NotFound("媒体资源不存在")
		}
		return nil, commonresponse.InternalServerError("查询媒体资源失败")
	}

	now := time.Now()
	asset.AuditStatus = auditStatus
	asset.MetadataJson = mergeReviewMetadata(asset.MetadataJson, strings.TrimSpace(req.ReviewMessage), formatID(adminUser.Id), formatTime(now))
	if err := l.svcCtx.MediaAssetModel.Update(l.ctx, asset); err != nil {
		return nil, commonresponse.InternalServerError("审核媒体资源失败")
	}

	owner, _ := l.svcCtx.UserAccountModel.FindOne(l.ctx, asset.OwnerUserId)
	profile, _ := l.svcCtx.UserProfileModel.FindOneByUserId(l.ctx, asset.OwnerUserId)
	stat, _ := l.svcCtx.EntityStatModel.FindOneByTargetTypeTargetId(l.ctx, targetTypeMediaAsset, asset.Id)
	tags, _ := l.svcCtx.TaggingModel.FindNamesByTargetIDs(l.ctx, targetTypeMediaAsset, []uint64{asset.Id})

	return buildMediaAssetResponse(l.ctx, l.svcCtx, asset, nil, owner, profile, stat, tags[asset.Id], adminUser, types.MediaVariantRequest{})
}
