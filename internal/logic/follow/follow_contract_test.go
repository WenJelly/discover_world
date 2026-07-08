package follow

import (
	"os"
	"strings"
	"testing"
)

func readSource(t *testing.T, path string) string {
	t.Helper()
	source, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return string(source)
}

func TestFollowBackendContract(t *testing.T) {
	api := readSource(t, "../../../api/discover_world.api")
	typesSource := readSource(t, "../../types/types.go")
	routes := readSource(t, "../../handler/routes.go")
	svc := readSource(t, "../../svc/servicecontext.go")
	common := readSource(t, "common.go")

	for _, fragment := range []string{
		"FollowTargetRequest",
		"FollowStatusResponse",
		"FollowListRequest",
		"FollowUserListResponse",
		"post /follow/create",
		"post /follow/cancel",
		"post /follow/status",
		"post /follow/follower/list",
		"post /follow/following/list",
	} {
		if !strings.Contains(api, fragment) {
			t.Fatalf("api missing %q", fragment)
		}
		if strings.HasPrefix(fragment, "Follow") && !strings.Contains(typesSource, fragment) {
			t.Fatalf("internal types missing %q", fragment)
		}
	}

	for _, fragment := range []string{
		"follow.CreateFollowHandler",
		"follow.CancelFollowHandler",
		"follow.GetFollowStatusHandler",
		"follow.GetFollowerListHandler",
		"follow.GetFollowingListHandler",
		"UserFollowModel",
	} {
		if !strings.Contains(routes+svc, fragment) {
			t.Fatalf("routes/service context missing %q", fragment)
		}
	}

	for _, fragment := range []string{
		"targetID == loginUser.Id",
		"不能关注自己",
		"FindOneActive",
		"CountFollowers",
		"CountFollowing",
		"IsFollowing",
		"buildPublicAccountSummaries",
	} {
		if !strings.Contains(common, fragment) {
			t.Fatalf("follow common logic missing %q", fragment)
		}
	}
}
