// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package forum

import (
	"context"
	"database/sql"
	postmodel "discover_world/model/post"
	"github.com/zeromicro/go-zero/core/stores/sqlx"
	"time"

	"discover_world/internal/common/ipgeo"
	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"github.com/zeromicro/go-zero/core/logx"
)

type CreateForumPostLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewCreateForumPostLogic(ctx context.Context, svcCtx *svc.ServiceContext) *CreateForumPostLogic {
	return &CreateForumPostLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *CreateForumPostLogic) CreateForumPost(req *types.CreateForumPostRequest) (*types.ForumPostResponse, error) {
	if req == nil {
		return nil, commonresponse.BadRequest("request cannot be empty")
	}
	loginUser, err := loadLoginUser(l.ctx, l.svcCtx)
	if err != nil {
		return nil, err
	}
	boardID, err := parseRequiredID(req.BoardId, "boardId")
	if err != nil {
		return nil, err
	}
	if _, err := l.svcCtx.Models.Forum.ForumBoard.FindOneActiveByID(l.ctx, boardID); err != nil {
		if err == sqlx.ErrNotFound {
			return nil, commonresponse.NotFound("forum board not found")
		}
		return nil, commonresponse.InternalServerError("query forum board failed")
	}
	title, err := normalizeForumPostTitle(req.Title)
	if err != nil {
		return nil, err
	}
	content, err := normalizeForumPostContent(req.Content)
	if err != nil {
		return nil, err
	}
	imageIDs, err := parseForumImageIDs(req.ImageIds)
	if err != nil {
		return nil, err
	}
	if err := validateForumPostBody(content, imageIDs); err != nil {
		return nil, err
	}
	if err := validatePostImages(l.ctx, l.svcCtx, loginUser.Id, imageIDs); err != nil {
		return nil, err
	}

	var postID uint64
	err = l.svcCtx.Transact(l.ctx, func(ctx context.Context, txSvc *svc.ServiceContext) error {
		result, err := txSvc.Models.Post.Post.Insert(ctx, &postmodel.Post{
			UserId:     loginUser.Id,
			Content:    optionalString(content),
			PostType:   "daily",
			Visibility: forumPostVisibility,
			Status:     forumPostStatusActive,
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
		postID = uint64(id)
		if err := txSvc.Models.Media.AssetLink.ReplaceActiveAssetIDsByOwner(ctx, ownerTypePost, postID, linkRoleAttachment, imageIDs); err != nil {
			return err
		}
		if _, err := txSvc.Models.Post.PostDiscussion.Insert(ctx, &postmodel.PostDiscussion{
			PostId:         postID,
			BoardId:        boardID,
			Title:          title,
			Status:         forumPostStatusActive,
			LastActivityAt: time.Now(),
		}); err != nil {
			return err
		}
		if err := txSvc.Models.Statistics.EntityStat.Ensure(ctx, targetTypePost, postID); err != nil {
			return err
		}
		if err := ipgeo.RecordContentAttribution(ctx, txSvc.Config.IpGeo.Enabled, txSvc.IpGeoResolver, txSvc.Config.IpGeo.HashSecret, txSvc.Models.Moderation.ContentIpAttribution, ipgeo.TargetTypePost, postID, ipgeo.ActionTypeCreate, loginUser.Id); err != nil {
			logx.WithContext(ctx).Errorf("record forum post ip attribution failed: postId=%d userId=%d err=%v", postID, loginUser.Id, err)
		}
		return nil
	})
	if err != nil {
		return nil, commonresponse.InternalServerError("create forum post failed")
	}

	discussion, err := l.svcCtx.Models.Post.PostDiscussion.FindByPostID(l.ctx, postID)
	if err != nil {
		return nil, commonresponse.InternalServerError("load forum post failed")
	}
	list, err := buildForumPostResponses(l.ctx, l.svcCtx, []*postmodel.PostDiscussion{discussion}, loginUser)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return &types.ForumPostResponse{}, nil
	}
	return &list[0], nil
}
