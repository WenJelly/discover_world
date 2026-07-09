package feed

import (
	"os"
	"strings"
	"testing"
)

func readFeedContractSource(t *testing.T, path string) string {
	t.Helper()
	source, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return string(source)
}

func TestFollowingFeedAPIAndLogicContract(t *testing.T) {
	api := readFeedContractSource(t, "../../../api/discover_world.api")
	typesSource := readFeedContractSource(t, "../../types/types.go")

	for _, fragment := range []string{
		"FollowingPostListRequest",
		"FollowingMediaListRequest",
		"post /feed/following/post/list/cursor",
		"post /feed/following/media/list/cursor",
	} {
		if !strings.Contains(api, fragment) {
			t.Fatalf("api missing %q", fragment)
		}
		if strings.HasSuffix(fragment, "Request") && !strings.Contains(typesSource, fragment) {
			t.Fatalf("internal types missing %q", fragment)
		}
	}

	for _, item := range []struct {
		path      string
		fragments []string
	}{
		{
			path: "getfollowingpostcursorlistlogic.go",
			fragments: []string{
				"UserFollowModel.ListFollowingIDs",
				"PostModel.FindPublicByAuthorsBeforeCursor",
				"postlogic.BuildPublicPostResponses",
				"types.PublicPostCursorPageResponse",
			},
		},
		{
			path: "getfollowingmediacursorlistlogic.go",
			fragments: []string{
				"UserFollowModel.ListFollowingIDs",
				"MediaAssetModel.FindPublicWorkByOwnersBeforeID",
				"mediaLogic.BuildMediaAssetListResponse",
				"types.MediaAssetCursorPageResponse",
			},
		},
	} {
		source := readFeedContractSource(t, item.path)
		for _, fragment := range item.fragments {
			if !strings.Contains(source, fragment) {
				t.Fatalf("%s missing %q", item.path, fragment)
			}
		}
	}
}
