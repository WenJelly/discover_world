package model

import (
	"os"
	"strings"
	"testing"
)

func TestNotificationModelContract(t *testing.T) {
	source, err := os.ReadFile("notificationmodel.go")
	if err != nil {
		t.Fatalf("read notificationmodel.go: %v", err)
	}
	text := string(source)

	for _, fragment := range []string{
		"NotificationModel interface",
		"Insert(ctx context.Context, data *Notification) (sql.Result, error)",
		"FindByRecipientBeforeID(ctx context.Context, recipientUserID uint64, beforeID uint64, limit int64)",
		"CountUnread(ctx context.Context, recipientUserID uint64) (int64, error)",
		"MarkRead(ctx context.Context, recipientUserID uint64, id uint64) error",
		"MarkAllRead(ctx context.Context, recipientUserID uint64) error",
		"`notification`",
		"`recipient_user_id`",
		"`read_at` is null",
	} {
		if !strings.Contains(text, fragment) {
			t.Fatalf("notificationmodel.go missing %q", fragment)
		}
	}

	svcSource, err := os.ReadFile("../internal/svc/servicecontext.go")
	if err != nil {
		t.Fatalf("read servicecontext.go: %v", err)
	}
	svc := string(svcSource)
	for _, fragment := range []string{
		"NotificationModel",
		"model.NewNotificationModel(conn)",
	} {
		if !strings.Contains(svc, fragment) {
			t.Fatalf("servicecontext.go missing %q", fragment)
		}
	}
}
