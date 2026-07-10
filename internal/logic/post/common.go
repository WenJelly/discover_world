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
	access "discover_world/internal/logic/access"
	"discover_world/internal/logic/ipgeo"
	mediaLogic "discover_world/internal/logic/media"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"discover_world/model"
)

const (
	maxPostContentLength  = 2000
	maxPostCommentLength  = 1000
	maxPostImageCount     = 9
	maxPostLocationLen    = 255
	maxPostLikedByCount   = 3
	defaultCommentPage    = 20
	maxCommentPage        = 50
	defaultPublicPostPage = 20
	maxPublicPostPage     = 50

	postStatusActive  = "active"
	postStatusDeleted = "deleted"

	postTypeDaily       = "daily"
	postTypeTravelShare = "travel_share"

	postVisibilityPublic    = "public"
	postVisibilityFollowers = "followers"
	postVisibilityPrivate   = "private"

	targetTypePost     = "post"
	ownerTypePost      = "post"
	linkRoleAttachment = "attachment"
	defaultReaction    = "like"
)

type postCursorPayload struct {
	ID uint64 `json:"id"`
}

type publicPostCursorPayload struct {
	ID    uint64  `json:"id"`
	Score float64 `json:"score,omitempty"`
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
	case postVisibilityFollowers:
		return postVisibilityFollowers, nil
	case postVisibilityPrivate:
		return postVisibilityPrivate, nil
	default:
		return "", commonresponse.BadRequest("visibility must be public, followers or private")
	}
}

func normalizePostType(postType string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(postType)) {
	case "", postTypeDaily:
		return postTypeDaily, nil
	case postTypeTravelShare:
		return postTypeTravelShare, nil
	default:
		return "", commonresponse.BadRequest("postType must be daily or travel_share")
	}
}

func normalizePostTypeFilter(postType string) (string, error) {
	postType = strings.ToLower(strings.TrimSpace(postType))
	if postType == "" || postType == "all" {
		return "", nil
	}
	return normalizePostType(postType)
}

func normalizePostTypeValue(postType string) string {
	normalized, err := normalizePostType(postType)
	if err != nil {
		return postTypeDaily
	}
	return normalized
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

func normalizePublicPostPageSize(pageSize int64) (int64, error) {
	if pageSize <= 0 {
		return defaultPublicPostPage, nil
	}
	if pageSize > maxPublicPostPage {
		return 0, commonresponse.BadRequest("pageSize cannot exceed 50")
	}
	return pageSize, nil
}

func normalizePublicPostSort(sort string) string {
	sort = strings.ToLower(strings.TrimSpace(sort))
	switch sort {
	case "hot", "rising":
		return sort
	default:
		return "latest"
	}
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

func encodePublicPostCursor(post *model.Post) (string, error) {
	if post == nil || post.Id == 0 {
		return "", nil
	}
	data, err := json.Marshal(publicPostCursorPayload{ID: post.Id, Score: post.Score})
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(data), nil
}

func decodePublicPostCursor(raw string) (model.PublicPostCursor, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return model.PublicPostCursor{}, nil
	}
	data, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return model.PublicPostCursor{}, commonresponse.BadRequest("cursor is invalid")
	}
	var payload publicPostCursorPayload
	if err := json.Unmarshal(data, &payload); err != nil || payload.ID == 0 {
		return model.PublicPostCursor{}, commonresponse.BadRequest("cursor is invalid")
	}
	return model.PublicPostCursor{ID: payload.ID, Score: payload.Score}, nil
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
	if !canViewPost(ctx, post, viewer, svcCtx) {
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

func canViewPost(ctx context.Context, post *model.Post, user *model.UserAccount, svcCtx *svc.ServiceContext) bool {
	if post == nil || post.Status != postStatusActive || post.DeletedAt.Valid {
		return false
	}
	level, err := access.ResolveViewerAccess(ctx, svcCtx, user, post.UserId)
	if err != nil {
		return false
	}
	return access.CanViewVisibility(post.Visibility, level)
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
		if postVisibility == postVisibilityFollowers {
			if asset.Visibility != postVisibilityPublic && asset.Visibility != postVisibilityFollowers {
				return commonresponse.BadRequest("followers posts can only use public or followers images")
			}
			if asset.AuditStatus != "approved" {
				return commonresponse.BadRequest("followers posts can only use approved images")
			}
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

func BuildPublicPostResponses(ctx context.Context, svcCtx *svc.ServiceContext, posts []*model.Post, viewer *model.UserAccount) ([]types.PublicPostResponse, error) {
	return buildPublicPostResponses(ctx, svcCtx, posts, viewer)
}

func buildPublicPostResponses(ctx context.Context, svcCtx *svc.ServiceContext, posts []*model.Post, viewer *model.UserAccount) ([]types.PublicPostResponse, error) {
	if len(posts) == 0 {
		return []types.PublicPostResponse{}, nil
	}

	profilePosts, err := buildPostResponses(ctx, svcCtx, posts, viewer)
	if err != nil {
		return nil, err
	}

	userIDs := make([]uint64, 0, len(posts))
	for _, post := range posts {
		if post != nil {
			userIDs = append(userIDs, post.UserId)
		}
	}
	accounts, err := svcCtx.UserAccountModel.FindByIDs(ctx, userIDs)
	if err != nil {
		return nil, commonresponse.InternalServerError("query post authors failed")
	}
	profiles, err := svcCtx.UserProfileModel.FindByUserIDs(ctx, userIDs)
	if err != nil {
		return nil, commonresponse.InternalServerError("query post author profiles failed")
	}
	avatarURLs, err := mediaLogic.LoadAvatarURLsByOwner(ctx, svcCtx, profiles)
	if err != nil {
		return nil, commonresponse.InternalServerError("query post author avatars failed")
	}
	accountByID := make(map[uint64]*model.UserAccount, len(accounts))
	for _, account := range accounts {
		if account != nil {
			accountByID[account.Id] = account
		}
	}

	resp := make([]types.PublicPostResponse, 0, len(profilePosts))
	for index, item := range profilePosts {
		var author types.AccountSummary
		if index < len(posts) && posts[index] != nil {
			account := accountByID[posts[index].UserId]
			author = buildAccountSummary(account, profiles[posts[index].UserId], avatarURLs[posts[index].UserId])
		}
		resp = append(resp, types.PublicPostResponse{
			Id:          item.Id,
			UserId:      item.UserId,
			Author:      author,
			Content:     item.Content,
			PostType:    item.PostType,
			Visibility:  item.Visibility,
			Status:      item.Status,
			Location:    item.Location,
			IpRegion:    item.IpRegion,
			Images:      item.Images,
			Stats:       item.Stats,
			LikedBy:     item.LikedBy,
			IsLiked:     item.IsLiked,
			IsFavorited: item.IsFavorited,
			CreatedAt:   item.CreatedAt,
			UpdatedAt:   item.UpdatedAt,
		})
	}
	return resp, nil
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
	likedByByPost, err := loadPostLikedBySummaries(ctx, svcCtx, postIDs)
	if err != nil {
		return nil, commonresponse.InternalServerError("query post liked users failed")
	}
	ipRegions, err := loadIPRegionsByTarget(ctx, svcCtx, postIDs)
	if err != nil {
		return nil, commonresponse.InternalServerError("query post ip regions failed")
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
		likedBy := nonNilAccountSummaries(likedByByPost[post.Id])
		item := types.ProfilePostResponse{
			Id:         formatID(post.Id),
			UserId:     formatID(post.UserId),
			Content:    nullStringValue(post.Content),
			PostType:   normalizePostTypeValue(post.PostType),
			Visibility: post.Visibility,
			Status:     post.Status,
			Location:   nullStringValue(post.Location),
			IpRegion:   ipRegions[post.Id],
			IsPinned:   isPinned,
			PinnedAt:   pinnedAt,
			Images:     images,
			Stats:      buildStats(statsByPost[post.Id]),
			LikedBy:    likedBy,
			CreatedAt:  formatTime(post.CreatedAt),
			UpdatedAt:  formatTime(post.UpdatedAt),
		}
		applyPostViewerState(&item, post.Id, viewerState)
		resp = append(resp, item)
	}
	return resp, nil
}

func loadIPRegionsByTarget(ctx context.Context, svcCtx *svc.ServiceContext, postIDs []uint64) (map[uint64]types.IpRegionResponse, error) {
	return ipgeo.LoadRegionsByTarget(ctx, svcCtx, ipgeo.TargetTypePost, postIDs)
}

func nonNilAccountSummaries(list []types.AccountSummary) []types.AccountSummary {
	if list == nil {
		return []types.AccountSummary{}
	}
	return list
}

func loadPostLikedBySummaries(ctx context.Context, svcCtx *svc.ServiceContext, postIDs []uint64) (map[uint64][]types.AccountSummary, error) {
	resp := make(map[uint64][]types.AccountSummary)
	likedUserIDsByPost, err := svcCtx.ReactionModel.FindActiveUserIDsByTargets(ctx, targetTypePost, postIDs, defaultReaction, maxPostLikedByCount)
	if err != nil {
		return nil, err
	}
	if len(likedUserIDsByPost) == 0 {
		return resp, nil
	}

	userIDs := make([]uint64, 0)
	for _, ids := range likedUserIDsByPost {
		userIDs = append(userIDs, ids...)
	}
	accounts, err := svcCtx.UserAccountModel.FindByIDs(ctx, userIDs)
	if err != nil {
		return nil, err
	}
	profiles, err := svcCtx.UserProfileModel.FindByUserIDs(ctx, userIDs)
	if err != nil {
		return nil, err
	}
	avatarURLs, err := mediaLogic.LoadAvatarURLsByOwner(ctx, svcCtx, profiles)
	if err != nil {
		return nil, commonresponse.InternalServerError("query post like avatars failed")
	}

	accountsByID := make(map[uint64]*model.UserAccount, len(accounts))
	for _, account := range accounts {
		if account != nil {
			accountsByID[account.Id] = account
		}
	}

	for postID, ids := range likedUserIDsByPost {
		for _, userID := range ids {
			account := accountsByID[userID]
			if account == nil {
				continue
			}
			resp[postID] = append(resp[postID], buildAccountSummary(account, profiles[userID], avatarURLs[userID]))
		}
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

func buildAccountSummary(account *model.UserAccount, profile *model.UserProfile, avatarURL string) types.AccountSummary {
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
	role := strings.TrimSpace(account.Role)
	if role == "" {
		role = "user"
	}
	return types.AccountSummary{
		Id:        formatID(account.Id),
		Username:  account.Username,
		Email:     "",
		Nickname:  nickname,
		AvatarUrl: avatarURL,
		Bio:       bio,
		Status:    account.Status,
		Role:      role,
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
	avatarURLs, err := mediaLogic.LoadAvatarURLsByOwner(ctx, svcCtx, profiles)
	if err != nil {
		return nil, commonresponse.InternalServerError("query comment author avatars failed")
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
			Author:    buildAccountSummary(author, profiles[comment.UserId], avatarURLs[comment.UserId]),
			Content:   comment.Content,
			Status:    comment.Status,
			CreatedAt: formatTime(comment.CreatedAt),
			UpdatedAt: formatTime(comment.UpdatedAt),
		})
	}
	return resp, nil
}
