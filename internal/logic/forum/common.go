package forum

import (
	"context"
	"database/sql"
	accountmodel "discover_world/model/account"
	forummodel "discover_world/model/forum"
	postmodel "discover_world/model/post"
	"github.com/zeromicro/go-zero/core/stores/sqlx"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	commonauth "discover_world/internal/common/auth"
	commonresponse "discover_world/internal/common/response"
	postlogic "discover_world/internal/logic/post"
	"discover_world/internal/svc"
	"discover_world/internal/types"
)

const (
	defaultForumPageSize = 20
	maxForumPageSize     = 50
	maxForumTitleLength  = 120
	maxForumContentLen   = 2000
	maxForumImageCount   = 9

	forumPostStatusActive = "active"
	forumPostVisibility   = "public"
	ownerTypePost         = "post"
	linkRoleAttachment    = "attachment"
	targetTypePost        = "post"
)

func loadLoginUser(ctx context.Context, svcCtx *svc.ServiceContext) (*accountmodel.UserAccount, error) {
	return commonauth.LoadRequiredLoginUser(ctx, svcCtx, "")
}

func parseRequiredID(raw, field string) (uint64, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0, commonresponse.BadRequest(field + " must be a positive integer")
	}
	id, err := strconv.ParseUint(raw, 10, 64)
	if err != nil || id == 0 {
		return 0, commonresponse.BadRequest(field + " must be a positive integer")
	}
	return id, nil
}

func normalizeForumPageSize(pageSize int64) (int64, error) {
	if pageSize <= 0 {
		return defaultForumPageSize, nil
	}
	if pageSize > maxForumPageSize {
		return 0, commonresponse.BadRequest("pageSize cannot exceed 50")
	}
	return pageSize, nil
}

func normalizeForumPostTitle(title string) (string, error) {
	title = strings.TrimSpace(title)
	if title == "" {
		return "", commonresponse.BadRequest("title is required")
	}
	if utf8.RuneCountInString(title) > maxForumTitleLength {
		return "", commonresponse.BadRequest("title length cannot exceed 120")
	}
	return title, nil
}

func normalizeForumPostContent(content string) (string, error) {
	content = strings.TrimSpace(content)
	if utf8.RuneCountInString(content) > maxForumContentLen {
		return "", commonresponse.BadRequest("content length cannot exceed 2000")
	}
	return content, nil
}

func parseForumImageIDs(rawIDs []string) ([]uint64, error) {
	if len(rawIDs) == 0 {
		return nil, nil
	}
	if len(rawIDs) > maxForumImageCount {
		return nil, commonresponse.BadRequest("image count cannot exceed 9")
	}
	seen := map[uint64]struct{}{}
	ids := make([]uint64, 0, len(rawIDs))
	for _, raw := range rawIDs {
		raw = strings.TrimSpace(raw)
		if raw == "" {
			continue
		}
		id, err := parseRequiredID(raw, "imageIds")
		if err != nil {
			return nil, err
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	return ids, nil
}

func validateForumPostBody(content string, imageIDs []uint64) error {
	if strings.TrimSpace(content) == "" && len(imageIDs) == 0 {
		return commonresponse.BadRequest("content or images are required")
	}
	return nil
}

func validatePostImages(ctx context.Context, svcCtx *svc.ServiceContext, ownerID uint64, imageIDs []uint64) error {
	if len(imageIDs) == 0 {
		return nil
	}
	assets, err := svcCtx.MediaAssetModel.FindByIDs(ctx, imageIDs)
	if err != nil {
		return commonresponse.InternalServerError("query images failed")
	}
	for _, id := range imageIDs {
		asset := assets[id]
		if asset == nil {
			return commonresponse.NotFound("image not found")
		}
		if asset.OwnerUserId != ownerID {
			return commonresponse.Forbidden("image does not belong to the post owner")
		}
		if asset.MediaType != "image" || asset.Status != "active" || asset.DeletedAt.Valid {
			return commonresponse.BadRequest("image is not active")
		}
		if asset.Visibility != "public" || asset.AuditStatus != "approved" {
			return commonresponse.BadRequest("forum posts can only use public approved images")
		}
	}
	return nil
}

func optionalString(value string) sql.NullString {
	value = strings.TrimSpace(value)
	if value == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: value, Valid: true}
}

func nullStringValue(value sql.NullString) string {
	if !value.Valid {
		return ""
	}
	return value.String
}

func formatID(id uint64) string {
	if id == 0 {
		return ""
	}
	return strconv.FormatUint(id, 10)
}

func formatTime(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	return value.Format("2006-01-02 15:04:05")
}

func buildForumBoardResponse(board *forummodel.ForumBoard) types.ForumBoardResponse {
	if board == nil {
		return types.ForumBoardResponse{}
	}
	return types.ForumBoardResponse{
		Id:          formatID(board.Id),
		Slug:        board.Slug,
		Name:        board.Name,
		Description: nullStringValue(board.Description),
		Status:      board.Status,
		SortOrder:   board.SortOrder,
		CreatedAt:   formatTime(board.CreatedAt),
		UpdatedAt:   formatTime(board.UpdatedAt),
	}
}

func buildForumPostResponses(ctx context.Context, svcCtx *svc.ServiceContext, discussions []*postmodel.PostDiscussion, viewer *accountmodel.UserAccount) ([]types.ForumPostResponse, error) {
	if len(discussions) == 0 {
		return []types.ForumPostResponse{}, nil
	}

	postIDs := make([]uint64, 0, len(discussions))
	for _, discussion := range discussions {
		if discussion != nil {
			postIDs = append(postIDs, discussion.PostId)
		}
	}
	postsByID, err := svcCtx.PostModel.FindByIDs(ctx, postIDs)
	if err != nil {
		return nil, commonresponse.InternalServerError("query forum posts failed")
	}

	orderedPosts := make([]*postmodel.Post, 0, len(discussions))
	orderedDiscussions := make([]*postmodel.PostDiscussion, 0, len(discussions))
	for _, discussion := range discussions {
		if discussion == nil {
			continue
		}
		post := postsByID[discussion.PostId]
		if post == nil || post.Status != forumPostStatusActive || post.Visibility != forumPostVisibility || post.DeletedAt.Valid {
			continue
		}
		orderedPosts = append(orderedPosts, post)
		orderedDiscussions = append(orderedDiscussions, discussion)
	}

	publicPosts, err := postlogic.BuildPublicPostResponses(ctx, svcCtx, orderedPosts, viewer)
	if err != nil {
		return nil, err
	}

	resp := make([]types.ForumPostResponse, 0, len(publicPosts))
	for index, post := range publicPosts {
		if index >= len(orderedDiscussions) {
			continue
		}
		discussion := orderedDiscussions[index]
		board, err := svcCtx.ForumBoardModel.FindOneActiveByID(ctx, discussion.BoardId)
		if err != nil {
			if err == sqlx.ErrNotFound {
				continue
			}
			return nil, commonresponse.InternalServerError("query forum board failed")
		}
		resp = append(resp, types.ForumPostResponse{
			Post:           post,
			Board:          buildForumBoardResponse(board),
			Title:          discussion.Title,
			IsLocked:       discussion.IsLocked == 1,
			IsBoardPinned:  discussion.IsBoardPinned == 1,
			LastActivityAt: formatTime(discussion.LastActivityAt),
		})
	}
	return resp, nil
}
