// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package profile

import (
	"context"
	"errors"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"discover_world/model"

	"github.com/zeromicro/go-zero/core/logx"
)

type GetProfileFeaturedMediaListLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewGetProfileFeaturedMediaListLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetProfileFeaturedMediaListLogic {
	return &GetProfileFeaturedMediaListLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetProfileFeaturedMediaListLogic) GetProfileFeaturedMediaList(req *types.ProfileFeaturedMediaListRequest) (resp *types.MediaAssetPageResponse, err error) {
	if req == nil {
		req = &types.ProfileFeaturedMediaListRequest{}
	}

	loginUser, target, _, err := loadProfileTarget(l.ctx, l.svcCtx, req.UserId)
	if err != nil {
		return nil, err
	}
	pageSize, err := normalizeProfileCursorPage(req.PageSize)
	if err != nil {
		return nil, err
	}

	userProfile, err := l.svcCtx.UserProfileModel.FindOneByUserId(l.ctx, target.Id)
	if err != nil {
		if errors.Is(err, model.ErrNotFound) {
			return &types.MediaAssetPageResponse{
				PageNum:  1,
				PageSize: pageSize,
				Total:    0,
				List:     []types.MediaAssetResponse{},
			}, nil
		}
		return nil, commonresponse.InternalServerError("查询用户资料失败")
	}

	assetIDs, err := l.svcCtx.AssetLinkModel.FindActiveAssetIDsByOwner(l.ctx, ownerTypeUserProfile, userProfile.Id, linkRoleFeaturedMedia, pageSize)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询精选图片失败")
	}
	mediaByID, err := buildMediaResponseMap(l.ctx, l.svcCtx, assetIDs, loginUser, req.Variant)
	if err != nil {
		return nil, err
	}

	list := make([]types.MediaAssetResponse, 0, len(assetIDs))
	for _, assetID := range assetIDs {
		if item, ok := mediaByID[assetID]; ok {
			list = append(list, item)
		}
	}

	return &types.MediaAssetPageResponse{
		PageNum:  1,
		PageSize: pageSize,
		Total:    int64(len(list)),
		List:     list,
	}, nil
}
