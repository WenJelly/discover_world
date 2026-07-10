package model

import (
	"os"
	"strings"
	"testing"
)

func TestPostRowsIncludesPinFields(t *testing.T) {
	for _, field := range []string{"`is_pinned`", "`pinned_at`"} {
		if !strings.Contains(postRows, field) {
			t.Fatalf("postRows does not include %s: %s", field, postRows)
		}
	}
}

func TestPostRowsIncludesPostType(t *testing.T) {
	if !strings.Contains(postRows, "`post_type`") {
		t.Fatalf("postRows does not include post_type: %s", postRows)
	}
}

func TestPostModelUnscoredQueriesSelectDefaultScore(t *testing.T) {
	if !strings.Contains(postRowsWithDefaultScore, "0 as score") {
		t.Fatalf("postRowsWithDefaultScore must select a default score: %s", postRowsWithDefaultScore)
	}
	if got := qualifiedPostRowsWithDefaultScore("p"); !strings.Contains(got, "p.`id`") || !strings.Contains(got, "0 as score") {
		t.Fatalf("qualifiedPostRowsWithDefaultScore should qualify rows and select a default score: %s", got)
	}

	source, err := os.ReadFile("postmodel.go")
	if err != nil {
		t.Fatalf("read postmodel.go: %v", err)
	}
	for _, fragment := range []string{
		"FindOneActive(ctx context.Context",
		"FindByIDs(ctx context.Context",
		"FindPublicByAuthorsBeforeCursor(ctx context.Context",
		"FindByUserBeforePinCursor(ctx context.Context",
	} {
		if !strings.Contains(string(source), fragment) {
			t.Fatalf("postmodel.go missing %q", fragment)
		}
	}

	if count := strings.Count(string(source), "postRowsWithDefaultScore"); count < 5 {
		t.Fatalf("postmodel.go should use postRowsWithDefaultScore for unscored Post scans, got %d uses", count)
	}

	searchSource, err := os.ReadFile("searchmodel.go")
	if err != nil {
		t.Fatalf("read searchmodel.go: %v", err)
	}
	if !strings.Contains(string(searchSource), "qualifiedPostRowsWithDefaultScore") {
		t.Fatal("searchmodel.go should use qualifiedPostRowsWithDefaultScore for unscored Post scans")
	}
}

func TestPostModelProfileQuerySupportsFollowersVisibility(t *testing.T) {
	source, err := os.ReadFile("postmodel.go")
	if err != nil {
		t.Fatalf("read postmodel.go: %v", err)
	}
	text := string(source)
	required := []string{
		"FindByUserBeforePinCursor(ctx context.Context, userID uint64, visibleValues []string",
		"`visibility` in (",
	}
	for _, item := range required {
		if !strings.Contains(text, item) {
			t.Fatalf("postmodel.go missing %q", item)
		}
	}
}
