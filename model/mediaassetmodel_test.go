package model

import (
	"os"
	"strings"
	"testing"
)

func TestMediaAssetModelSupportsOwnerPublishedLookup(t *testing.T) {
	source, err := os.ReadFile("mediaassetmodel.go")
	if err != nil {
		t.Fatalf("read mediaassetmodel.go: %v", err)
	}
	text := string(source)

	for _, fragment := range []string{
		"FindOwnerPublicApprovedByIDs",
		"`owner_user_id` = ?",
		"`status` = 'active'",
		"`visibility` = 'public'",
		"`audit_status` = 'approved'",
		"`asset_usage` = 'work'",
	} {
		if !strings.Contains(text, fragment) {
			t.Fatalf("mediaassetmodel.go missing %q in owner published media lookup", fragment)
		}
	}
}
