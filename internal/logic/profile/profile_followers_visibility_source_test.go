package profile

import (
	"os"
	"strings"
	"testing"
)

func TestProfilePostListUsesAccessLevel(t *testing.T) {
	commonSource, err := os.ReadFile("common.go")
	if err != nil {
		t.Fatalf("read common.go: %v", err)
	}
	listSource, err := os.ReadFile("getprofilepostcursorlistlogic.go")
	if err != nil {
		t.Fatalf("read getprofilepostcursorlistlogic.go: %v", err)
	}
	commonText := string(commonSource)
	listText := string(listSource)
	if !strings.Contains(commonText, "ResolveViewerAccess") {
		t.Fatal("common.go should resolve viewer access for target profile")
	}
	if strings.Contains(commonText, "includePrivate := target.Id == loginUser.Id") {
		t.Fatal("loadProfileTarget should not return boolean includePrivate")
	}
	if !strings.Contains(listText, "FindByUserBeforePinCursor") || !strings.Contains(listText, "accessLevel") {
		t.Fatal("profile post list should pass accessLevel into post model query")
	}
}
