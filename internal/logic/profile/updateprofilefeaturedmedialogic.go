// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package profile

import (
	"context"

	commonauth "discover_world/internal/common/auth"
	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type UpdateProfileFeaturedMediaLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewUpdateProfileFeaturedMediaLogic(ctx context.Context, svcCtx *svc.ServiceContext) *UpdateProfileFeaturedMediaLogic {
	return &UpdateProfileFeaturedMediaLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *UpdateProfileFeaturedMediaLogic) UpdateProfileFeaturedMedia(req *types.UpdateProfileFeaturedMediaRequest) (resp *types.MediaAssetPageResponse, err error) {
	if req == nil {
		req = &types.UpdateProfileFeaturedMediaRequest{}
	}

	loginUser, err := commonauth.LoadRequiredLoginUser(l.ctx, l.svcCtx, "")
	if err != nil {
		return nil, err
	}
	userProfile, err := ensureProfileForAccount(l.ctx, l.svcCtx, loginUser)
	if err != nil {
		return nil, err
	}

	ids, err := parseProfileFeaturedMediaAssetIDs(req.MediaAssetIds)
	if err != nil {
		return nil, err
	}
	if len(ids) > 0 {
		assetsByID, err := l.svcCtx.Models.Media.MediaAsset.FindOwnerPublicApprovedByIDs(l.ctx, loginUser.Id, ids)
		if err != nil {
			return nil, commonresponse.InternalServerError("查询已发布图片失败")
		}
		for _, id := range ids {
			if assetsByID[id] == nil {
				return nil, commonresponse.BadRequest("个人精选照片必须从自己已发布的图片中选择")
			}
		}
	}

	if err := l.svcCtx.Transact(l.ctx, func(ctx context.Context, txSvcCtx *svc.ServiceContext) error {
		return txSvcCtx.Models.Media.AssetLink.ReplaceActiveAssetIDsByOwner(ctx, ownerTypeUserProfile, userProfile.Id, linkRoleFeaturedMedia, ids)
	}); err != nil {
		return nil, commonresponse.InternalServerError("保存个人精选图片失败")
	}

	return buildProfileFeaturedMediaPage(l.ctx, l.svcCtx, userProfile.Id, loginUser, types.MediaVariantRequest{CompressType: 2}, maxProfileFeaturedMediaCount)
}
