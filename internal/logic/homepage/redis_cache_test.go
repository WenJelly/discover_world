package homepage

import (
	"os"
	"strings"
	"testing"

	"discover_world/internal/types"
)

func TestHomepageCacheKeyIsStableAndVariesByMediaVariant(t *testing.T) {
	base := homepageCacheKey("4", types.MediaVariantRequest{CompressType: 2, CutWidth: 800})
	if base == "" || base != homepageCacheKey("4", types.MediaVariantRequest{CompressType: 2, CutWidth: 800}) {
		t.Fatalf("cache key is not stable: %q", base)
	}
	if base == homepageCacheKey("4", types.MediaVariantRequest{CompressType: 2, CutWidth: 1200}) {
		t.Fatal("different media variants shared a homepage cache key")
	}
}

func TestPublicHomepageUsesVersionedRedisCache(t *testing.T) {
	source, err := os.ReadFile("getHomepageConfigLogic.go")
	if err != nil {
		t.Fatalf("read getHomepageConfigLogic.go: %v", err)
	}
	text := string(source)
	for _, fragment := range []string{"Version(l.ctx, \"homepage\")", "GetJSON", "SetJSON"} {
		if !strings.Contains(text, fragment) {
			t.Fatalf("homepage read path missing %q", fragment)
		}
	}
}
