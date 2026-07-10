package media

import (
	"os"
	"strings"
	"testing"
)

func TestMediaViewUsesSharedAccessPolicy(t *testing.T) {
	source, err := os.ReadFile("view.go")
	if err != nil {
		t.Fatalf("read view.go: %v", err)
	}
	text := string(source)
	required := []string{
		`access.ResolveViewerAccess`,
		`access.CanViewVisibility`,
		`asset.Status != "active"`,
		`asset.AuditStatus != "approved"`,
	}
	for _, item := range required {
		if !strings.Contains(text, item) {
			t.Fatalf("view.go missing %q", item)
		}
	}
}
