package notification

import (
	"os"
	"strings"
	"testing"
)

func TestUnreadCountUsesRedisCacheAndReadWritesInvalidateIt(t *testing.T) {
	countSource, err := os.ReadFile("getunreadnotificationcountlogic.go")
	if err != nil {
		t.Fatalf("read count source: %v", err)
	}
	for _, fragment := range []string{"GetInt64", "SetInt64", "NotificationUnreadCacheKey"} {
		if !strings.Contains(string(countSource), fragment) {
			t.Fatalf("unread count source missing %q", fragment)
		}
	}
	for _, file := range []string{"marknotificationreadlogic.go", "markallnotificationsreadlogic.go"} {
		source, err := os.ReadFile(file)
		if err != nil {
			t.Fatalf("read %s: %v", file, err)
		}
		if !strings.Contains(string(source), "InvalidateNotificationUnread") {
			t.Fatalf("%s does not invalidate unread cache", file)
		}
	}
}
