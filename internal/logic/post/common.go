package post

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	commonauth "discover_world/internal/common/auth"
	commonresponse "discover_world/internal/common/response"
	mediaLogic "discover_world/internal/logic/media"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"discover_world/model"
)

const (
	maxPostContentLength = 2000
	maxPostCommentLength = 1000
	maxPostImageCount    = 9
	maxPostLocationLen   = 255
	defaultCommentPage   = 20
	maxCommentPage       = 50

	postStatusActive  = "active"
	postStatusDeleted = "deleted"

	postVisibilityPublic  = "public"
	postVisibilityPrivate = "private"

	targetTypePost     = "post"
	ownerTypePost      = "post"
	linkRoleAttachment = "attachment"
	defaultReaction    = "like"
)

type postCursorPayload struct {
	ID uint64 `json:"id"`
}

type postViewerState struct {
	liked     map[uint64]bool
	favorited map[uint64]bool
}

func normalizePostContent(content string) (string, error) {
	content = strings.TrimSpace(content)
	if utf8.RuneCountInString(content) > maxPostContentLength {
		return "", commonresponse.BadRequest("content length cannot exceed 2000")
	}
	return content, nil
}

func normalizePostComment(content string) (string, error) {
	content = strings.TrimSpace(content)
	if content == "" {
		return "", commonresponse.BadRequest("comment content is required")
	}
	if utf8.RuneCountInString(content) > maxPostCommentLength {
		return "", commonresponse.BadRequest("comment length cannot exceed 1000")
	}
	return content, nil
}

func normalizePostLocation(location string) (string, error) {
	location = strings.TrimSpace(location)
	if utf8.RuneCountInString(location) > maxPostLocationLen {
		return "", commonresponse.BadRequest("location length cannot exceed 255")
	}
	return location, nil
}

func normalizePostVisibility(visibility string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(visibility)) {
	case "", postVisibilityPublic:
		return postVisibilityPublic, nil
	case postVisibilityPrivate:
		return postVisibilityPrivate, nil
	default:
		return "", commonresponse.BadRequest("visibility must be public or private")
	}
}

func parsePostImageIDs(rawIDs []string) ([]uint64, error) {
	if len(rawIDs) == 0 {
		return nil, nil
	}

	seen := make(map[uint64]struct{}, len(rawIDs))
	ids := make([]uint64, 0, len(rawIDs))
	for _, raw := range rawIDs {
		raw = strings.TrimSpace(raw)
		if raw == "" {
			continue
		}
		id, err := strconv.ParseUint(raw, 10, 64)
		if err != nil || id == 0 {
			return nil, commonresponse.BadRequest("imageIds must contain positive integers")
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	return ids, nil
}

func validatePostBody(content string, imageIDs []uint64) error {
	if strings.TrimSpace(content) == "" && len(imageIDs) == 0 {
		return commonresponse.BadRequest("content or images are required")
	}
	if len(imageIDs) > maxPostImageCount {
		return commonresponse.BadRequest("image count cannot exceed 9")
	}
	return nil
}

func normalizeReactionType(reactionType string) (string, error) {
	reactionType = strings.ToLower(strings.TrimSpace(reactionType))
	if reactionType == "" {
		return defaultReaction, nil
	}
	switch reactionType {
	case "like", "love", "clap", "wow":
		return reactionType, nil
	default:
		return "", commonresponse.BadRequest("reactionType must be like, love, clap, or wow")
	}
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

func normalizeCommentPageSize(pageSize int64) (int64, error) {
	if pageSize <= 0 {
		return defaultCommentPage, nil
	}
	if pageSize > maxCommentPage {
		return 0, commonresponse.BadRequest("pageSize cannot exceed 50")
	}
	return pageSize, nil
}

func encodeCursor(id uint64) (string, error) {
	data, err := json.Marshal(postCursorPayload{ID: id})
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(data), nil
}

func decodeCursor(raw string) (uint64, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0, nil
	}
	data, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return 0, commonresponse.BadRequest("cursor is invalid")
	}
	var payload postCursorPayload
	if err := json.Unmarshal(data, &payload); err != nil || payload.ID == 0 {
		return 0, commonresponse.BadRequest("cursor is invalid")
	}
	return payload.ID, nil
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

func uint64ToInt64(value uint64) int64 {
	if value > uint64(^uint64(0)>>1) {
		return int64(^uint64(0) >> 1)
	}
	return int64(value)
}

func loadLoginUser(ctx context.Context, svcCtx *svc.ServiceContext) (*model.UserAccount, error) {
	return commonauth.LoadRequiredLoginUser(ctx, svcCtx, "")
}

func loadVisiblePost(ctx context.Context, svcCtx *svc.ServiceContext, postID uint64, viewer *model.UserAccount) (*model.Post, error) {
	post, err := svcCtx.PostModel.FindOneActive(ctx, postID)
	if err != nil {
		if errors.Is(err, model.ErrNotFound) {
			return nil, commonresponse.NotFound("post not found")
		}
		return nil, commonresponse.InternalServerError("query post failed")
	}
	if !canViewPost(post, viewer, svcCtx) {
		return nil, commonresponse.Forbidden("no permission to view this post")
	}
	return post, nil
}

func canManagePost(post *model.Post, user *model.UserAccount, svcCtx *svc.ServiceContext) bool {
	if post == nil || user == nil {
		return false
	}
	return post.UserId == user.Id || svcCtx.IsAdminAccount(user)
}

func canViewPost(post *model.Post, user *model.UserAccount, svcCtx *svc.ServiceContext) bool {
	if post == nil || post.Status != postStatusActive || post.DeletedAt.Valid {
		return false
	}
	if post.Visibility == postVisibilityPublic {
		return true
	}
	return canManagePost(post, user, svcCtx)
}

func validatePostImages(ctx context.Context, svcCtx *svc.ServiceContext, ownerID uint64, imageIDs []uint64, postVisibility string) error {
	if len(imageIDs) == 0 {
		return nil
	}
	if len(imageIDs) > maxPostImageCount {
		return commonresponse.BadRequest("image count cannot exceed 9")
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
		if postVisibility == postVisibilityPublic && (asset.Visibility != "public" || asset.AuditStatus != "approved") {
			return commonresponse.BadRequest("public posts can only use public approved images")
		}
	}
	return nil
}

func buildStats(stat *model.EntityStat) types.MediaAssetStats {
	if stat == nil {
		return types.MediaAssetStats{}
	}
	return types.MediaAssetStats{
		ViewCount:     uint64ToInt64(stat.ViewCount),
		ReactionCount: uint64ToInt64(stat.ReactionCount),
		FavoriteCount: uint64ToInt64(stat.FavoriteCount),
		CommentCount:  uint64ToInt64(stat.CommentCount),
		ShareCount:    uint64ToInt64(stat.ShareCount),
		DownloadCount: uint64ToInt64(stat.DownloadCount),
	}
}

func buildPostPinState(post *model.Post) (bool, string) {
	if post == nil || post.IsPinned != 1 {
		return false, ""
	}
	return true, formatTime(post.PinnedAt.Time)
}

func buildPostResponse(ctx context.Context, svcCtx *svc.ServiceContext, post *model.Post, viewer *model.UserAccount) (*types.ProfilePostResponse, error) {
	list, err := buildPostResponses(ctx, svcCtx, []*model.Post{post}, viewer)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return &types.ProfilePostResponse{}, nil
	}
	return &list[0], nil
}

func buildPostResponses(ctx context.Context, svcCtx *svc.ServiceContext, posts []*model.Post, viewer *model.UserAccount) ([]types.ProfilePostResponse, error) {
	if len(posts) == 0 {
		return []types.ProfilePostResponse{}, nil
	}

	postIDs := make([]uint64, 0, len(posts))
	for _, post := range posts {
		if post != nil {
			postIDs = append(postIDs, post.Id)
		}
	}

	assetIDsByPost, err := svcCtx.AssetLinkModel.FindActiveAssetIDsByOwners(ctx, ownerTypePost, linkRoleAttachment, postIDs)
	if err != nil {
		return nil, commonresponse.InternalServerError("query post images failed")
	}
	assetIDs := make([]uint64, 0)
	for _, ids := range assetIDsByPost {
		assetIDs = append(assetIDs, ids...)
	}
	mediaByID, err := buildMediaResponseMap(ctx, svcCtx, assetIDs, viewer)
	if err != nil {
		return nil, err
	}
	statsByPost, err := svcCtx.EntityStatModel.FindByTargetIDs(ctx, targetTypePost, postIDs)
	if err != nil {
		return nil, commonresponse.InternalServerError("query post stats failed")
	}
	viewerState, err := loadPostViewerState(ctx, svcCtx, viewer, postIDs)
	if err != nil {
		return nil, commonresponse.InternalServerError("query post viewer state failed")
	}

	resp := make([]types.ProfilePostResponse, 0, len(posts))
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
		isPinned, pinnedAt := buildPostPinState(post)
		item := types.ProfilePostResponse{
			Id:         formatID(post.Id),
			UserId:     formatID(post.UserId),
			Content:    nullStringValue(post.Content),
			Visibility: post.Visibility,
			Status:     post.Status,
			Location:   nullStringValue(post.Location),
			IsPinned:   isPinned,
			PinnedAt:   pinnedAt,
			Images:     images,
			Stats:      buildStats(statsByPost[post.Id]),
			CreatedAt:  formatTime(post.CreatedAt),
			UpdatedAt:  formatTime(post.UpdatedAt),
		}
		applyPostViewerState(&item, post.Id, viewerState)
		resp = append(resp, item)
	}
	return resp, nil
}

func loadPostViewerState(ctx context.Context, svcCtx *svc.ServiceContext, viewer *model.UserAccount, postIDs []uint64) (postViewerState, error) {
	state := postViewerState{
		liked:     map[uint64]bool{},
		favorited: map[uint64]bool{},
	}
	if viewer == nil || viewer.Id == 0 || len(postIDs) == 0 {
		return state, nil
	}

	liked, err := svcCtx.ReactionModel.FindActiveTargetIDsByUser(ctx, viewer.Id, targetTypePost, postIDs, defaultReaction)
	if err != nil {
		return state, err
	}
	favorited, err := svcCtx.FavoriteModel.FindActiveTargetIDsByUser(ctx, viewer.Id, targetTypePost, postIDs)
	if err != nil {
		return state, err
	}
	state.liked = liked
	state.favorited = favorited
	return state, nil
}

func applyPostViewerState(resp *types.ProfilePostResponse, postID uint64, state postViewerState) {
	if resp == nil {
		return
	}
	resp.IsLiked = state.liked[postID]
	resp.IsFavorited = state.favorited[postID]
}

func buildMediaResponseMap(ctx context.Context, svcCtx *svc.ServiceContext, assetIDs []uint64, viewer *model.UserAccount) (map[uint64]types.MediaAssetResponse, error) {
	resp := make(map[uint64]types.MediaAssetResponse)
	if len(assetIDs) == 0 {
		return resp, nil
	}
	assetsByID, err := svcCtx.MediaAssetModel.FindByIDs(ctx, assetIDs)
	if err != nil {
		return nil, commonresponse.InternalServerError("query images failed")
	}
	assets := make([]*model.MediaAsset, 0, len(assetIDs))
	orderedIDs := make([]uint64, 0, len(assetIDs))
	seen := make(map[uint64]struct{}, len(assetIDs))
	for _, id := range assetIDs {
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		if asset := assetsByID[id]; asset != nil {
			assets = append(assets, asset)
			orderedIDs = append(orderedIDs, id)
		}
	}
	list, err := mediaLogic.BuildMediaAssetListResponse(ctx, svcCtx, assets, viewer, types.MediaVariantRequest{CompressType: 2})
	if err != nil {
		return nil, commonresponse.InternalServerError("build image response failed")
	}
	for index, item := range list {
		if index < len(orderedIDs) {
			resp[orderedIDs[index]] = item
		}
	}
	return resp, nil
}

func buildAccountSummary(svcCtx *svc.ServiceContext, account *model.UserAccount, profile *model.UserProfile) types.AccountSummary {
	if account == nil {
		return types.AccountSummary{}
	}
	nickname := ""
	bio := ""
	if profile != nil {
		nickname = nullStringValue(profile.Nickname)
		bio = nullStringValue(profile.Bio)
	}
	if nickname == "" {
		nickname = account.Username
	}
	role := "user"
	if svcCtx.IsAdminAccount(account) {
		role = "admin"
	}
	return types.AccountSummary{
		Id:       formatID(account.Id),
		Username: account.Username,
		Email:    "",
		Nickname: nickname,
		Bio:      bio,
		Status:   account.Status,
		Role:     role,
	}
}

func buildCommentResponses(ctx context.Context, svcCtx *svc.ServiceContext, comments []*model.CommentRecord) ([]types.PostCommentResponse, error) {
	if len(comments) == 0 {
		return []types.PostCommentResponse{}, nil
	}
	userIDs := make([]uint64, 0, len(comments))
	for _, comment := range comments {
		if comment != nil {
			userIDs = append(userIDs, comment.UserId)
		}
	}
	accounts, err := svcCtx.UserAccountModel.FindByIDs(ctx, userIDs)
	if err != nil {
		return nil, commonresponse.InternalServerError("query comment authors failed")
	}
	profiles, err := svcCtx.UserProfileModel.FindByUserIDs(ctx, userIDs)
	if err != nil {
		return nil, commonresponse.InternalServerError("query comment author profiles failed")
	}
	accountByID := make(map[uint64]*model.UserAccount, len(accounts))
	for _, account := range accounts {
		if account != nil {
			accountByID[account.Id] = account
		}
	}

	resp := make([]types.PostCommentResponse, 0, len(comments))
	for _, comment := range comments {
		if comment == nil {
			continue
		}
		author := accountByID[comment.UserId]
		resp = append(resp, types.PostCommentResponse{
			Id:        formatID(comment.Id),
			PostId:    formatID(comment.TargetId),
			UserId:    formatID(comment.UserId),
			Author:    buildAccountSummary(svcCtx, author, profiles[comment.UserId]),
			Content:   comment.Content,
			Status:    comment.Status,
			CreatedAt: formatTime(comment.CreatedAt),
			UpdatedAt: formatTime(comment.UpdatedAt),
		})
	}
	return resp, nil
}
