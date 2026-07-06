package model

import (
	"os"
	"strings"
	"testing"
)

func TestMediaAssetModelExposesOwnerPublicApprovedCount(t *testing.T) {
	source, err := os.ReadFile("mediaassetmodel.go")
	if err != nil {
		t.Fatalf("read mediaassetmodel.go: %v", err)
	}
	text := string(source)

	if !strings.Contains(text, "CountPublicApprovedByOwner") {
		t.Fatal("media asset model should expose CountPublicApprovedByOwner")
	}

	start := strings.Index(text, "func (m *customMediaAssetModel) CountPublicApprovedByOwner")
	if start < 0 {
		t.Fatal("CountPublicApprovedByOwner implementation missing")
	}
	end := strings.Index(text[start:], "\nfunc ")
	body := text[start:]
	if end > 0 {
		body = text[start : start+end]
	}

	for _, fragment := range []string{
		"`owner_user_id` = ?",
		"`status` = 'active'",
		"`visibility` = 'public'",
		"`audit_status` = 'approved'",
		"`asset_usage` = 'work'",
	} {
		if !strings.Contains(body, fragment) {
			t.Fatalf("CountPublicApprovedByOwner missing %q", fragment)
		}
	}
}
