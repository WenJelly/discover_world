package admin

import (
	"os"
	"strings"
	"testing"
)

func TestHomepageAdminWritesInvalidateRedisVersion(t *testing.T) {
	for _, file := range []string{"updateHomepageHeroLogic.go", "updateHomepageFeaturedLogic.go"} {
		source, err := os.ReadFile(file)
		if err != nil {
			t.Fatalf("read %s: %v", file, err)
		}
		if !strings.Contains(string(source), "InvalidateHomepageCache") {
			t.Fatalf("%s does not invalidate homepage cache", file)
		}
	}
}
