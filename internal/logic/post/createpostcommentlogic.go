// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package post

import (
	"context"
	"database/sql"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"discover_world/model"

	"github.com/zeromicro/go-zero/core/logx"
)

type CreatePostCommentLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewCreatePostCommentLogic(ctx context.Context, svcCtx *svc.ServiceContext) *CreatePostCommentLogic {
	return &CreatePostCommentLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *CreatePostCommentLogic) CreatePostComment(req *types.CreatePostCommentRequest) (*types.PostCommentResponse, error) {
	if req == nil {
		return nil, commonresponse.BadRequest("request cannot be empty")
	}
	postID, err := parseRequiredID(req.PostId, "postId")
	if err != nil {
		return nil, err
	}
	content, err := normalizePostComment(req.Content)
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

	var commentID uint64
	err = l.svcCtx.Transact(l.ctx, func(ctx context.Context, txSvc *svc.ServiceContext) error {
		result, err := txSvc.CommentRecordModel.Insert(ctx, &model.CommentRecord{
			UserId:     loginUser.Id,
			TargetType: targetTypePost,
			TargetId:   post.Id,
			Content:    content,
			Status:     postStatusActive,
		})
		if err != nil {
			return err
		}
		id, err := result.LastInsertId()
		if err != nil || id <= 0 {
			if err != nil {
				return err
			}
			return sql.ErrNoRows
		}
		commentID = uint64(id)
		return txSvc.EntityStatModel.IncrementCounter(ctx, targetTypePost, post.Id, "comment_count", 1)
	})
	if err != nil {
		return nil, commonresponse.InternalServerError("create post comment failed")
	}

	comment, err := l.svcCtx.CommentRecordModel.FindOne(l.ctx, commentID)
	if err != nil {
		return nil, commonresponse.InternalServerError("load post comment failed")
	}
	list, err := buildCommentResponses(l.ctx, l.svcCtx, []*model.CommentRecord{comment})
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return &types.PostCommentResponse{}, nil
	}
	return &list[0], nil
}
