// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package post

import (
	"context"
	"database/sql"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/logic/ipgeo"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"discover_world/model"

	"github.com/zeromicro/go-zero/core/logx"
)

type CreatePostLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewCreatePostLogic(ctx context.Context, svcCtx *svc.ServiceContext) *CreatePostLogic {
	return &CreatePostLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *CreatePostLogic) CreatePost(req *types.CreatePostRequest) (*types.ProfilePostResponse, error) {
	if req == nil {
		return nil, commonresponse.BadRequest("request cannot be empty")
	}
	loginUser, err := loadLoginUser(l.ctx, l.svcCtx)
	if err != nil {
		return nil, err
	}

	content, err := normalizePostContent(req.Content)
	if err != nil {
		return nil, err
	}
	postType, err := normalizePostType(req.PostType)
	if err != nil {
		return nil, err
	}
	visibility, err := normalizePostVisibility(req.Visibility)
	if err != nil {
		return nil, err
	}
	imageIDs, err := parsePostImageIDs(req.ImageIds)
	if err != nil {
		return nil, err
	}
	if err := validatePostBody(content, imageIDs); err != nil {
		return nil, err
	}
	if err := validatePostImages(l.ctx, l.svcCtx, loginUser.Id, imageIDs, visibility); err != nil {
		return nil, err
	}

	var postID uint64
	err = l.svcCtx.Transact(l.ctx, func(ctx context.Context, txSvc *svc.ServiceContext) error {
		data := &model.Post{
			UserId:     loginUser.Id,
			Content:    optionalString(content),
			PostType:   postType,
			Visibility: visibility,
			Status:     postStatusActive,
		}
		result, err := txSvc.PostModel.Insert(ctx, data)
		if err != nil {
			return err
		}
		id, err := result.LastInsertId()
		if err != nil || id <= 0 {
			return sql.ErrNoRows
		}
		postID = uint64(id)
		if err := txSvc.AssetLinkModel.ReplaceActiveAssetIDsByOwner(ctx, ownerTypePost, postID, linkRoleAttachment, imageIDs); err != nil {
			return err
		}
		if err := txSvc.EntityStatModel.Ensure(ctx, targetTypePost, postID); err != nil {
			return err
		}
		if err := ipgeo.RecordContentAttribution(ctx, txSvc, ipgeo.TargetTypePost, postID, ipgeo.ActionTypeCreate, loginUser.Id); err != nil {
			logx.WithContext(ctx).Errorf("record post ip attribution failed: postId=%d userId=%d err=%v", postID, loginUser.Id, err)
		}
		return nil
	})
	if err != nil {
		return nil, commonresponse.InternalServerError("create post failed")
	}

	created, err := l.svcCtx.PostModel.FindOneActive(l.ctx, postID)
	if err != nil {
		return nil, commonresponse.InternalServerError("load created post failed")
	}
	return buildPostResponse(l.ctx, l.svcCtx, created, loginUser)
}
