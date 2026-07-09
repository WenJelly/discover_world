package notification

import (
	"os"
	"strings"
	"testing"
)

func TestNotificationEventWiringContract(t *testing.T) {
	for _, item := range []struct {
		path      string
		fragments []string
	}{
		{
			path: "../follow/createfollowlogic.go",
			fragments: []string{
				"NotificationModel.Insert",
				`"follow"`,
				"wasFollowing",
			},
		},
		{
			path: "../post/createpostcommentlogic.go",
			fragments: []string{
				"NotificationModel.Insert",
				`"post_comment"`,
				"post.UserId != loginUser.Id",
			},
		},
		{
			path: "../post/togglepostreactionlogic.go",
			fragments: []string{
				"NotificationModel.Insert",
				`"post_reaction"`,
				"nextActive",
				"post.UserId != loginUser.Id",
			},
		},
		{
			path: "../post/togglepostfavoritelogic.go",
			fragments: []string{
				"NotificationModel.Insert",
				`"post_favorite"`,
				"nextActive",
				"post.UserId != loginUser.Id",
			},
		},
		{
			path: "../media/togglemediareactionlogic.go",
			fragments: []string{
				"NotificationModel.Insert",
				`"media_reaction"`,
				"nextActive",
				"asset.OwnerUserId != loginUser.Id",
			},
		},
		{
			path: "../media/reviewmediaassetlogic.go",
			fragments: []string{
				"NotificationModel.Insert",
				`"media_review"`,
				"asset.OwnerUserId",
			},
		},
	} {
		source, err := os.ReadFile(item.path)
		if err != nil {
			t.Fatalf("read %s: %v", item.path, err)
		}
		text := string(source)
		for _, fragment := range item.fragments {
			if !strings.Contains(text, fragment) {
				t.Fatalf("%s missing %q", item.path, fragment)
			}
		}
	}
}
