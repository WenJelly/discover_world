package media

import (
	"context"
	"database/sql"
	accountmodel "discover_world/model/account"
	mediamodel "discover_world/model/media"
	profilemodel "discover_world/model/profile"
	statisticsmodel "discover_world/model/statistics"
	"errors"
	"github.com/zeromicro/go-zero/core/stores/sqlx"
	"strings"

	commonresponse "discover_world/internal/common/response"
	access "discover_world/internal/logic/access"
	"discover_world/internal/logic/ipgeo"
	"discover_world/internal/svc"
	"discover_world/internal/types"
)

type mediaViewerState struct {
	liked map[uint64]bool
}

func BuildMediaAssetListResponse(ctx context.Context, svcCtx *svc.ServiceContext, assets []*mediamodel.MediaAsset, viewer *accountmodel.UserAccount, variant types.MediaVariantRequest) ([]types.MediaAssetResponse, error) {
	return buildMediaAssetListResponse(ctx, svcCtx, assets, viewer, variant)
}

func buildMediaAssetResponse(ctx context.Context, svcCtx *svc.ServiceContext, asset *mediamodel.MediaAsset, object *mediamodel.MediaObject, owner *accountmodel.UserAccount, profile *profilemodel.UserProfile, stat *statisticsmodel.EntityStat, tags []string, viewer *accountmodel.UserAccount, variant types.MediaVariantRequest) (*types.MediaAssetResponse, error) {
	resp, err := buildMediaAssetResponseWithBucket(ctx, svcCtx, asset, object, nil, owner, profile, stat, tags, viewer, variant)
	if err != nil {
		return nil, err
	}
	if resp != nil {
		resp.Owner.AvatarUrl = LoadAvatarURL(ctx, svcCtx, profile)
		ipRegions, err := loadIPRegionsByTarget(ctx, svcCtx, []uint64{asset.Id})
		if err != nil {
			return nil, err
		}
		resp.IpRegion = ipRegions[asset.Id]
		viewerState, err := loadMediaViewerState(ctx, svcCtx, viewer, []uint64{asset.Id})
		if err != nil {
			return nil, err
		}
		applyMediaViewerState(resp, asset.Id, viewerState)
	}
	return resp, nil
}

func buildMediaAssetResponseWithBucket(ctx context.Context, svcCtx *svc.ServiceContext, asset *mediamodel.MediaAsset, object *mediamodel.MediaObject, bucket *mediamodel.StorageBucket, owner *accountmodel.UserAccount, profile *profilemodel.UserProfile, stat *statisticsmodel.EntityStat, tags []string, viewer *accountmodel.UserAccount, variant types.MediaVariantRequest) (*types.MediaAssetResponse, error) {
	if asset == nil {
		return nil, commonNotFound()
	}

	if object == nil {
		loaded, err := svcCtx.Models.Media.MediaObject.FindOriginalByAssetID(ctx, asset.Id)
		if err != nil && !errors.Is(err, sqlx.ErrNotFound) {
			return nil, err
		}
		object = loaded
	}

	if object != nil {
		if bucket == nil {
			loaded, err := svcCtx.Models.Media.StorageBucket.FindOne(ctx, object.BucketId)
			if err == nil {
				bucket = loaded
			}
		}
	}

	metadata := parseMediaMetadata(asset.MetadataJson)
	if len(tags) == 0 {
		tags = metadata.Tags
	}

	fileSize, width, height := int64(0), int64(0), int64(0)
	mimeType, fileExt := "", ""
	baseURL := ""
	if object != nil {
		fileSize = nullInt64Value(object.FileSize)
		width = nullInt64Value(object.Width)
		height = nullInt64Value(object.Height)
		mimeType = nullStringValue(object.MimeType)
		fileExt = nullStringValue(object.FileExt)
		baseURL = buildPublicObjectURL(bucket, object.ObjectKey)
	}

	thumbnail, err := buildVariantURL(baseURL, fileSize, width, height, variantOrDefault(variant, 2))
	if err != nil {
		return nil, err
	}
	preview, err := buildVariantURL(baseURL, fileSize, width, height, types.MediaVariantRequest{CompressType: 1})
	if err != nil {
		return nil, err
	}
	detail, err := buildVariantURL(baseURL, fileSize, width, height, variant)
	if err != nil {
		return nil, err
	}

	aspectRatio := float64(0)
	if width > 0 && height > 0 {
		aspectRatio = float64(width) / float64(height)
	}

	canAccessOriginal := canViewOriginal(ctx, asset, viewer, svcCtx)
	permissions := types.MediaAssetPermissions{
		CanViewOriginal: canAccessOriginal,
		CanDownload:     canAccessOriginal,
	}
	reviewMessage, reviewerID, reviewTime, rawMetadata := "", "", "", ""
	if canManageMediaAsset(asset, viewer, svcCtx) {
		reviewMessage = metadata.ReviewMessage
		reviewerID = metadata.ReviewerId
		reviewTime = metadata.ReviewTime
		rawMetadata = nullStringValue(asset.MetadataJson)
	}

	return &types.MediaAssetResponse{
		Id:               formatID(asset.Id),
		MediaType:        asset.MediaType,
		AssetUsage:       normalizeAssetUsage(asset.AssetUsage),
		Title:            nullStringValue(asset.Title),
		Description:      nullStringValue(asset.Description),
		Category:         metadata.Category,
		Tags:             tags,
		OwnerUserId:      formatID(asset.OwnerUserId),
		Owner:            buildAccountSummary(svcCtx, owner, profile),
		OriginalFilename: nullStringValue(asset.OriginalFilename),
		Visibility:       asset.Visibility,
		Status:           asset.Status,
		AuditStatus:      asset.AuditStatus,
		ReviewMessage:    reviewMessage,
		ReviewerId:       reviewerID,
		ReviewTime:       reviewTime,
		FileSize:         fileSize,
		Width:            width,
		Height:           height,
		AspectRatio:      aspectRatio,
		MimeType:         mimeType,
		FileExt:          fileExt,
		DominantColor:    metadata.DominantColor,
		BlurHash:         metadata.BlurHash,
		Urls: types.MediaAssetUrls{
			Thumbnail: thumbnail,
			Preview:   preview,
			Detail:    detail,
			Original:  baseURL,
		},
		Permissions:  permissions,
		Stats:        buildMediaStats(stat),
		IpRegion:     types.IpRegionResponse{},
		MetadataJson: rawMetadata,
		CreatedAt:    formatTime(asset.CreatedAt),
		UpdatedAt:    formatTime(asset.UpdatedAt),
	}, nil
}

func buildMediaAssetListResponse(ctx context.Context, svcCtx *svc.ServiceContext, assets []*mediamodel.MediaAsset, viewer *accountmodel.UserAccount, variant types.MediaVariantRequest) ([]types.MediaAssetResponse, error) {
	if len(assets) == 0 {
		return []types.MediaAssetResponse{}, nil
	}

	assetIDs := make([]uint64, 0, len(assets))
	ownerIDs := make([]uint64, 0, len(assets))
	ownerSeen := make(map[uint64]struct{}, len(assets))
	for _, asset := range assets {
		if asset == nil {
			continue
		}
		assetIDs = append(assetIDs, asset.Id)
		if _, ok := ownerSeen[asset.OwnerUserId]; !ok {
			ownerSeen[asset.OwnerUserId] = struct{}{}
			ownerIDs = append(ownerIDs, asset.OwnerUserId)
		}
	}

	objects, err := svcCtx.Models.Media.MediaObject.FindOriginalByAssetIDs(ctx, assetIDs)
	if err != nil {
		return nil, err
	}
	buckets, err := svcCtx.Models.Media.StorageBucket.FindByIDs(ctx, collectOriginalBucketIDs(assets, objects))
	if err != nil {
		return nil, err
	}
	stats, err := svcCtx.Models.Statistics.EntityStat.FindByTargetIDs(ctx, targetTypeMediaAsset, assetIDs)
	if err != nil {
		return nil, err
	}
	tags, err := svcCtx.Models.Taxonomy.Tagging.FindNamesByTargetIDs(ctx, targetTypeMediaAsset, assetIDs)
	if err != nil {
		return nil, err
	}
	owners, err := svcCtx.Models.Account.UserAccount.FindByIDs(ctx, ownerIDs)
	if err != nil {
		return nil, err
	}
	profiles, err := svcCtx.Models.Profile.UserProfile.FindByUserIDs(ctx, ownerIDs)
	if err != nil {
		return nil, err
	}

	ownerMap := make(map[uint64]*accountmodel.UserAccount, len(owners))
	for _, owner := range owners {
		if owner != nil {
			ownerMap[owner.Id] = owner
		}
	}

	avatarURLs, err := LoadAvatarURLsByOwner(ctx, svcCtx, profiles)
	if err != nil {
		return nil, err
	}
	viewerState, err := loadMediaViewerState(ctx, svcCtx, viewer, assetIDs)
	if err != nil {
		return nil, err
	}
	ipRegions, err := loadIPRegionsByTarget(ctx, svcCtx, assetIDs)
	if err != nil {
		return nil, err
	}

	resp := make([]types.MediaAssetResponse, 0, len(assets))
	for _, asset := range assets {
		if asset == nil {
			continue
		}
		object := objects[asset.Id]
		var bucket *mediamodel.StorageBucket
		if object != nil {
			bucket = buckets[object.BucketId]
		}
		item, err := buildMediaAssetResponseWithBucket(ctx, svcCtx, asset, object, bucket, ownerMap[asset.OwnerUserId], profiles[asset.OwnerUserId], stats[asset.Id], tags[asset.Id], viewer, variant)
		if err != nil {
			return nil, err
		}
		applyMediaViewerState(item, asset.Id, viewerState)
		item.IpRegion = ipRegions[asset.Id]
		item.Owner.AvatarUrl = avatarURLs[asset.OwnerUserId]
		resp = append(resp, *item)
	}
	return resp, nil
}

func loadIPRegionsByTarget(ctx context.Context, svcCtx *svc.ServiceContext, assetIDs []uint64) (map[uint64]types.IpRegionResponse, error) {
	return ipgeo.LoadRegionsByTarget(ctx, svcCtx, ipgeo.TargetTypeMediaAsset, assetIDs)
}

func loadMediaViewerState(ctx context.Context, svcCtx *svc.ServiceContext, viewer *accountmodel.UserAccount, assetIDs []uint64) (mediaViewerState, error) {
	state := mediaViewerState{
		liked: map[uint64]bool{},
	}
	if viewer == nil || viewer.Id == 0 || len(assetIDs) == 0 {
		return state, nil
	}

	liked, err := svcCtx.Models.Interaction.Reaction.FindActiveTargetIDsByUser(ctx, viewer.Id, targetTypeMediaAsset, assetIDs, defaultMediaReaction)
	if err != nil {
		return state, err
	}
	state.liked = liked
	return state, nil
}

func applyMediaViewerState(resp *types.MediaAssetResponse, assetID uint64, state mediaViewerState) {
	if resp == nil {
		return
	}
	resp.IsLiked = state.liked[assetID]
}

func collectOriginalBucketIDs(assets []*mediamodel.MediaAsset, objects map[uint64]*mediamodel.MediaObject) []uint64 {
	if len(assets) == 0 || len(objects) == 0 {
		return nil
	}

	seen := make(map[uint64]struct{}, len(objects))
	ids := make([]uint64, 0, len(objects))
	for _, asset := range assets {
		if asset == nil {
			continue
		}
		object := objects[asset.Id]
		if object == nil || object.BucketId == 0 {
			continue
		}
		if _, ok := seen[object.BucketId]; ok {
			continue
		}
		seen[object.BucketId] = struct{}{}
		ids = append(ids, object.BucketId)
	}
	return ids
}

func buildAccountSummary(_ *svc.ServiceContext, account *accountmodel.UserAccount, profile *profilemodel.UserProfile) types.AccountSummary {
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

	// AvatarUrl is resolved by the caller (LoadAvatarURL for a single asset,
	// LoadAvatarURLsByOwner for lists) and assigned onto Owner.AvatarUrl after
	// this summary is built — resolving it here would be N+1 queries per item.
	return types.AccountSummary{
		Id:        formatID(account.Id),
		Username:  account.Username,
		Email:     "",
		Nickname:  nickname,
		AvatarUrl: "",
		Bio:       bio,
		Status:    account.Status,
		Role:      accountRole(account),
	}
}

// LoadAvatarURL resolves a user's avatar public URL from the avatar asset
// referenced by their profile. Returns "" when the user has no avatar.
func LoadAvatarURL(ctx context.Context, svcCtx *svc.ServiceContext, profile *profilemodel.UserProfile) string {
	if profile == nil || !profile.AvatarAssetId.Valid || profile.AvatarAssetId.Int64 <= 0 {
		return ""
	}

	object, err := svcCtx.Models.Media.MediaObject.FindOriginalByAssetID(ctx, uint64(profile.AvatarAssetId.Int64))
	if err != nil {
		return ""
	}
	bucket, err := svcCtx.Models.Media.StorageBucket.FindOne(ctx, object.BucketId)
	if err != nil {
		return ""
	}
	return BuildPublicObjectURL(bucket, object.ObjectKey)
}

// collectAvatarAssetIDs extracts the unique, valid avatar asset IDs from a set
// of user profiles (keyed by owner user ID).
func collectAvatarAssetIDs(profiles map[uint64]*profilemodel.UserProfile) []uint64 {
	seen := make(map[uint64]struct{}, len(profiles))
	ids := make([]uint64, 0, len(profiles))
	for _, profile := range profiles {
		if profile == nil || !profile.AvatarAssetId.Valid || profile.AvatarAssetId.Int64 <= 0 {
			continue
		}
		assetID := uint64(profile.AvatarAssetId.Int64)
		if _, ok := seen[assetID]; ok {
			continue
		}
		seen[assetID] = struct{}{}
		ids = append(ids, assetID)
	}
	return ids
}

// LoadAvatarURLsByOwner bulk-resolves avatar URLs for a set of user profiles
// (keyed by owner user ID), so a page of N assets costs only two extra
// queries regardless of how many distinct owners it has.
func LoadAvatarURLsByOwner(ctx context.Context, svcCtx *svc.ServiceContext, profiles map[uint64]*profilemodel.UserProfile) (map[uint64]string, error) {
	out := make(map[uint64]string, len(profiles))
	if len(profiles) == 0 {
		return out, nil
	}

	assetIDs := collectAvatarAssetIDs(profiles)
	if len(assetIDs) == 0 {
		return out, nil
	}

	objects, err := svcCtx.Models.Media.MediaObject.FindOriginalByAssetIDs(ctx, assetIDs)
	if err != nil {
		return nil, err
	}

	bucketIDs := make([]uint64, 0, len(objects))
	bucketSeen := make(map[uint64]struct{}, len(objects))
	for _, object := range objects {
		if object == nil || object.BucketId == 0 {
			continue
		}
		if _, ok := bucketSeen[object.BucketId]; ok {
			continue
		}
		bucketSeen[object.BucketId] = struct{}{}
		bucketIDs = append(bucketIDs, object.BucketId)
	}
	buckets, err := svcCtx.Models.Media.StorageBucket.FindByIDs(ctx, bucketIDs)
	if err != nil {
		return nil, err
	}

	urlByAsset := make(map[uint64]string, len(objects))
	for assetID, object := range objects {
		if object == nil {
			continue
		}
		bucket := buckets[object.BucketId]
		if bucket == nil {
			continue
		}
		urlByAsset[assetID] = BuildPublicObjectURL(bucket, object.ObjectKey)
	}

	for ownerUserID, profile := range profiles {
		if profile == nil || !profile.AvatarAssetId.Valid || profile.AvatarAssetId.Int64 <= 0 {
			continue
		}
		if url, ok := urlByAsset[uint64(profile.AvatarAssetId.Int64)]; ok {
			out[ownerUserID] = url
		}
	}
	return out, nil
}

func buildMediaStats(stat *statisticsmodel.EntityStat) types.MediaAssetStats {
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

func canManageMediaAsset(asset *mediamodel.MediaAsset, user *accountmodel.UserAccount, svcCtx *svc.ServiceContext) bool {
	if asset == nil || user == nil {
		return false
	}
	return asset.OwnerUserId == user.Id || svcCtx.IsAdminAccount(user)
}

func canViewMediaAsset(ctx context.Context, asset *mediamodel.MediaAsset, user *accountmodel.UserAccount, svcCtx *svc.ServiceContext) bool {
	if asset == nil || asset.Status != "active" || asset.DeletedAt.Valid {
		return false
	}
	level, err := access.ResolveViewerAccess(ctx, svcCtx, user, asset.OwnerUserId)
	if err != nil {
		return false
	}
	if level == access.ViewerAccessOwner || level == access.ViewerAccessAdmin {
		return access.CanViewVisibility(asset.Visibility, level)
	}
	if asset.AuditStatus != "approved" {
		return false
	}
	return access.CanViewVisibility(asset.Visibility, level)
}

func canViewOriginal(ctx context.Context, asset *mediamodel.MediaAsset, user *accountmodel.UserAccount, svcCtx *svc.ServiceContext) bool {
	return canViewMediaAsset(ctx, asset, user, svcCtx)
}

func accountRole(account *accountmodel.UserAccount) string {
	if account == nil {
		return "user"
	}
	role := strings.TrimSpace(account.Role)
	if role == "" {
		return "user"
	}
	return role
}

func commonNotFound() error {
	return commonresponse.NotFound("媒体资源不存在")
}

func sqlNullInt64FromUint64(value uint64) sql.NullInt64 {
	if value == 0 {
		return sql.NullInt64{}
	}
	return sql.NullInt64{Int64: int64(value), Valid: true}
}
