package model

import (
	"os"
	"strings"
	"testing"
)

func TestUserFollowModelDefinesFollowOperations(t *testing.T) {
	source, err := os.ReadFile("userfollowmodel.go")
	if err != nil {
		t.Fatalf("read userfollowmodel.go: %v", err)
	}
	text := string(source)

	for _, fragment := range []string{
		"Follow(ctx context.Context, followerID uint64, followingID uint64) error",
		"Unfollow(ctx context.Context, followerID uint64, followingID uint64) error",
		"IsFollowing(ctx context.Context, followerID uint64, followingID uint64) (bool, error)",
		"CountFollowers(ctx context.Context, userID uint64) (int64, error)",
		"CountFollowing(ctx context.Context, userID uint64) (int64, error)",
		"ListFollowerIDs(ctx context.Context, userID uint64, cursor uint64, limit int64) ([]uint64, bool, error)",
		"ListFollowingIDs(ctx context.Context, userID uint64, cursor uint64, limit int64) ([]uint64, bool, error)",
		"on duplicate key update `status` = 1",
		"where `follower_id` = ? and `following_id` = ?",
		"where `following_id` = ? and `status` = 1",
		"where `follower_id` = ? and `status` = 1",
	} {
		if !strings.Contains(text, fragment) {
			t.Fatalf("userfollowmodel.go missing %q", fragment)
		}
	}
}
