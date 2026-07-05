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

type GetPostCommentCursorListLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewGetPostCommentCursorListLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetPostCommentCursorListLogic {
	return &GetPostCommentCursorListLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetPostCommentCursorListLogic) GetPostCommentCursorList(req *types.PostCommentCursorListRequest) (*types.PostCommentCursorPageResponse, error) {
	if req == nil {
		return nil, commonresponse.BadRequest("request cannot be empty")
	}
	postID, err := parseRequiredID(req.PostId, "postId")
	if err != nil {
		return nil, err
	}
	pageSize, err := normalizeCommentPageSize(req.PageSize)
	if err != nil {
		return nil, err
	}
	cursorID, err := decodeCursor(req.Cursor)
	if err != nil {
		return nil, err
	}
	loginUser, err := loadLoginUser(l.ctx, l.svcCtx)
	if err != nil {
		return nil, err
	}
	if _, err := loadVisiblePost(l.ctx, l.svcCtx, postID, loginUser); err != nil {
		return nil, err
	}

	comments, err := l.svcCtx.CommentRecordModel.FindActiveByTargetBeforeID(l.ctx, targetTypePost, postID, int64(cursorID), pageSize+1)
	if err != nil {
		return nil, commonresponse.InternalServerError("query post comments failed")
	}
	hasMore := int64(len(comments)) > pageSize
	if hasMore {
		comments = comments[:pageSize]
	}
	list, err := buildCommentResponses(l.ctx, l.svcCtx, comments)
	if err != nil {
		return nil, err
	}
	nextCursor := ""
	if hasMore && len(comments) > 0 {
		nextCursor, err = encodeCursor(comments[len(comments)-1].Id)
		if err != nil {
			return nil, commonresponse.InternalServerError("encode cursor failed")
		}
	}

	return &types.PostCommentCursorPageResponse{
		PageSize:   pageSize,
		HasMore:    hasMore,
		NextCursor: nextCursor,
		List:       list,
	}, nil
}
