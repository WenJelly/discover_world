package post

import (
	"database/sql"
	"testing"
	"time"

	"discover_world/internal/svc"
	"discover_world/internal/types"
	"discover_world/model"
)

func TestNormalizePostContentTrimsAndLimitsLength(t *testing.T) {
	got, err := normalizePostContent("  hello world  ")
	if err != nil {
		t.Fatalf("normalizePostContent returned error: %v", err)
	}
	if got != "hello world" {
		t.Fatalf("normalizePostContent = %q, want %q", got, "hello world")
	}

	long := make([]rune, maxPostContentLength+1)
	for i := range long {
		long[i] = 'a'
	}
	if _, err := normalizePostContent(string(long)); err == nil {
		t.Fatal("normalizePostContent accepted content beyond the length limit")
	}
}

func TestNormalizePostVisibilityAllowsOnlyPublicAndPrivate(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want string
	}{
		{name: "empty defaults public", raw: "", want: postVisibilityPublic},
		{name: "public lowercased", raw: " PUBLIC ", want: postVisibilityPublic},
		{name: "private lowercased", raw: "Private", want: postVisibilityPrivate},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := normalizePostVisibility(tt.raw)
			if err != nil {
				t.Fatalf("normalizePostVisibility returned error: %v", err)
			}
			if got != tt.want {
				t.Fatalf("normalizePostVisibility = %q, want %q", got, tt.want)
			}
		})
	}

	if _, err := normalizePostVisibility("followers"); err == nil {
		t.Fatal("normalizePostVisibility accepted unsupported followers visibility")
	}
}

func TestParsePostImageIDsDropsDuplicatesAndRejectsBadIDs(t *testing.T) {
	got, err := parsePostImageIDs([]string{" 7 ", "2", "7", "", "9"})
	if err != nil {
		t.Fatalf("parsePostImageIDs returned error: %v", err)
	}
	want := []uint64{7, 2, 9}
	if len(got) != len(want) {
		t.Fatalf("parsePostImageIDs length = %d, want %d: %#v", len(got), len(want), got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("parsePostImageIDs = %#v, want %#v", got, want)
		}
	}

	if _, err := parsePostImageIDs([]string{"0"}); err == nil {
		t.Fatal("parsePostImageIDs accepted zero")
	}
	if _, err := parsePostImageIDs([]string{"abc"}); err == nil {
		t.Fatal("parsePostImageIDs accepted non-numeric id")
	}
}

func TestValidatePostBodyRequiresTextOrImages(t *testing.T) {
	if err := validatePostBody("", nil); err == nil {
		t.Fatal("validatePostBody accepted empty text and no images")
	}
	if err := validatePostBody("hello", nil); err != nil {
		t.Fatalf("validatePostBody rejected text-only post: %v", err)
	}
	if err := validatePostBody("", []uint64{1}); err != nil {
		t.Fatalf("validatePostBody rejected image-only post: %v", err)
	}

	ids := make([]uint64, maxPostImageCount+1)
	for i := range ids {
		ids[i] = uint64(i + 1)
	}
	if err := validatePostBody("hello", ids); err == nil {
		t.Fatal("validatePostBody accepted too many images")
	}
}

func TestNormalizeReactionTypeUsesWhitelist(t *testing.T) {
	got, err := normalizeReactionType("")
	if err != nil {
		t.Fatalf("normalizeReactionType returned error: %v", err)
	}
	if got != defaultReaction {
		t.Fatalf("normalizeReactionType empty = %q, want %q", got, defaultReaction)
	}

	for _, reactionType := range []string{"like", "love", "clap", "wow"} {
		got, err := normalizeReactionType(" " + reactionType + " ")
		if err != nil {
			t.Fatalf("normalizeReactionType(%q) returned error: %v", reactionType, err)
		}
		if got != reactionType {
			t.Fatalf("normalizeReactionType(%q) = %q", reactionType, got)
		}
	}

	if _, err := normalizeReactionType("anything"); err == nil {
		t.Fatal("normalizeReactionType accepted an unsupported reaction type")
	}
}

func TestBuildPostPinStateUsesPinnedFields(t *testing.T) {
	pinnedAt := time.Date(2026, 7, 4, 12, 30, 0, 0, time.UTC)

	isPinned, formatted := buildPostPinState(&model.Post{
		IsPinned: 1,
		PinnedAt: sql.NullTime{
			Time:  pinnedAt,
			Valid: true,
		},
	})

	if !isPinned {
		t.Fatal("buildPostPinState returned isPinned=false, want true")
	}
	if formatted != "2026-07-04 12:30:00" {
		t.Fatalf("buildPostPinState pinnedAt = %q", formatted)
	}
}

func TestApplyPostViewerStateMarksLikedAndFavoritedPosts(t *testing.T) {
	state := postViewerState{
		liked:     map[uint64]bool{10: true},
		favorited: map[uint64]bool{20: true},
	}

	liked := types.ProfilePostResponse{}
	applyPostViewerState(&liked, 10, state)
	if !liked.IsLiked {
		t.Fatal("applyPostViewerState did not mark liked post")
	}
	if liked.IsFavorited {
		t.Fatal("applyPostViewerState marked unrelated liked post as favorited")
	}

	favorited := types.ProfilePostResponse{}
	applyPostViewerState(&favorited, 20, state)
	if favorited.IsLiked {
		t.Fatal("applyPostViewerState marked unrelated favorited post as liked")
	}
	if !favorited.IsFavorited {
		t.Fatal("applyPostViewerState did not mark favorited post")
	}
}

func TestBuildAccountSummaryKeepsEmailPrivate(t *testing.T) {
	summary := buildAccountSummary(&svc.ServiceContext{}, &model.UserAccount{
		Id:       7,
		Username: "alice",
		Email: sql.NullString{
			String: "alice@example.com",
			Valid:  true,
		},
		Status: "active",
	}, &model.UserProfile{
		Nickname: sql.NullString{
			String: "Alice Chen",
			Valid:  true,
		},
	})

	if summary.Username != "alice" {
		t.Fatalf("summary.Username = %q, want alice", summary.Username)
	}
	if summary.Nickname != "Alice Chen" {
		t.Fatalf("summary.Nickname = %q, want Alice Chen", summary.Nickname)
	}
	if summary.Email != "" {
		t.Fatalf("summary.Email = %q, want empty private email", summary.Email)
	}
}
