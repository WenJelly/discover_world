// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package post

import (
	"context"
	"strings"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type UpdatePostLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewUpdatePostLogic(ctx context.Context, svcCtx *svc.ServiceContext) *UpdatePostLogic {
	return &UpdatePostLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *UpdatePostLogic) UpdatePost(req *types.UpdatePostRequest) (*types.ProfilePostResponse, error) {
	if req == nil {
		return nil, commonresponse.BadRequest("request cannot be empty")
	}
	postID, err := parseRequiredID(req.Id, "id")
	if err != nil {
		return nil, err
	}
	loginUser, err := loadLoginUser(l.ctx, l.svcCtx)
	if err != nil {
		return nil, err
	}
	existing, err := l.svcCtx.PostModel.FindOneActive(l.ctx, postID)
	if err != nil {
		return nil, commonresponse.NotFound("post not found")
	}
	if !canManagePost(existing, loginUser, l.svcCtx) {
		return nil, commonresponse.Forbidden("no permission to update this post")
	}

	content, err := normalizePostContent(req.Content)
	if err != nil {
		return nil, err
	}
	postType, err := normalizePostType(req.PostType)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(req.PostType) == "" {
		postType = normalizePostTypeValue(existing.PostType)
	}
	visibility, err := normalizePostVisibility(req.Visibility)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(req.Visibility) == "" {
		visibility = existing.Visibility
	}
	location, err := normalizePostLocation(req.Location)
	if err != nil {
		return nil, err
	}

	replaceImages := req.ImageIds != nil
	imageIDs := []uint64(nil)
	if replaceImages {
		imageIDs, err = parsePostImageIDs(req.ImageIds)
		if err != nil {
			return nil, err
		}
	} else {
		imageIDs, err = l.svcCtx.AssetLinkModel.FindActiveAssetIDsByOwner(l.ctx, ownerTypePost, existing.Id, linkRoleAttachment, maxPostImageCount)
		if err != nil {
			return nil, commonresponse.InternalServerError("query post images failed")
		}
	}
	if err := validatePostImages(l.ctx, l.svcCtx, existing.UserId, imageIDs, visibility); err != nil {
		return nil, err
	}
	if err := validatePostBody(content, imageIDs); err != nil {
		return nil, err
	}

	existing.Content = optionalString(content)
	existing.PostType = postType
	existing.Visibility = visibility
	existing.Location = optionalString(location)
	existing.Status = postStatusActive

	err = l.svcCtx.Transact(l.ctx, func(ctx context.Context, txSvc *svc.ServiceContext) error {
		if err := txSvc.PostModel.Update(ctx, existing); err != nil {
			return err
		}
		if replaceImages {
			return txSvc.AssetLinkModel.ReplaceActiveAssetIDsByOwner(ctx, ownerTypePost, existing.Id, linkRoleAttachment, imageIDs)
		}
		return nil
	})
	if err != nil {
		return nil, commonresponse.InternalServerError("update post failed")
	}

	updated, err := l.svcCtx.PostModel.FindOneActive(l.ctx, existing.Id)
	if err != nil {
		return nil, commonresponse.InternalServerError("load updated post failed")
	}
	return buildPostResponse(l.ctx, l.svcCtx, updated, loginUser)
}
