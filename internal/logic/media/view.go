package media

import (
	"context"
	"database/sql"
	"errors"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"discover_world/model"
)

func BuildMediaAssetListResponse(ctx context.Context, svcCtx *svc.ServiceContext, assets []*model.MediaAsset, viewer *model.UserAccount, variant types.MediaVariantRequest) ([]types.MediaAssetResponse, error) {
	return buildMediaAssetListResponse(ctx, svcCtx, assets, viewer, variant)
}

func buildMediaAssetResponse(ctx context.Context, svcCtx *svc.ServiceContext, asset *model.MediaAsset, object *model.MediaObject, owner *model.UserAccount, profile *model.UserProfile, stat *model.EntityStat, tags []string, viewer *model.UserAccount, variant types.MediaVariantRequest) (*types.MediaAssetResponse, error) {
	resp, err := buildMediaAssetResponseWithBucket(ctx, svcCtx, asset, object, nil, owner, profile, stat, tags, viewer, variant)
	if err != nil {
		return nil, err
	}
	if resp != nil {
		resp.Owner.AvatarUrl = LoadAvatarURL(ctx, svcCtx, profile)
	}
	return resp, nil
}

func buildMediaAssetResponseWithBucket(ctx context.Context, svcCtx *svc.ServiceContext, asset *model.MediaAsset, object *model.MediaObject, bucket *model.StorageBucket, owner *model.UserAccount, profile *model.UserProfile, stat *model.EntityStat, tags []string, viewer *model.UserAccount, variant types.MediaVariantRequest) (*types.MediaAssetResponse, error) {
	if asset == nil {
		return nil, commonNotFound()
	}

	if object == nil {
		loaded, err := svcCtx.MediaObjectModel.FindOriginalByAssetID(ctx, asset.Id)
		if err != nil && !errors.Is(err, model.ErrNotFound) {
			return nil, err
		}
		object = loaded
	}

	if object != nil {
		if bucket == nil {
			loaded, err := svcCtx.StorageBucketModel.FindOne(ctx, object.BucketId)
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

	canAccessOriginal := canViewOriginal(asset, viewer, svcCtx)
	permissions := types.MediaAssetPermissions{
		CanViewOriginal: canAccessOriginal,
		CanDownload:     canAccessOriginal,
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
		ReviewMessage:    metadata.ReviewMessage,
		ReviewerId:       metadata.ReviewerId,
		ReviewTime:       metadata.ReviewTime,
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
		MetadataJson: nullStringValue(asset.MetadataJson),
		CreatedAt:    formatTime(asset.CreatedAt),
		UpdatedAt:    formatTime(asset.UpdatedAt),
	}, nil
}

func buildMediaAssetListResponse(ctx context.Context, svcCtx *svc.ServiceContext, assets []*model.MediaAsset, viewer *model.UserAccount, variant types.MediaVariantRequest) ([]types.MediaAssetResponse, error) {
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

	objects, err := svcCtx.MediaObjectModel.FindOriginalByAssetIDs(ctx, assetIDs)
	if err != nil {
		return nil, err
	}
	buckets, err := svcCtx.StorageBucketModel.FindByIDs(ctx, collectOriginalBucketIDs(assets, objects))
	if err != nil {
		return nil, err
	}
	stats, err := svcCtx.EntityStatModel.FindByTargetIDs(ctx, targetTypeMediaAsset, assetIDs)
	if err != nil {
		return nil, err
	}
	tags, err := svcCtx.TaggingModel.FindNamesByTargetIDs(ctx, targetTypeMediaAsset, assetIDs)
	if err != nil {
		return nil, err
	}
	owners, err := svcCtx.UserAccountModel.FindByIDs(ctx, ownerIDs)
	if err != nil {
		return nil, err
	}
	profiles, err := svcCtx.UserProfileModel.FindByUserIDs(ctx, ownerIDs)
	if err != nil {
		return nil, err
	}

	ownerMap := make(map[uint64]*model.UserAccount, len(owners))
	for _, owner := range owners {
		if owner != nil {
			ownerMap[owner.Id] = owner
		}
	}

	avatarURLs, err := loadAvatarURLsByOwner(ctx, svcCtx, profiles)
	if err != nil {
		return nil, err
	}

	resp := make([]types.MediaAssetResponse, 0, len(assets))
	for _, asset := range assets {
		if asset == nil {
			continue
		}
		object := objects[asset.Id]
		var bucket *model.StorageBucket
		if object != nil {
			bucket = buckets[object.BucketId]
		}
		item, err := buildMediaAssetResponseWithBucket(ctx, svcCtx, asset, object, bucket, ownerMap[asset.OwnerUserId], profiles[asset.OwnerUserId], stats[asset.Id], tags[asset.Id], viewer, variant)
		if err != nil {
			return nil, err
		}
		item.Owner.AvatarUrl = avatarURLs[asset.OwnerUserId]
		resp = append(resp, *item)
	}
	return resp, nil
}

func collectOriginalBucketIDs(assets []*model.MediaAsset, objects map[uint64]*model.MediaObject) []uint64 {
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

	// AvatarUrl is resolved by the caller (LoadAvatarURL for a single asset,
	// loadAvatarURLsByOwner for lists) and assigned onto Owner.AvatarUrl after
	// this summary is built — resolving it here would be N+1 queries per item.
	return types.AccountSummary{
		Id:        formatID(account.Id),
		Username:  account.Username,
		Email:     "",
		Nickname:  nickname,
		AvatarUrl: "",
		Bio:       bio,
		Status:    account.Status,
		Role:      accountRole(svcCtx, account),
	}
}

// LoadAvatarURL resolves a user's avatar public URL from the avatar asset
// referenced by their profile. Returns "" when the user has no avatar.
func LoadAvatarURL(ctx context.Context, svcCtx *svc.ServiceContext, profile *model.UserProfile) string {
	if profile == nil || !profile.AvatarAssetId.Valid || profile.AvatarAssetId.Int64 <= 0 {
		return ""
	}

	object, err := svcCtx.MediaObjectModel.FindOriginalByAssetID(ctx, uint64(profile.AvatarAssetId.Int64))
	if err != nil {
		return ""
	}
	bucket, err := svcCtx.StorageBucketModel.FindOne(ctx, object.BucketId)
	if err != nil {
		return ""
	}
	return BuildPublicObjectURL(bucket, object.ObjectKey)
}

// collectAvatarAssetIDs extracts the unique, valid avatar asset IDs from a set
// of user profiles (keyed by owner user ID).
func collectAvatarAssetIDs(profiles map[uint64]*model.UserProfile) []uint64 {
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

// loadAvatarURLsByOwner bulk-resolves avatar URLs for a set of user profiles
// (keyed by owner user ID), so a page of N assets costs only two extra
// queries regardless of how many distinct owners it has.
func loadAvatarURLsByOwner(ctx context.Context, svcCtx *svc.ServiceContext, profiles map[uint64]*model.UserProfile) (map[uint64]string, error) {
	out := make(map[uint64]string, len(profiles))
	if len(profiles) == 0 {
		return out, nil
	}

	assetIDs := collectAvatarAssetIDs(profiles)
	if len(assetIDs) == 0 {
		return out, nil
	}

	objects, err := svcCtx.MediaObjectModel.FindOriginalByAssetIDs(ctx, assetIDs)
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
	buckets, err := svcCtx.StorageBucketModel.FindByIDs(ctx, bucketIDs)
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

func buildMediaStats(stat *model.EntityStat) types.MediaAssetStats {
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

func canManageMediaAsset(asset *model.MediaAsset, user *model.UserAccount, svcCtx *svc.ServiceContext) bool {
	if asset == nil || user == nil {
		return false
	}
	return asset.OwnerUserId == user.Id || svcCtx.IsAdminAccount(user)
}

func canViewMediaAsset(asset *model.MediaAsset, user *model.UserAccount, svcCtx *svc.ServiceContext) bool {
	if asset == nil {
		return false
	}
	if asset.Visibility == "public" && asset.Status == "active" && asset.AuditStatus == "approved" {
		return true
	}
	return canManageMediaAsset(asset, user, svcCtx)
}

func canViewOriginal(asset *model.MediaAsset, user *model.UserAccount, svcCtx *svc.ServiceContext) bool {
	return canViewMediaAsset(asset, user, svcCtx)
}

func accountRole(svcCtx *svc.ServiceContext, account *model.UserAccount) string {
	if svcCtx.IsAdminAccount(account) {
		return "admin"
	}
	return "user"
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
