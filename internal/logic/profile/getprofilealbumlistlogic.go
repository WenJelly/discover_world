// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package profile

import (
	"context"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type GetProfileAlbumListLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewGetProfileAlbumListLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetProfileAlbumListLogic {
	return &GetProfileAlbumListLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetProfileAlbumListLogic) GetProfileAlbumList(req *types.ProfileAlbumListRequest) (resp *types.ProfileAlbumPageResponse, err error) {
	if req == nil {
		req = &types.ProfileAlbumListRequest{}
	}

	loginUser, target, includePrivate, err := loadProfileTarget(l.ctx, l.svcCtx, req.UserId)
	if err != nil {
		return nil, err
	}
	pageNum, pageSize, err := normalizeProfilePage(req.PageNum, req.PageSize)
	if err != nil {
		return nil, err
	}

	total, err := l.svcCtx.AlbumModel.CountByUser(l.ctx, target.Id, includePrivate)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询相册数量失败")
	}
	albums, err := l.svcCtx.AlbumModel.FindByUser(l.ctx, target.Id, includePrivate, pageSize, (pageNum-1)*pageSize)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询相册失败")
	}

	albumIDs := make([]uint64, 0, len(albums))
	coverAssetIDs := make([]uint64, 0, len(albums))
	for _, album := range albums {
		if album == nil {
			continue
		}
		albumIDs = append(albumIDs, album.Id)
		if album.CoverAssetId.Valid && album.CoverAssetId.Int64 > 0 {
			coverAssetIDs = append(coverAssetIDs, uint64(album.CoverAssetId.Int64))
		}
	}

	itemCounts, err := l.svcCtx.AssetLinkModel.CountActiveByOwners(l.ctx, ownerTypeAlbum, linkRoleAlbumItem, albumIDs)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询相册图片数量失败")
	}
	mediaByID, err := buildMediaResponseMap(l.ctx, l.svcCtx, coverAssetIDs, loginUser, types.MediaVariantRequest{CompressType: 2})
	if err != nil {
		return nil, err
	}

	list := make([]types.ProfileAlbumResponse, 0, len(albums))
	for _, album := range albums {
		if album == nil {
			continue
		}
		var cover types.MediaAssetResponse
		if album.CoverAssetId.Valid && album.CoverAssetId.Int64 > 0 {
			cover = mediaByID[uint64(album.CoverAssetId.Int64)]
		}
		list = append(list, types.ProfileAlbumResponse{
			Id:          formatID(album.Id),
			UserId:      formatID(album.UserId),
			Name:        album.Name,
			Description: nullStringValue(album.Description),
			Cover:       cover,
			ItemCount:   itemCounts[album.Id],
			Visibility:  album.Visibility,
			Status:      album.Status,
			CreatedAt:   formatTime(album.CreatedAt),
			UpdatedAt:   formatTime(album.UpdatedAt),
		})
	}

	return &types.ProfileAlbumPageResponse{
		PageNum:  pageNum,
		PageSize: pageSize,
		Total:    total,
		List:     list,
	}, nil
}
