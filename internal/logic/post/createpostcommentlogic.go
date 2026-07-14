// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package post

import (
	"context"
	"database/sql"
	notificationmodel "discover_world/model/notification"
	postmodel "discover_world/model/post"
	"errors"
	"github.com/zeromicro/go-zero/core/stores/sqlx"
	"strings"
	"time"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"
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
	discussion, err := l.svcCtx.Models.Post.PostDiscussion.FindByPostID(l.ctx, post.Id)
	if err != nil && !errors.Is(err, sqlx.ErrNotFound) {
		return nil, commonresponse.InternalServerError("query forum post failed")
	}
	if discussion != nil && discussion.IsLocked == 1 {
		return nil, commonresponse.Forbidden("forum post is locked")
	}

	var commentID uint64
	notificationCreated := false
	err = l.svcCtx.Transact(l.ctx, func(ctx context.Context, txSvc *svc.ServiceContext) error {
		result, err := txSvc.Models.Post.CommentRecord.Insert(ctx, &postmodel.CommentRecord{
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
		if err := txSvc.Models.Statistics.EntityStat.IncrementCounter(ctx, targetTypePost, post.Id, "comment_count", 1); err != nil {
			return err
		}
		if err := txSvc.Models.Statistics.EntityStatHourly.IncrementCounter(ctx, targetTypePost, post.Id, "comment_count", 1); err != nil {
			return err
		}
		if err := txSvc.Models.Post.PostDiscussion.TouchActivity(ctx, post.Id, time.Now()); err != nil {
			return err
		}
		if post.UserId != loginUser.Id {
			if _, err := txSvc.Models.Notification.Notification.Insert(ctx, &notificationmodel.Notification{
				RecipientUserId: post.UserId,
				ActorUserId:     sql.NullInt64{Int64: int64(loginUser.Id), Valid: true},
				EventType:       "post_comment",
				TargetType:      targetTypePost,
				TargetId:        post.Id,
				Title:           "新的评论",
				Content:         sql.NullString{String: content, Valid: strings.TrimSpace(content) != ""},
			}); err != nil {
				logx.WithContext(ctx).Errorf("create post comment notification failed: postId=%d actorId=%d err=%v", post.Id, loginUser.Id, err)
			} else {
				notificationCreated = true
			}
		}
		return nil
	})
	if err != nil {
		return nil, commonresponse.InternalServerError("create post comment failed")
	}
	if notificationCreated {
		if err := l.svcCtx.InvalidateNotificationUnread(l.ctx, post.UserId); err != nil {
			l.Errorf("invalidate unread cache after post comment notification failed: ownerId=%d err=%v", post.UserId, err)
		}
	}

	comment, err := l.svcCtx.Models.Post.CommentRecord.FindOne(l.ctx, commentID)
	if err != nil {
		return nil, commonresponse.InternalServerError("load post comment failed")
	}
	list, err := buildCommentResponses(l.ctx, l.svcCtx, []*postmodel.CommentRecord{comment})
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return &types.PostCommentResponse{}, nil
	}
	return &list[0], nil
}
