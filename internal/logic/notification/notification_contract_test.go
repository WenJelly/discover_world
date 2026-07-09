package notification

import (
	"os"
	"strings"
	"testing"
)

func readNotificationContractSource(t *testing.T, path string) string {
	t.Helper()
	source, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return string(source)
}

func TestNotificationAPIAndLogicContract(t *testing.T) {
	api := readNotificationContractSource(t, "../../../api/discover_world.api")
	typesSource := readNotificationContractSource(t, "../../types/types.go")

	for _, fragment := range []string{
		"NotificationListRequest",
		"NotificationCursorPageResponse",
		"NotificationResponse",
		"UnreadNotificationCountRequest",
		"UnreadNotificationCountResponse",
		"MarkNotificationReadRequest",
		"MarkAllNotificationsReadRequest",
		"post /notification/list/cursor",
		"post /notification/unread/count",
		"post /notification/read",
		"post /notification/read/all",
	} {
		if !strings.Contains(api, fragment) {
			t.Fatalf("api missing %q", fragment)
		}
		if strings.HasSuffix(fragment, "Request") || strings.HasSuffix(fragment, "Response") {
			if !strings.Contains(typesSource, fragment) {
				t.Fatalf("internal types missing %q", fragment)
			}
		}
	}

	for _, item := range []struct {
		path      string
		fragments []string
	}{
		{path: "getnotificationcursorlistlogic.go", fragments: []string{"NotificationModel.FindByRecipientBeforeID", "types.NotificationCursorPageResponse"}},
		{path: "getunreadnotificationcountlogic.go", fragments: []string{"NotificationModel.CountUnread", "types.UnreadNotificationCountResponse"}},
		{path: "marknotificationreadlogic.go", fragments: []string{"NotificationModel.MarkRead"}},
		{path: "markallnotificationsreadlogic.go", fragments: []string{"NotificationModel.MarkAllRead"}},
	} {
		source := readNotificationContractSource(t, item.path)
		for _, fragment := range item.fragments {
			if !strings.Contains(source, fragment) {
				t.Fatalf("%s missing %q", item.path, fragment)
			}
		}
	}
}
