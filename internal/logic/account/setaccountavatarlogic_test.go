package account

import (
	"testing"

	"discover_world/model"
)

func TestValidateAvatarAssetForUserAcceptsCompletedOwnedAvatar(t *testing.T) {
	asset := &model.MediaAsset{
		OwnerUserId: 7,
		MediaType:   "image",
		AssetUsage:  "avatar",
		Visibility:  "public",
		Status:      "active",
		AuditStatus: "approved",
	}

	if err := validateAvatarAssetForUser(asset, 7); err != nil {
		t.Fatalf("validateAvatarAssetForUser rejected valid avatar: %v", err)
	}
}

func TestValidateAvatarAssetForUserRejectsUnusableAssets(t *testing.T) {
	tests := []struct {
		name  string
		asset *model.MediaAsset
	}{
		{name: "missing", asset: nil},
		{name: "different owner", asset: &model.MediaAsset{OwnerUserId: 8, MediaType: "image", AssetUsage: "avatar", Visibility: "public", Status: "active", AuditStatus: "approved"}},
		{name: "work asset", asset: &model.MediaAsset{OwnerUserId: 7, MediaType: "image", AssetUsage: "work", Visibility: "public", Status: "active", AuditStatus: "approved"}},
		{name: "uploading", asset: &model.MediaAsset{OwnerUserId: 7, MediaType: "image", AssetUsage: "avatar", Visibility: "public", Status: "uploading", AuditStatus: "approved"}},
		{name: "not approved", asset: &model.MediaAsset{OwnerUserId: 7, MediaType: "image", AssetUsage: "avatar", Visibility: "public", Status: "active", AuditStatus: "pending"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := validateAvatarAssetForUser(tt.asset, 7); err == nil {
				t.Fatal("validateAvatarAssetForUser accepted unusable avatar asset")
			}
		})
	}
}
