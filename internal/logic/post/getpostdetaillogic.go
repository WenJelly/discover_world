// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package post

import (
	"context"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type GetPostDetailLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewGetPostDetailLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetPostDetailLogic {
	return &GetPostDetailLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetPostDetailLogic) GetPostDetail(req *types.GetPostDetailRequest) (*types.ProfilePostResponse, error) {
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
	post, err := loadVisiblePost(l.ctx, l.svcCtx, postID, loginUser)
	if err != nil {
		return nil, err
	}
	if err := l.svcCtx.EntityStatModel.IncrementCounter(l.ctx, targetTypePost, post.Id, "view_count", 1); err != nil {
		return nil, commonresponse.InternalServerError("update post view count failed")
	}
	return buildPostResponse(l.ctx, l.svcCtx, post, loginUser)
}
