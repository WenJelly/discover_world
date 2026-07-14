package media

import (
	"os"
	"strings"
	"testing"
)

func TestReviewMediaAssetWritesAdminAudit(t *testing.T) {
	source, err := os.ReadFile("reviewmediaassetlogic.go")
	if err != nil {
		t.Fatalf("read reviewmediaassetlogic.go: %v", err)
	}
	text := string(source)
	for _, fragment := range []string{
		"adminsupport.RequireAdminCapability",
		"adminsupport.CapabilityMediaReview",
		"adminsupport.TransactOperation",
		"adminsupport.OperationLogInput",
		"media.review",
	} {
		if !strings.Contains(text, fragment) {
			t.Fatalf("reviewmediaassetlogic.go missing %q", fragment)
		}
	}
}
