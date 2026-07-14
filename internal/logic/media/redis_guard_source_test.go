package media

import (
	"os"
	"strings"
	"testing"
)

func TestDirectUploadUsesRedisRateQuotaAndCompletionLock(t *testing.T) {
	source, err := os.ReadFile("direct_upload.go")
	if err != nil {
		t.Fatalf("read direct_upload.go: %v", err)
	}
	text := string(source)
	for _, fragment := range []string{
		`Allow(ctx, "upload:init:user"`,
		`ConsumeQuota(ctx, "upload:bytes"`,
		`TryLock(ctx, "upload:complete:"+req.SessionId`,
	} {
		if !strings.Contains(text, fragment) {
			t.Fatalf("direct_upload.go missing %q", fragment)
		}
	}
}

func TestDownloadUsesRedisUserRateLimit(t *testing.T) {
	source, err := os.ReadFile("downloadmediaassetlogic.go")
	if err != nil {
		t.Fatalf("read downloadmediaassetlogic.go: %v", err)
	}
	if !strings.Contains(string(source), `Allow(l.ctx, "download:user"`) {
		t.Fatal("download flow missing Redis user rate limit")
	}
}
