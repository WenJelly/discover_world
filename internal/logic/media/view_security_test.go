package media

import (
	"database/sql"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"discover_world/internal/svc"
	"discover_world/internal/types"
	"discover_world/model"
)

func TestAnonymousMediaResponseOmitsGovernanceFieldsAndRawMetadata(t *testing.T) {
	asset := &model.MediaAsset{
		Id:          10,
		OwnerUserId: 20,
		MediaType:   "image",
		AssetUsage:  "work",
		Visibility:  "public",
		Status:      "active",
		AuditStatus: "approved",
		MetadataJson: sql.NullString{String: `{
			"category":"城市",
			"tags":["夜景"],
			"dominantColor":"#112233",
			"blurHash":"hash",
			"reviewMessage":"internal moderation note",
			"reviewerId":"99",
			"reviewTime":"2026-07-14T00:00:00Z",
			"internalObjectKey":"private/path"
		}`, Valid: true},
		CreatedAt: time.Unix(100, 0),
		UpdatedAt: time.Unix(200, 0),
	}
	object := &model.MediaObject{AssetId: asset.Id, BucketId: 3, ObjectKey: "public/image.jpg"}
	bucket := &model.StorageBucket{CdnDomain: sql.NullString{String: "https://cdn.example.com", Valid: true}}

	resp, err := buildMediaAssetResponseWithBucket(t.Context(), &svc.ServiceContext{}, asset, object, bucket, nil, nil, nil, nil, nil, types.MediaVariantRequest{})
	if err != nil {
		t.Fatalf("build media response: %v", err)
	}
	payload, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("marshal media response: %v", err)
	}
	jsonText := string(payload)
	for _, forbidden := range []string{"reviewMessage", "reviewerId", "reviewTime", "metadataJson", "internal moderation note", "private/path"} {
		if strings.Contains(jsonText, forbidden) {
			t.Fatalf("anonymous response exposes %q: %s", forbidden, jsonText)
		}
	}
	for _, allowed := range []string{"\"category\":\"城市\"", "\"tags\":[\"夜景\"]", "\"dominantColor\":\"#112233\"", "\"blurHash\":\"hash\""} {
		if !strings.Contains(jsonText, allowed) {
			t.Fatalf("anonymous response lost whitelisted metadata %q: %s", allowed, jsonText)
		}
	}
}

func TestAdminMediaResponseRetainsGovernanceFields(t *testing.T) {
	asset := &model.MediaAsset{
		Id:           10,
		OwnerUserId:  20,
		MediaType:    "image",
		AssetUsage:   "work",
		Visibility:   "public",
		Status:       "active",
		AuditStatus:  "approved",
		MetadataJson: sql.NullString{String: `{"reviewMessage":"note","reviewerId":"99","reviewTime":"2026-07-14T00:00:00Z"}`, Valid: true},
	}
	object := &model.MediaObject{AssetId: asset.Id, BucketId: 3, ObjectKey: "public/image.jpg"}
	bucket := &model.StorageBucket{CdnDomain: sql.NullString{String: "https://cdn.example.com", Valid: true}}
	admin := &model.UserAccount{Id: 99, Role: "admin", Status: "active"}

	resp, err := buildMediaAssetResponseWithBucket(t.Context(), &svc.ServiceContext{}, asset, object, bucket, nil, nil, nil, nil, admin, types.MediaVariantRequest{})
	if err != nil {
		t.Fatalf("build admin media response: %v", err)
	}
	if resp.ReviewMessage != "note" || resp.ReviewerId != "99" || resp.ReviewTime == "" || resp.MetadataJson == "" {
		t.Fatalf("admin governance fields were removed: %+v", resp)
	}
}
