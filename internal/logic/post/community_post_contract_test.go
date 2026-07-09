package post

import (
	"os"
	"strings"
	"testing"
)

func readPostContractSource(t *testing.T, path string) string {
	t.Helper()
	source, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return string(source)
}

func TestPublicPostAPIAndTypeContract(t *testing.T) {
	api := readPostContractSource(t, "../../../api/discover_world.api")
	typesSource := readPostContractSource(t, "../../types/types.go")

	for _, fragment := range []string{
		"PublicPostListRequest",
		"PublicPostCursorPageResponse",
		"PublicPostResponse",
		"ForumBoardListRequest",
		"ForumBoardResponse",
		"ForumPostListRequest",
		"CreateForumPostRequest",
		"CreateModerationReportRequest",
		"AdminModeratePostRequest",
		"post /post/public/list/cursor",
		"post /forum/board/list",
		"post /forum/post/list/cursor",
		"post /forum/post/create",
		"post /moderation/report/create",
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
}

func TestPublicPostLogicUsesModelAndSharedPostResponseAssembly(t *testing.T) {
	source := readPostContractSource(t, "getpublicpostcursorlistlogic.go")

	for _, fragment := range []string{
		"FindPublicBeforeCursor",
		"buildPublicPostResponses",
		"Author",
		"decodePublicPostCursor",
		"encodePublicPostCursor",
		"types.PublicPostCursorPageResponse",
	} {
		if !strings.Contains(source, fragment) {
			t.Fatalf("public post logic missing %q", fragment)
		}
	}
}

func TestPostActivityWritesHourlyStatsForRanking(t *testing.T) {
	for _, item := range []struct {
		path    string
		counter string
	}{
		{path: "getpostdetaillogic.go", counter: `"view_count"`},
		{path: "togglepostreactionlogic.go", counter: `"reaction_count"`},
		{path: "togglepostfavoritelogic.go", counter: `"favorite_count"`},
		{path: "createpostcommentlogic.go", counter: `"comment_count"`},
	} {
		source := readPostContractSource(t, item.path)
		if !strings.Contains(source, "EntityStatModel") {
			t.Fatalf("%s must still update entity_stat", item.path)
		}
		if !strings.Contains(source, "EntityStatHourlyModel.IncrementCounter") {
			t.Fatalf("%s must update entity_stat_hourly", item.path)
		}
		if !strings.Contains(source, item.counter) {
			t.Fatalf("%s missing counter %s", item.path, item.counter)
		}
	}
}

func TestForumPostCommentsRespectLockAndTouchActivity(t *testing.T) {
	source := readPostContractSource(t, "createpostcommentlogic.go")

	for _, fragment := range []string{
		"PostDiscussionModel.FindByPostID",
		"IsLocked == 1",
		"PostDiscussionModel.TouchActivity",
	} {
		if !strings.Contains(source, fragment) {
			t.Fatalf("createpostcommentlogic.go missing forum comment behavior %q", fragment)
		}
	}
}
