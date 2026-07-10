// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package media

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/logic/adminsupport"
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

	adminUser, err := adminsupport.RequireAdminCapability(l.ctx, l.svcCtx, adminsupport.CapabilityMediaReview)
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
	before := map[string]any{
		"id":           formatID(asset.Id),
		"auditStatus":  asset.AuditStatus,
		"metadataJson": nullStringValue(asset.MetadataJson),
	}
	asset.AuditStatus = auditStatus
	asset.MetadataJson = mergeReviewMetadata(asset.MetadataJson, strings.TrimSpace(req.ReviewMessage), formatID(adminUser.Id), formatTime(now))
	if err := l.svcCtx.MediaAssetModel.Update(l.ctx, asset); err != nil {
		return nil, commonresponse.InternalServerError("审核媒体资源失败")
	}
	if err := adminsupport.RecordOperation(l.ctx, l.svcCtx, adminsupport.OperationLogInput{
		OperatorUserID: adminUser.Id,
		Action:         "media.review",
		TargetType:     targetTypeMediaAsset,
		TargetID:       asset.Id,
		Reason:         req.ReviewMessage,
		Before:         before,
		After: map[string]any{
			"id":           formatID(asset.Id),
			"auditStatus":  asset.AuditStatus,
			"metadataJson": nullStringValue(asset.MetadataJson),
		},
	}); err != nil {
		return nil, err
	}
	if asset.OwnerUserId != adminUser.Id {
		title := "作品审核已更新"
		if auditStatus == "approved" {
			title = "作品审核通过"
		} else if auditStatus == "rejected" {
			title = "作品审核未通过"
		}
		if _, err := l.svcCtx.NotificationModel.Insert(l.ctx, &model.Notification{
			RecipientUserId: asset.OwnerUserId,
			ActorUserId:     sql.NullInt64{Int64: int64(adminUser.Id), Valid: true},
			EventType:       "media_review",
			TargetType:      targetTypeMediaAsset,
			TargetId:        asset.Id,
			Title:           title,
			Content:         sql.NullString{String: strings.TrimSpace(req.ReviewMessage), Valid: strings.TrimSpace(req.ReviewMessage) != ""},
		}); err != nil {
			l.Errorf("create media review notification failed: assetId=%d ownerId=%d err=%v", asset.Id, asset.OwnerUserId, err)
		}
	}

	owner, _ := l.svcCtx.UserAccountModel.FindOne(l.ctx, asset.OwnerUserId)
	profile, _ := l.svcCtx.UserProfileModel.FindOneByUserId(l.ctx, asset.OwnerUserId)
	stat, _ := l.svcCtx.EntityStatModel.FindOneByTargetTypeTargetId(l.ctx, targetTypeMediaAsset, asset.Id)
	tags, _ := l.svcCtx.TaggingModel.FindNamesByTargetIDs(l.ctx, targetTypeMediaAsset, []uint64{asset.Id})

	return buildMediaAssetResponse(l.ctx, l.svcCtx, asset, nil, owner, profile, stat, tags[asset.Id], adminUser, types.MediaVariantRequest{})
}
