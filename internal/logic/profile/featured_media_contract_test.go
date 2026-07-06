package profile

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func readProjectFile(t *testing.T, parts ...string) string {
	t.Helper()
	path := filepath.Join(append([]string{"..", "..", ".."}, parts...)...)
	source, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return string(source)
}

func TestProfileFeaturedMediaUpdateContract(t *testing.T) {
	api := readProjectFile(t, "api", "discover_world.api")
	types := readProjectFile(t, "internal", "types", "profile.go")
	routes := readProjectFile(t, "internal", "handler", "routes.go")

	for _, fragment := range []string{
		"UpdateProfileFeaturedMediaRequest",
		"MediaAssetIds []string",
	} {
		if !strings.Contains(types, fragment) {
			t.Fatalf("profile types missing %q", fragment)
		}
	}

	for _, fragment := range []string{
		"@handler UpdateProfileFeaturedMedia",
		"post /profile/featured/media/update (UpdateProfileFeaturedMediaRequest) returns (MediaAssetPageResponse)",
	} {
		if !strings.Contains(api, fragment) {
			t.Fatalf("api missing %q", fragment)
		}
	}

	for _, fragment := range []string{
		`Path:    "/profile/featured/media/update"`,
		"profile.UpdateProfileFeaturedMediaHandler(serverCtx)",
	} {
		if !strings.Contains(routes, fragment) {
			t.Fatalf("routes.go missing %q", fragment)
		}
	}
}

func TestProfileFeaturedMediaUpdateUsesOwnPublishedImages(t *testing.T) {
	logic := readProjectFile(t, "internal", "logic", "profile", "updateprofilefeaturedmedialogic.go")
	listLogic := readProjectFile(t, "internal", "logic", "profile", "getprofilefeaturedmedialistlogic.go")

	for _, fragment := range []string{
		"FindOwnerPublicApprovedByIDs",
		"loginUser.Id",
		"个人精选照片必须从自己已发布的图片中选择",
		"ReplaceActiveAssetIDsByOwner",
		"ownerTypeUserProfile",
		"linkRoleFeaturedMedia",
	} {
		if !strings.Contains(logic, fragment) {
			t.Fatalf("update profile featured logic missing %q", fragment)
		}
	}

	for _, fragment := range []string{
		"FindPublicApprovedByIDs",
		"buildMediaResponseMap",
	} {
		if !strings.Contains(listLogic, fragment) {
			t.Fatalf("profile featured list logic missing %q", fragment)
		}
	}
}
