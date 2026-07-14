package moderation

import (
	"os"
	"strings"
	"testing"
)

func readModerationSource(t *testing.T, path string) string {
	t.Helper()
	source, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return string(source)
}

func TestAdminBackendModerationContracts(t *testing.T) {
	for _, path := range []string{
		"adminhidepostlogic.go",
		"adminrestorepostlogic.go",
		"adminlockforumpostlogic.go",
		"adminunlockforumpostlogic.go",
		"adminpinforumpostlogic.go",
		"adminunpinforumpostlogic.go",
		"adminhidecommentlogic.go",
		"adminrestorecommentlogic.go",
		"resolveadminmoderationreportlogic.go",
	} {
		source := readModerationSource(t, path)
		for _, fragment := range []string{
			"adminsupport.RequireAdminCapability",
			"adminsupport.CapabilityContentModerate",
			"adminsupport.TransactOperation",
			"OperationLogInput",
		} {
			if !strings.Contains(source, fragment) {
				t.Fatalf("%s missing %q", path, fragment)
			}
		}
	}
}

func TestAdminContentListUsesContentModels(t *testing.T) {
	source := readModerationSource(t, "getadmincontentlistlogic.go")
	for _, fragment := range []string{
		"PostModel.CountAdminByFilter",
		"PostModel.FindAdminByFilter",
		"CommentRecordModel.CountByFilter",
		"CommentRecordModel.FindByFilter",
		"buildAdminPostContentResponse",
		"buildAdminCommentContentResponse",
		"loadAdminContentAuthors",
	} {
		if !strings.Contains(source, fragment) {
			t.Fatalf("getadmincontentlistlogic.go missing %q", fragment)
		}
	}
}
