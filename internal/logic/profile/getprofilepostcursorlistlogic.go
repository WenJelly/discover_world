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

type GetProfilePostCursorListLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewGetProfilePostCursorListLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetProfilePostCursorListLogic {
	return &GetProfilePostCursorListLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetProfilePostCursorListLogic) GetProfilePostCursorList(req *types.ProfilePostListRequest) (resp *types.ProfilePostCursorPageResponse, err error) {
	if req == nil {
		req = &types.ProfilePostListRequest{}
	}

	loginUser, target, includePrivate, err := loadProfileTarget(l.ctx, l.svcCtx, req.UserId)
	if err != nil {
		return nil, err
	}
	pageSize, err := normalizeProfileCursorPage(req.PageSize)
	if err != nil {
		return nil, err
	}
	cursorID, err := decodeProfileCursor(req.Cursor)
	if err != nil {
		return nil, err
	}

	posts, err := l.svcCtx.PostModel.FindByUserBeforeID(l.ctx, target.Id, includePrivate, int64(cursorID), pageSize+1)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询动态失败")
	}

	hasMore := int64(len(posts)) > pageSize
	if hasMore {
		posts = posts[:pageSize]
	}

	postIDs := make([]uint64, 0, len(posts))
	for _, post := range posts {
		if post != nil {
			postIDs = append(postIDs, post.Id)
		}
	}

	assetIDsByPost, err := l.svcCtx.AssetLinkModel.FindActiveAssetIDsByOwners(l.ctx, ownerTypePost, linkRoleAttachment, postIDs)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询动态图片失败")
	}
	assetIDs := make([]uint64, 0)
	for _, ids := range assetIDsByPost {
		assetIDs = append(assetIDs, ids...)
	}
	mediaByID, err := buildMediaResponseMap(l.ctx, l.svcCtx, assetIDs, loginUser, types.MediaVariantRequest{CompressType: 2})
	if err != nil {
		return nil, err
	}
	statsByPost, err := l.svcCtx.EntityStatModel.FindByTargetIDs(l.ctx, targetTypePost, postIDs)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询动态统计失败")
	}

	list := make([]types.ProfilePostResponse, 0, len(posts))
	for _, post := range posts {
		if post == nil {
			continue
		}
		images := make([]types.MediaAssetResponse, 0, len(assetIDsByPost[post.Id]))
		for _, assetID := range assetIDsByPost[post.Id] {
			if image, ok := mediaByID[assetID]; ok {
				images = append(images, image)
			}
		}
		list = append(list, types.ProfilePostResponse{
			Id:         formatID(post.Id),
			UserId:     formatID(post.UserId),
			Content:    nullStringValue(post.Content),
			Visibility: post.Visibility,
			Status:     post.Status,
			Location:   nullStringValue(post.Location),
			Images:     images,
			Stats:      buildStats(statsByPost[post.Id]),
			CreatedAt:  formatTime(post.CreatedAt),
			UpdatedAt:  formatTime(post.UpdatedAt),
		})
	}

	nextCursor := ""
	if hasMore && len(posts) > 0 {
		nextCursor, err = encodeProfileCursor(posts[len(posts)-1].Id)
		if err != nil {
			return nil, err
		}
	}

	return &types.ProfilePostCursorPageResponse{
		PageSize:   pageSize,
		HasMore:    hasMore,
		NextCursor: nextCursor,
		List:       list,
	}, nil
}
