package model

import (
	"os"
	"strings"
	"testing"
)

func readCommunityModelSource(t *testing.T, path string) string {
	t.Helper()
	source, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return string(source)
}

func TestPublicPostModelContract(t *testing.T) {
	source := readCommunityModelSource(t, "postmodel.go")

	for _, fragment := range []string{
		"FindPublicBeforeCursor(ctx context.Context, cursor PublicPostCursor, sort string, searchText string, limit int64)",
		"FindByIDs(ctx context.Context, ids []uint64)",
		"SetStatus(ctx context.Context, id uint64, status string)",
		"PublicPostCursor",
		"`status` = 'active'",
		"`visibility` = 'public'",
		"`deleted_at` is null",
		"`user_account`",
		"ua.`status` = 'active'",
		"postHotScoreSQL",
		"postRisingScoreSQL",
	} {
		if !strings.Contains(source, fragment) {
			t.Fatalf("postmodel.go missing %q", fragment)
		}
	}
}

func TestForumAndModerationModelsAreRegistered(t *testing.T) {
	for _, item := range []struct {
		path      string
		fragments []string
	}{
		{
			path: "forumboardmodel.go",
			fragments: []string{
				"ForumBoardModel interface",
				"FindActive(ctx context.Context",
				"FindOneActiveByID(ctx context.Context",
				"`forum_board`",
				"`slug`",
			},
		},
		{
			path: "postdiscussionmodel.go",
			fragments: []string{
				"PostDiscussionModel interface",
				"FindPublicByBoardBeforeCursor(ctx context.Context",
				"Insert(ctx context.Context",
				"SetLocked(ctx context.Context",
				"SetBoardPinned(ctx context.Context",
				"TouchActivity(ctx context.Context",
				"`post_discussion`",
				"`last_activity_at`",
			},
		},
		{
			path: "moderationreportmodel.go",
			fragments: []string{
				"ModerationReportModel interface",
				"Insert(ctx context.Context",
				"`moderation_report`",
				"`target_type`",
				"`reason`",
			},
		},
	} {
		source := readCommunityModelSource(t, item.path)
		for _, fragment := range item.fragments {
			if !strings.Contains(source, fragment) {
				t.Fatalf("%s missing %q", item.path, fragment)
			}
		}
	}

	svcSource, err := os.ReadFile("../internal/svc/servicecontext.go")
	if err != nil {
		t.Fatalf("read servicecontext.go: %v", err)
	}
	svc := string(svcSource)
	for _, fragment := range []string{
		"ForumBoardModel",
		"PostDiscussionModel",
		"ModerationReportModel",
		"model.NewForumBoardModel(conn)",
		"model.NewPostDiscussionModel(conn)",
		"model.NewModerationReportModel(conn)",
	} {
		if !strings.Contains(svc, fragment) {
			t.Fatalf("servicecontext.go missing %q", fragment)
		}
	}
}
