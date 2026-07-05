package profile

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"time"

	commonauth "discover_world/internal/common/auth"
	commonresponse "discover_world/internal/common/response"
	mediaLogic "discover_world/internal/logic/media"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"discover_world/model"
)

const (
	defaultProfileCursorPageSize = 10
	maxProfileCursorPageSize     = 50
	defaultProfilePageNum        = 1
	defaultProfilePageSize       = 12
	maxProfilePageSize           = 60

	targetTypePost        = "post"
	targetTypeAlbum       = "album"
	ownerTypePost         = "post"
	ownerTypeAlbum        = "album"
	ownerTypeUserProfile  = "user_profile"
	linkRoleAttachment    = "attachment"
	linkRoleAlbumItem     = "album_item"
	linkRoleFeaturedMedia = "featured"
	defaultPostReaction   = "like"
)

type profileCursorPayload struct {
	ID       uint64 `json:"id"`
	IsPinned bool   `json:"isPinned,omitempty"`
	PinnedAt string `json:"pinnedAt,omitempty"`
}

type postViewerState struct {
	liked     map[uint64]bool
	favorited map[uint64]bool
}

func loadProfileTarget(ctx context.Context, svcCtx *svc.ServiceContext, rawUserID string) (*model.UserAccount, *model.UserAccount, bool, error) {
	loginUser, err := commonauth.LoadRequiredLoginUser(ctx, svcCtx, "")
	if err != nil {
		return nil, nil, false, err
	}

	targetID := loginUser.Id
	if strings.TrimSpace(rawUserID) != "" {
		targetID, err = parseRequiredID(rawUserID, "userId")
		if err != nil {
			return nil, nil, false, err
		}
	}

	target := loginUser
	if targetID != loginUser.Id {
		target, err = svcCtx.UserAccountModel.FindOneActive(ctx, targetID)
		if err != nil {
			if errors.Is(err, model.ErrNotFound) {
				return nil, nil, false, commonresponse.NotFound("账号不存在")
			}
			return nil, nil, false, commonresponse.InternalServerError("查询账号失败")
		}
	}

	includePrivate := target.Id == loginUser.Id || svcCtx.IsAdminAccount(loginUser)
	return loginUser, target, includePrivate, nil
}

func normalizeProfileCursorPage(pageSize int64) (int64, error) {
	if pageSize <= 0 {
		return defaultProfileCursorPageSize, nil
	}
	if pageSize > maxProfileCursorPageSize {
		return 0, commonresponse.BadRequest("pageSize 不能超过 50")
	}
	return pageSize, nil
}

func normalizeProfilePage(pageNum, pageSize int64) (int64, int64, error) {
	if pageNum <= 0 {
		pageNum = defaultProfilePageNum
	}
	if pageSize <= 0 {
		pageSize = defaultProfilePageSize
	}
	if pageSize > maxProfilePageSize {
		return 0, 0, commonresponse.BadRequest("pageSize 不能超过 60")
	}
	return pageNum, pageSize, nil
}

func encodeProfileCursor(post *model.Post) (string, error) {
	if post == nil {
		return "", nil
	}
	_, pinnedAt := buildPostPinState(post)
	data, err := json.Marshal(profileCursorPayload{
		ID:       post.Id,
		IsPinned: post.IsPinned == 1,
		PinnedAt: pinnedAt,
	})
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(data), nil
}

func decodeProfileCursor(raw string) (uint64, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0, nil
	}

	data, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return 0, commonresponse.BadRequest("cursor 无效")
	}

	var payload profileCursorPayload
	if err := json.Unmarshal(data, &payload); err != nil || payload.ID == 0 {
		return 0, commonresponse.BadRequest("cursor 无效")
	}
	return payload.ID, nil
}

func decodeProfilePinCursor(raw string) (model.PostPinCursor, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return model.PostPinCursor{}, nil
	}

	data, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return model.PostPinCursor{}, commonresponse.BadRequest("cursor invalid")
	}

	var payload profileCursorPayload
	if err := json.Unmarshal(data, &payload); err != nil || payload.ID == 0 {
		return model.PostPinCursor{}, commonresponse.BadRequest("cursor invalid")
	}

	cursor := model.PostPinCursor{
		ID:       payload.ID,
		IsPinned: payload.IsPinned,
	}
	if strings.TrimSpace(payload.PinnedAt) != "" {
		pinnedAt, err := time.ParseInLocation("2006-01-02 15:04:05", payload.PinnedAt, time.Local)
		if err != nil {
			return model.PostPinCursor{}, commonresponse.BadRequest("cursor invalid")
		}
		cursor.PinnedAt = sql.NullTime{Time: pinnedAt, Valid: true}
	}
	return cursor, nil
}

func parseRequiredID(raw, field string) (uint64, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0, commonresponse.BadRequest(field + " 必须是正整数")
	}
	id, err := strconv.ParseUint(raw, 10, 64)
	if err != nil || id == 0 {
		return 0, commonresponse.BadRequest(field + " 必须是正整数")
	}
	return id, nil
}

func formatID(id uint64) string {
	if id == 0 {
		return ""
	}
	return strconv.FormatUint(id, 10)
}

func nullStringValue(value sql.NullString) string {
	if value.Valid {
		return value.String
	}
	return ""
}

func formatTime(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	return value.Format("2006-01-02 15:04:05")
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

func loadPostViewerState(ctx context.Context, svcCtx *svc.ServiceContext, viewer *model.UserAccount, postIDs []uint64) (postViewerState, error) {
	state := postViewerState{
		liked:     map[uint64]bool{},
		favorited: map[uint64]bool{},
	}
	if viewer == nil || viewer.Id == 0 || len(postIDs) == 0 {
		return state, nil
	}

	liked, err := svcCtx.ReactionModel.FindActiveTargetIDsByUser(ctx, viewer.Id, targetTypePost, postIDs, defaultPostReaction)
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

func uint64ToInt64(value uint64) int64 {
	if value > uint64(^uint64(0)>>1) {
		return int64(^uint64(0) >> 1)
	}
	return int64(value)
}

func uniqueIDs(ids []uint64) []uint64 {
	seen := make(map[uint64]struct{}, len(ids))
	resp := make([]uint64, 0, len(ids))
	for _, id := range ids {
		if id == 0 {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		resp = append(resp, id)
	}
	return resp
}

func buildMediaResponseMap(ctx context.Context, svcCtx *svc.ServiceContext, assetIDs []uint64, viewer *model.UserAccount, variant types.MediaVariantRequest) (map[uint64]types.MediaAssetResponse, error) {
	resp := make(map[uint64]types.MediaAssetResponse)
	assetIDs = uniqueIDs(assetIDs)
	if len(assetIDs) == 0 {
		return resp, nil
	}

	assetsByID, err := svcCtx.MediaAssetModel.FindByIDs(ctx, assetIDs)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询媒体资源失败")
	}
	assets := make([]*model.MediaAsset, 0, len(assetIDs))
	orderedIDs := make([]uint64, 0, len(assetIDs))
	for _, id := range assetIDs {
		if asset := assetsByID[id]; asset != nil {
			assets = append(assets, asset)
			orderedIDs = append(orderedIDs, id)
		}
	}

	list, err := mediaLogic.BuildMediaAssetListResponse(ctx, svcCtx, assets, viewer, variant)
	if err != nil {
		return nil, commonresponse.InternalServerError("构造媒体资源响应失败")
	}
	for index, item := range list {
		if index < len(orderedIDs) {
			resp[orderedIDs[index]] = item
		}
	}
	return resp, nil
}
