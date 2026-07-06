// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package account

import (
	"context"
	"database/sql"
	"mime/multipart"
	"strconv"

	commonauth "discover_world/internal/common/auth"
	commonresponse "discover_world/internal/common/response"
	mediaLogic "discover_world/internal/logic/media"
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

func (l *SetAccountAvatarLogic) SetAccountAvatar(file multipart.File, header *multipart.FileHeader, authorization string) (resp *types.DetailAccountResponse, err error) {
	loginUser, err := commonauth.LoadRequiredLoginUser(l.ctx, l.svcCtx, authorization)
	if err != nil {
		return nil, err
	}

	mediaResp, err := mediaLogic.StoreMultipartMediaAsset(l.ctx, l.svcCtx, file, header, mediaLogic.MediaWriteRequest{
		Title:      loginUser.Username + " avatar",
		Visibility: "public",
		UsageType:  "avatar",
		AssetUsage: "avatar",
	}, authorization)
	if err != nil {
		return nil, err
	}
	assetID, err := strconv.ParseUint(mediaResp.Id, 10, 64)
	if err != nil || assetID == 0 {
		return nil, commonresponse.InternalServerError("头像资源ID无效")
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
