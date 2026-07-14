// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package account

import (
	"context"
	"database/sql"
	mediamodel "discover_world/model/media"
	"errors"
	"github.com/zeromicro/go-zero/core/stores/sqlx"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"github.com/zeromicro/go-zero/core/logx"
)

type SetAccountAvatarLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewSetAccountAvatarLogic(ctx context.Context, svcCtx *svc.ServiceContext) *SetAccountAvatarLogic {
	return &SetAccountAvatarLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *SetAccountAvatarLogic) SetAccountAvatar(req *types.SetAccountAvatarRequest) (resp *types.DetailAccountResponse, err error) {
	if req == nil {
		return nil, commonresponse.BadRequest("请求不能为空")
	}

	loginUser, err := loadLoginAccount(l.ctx, l.svcCtx)
	if err != nil {
		return nil, err
	}

	assetID, err := parseRequiredID(req.AssetId, "assetId")
	if err != nil {
		return nil, err
	}
	asset, err := l.svcCtx.MediaAssetModel.FindOneActive(l.ctx, assetID)
	if err != nil {
		if errors.Is(err, sqlx.ErrNotFound) {
			return nil, commonresponse.NotFound("头像资源不存在")
		}
		return nil, commonresponse.InternalServerError("查询头像资源失败")
	}
	if err := validateAvatarAssetForUser(asset, loginUser.Id); err != nil {
		return nil, err
	}

	profile, err := ensureUserProfile(l.ctx, l.svcCtx, loginUser)
	if err != nil {
		return nil, err
	}
	profile.AvatarAssetId = sql.NullInt64{Int64: int64(assetID), Valid: true}
	if err := l.svcCtx.UserProfileModel.Update(l.ctx, profile); err != nil {
		return nil, commonresponse.InternalServerError("更新头像失败")
	}

	return loadDetailAccountResponse(l.ctx, l.svcCtx, loginUser)
}

func validateAvatarAssetForUser(asset *mediamodel.MediaAsset, userID uint64) error {
	if asset == nil {
		return commonresponse.NotFound("头像资源不存在")
	}
	if asset.OwnerUserId != userID {
		return commonresponse.Forbidden("无权使用该头像资源")
	}
	if asset.MediaType != "image" || asset.AssetUsage != "avatar" {
		return commonresponse.BadRequest("资源不是可用头像")
	}
	if asset.Status != "active" || asset.DeletedAt.Valid {
		return commonresponse.BadRequest("头像资源尚未上传完成")
	}
	if asset.Visibility != "public" || asset.AuditStatus != "approved" {
		return commonresponse.BadRequest("头像资源状态不可用")
	}
	return nil
}
