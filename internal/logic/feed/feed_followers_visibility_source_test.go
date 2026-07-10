package feed

import (
	"os"
	"strings"
	"testing"
)

func TestFollowingFeedsPassViewerToResponseBuilders(t *testing.T) {
	postSource, err := os.ReadFile("getfollowingpostcursorlistlogic.go")
	if err != nil {
		t.Fatalf("read post feed: %v", err)
	}
	mediaSource, err := os.ReadFile("getfollowingmediacursorlistlogic.go")
	if err != nil {
		t.Fatalf("read media feed: %v", err)
	}
	if !strings.Contains(string(postSource), "BuildPublicPostResponses(l.ctx, l.svcCtx, posts, loginUser)") {
		t.Fatal("following post feed must pass loginUser to response builder")
	}
	if !strings.Contains(string(mediaSource), "BuildMediaAssetListResponse(l.ctx, l.svcCtx, assets, loginUser") {
		t.Fatal("following media feed must pass loginUser to response builder")
	}
}
