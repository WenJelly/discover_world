package moderation

import (
	"os"
	"strings"
	"testing"
)

func readModerationContractSource(t *testing.T, path string) string {
	t.Helper()
	source, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return string(source)
}

func TestModerationLogicContract(t *testing.T) {
	for _, item := range []struct {
		path      string
		fragments []string
	}{
		{
			path: "createmoderationreportlogic.go",
			fragments: []string{
				"loadLoginUser",
				"normalizeReportTargetType",
				"ModerationReportModel.Insert",
				"types.ModerationReportResponse",
			},
		},
		{
			path: "adminhidepostlogic.go",
			fragments: []string{
				"PostModel.SetStatus",
				`"hidden"`,
			},
		},
		{
			path: "adminrestorepostlogic.go",
			fragments: []string{
				"PostModel.SetStatus",
				`"active"`,
			},
		},
		{
			path: "adminlockforumpostlogic.go",
			fragments: []string{
				"PostDiscussionModel.SetLocked",
				"true",
			},
		},
		{
			path: "adminpinforumpostlogic.go",
			fragments: []string{
				"PostDiscussionModel.SetBoardPinned",
				"true",
			},
		},
	} {
		source := readModerationContractSource(t, item.path)
		for _, fragment := range item.fragments {
			if !strings.Contains(source, fragment) {
				t.Fatalf("%s missing %q", item.path, fragment)
			}
		}
	}
}
