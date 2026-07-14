package notification

import (
	"os"
	"strings"
	"testing"
)

func TestNotificationProducersInvalidateUnreadCache(t *testing.T) {
	files := []string{
		"../follow/createfollowlogic.go",
		"../media/reviewmediaassetlogic.go",
		"../media/togglemediareactionlogic.go",
		"../post/createpostcommentlogic.go",
		"../post/togglepostreactionlogic.go",
		"../post/togglepostfavoritelogic.go",
	}
	for _, file := range files {
		source, err := os.ReadFile(file)
		if err != nil {
			t.Fatalf("read %s: %v", file, err)
		}
		if !strings.Contains(string(source), "InvalidateNotificationUnread") {
			t.Fatalf("%s does not invalidate unread cache after notification creation", file)
		}
	}
}
