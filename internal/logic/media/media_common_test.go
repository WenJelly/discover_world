package media

import (
	"database/sql"
	"encoding/binary"
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

func TestEncodeDecodeHotMediaCursor(t *testing.T) {
	token, err := encodeHotMediaCursor(12345, 9.875)
	if err != nil {
		t.Fatalf("encodeHotMediaCursor returned error: %v", err)
	}

	cursor, err := decodeHotMediaCursor(token)
	if err != nil {
		t.Fatalf("decodeHotMediaCursor returned error: %v", err)
	}
	if cursor.ID != 12345 {
		t.Fatalf("decodeHotMediaCursor id = %d, want 12345", cursor.ID)
	}
	if cursor.HotScore != 9.875 {
		t.Fatalf("decodeHotMediaCursor hot score = %v, want 9.875", cursor.HotScore)
	}
}

func TestEncodeDecodeRisingMediaCursor(t *testing.T) {
	token, err := encodeRisingMediaCursor(12345, 6.25)
	if err != nil {
		t.Fatalf("encodeRisingMediaCursor returned error: %v", err)
	}

	cursor, err := decodeRisingMediaCursor(token)
	if err != nil {
		t.Fatalf("decodeRisingMediaCursor returned error: %v", err)
	}
	if cursor.ID != 12345 {
		t.Fatalf("decodeRisingMediaCursor id = %d, want 12345", cursor.ID)
	}
	if cursor.RisingScore != 6.25 {
		t.Fatalf("decodeRisingMediaCursor rising score = %v, want 6.25", cursor.RisingScore)
	}
}

func TestDecodeMediaCursorRejectsInvalidTokens(t *testing.T) {
	if _, err := decodeMediaCursor("not-a-cursor"); err == nil {
		t.Fatal("decodeMediaCursor should reject invalid cursor tokens")
	}
}

func TestNormalizeMediaCursorSort(t *testing.T) {
	tests := []struct {
		raw  string
		want string
	}{
		{raw: "", want: mediaCursorSortLatest},
		{raw: "latest", want: mediaCursorSortLatest},
		{raw: "time", want: mediaCursorSortLatest},
		{raw: "hot", want: mediaCursorSortHot},
		{raw: "rising", want: mediaCursorSortRising},
		{raw: "created", want: mediaCursorSortCreated},
		{raw: "fresh", want: mediaCursorSortCreated},
	}

	for _, tt := range tests {
		t.Run(tt.raw, func(t *testing.T) {
			got, err := normalizeMediaCursorSort(tt.raw)
			if err != nil {
				t.Fatalf("normalizeMediaCursorSort returned error: %v", err)
			}
			if got != tt.want {
				t.Fatalf("normalizeMediaCursorSort(%q) = %q, want %q", tt.raw, got, tt.want)
			}
		})
	}

	if _, err := normalizeMediaCursorSort("random"); err == nil {
		t.Fatal("normalizeMediaCursorSort accepted an unknown sort")
	}
}

func TestEncodeDecodeCreatedMediaCursor(t *testing.T) {
	createdAt := time.Date(2026, 7, 7, 10, 20, 30, 123456789, time.UTC)
	token, err := encodeCreatedMediaCursor(12345, createdAt)
	if err != nil {
		t.Fatalf("encodeCreatedMediaCursor returned error: %v", err)
	}

	cursor, err := decodeCreatedMediaCursor(token)
	if err != nil {
		t.Fatalf("decodeCreatedMediaCursor returned error: %v", err)
	}
	if cursor.ID != 12345 {
		t.Fatalf("decodeCreatedMediaCursor id = %d, want 12345", cursor.ID)
	}
	if !cursor.CreatedAt.Equal(createdAt) {
		t.Fatalf("decodeCreatedMediaCursor createdAt = %v, want %v", cursor.CreatedAt, createdAt)
	}
}

func TestEncodeDecodeCreatedMediaCursorPreservesOffset(t *testing.T) {
	createdAt := time.Date(2026, 7, 7, 10, 20, 30, 0, time.FixedZone("CST", 8*60*60))
	token, err := encodeCreatedMediaCursor(12345, createdAt)
	if err != nil {
		t.Fatalf("encodeCreatedMediaCursor returned error: %v", err)
	}

	cursor, err := decodeCreatedMediaCursor(token)
	if err != nil {
		t.Fatalf("decodeCreatedMediaCursor returned error: %v", err)
	}
	if got := cursor.CreatedAt.Format("-07:00"); got != "+08:00" {
		t.Fatalf("decodeCreatedMediaCursor offset = %s, want +08:00", got)
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
		Exif: &mediaExifMetadata{
			Aperture:     " f/8.0 ",
			FocalLength:  "24mm",
			ShutterSpeed: "1/125s",
			ISO:          "100",
			CameraModel:  "Canon EOS R5",
			LensModel:    "Canon RF 24-70mm F2.8 L IS USM",
		},
	})

	got := parseMediaMetadata(raw)
	if got.UsageType != "avatar" || got.Category != "城市" || got.DominantColor != "#112233" || got.ReviewerId != "7" {
		t.Fatalf("metadata round trip failed: %#v", got)
	}
	if len(got.Tags) != 2 || got.Tags[0] != "夜景" || got.Tags[1] != "旅行" {
		t.Fatalf("metadata tags = %#v", got.Tags)
	}
	if got.Exif == nil {
		t.Fatal("metadata exif was not preserved")
	}
	if got.Exif.Aperture != "f/8.0" || got.Exif.FocalLength != "24mm" || got.Exif.ShutterSpeed != "1/125s" || got.Exif.ISO != "100" {
		t.Fatalf("metadata exif exposure fields = %#v", got.Exif)
	}
	if got.Exif.CameraModel != "Canon EOS R5" || got.Exif.LensModel != "Canon RF 24-70mm F2.8 L IS USM" {
		t.Fatalf("metadata exif camera fields = %#v", got.Exif)
	}
}

func TestExtractExifMetadataFromJPEGBytes(t *testing.T) {
	exif, err := extractExifMetadataFromJPEGBytes(buildTestExifJPEG())
	if err != nil {
		t.Fatalf("extractExifMetadataFromJPEGBytes returned error: %v", err)
	}
	if exif == nil {
		t.Fatal("expected exif metadata")
	}

	if exif.Aperture != "f/8.0" {
		t.Fatalf("aperture = %q, want f/8.0", exif.Aperture)
	}
	if exif.FocalLength != "24mm" {
		t.Fatalf("focal length = %q, want 24mm", exif.FocalLength)
	}
	if exif.ShutterSpeed != "1/125s" {
		t.Fatalf("shutter speed = %q, want 1/125s", exif.ShutterSpeed)
	}
	if exif.ISO != "100" {
		t.Fatalf("iso = %q, want 100", exif.ISO)
	}
	if exif.CameraModel != "Canon EOS R5" {
		t.Fatalf("camera model = %q, want Canon EOS R5", exif.CameraModel)
	}
	if exif.LensModel != "Canon RF 24-70mm F2.8 L IS USM" {
		t.Fatalf("lens model = %q, want Canon RF 24-70mm F2.8 L IS USM", exif.LensModel)
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

func TestBuildPublicMediaAssetListWhereIgnoresRequestedAuditStatus(t *testing.T) {
	for _, requestedStatus := range []string{"pending", "rejected", "all"} {
		t.Run(requestedStatus, func(t *testing.T) {
			whereSQL, args, err := buildPublicMediaAssetListWhere(mediaListFilter{
				AuditStatus: requestedStatus,
			})
			if err != nil {
				t.Fatalf("buildPublicMediaAssetListWhere returned error: %v", err)
			}

			if !strings.Contains(whereSQL, "`audit_status` = ?") {
				t.Fatalf("public media where SQL = %q, want approved audit status filter", whereSQL)
			}

			foundApprovedArg := false
			for _, arg := range args {
				if arg == "approved" {
					foundApprovedArg = true
					break
				}
			}
			if !foundApprovedArg {
				t.Fatalf("public media args = %#v, want approved audit status argument", args)
			}
		})
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

func buildTestExifJPEG() []byte {
	tiff := make([]byte, 0, 256)
	tiff = append(tiff, 'I', 'I')
	tiff = binary.LittleEndian.AppendUint16(tiff, 42)
	tiff = binary.LittleEndian.AppendUint32(tiff, 8)

	const ifd0EntryCount = 2
	tiff = append(tiff, byte(ifd0EntryCount), 0)
	ifd0ModelEntry := len(tiff)
	tiff = append(tiff, make([]byte, 12)...)
	ifd0ExifEntry := len(tiff)
	tiff = append(tiff, make([]byte, 12)...)
	tiff = append(tiff, 0, 0, 0, 0)

	model := append([]byte("Canon EOS R5"), 0)
	modelOffset := uint32(len(tiff))
	tiff = append(tiff, model...)
	if len(tiff)%2 != 0 {
		tiff = append(tiff, 0)
	}
	exifIFDOffset := uint32(len(tiff))

	putIFDEntry(tiff[ifd0ModelEntry:ifd0ModelEntry+12], 0x0110, 2, uint32(len(model)), modelOffset)
	putIFDEntry(tiff[ifd0ExifEntry:ifd0ExifEntry+12], 0x8769, 4, 1, exifIFDOffset)

	const exifEntryCount = 5
	tiff = append(tiff, byte(exifEntryCount), 0)
	fNumberEntry := len(tiff)
	tiff = append(tiff, make([]byte, 12)...)
	focalLengthEntry := len(tiff)
	tiff = append(tiff, make([]byte, 12)...)
	exposureEntry := len(tiff)
	tiff = append(tiff, make([]byte, 12)...)
	isoEntry := len(tiff)
	tiff = append(tiff, make([]byte, 12)...)
	lensEntry := len(tiff)
	tiff = append(tiff, make([]byte, 12)...)
	tiff = append(tiff, 0, 0, 0, 0)

	fNumberOffset := uint32(len(tiff))
	tiff = binary.LittleEndian.AppendUint32(tiff, 8)
	tiff = binary.LittleEndian.AppendUint32(tiff, 1)
	focalLengthOffset := uint32(len(tiff))
	tiff = binary.LittleEndian.AppendUint32(tiff, 24)
	tiff = binary.LittleEndian.AppendUint32(tiff, 1)
	exposureOffset := uint32(len(tiff))
	tiff = binary.LittleEndian.AppendUint32(tiff, 1)
	tiff = binary.LittleEndian.AppendUint32(tiff, 125)
	lens := append([]byte("Canon RF 24-70mm F2.8 L IS USM"), 0)
	lensOffset := uint32(len(tiff))
	tiff = append(tiff, lens...)

	putIFDEntry(tiff[fNumberEntry:fNumberEntry+12], 0x829D, 5, 1, fNumberOffset)
	putIFDEntry(tiff[focalLengthEntry:focalLengthEntry+12], 0x920A, 5, 1, focalLengthOffset)
	putIFDEntry(tiff[exposureEntry:exposureEntry+12], 0x829A, 5, 1, exposureOffset)
	putIFDEntry(tiff[isoEntry:isoEntry+12], 0x8827, 3, 1, 100)
	putIFDEntry(tiff[lensEntry:lensEntry+12], 0xA434, 2, uint32(len(lens)), lensOffset)

	app1Payload := append([]byte("Exif\x00\x00"), tiff...)
	jpeg := []byte{0xFF, 0xD8, 0xFF, 0xE1}
	jpeg = binary.BigEndian.AppendUint16(jpeg, uint16(len(app1Payload)+2))
	jpeg = append(jpeg, app1Payload...)
	jpeg = append(jpeg, 0xFF, 0xD9)
	return jpeg
}

func putIFDEntry(entry []byte, tag uint16, typ uint16, count uint32, valueOrOffset uint32) {
	binary.LittleEndian.PutUint16(entry[0:2], tag)
	binary.LittleEndian.PutUint16(entry[2:4], typ)
	binary.LittleEndian.PutUint32(entry[4:8], count)
	binary.LittleEndian.PutUint32(entry[8:12], valueOrOffset)
}
