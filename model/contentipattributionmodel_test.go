package model

import (
	"os"
	"strings"
	"testing"
)

func TestContentIPAttributionModelDefinesUpsertAndBatchLookup(t *testing.T) {
	source, err := os.ReadFile("contentipattributionmodel.go")
	if err != nil {
		t.Fatalf("read contentipattributionmodel.go: %v", err)
	}
	text := string(source)
	for _, want := range []string{
		"ContentIpAttributionModel interface",
		"Upsert(ctx context.Context, data *ContentIpAttribution) error",
		"FindByTargets(ctx context.Context, targetType string, targetIDs []uint64, actionType string)",
		"on duplicate key update",
		"uk_content_ip_target_action",
	} {
		if !strings.Contains(text, want) {
			t.Fatalf("content IP attribution model missing %q", want)
		}
	}
}
