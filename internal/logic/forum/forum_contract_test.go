package forum

import (
	"os"
	"strings"
	"testing"
)

func readForumContractSource(t *testing.T, path string) string {
	t.Helper()
	source, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return string(source)
}

func TestForumLogicContract(t *testing.T) {
	for _, item := range []struct {
		path      string
		fragments []string
	}{
		{
			path: "getforumboardlistlogic.go",
			fragments: []string{
				"ForumBoardModel.FindActive",
				"types.ForumBoardListResponse",
				"ForumBoardResponse",
			},
		},
		{
			path: "getforumpostcursorlistlogic.go",
			fragments: []string{
				"PostDiscussionModel.FindPublicByBoardBeforeCursor",
				"PostModel.FindByIDs",
				"buildForumPostResponses",
				"types.ForumPostCursorPageResponse",
			},
		},
		{
			path: "createforumpostlogic.go",
			fragments: []string{
				"loadLoginUser",
				"ForumBoardModel.FindOneActiveByID",
				"normalizeForumPostTitle",
				"validatePostImages",
				"svcCtx.Transact",
				"PostModel.Insert",
				"PostDiscussionModel.Insert",
				"EntityStatModel.Ensure",
			},
		},
	} {
		source := readForumContractSource(t, item.path)
		for _, fragment := range item.fragments {
			if !strings.Contains(source, fragment) {
				t.Fatalf("%s missing %q", item.path, fragment)
			}
		}
	}
}
