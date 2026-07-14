package media

import (
	"os"
	"strings"
	"testing"
)

func TestDirectUploadStorageUsageFollowsBusinessUsage(t *testing.T) {
	tests := []struct {
		assetUsage string
		want       string
	}{
		{assetUsage: "work", want: "media"},
		{assetUsage: "post", want: "media"},
		{assetUsage: "avatar", want: "avatar"},
		{assetUsage: "temp", want: "temp"},
	}

	for _, tt := range tests {
		if got := storageUsageForAssetUsage(tt.assetUsage); got != tt.want {
			t.Fatalf("storageUsageForAssetUsage(%q) = %q, want %q", tt.assetUsage, got, tt.want)
		}
	}
}

func TestBackendNoLongerContainsServerProxyUploadPipeline(t *testing.T) {
	storageSource, err := os.ReadFile("storage.go")
	if err != nil {
		t.Fatalf("read storage.go: %v", err)
	}
	storeSource, err := os.ReadFile("store.go")
	if err != nil {
		t.Fatalf("read store.go: %v", err)
	}
	combined := string(storageSource) + "\n" + string(storeSource)

	for _, forbidden := range []string{
		"saveMultipartFileToTemp",
		"downloadRemoteImageToTemp",
		"uploadFileToObjectStorage",
		"storeMultipartMediaAsset",
		"storeRemoteMediaAsset",
		"storeMediaAsset",
	} {
		if strings.Contains(combined, forbidden) {
			t.Fatalf("backend server upload pipeline still contains %q", forbidden)
		}
	}
}
