// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package media

import (
	"context"
	"database/sql"
	"errors"
	"github.com/zeromicro/go-zero/core/stores/sqlx"
	"time"

	commonauth "discover_world/internal/common/auth"
	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"github.com/zeromicro/go-zero/core/logx"
)

type DeleteMediaAssetLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewDeleteMediaAssetLogic(ctx context.Context, svcCtx *svc.ServiceContext) *DeleteMediaAssetLogic {
	return &DeleteMediaAssetLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *DeleteMediaAssetLogic) DeleteMediaAsset(req *types.DeleteMediaAssetRequest) error {
	if req == nil {
		return commonresponse.BadRequest("请求不能为空")
	}

	id, err := parseRequiredID(req.Id, "id")
	if err != nil {
		return err
	}

	loginUser, err := commonauth.LoadRequiredLoginUser(l.ctx, l.svcCtx, "")
	if err != nil {
		return err
	}

	asset, err := l.svcCtx.MediaAssetModel.FindOneActive(l.ctx, id)
	if err != nil {
		if errors.Is(err, sqlx.ErrNotFound) {
			return commonresponse.NotFound("媒体资源不存在")
		}
		return commonresponse.InternalServerError("查询媒体资源失败")
	}
	if !canManageMediaAsset(asset, loginUser, l.svcCtx) {
		return commonresponse.Forbidden("无权删除该媒体资源")
	}

	links, err := l.svcCtx.AssetLinkModel.FindActiveByAssetID(l.ctx, asset.Id)
	if err != nil {
		return commonresponse.InternalServerError("查询媒体引用失败")
	}
	references := buildMediaDeleteReferenceSummary(links)
	avatarProfiles, err := l.svcCtx.UserProfileModel.FindAvatarReferencesByAssetID(l.ctx, asset.Id)
	if err != nil {
		return commonresponse.InternalServerError("查询头像引用失败")
	}
	coverAlbums, err := l.svcCtx.AlbumModel.FindCoverReferencesByAssetID(l.ctx, asset.Id)
	if err != nil {
		return commonresponse.InternalServerError("查询相册封面引用失败")
	}
	references.addBlockingLabels(buildDirectMediaDeleteReferenceLabels(avatarProfiles, coverAlbums)...)

	if references.hasBlockingReferences() {
		return commonresponse.Conflict(references.blockingMessage())
	}
	if references.requiresForceConfirmation() && !req.Force {
		return commonresponse.Conflict(references.forceConfirmationMessage())
	}

	err = l.svcCtx.Transact(l.ctx, func(ctx context.Context, txSvc *svc.ServiceContext) error {
		asset.Status = "deleted"
		asset.DeletedAt = sql.NullTime{Time: time.Now(), Valid: true}
		if err := txSvc.MediaAssetModel.Update(ctx, asset); err != nil {
			return err
		}
		refreshMediaRanking(ctx, txSvc, asset.Id)
		if err := txSvc.MediaObjectModel.MarkDeletedByAssetID(ctx, asset.Id); err != nil {
			return err
		}
		if references.hasPostReferences() {
			return txSvc.AssetLinkModel.DeactivateActiveByAssetIDAndOwnerRole(ctx, asset.Id, deleteReferenceOwnerPost, deleteReferenceRoleAttachment)
		}
		return nil
	})
	if err != nil {
		return commonresponse.InternalServerError("删除媒体资源失败")
	}
	if err := l.svcCtx.InvalidateHomepageCache(l.ctx); err != nil {
		l.Errorf("invalidate homepage cache after media delete failed: %v", err)
	}

	return nil
}
