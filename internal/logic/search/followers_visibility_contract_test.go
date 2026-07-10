package search

import (
	"os"
	"strings"
	"testing"
)

func TestGlobalSearchRemainsPublicOnly(t *testing.T) {
	source, err := os.ReadFile("../../../model/searchmodel.go")
	if err != nil {
		t.Fatalf("read searchmodel.go: %v", err)
	}
	text := string(source)
	required := []string{
		"ma.`+\"`visibility`\"+` = 'public'",
		"p.`+\"`visibility`\"+` = 'public'",
		"a.`+\"`visibility`\"+` = 'public'",
	}
	for _, item := range required {
		if !strings.Contains(text, item) {
			t.Fatalf("searchmodel.go missing public-only guard %q", item)
		}
	}
	if strings.Contains(text, "followers") {
		t.Fatal("global search should not include followers visibility")
	}
}
