package media

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"testing"
	"time"

	"discover_world/internal/svc"
	"discover_world/internal/types"
	"discover_world/model"
)

func TestEncodeDecodeMediaCursor(t *testing.T) {
	token, err := encodeMediaCursor(12345)
	if err != nil {
		t.Fatalf("encodeMediaCursor returned error: %v", err)
	}

	id, err := decodeMediaCursor(token)
	if err != nil {
		t.Fatalf("decodeMediaCursor returned error: %v", err)
	}
	if id != 12345 {
		t.Fatalf("decodeMediaCursor id = %d, want 12345", id)
	}
}

func TestDecodeMediaCursorRejectsInvalidTokens(t *testing.T) {
	if _, err := decodeMediaCursor("not-a-cursor"); err == nil {
		t.Fatal("decodeMediaCursor should reject invalid cursor tokens")
	}
}

func TestBuildMediaObjectKeyUsesBucketBasePath(t *testing.T) {
	key, err := buildMediaObjectKey("media/images", "image", 1001, "jpeg")
	if err != nil {
		t.Fatalf("buildMediaObjectKey returned error: %v", err)
	}

	if key != "media/images/asset-1001/original.jpg" {
		t.Fatalf("object key = %q, want media/images/asset-1001/original.jpg", key)
	}
}

func TestBuildPublicObjectURLPrefersCdnDomain(t *testing.T) {
	bucket := &model.StorageBucket{
		Endpoint:  sql.NullString{String: "https://bucket.cos.ap-guangzhou.myqcloud.com", Valid: true},
		CdnDomain: sql.NullString{String: "https://cdn.example.com/media", Valid: true},
	}

	got := buildPublicObjectURL(bucket, "media/images/asset-1001/original image.jpg")
	want := "https://cdn.example.com/media/media/images/asset-1001/original%20image.jpg"
	if got != want {
		t.Fatalf("public URL = %q, want %q", got, want)
	}
}

func TestCollectOriginalBucketIDsKeepsAssetOrderAndDedupes(t *testing.T) {
	assets := []*model.MediaAsset{
		{Id: 1},
		nil,
		{Id: 2},
		{Id: 3},
	}
	objects := map[uint64]*model.MediaObject{
		1: {BucketId: 10},
		2: {BucketId: 10},
		3: {BucketId: 11},
	}

	got := collectOriginalBucketIDs(assets, objects)
	want := []uint64{10, 11}
	if len(got) != len(want) {
		t.Fatalf("collectOriginalBucketIDs length = %d, want %d: %#v", len(got), len(want), got)
	}
	for index := range want {
		if got[index] != want[index] {
			t.Fatalf("collectOriginalBucketIDs = %#v, want %#v", got, want)
		}
	}
}

func TestCollectAvatarAssetIDsDedupesAndSkipsInvalid(t *testing.T) {
	profiles := map[uint64]*model.UserProfile{
		1: {AvatarAssetId: sql.NullInt64{Int64: 100, Valid: true}},
		2: nil,
		3: {AvatarAssetId: sql.NullInt64{}},                        // invalid (no avatar)
		4: {AvatarAssetId: sql.NullInt64{Int64: 0, Valid: true}},   // zero ID
		5: {AvatarAssetId: sql.NullInt64{Int64: 100, Valid: true}}, // duplicate of owner 1
		6: {AvatarAssetId: sql.NullInt64{Int64: 200, Valid: true}},
	}

	got := collectAvatarAssetIDs(profiles)
	// Map iteration order is non-deterministic, so compare as a set.
	want := []uint64{100, 200}
	if len(got) != len(want) {
		t.Fatalf("collectAvatarAssetIDs length = %d, want %d: %#v", len(got), len(want), got)
	}
	gotSet := make(map[uint64]struct{}, len(got))
	for _, id := range got {
		gotSet[id] = struct{}{}
	}
	for _, id := range want {
		if _, ok := gotSet[id]; !ok {
			t.Fatalf("collectAvatarAssetIDs = %#v, want to contain %d", got, id)
		}
	}
}

func TestBuildAccountSummaryKeepsEmailPrivate(t *testing.T) {
	summary := buildAccountSummary(&svc.ServiceContext{}, &model.UserAccount{
		Id:       7,
		Username: "alice",
		Email: sql.NullString{
			String: "alice@example.com",
			Valid:  true,
		},
		Status: "active",
		Role:   "editor",
	}, &model.UserProfile{
		Nickname: sql.NullString{
			String: "Alice Chen",
			Valid:  true,
		},
	})

	if summary.Username != "alice" {
		t.Fatalf("summary.Username = %q, want alice", summary.Username)
	}
	if summary.Nickname != "Alice Chen" {
		t.Fatalf("summary.Nickname = %q, want Alice Chen", summary.Nickname)
	}
	if summary.Email != "" {
		t.Fatalf("summary.Email = %q, want empty private email", summary.Email)
	}
	if summary.Role != "editor" {
		t.Fatalf("summary.Role = %q, want role column value", summary.Role)
	}
}

func TestBuildVariantURLCompression(t *testing.T) {
	got, err := buildVariantURL("https://cdn.example.com/a.jpg", 8<<20, 2400, 1600, types.MediaVariantRequest{CompressType: 1})
	if err != nil {
		t.Fatalf("buildVariantURL returned error: %v", err)
	}
	if !strings.Contains(got, "imageMogr2/auto-orient/strip/thumbnail/1920x1920>") {
		t.Fatalf("variant URL = %q, want 1920 thumbnail processing", got)
	}
	if !strings.Contains(got, "imageMogr2/auto-orient/strip/thumbnail/") {
		t.Fatalf("variant URL = %q, want auto-orient and strip processing", got)
	}
}

func TestBuildVariantURLCompressesOversizedDimensions(t *testing.T) {
	got, err := buildVariantURL("https://cdn.example.com/a.webp", 1<<20, 5000, 1800, types.MediaVariantRequest{CompressType: 1})
	if err != nil {
		t.Fatalf("buildVariantURL returned error: %v", err)
	}
	if !strings.Contains(got, "imageMogr2/auto-orient/strip/thumbnail/2560x2560>") {
		t.Fatalf("variant URL = %q, want oversized dimensions to use 2560 thumbnail processing", got)
	}
}

func TestBuildVariantURLKeepsEmptyBaseURL(t *testing.T) {
	got, err := buildVariantURL("", 8<<20, 2400, 1600, types.MediaVariantRequest{CompressType: 2})
	if err != nil {
		t.Fatalf("buildVariantURL returned error: %v", err)
	}
	if got != "" {
		t.Fatalf("variant URL = %q, want empty URL", got)
	}
}

func TestBuildVariantURLRejectsOversizedCrop(t *testing.T) {
	_, err := buildVariantURL("https://cdn.example.com/a.jpg", 1<<20, 1200, 800, types.MediaVariantRequest{
		CompressType: 3,
		CutWidth:     4097,
		CutHeight:    800,
	})
	if err == nil {
		t.Fatal("buildVariantURL should reject oversized crop dimensions")
	}
}

func TestMetadataJSONRoundTrip(t *testing.T) {
	reviewTime := time.Date(2026, 7, 3, 12, 0, 0, 0, time.UTC)
	raw := metadataJSON(mediaMetadata{
		UsageType:     "avatar",
		Category:      "城市",
		Tags:          []string{"夜景", "旅行"},
		DominantColor: "#112233",
		BlurHash:      "001ABC",
		ReviewMessage: "ok",
		ReviewerId:    "7",
		ReviewTime:    formatTime(reviewTime),
	})

	got := parseMediaMetadata(raw)
	if got.UsageType != "avatar" || got.Category != "城市" || got.DominantColor != "#112233" || got.ReviewerId != "7" {
		t.Fatalf("metadata round trip failed: %#v", got)
	}
	if len(got.Tags) != 2 || got.Tags[0] != "夜景" || got.Tags[1] != "旅行" {
		t.Fatalf("metadata tags = %#v", got.Tags)
	}
}

func TestBuildPublicMediaAssetListWhereRequiresWorkUsage(t *testing.T) {
	whereSQL, args, err := buildPublicMediaAssetListWhere(mediaListFilter{})
	if err != nil {
		t.Fatalf("buildPublicMediaAssetListWhere returned error: %v", err)
	}

	if !strings.Contains(whereSQL, "`asset_usage` = ?") {
		t.Fatalf("public media where SQL = %q, want asset_usage filter", whereSQL)
	}
	foundWorkArg := false
	for _, arg := range args {
		if arg == "work" {
			foundWorkArg = true
			break
		}
	}
	if !foundWorkArg {
		t.Fatalf("public media args = %#v, want work asset usage argument", args)
	}
}

func TestStorageUsageCandidatesRequireAvatarBucket(t *testing.T) {
	got := storageUsageCandidates("avatar")
	want := []string{"avatar"}
	if len(got) != len(want) {
		t.Fatalf("storageUsageCandidates length = %d, want %d: %#v", len(got), len(want), got)
	}
	for index := range want {
		if got[index] != want[index] {
			t.Fatalf("storageUsageCandidates = %#v, want %#v", got, want)
		}
	}

	if media := storageUsageCandidates("media"); len(media) != 1 || media[0] != "media" {
		t.Fatalf("storageUsageCandidates(media) = %#v, want [media]", media)
	}
}

func TestInitialUploadAuditStatusDependsOnRoleAndUsage(t *testing.T) {
	tests := []struct {
		name       string
		assetUsage string
		isAdmin    bool
		want       string
	}{
		{name: "ordinary work upload requires review", assetUsage: assetUsageWork, want: "pending"},
		{name: "admin work upload is approved", assetUsage: assetUsageWork, isAdmin: true, want: "approved"},
		{name: "public post attachment is approved for ordinary user", assetUsage: assetUsagePost, want: "approved"},
		{name: "public post attachment is approved for admin", assetUsage: assetUsagePost, isAdmin: true, want: "approved"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := initialUploadAuditStatus(tt.assetUsage, tt.isAdmin); got != tt.want {
				t.Fatalf("initialUploadAuditStatus(%q, %v) = %q, want %q", tt.assetUsage, tt.isAdmin, got, tt.want)
			}
		})
	}
}

func TestNormalizeMediaReactionTypeDefaultsAndRejectsUnsupported(t *testing.T) {
	got, err := normalizeMediaReactionType("")
	if err != nil {
		t.Fatalf("normalizeMediaReactionType returned error: %v", err)
	}
	if got != "like" {
		t.Fatalf("normalizeMediaReactionType empty = %q, want like", got)
	}

	got, err = normalizeMediaReactionType(" LIKE ")
	if err != nil {
		t.Fatalf("normalizeMediaReactionType returned error: %v", err)
	}
	if got != "like" {
		t.Fatalf("normalizeMediaReactionType = %q, want like", got)
	}

	if _, err := normalizeMediaReactionType("wow"); err == nil {
		t.Fatal("normalizeMediaReactionType accepted unsupported media reaction type")
	}
}

func TestApplyMediaViewerStateMarksLikedAssets(t *testing.T) {
	state := mediaViewerState{
		liked: map[uint64]bool{10: true},
	}

	liked := types.MediaAssetResponse{}
	applyMediaViewerState(&liked, 10, state)
	if !liked.IsLiked {
		t.Fatal("applyMediaViewerState did not mark liked media asset")
	}

	unliked := types.MediaAssetResponse{}
	applyMediaViewerState(&unliked, 20, state)
	if unliked.IsLiked {
		t.Fatal("applyMediaViewerState marked unrelated media asset as liked")
	}
}

func TestMarkMediaAssetUploadFailedPersistsFailedStatusAndReturnsOriginalError(t *testing.T) {
	asset := &model.MediaAsset{Id: 42, Status: "uploading"}
	originalErr := errors.New("cos upload failed")

	var updated *model.MediaAsset
	got := markMediaAssetUploadFailed(context.Background(), asset, originalErr, func(ctx context.Context, data *model.MediaAsset) error {
		copied := *data
		updated = &copied
		return nil
	})

	if !errors.Is(got, originalErr) {
		t.Fatalf("markMediaAssetUploadFailed() error = %v, want original error", got)
	}
	if asset.Status != "failed" {
		t.Fatalf("asset status = %q, want failed", asset.Status)
	}
	if updated == nil {
		t.Fatal("update was not called")
	}
	if updated.Status != "failed" {
		t.Fatalf("updated status = %q, want failed", updated.Status)
	}
}
