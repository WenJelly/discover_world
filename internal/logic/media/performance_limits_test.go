package media

import (
	"strings"
	"testing"
)

func TestNormalizePublicMediaPageRejectsOversizedAndDeepOffsetRequests(t *testing.T) {
	if _, _, err := normalizePublicMediaPage(1, 61); err == nil || !strings.Contains(err.Error(), "cursor") {
		t.Fatalf("pageSize=61 error = %v, want cursor guidance", err)
	}
	if _, _, err := normalizePublicMediaPage(168, 60); err == nil || !strings.Contains(err.Error(), "cursor") {
		t.Fatalf("deep offset error = %v, want cursor guidance", err)
	}

	pageNum, pageSize, err := normalizePublicMediaPage(167, 60)
	if err != nil {
		t.Fatalf("bounded public page returned error: %v", err)
	}
	if pageNum != 167 || pageSize != 60 {
		t.Fatalf("bounded public page = (%d, %d), want (167, 60)", pageNum, pageSize)
	}
}

func TestNormalizeAdminMediaPageKeepsBatchAllowance(t *testing.T) {
	pageNum, pageSize, err := normalizeAdminMediaPage(2, 300)
	if err != nil {
		t.Fatalf("admin page returned error: %v", err)
	}
	if pageNum != 2 || pageSize != 300 {
		t.Fatalf("admin page = (%d, %d), want (2, 300)", pageNum, pageSize)
	}
}
