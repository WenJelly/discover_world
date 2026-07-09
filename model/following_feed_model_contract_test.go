package model

import (
	"os"
	"strings"
	"testing"
)

func TestFollowingFeedModelContract(t *testing.T) {
	postSource, err := os.ReadFile("postmodel.go")
	if err != nil {
		t.Fatalf("read postmodel.go: %v", err)
	}
	mediaSource, err := os.ReadFile("mediaassetmodel.go")
	if err != nil {
		t.Fatalf("read mediaassetmodel.go: %v", err)
	}

	for _, fragment := range []string{
		"FindPublicByAuthorsBeforeCursor(ctx context.Context, authorIDs []uint64, beforeID uint64, limit int64)",
		"`user_id` in",
		"`status` = 'active'",
		"`visibility` = 'public'",
		"`deleted_at` is null",
	} {
		if !strings.Contains(string(postSource), fragment) {
			t.Fatalf("postmodel.go missing %q", fragment)
		}
	}

	for _, fragment := range []string{
		"FindPublicWorkByOwnersBeforeID(ctx context.Context, ownerIDs []uint64, beforeID uint64, limit int64)",
		"`owner_user_id` in",
		"`status` = 'active'",
		"`visibility` = 'public'",
		"`audit_status` = 'approved'",
		"`asset_usage` = 'work'",
		"`deleted_at` is null",
	} {
		if !strings.Contains(string(mediaSource), fragment) {
			t.Fatalf("mediaassetmodel.go missing %q", fragment)
		}
	}
}
