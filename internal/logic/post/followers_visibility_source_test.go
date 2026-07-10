package post

import (
	"os"
	"strings"
	"testing"
)

func TestPostFollowersVisibilityUsesSharedAccessPolicy(t *testing.T) {
	source, err := os.ReadFile("common.go")
	if err != nil {
		t.Fatalf("read common.go: %v", err)
	}
	text := string(source)
	required := []string{
		`postVisibilityFollowers = "followers"`,
		`access.ResolveViewerAccess`,
		`access.CanViewVisibility`,
		`visibility must be public, followers or private`,
		`postVisibility == postVisibilityFollowers`,
	}
	for _, item := range required {
		if !strings.Contains(text, item) {
			t.Fatalf("common.go missing %q", item)
		}
	}
}
