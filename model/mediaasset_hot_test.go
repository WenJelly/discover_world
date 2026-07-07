package model

import (
	"strings"
	"testing"
	"time"
)

func TestMediaHotScoreSQLUsesWeightedEngagementAndAgeDecay(t *testing.T) {
	expr := mediaHotScoreSQL()

	for _, fragment := range []string{
		"ln(1 + coalesce",
		"`view_count`",
		"`reaction_count`",
		"* 4",
		"`favorite_count`",
		"* 8",
		"`comment_count`",
		"* 3",
		"`share_count`",
		"* 6",
		"`download_count`",
		"+ 2",
		"pow(greatest(1, timestampdiff(hour, `created_at`, now())) + 24, 0.85)",
	} {
		if !strings.Contains(expr, fragment) {
			t.Fatalf("mediaHotScoreSQL missing %q in %s", fragment, expr)
		}
	}
}

func TestMediaCreatedCursorWhereUsesCreatedAtAndIdTieBreaker(t *testing.T) {
	createdAt := time.Date(2026, 7, 7, 10, 20, 30, 0, time.UTC)
	where, args := appendCreatedCursorWhere("`status` = 'active'", createdAt, 99, nil)

	for _, fragment := range []string{
		"`status` = 'active'",
		"`created_at` < ?",
		"`created_at` = ?",
		"`id` < ?",
	} {
		if !strings.Contains(where, fragment) {
			t.Fatalf("appendCreatedCursorWhere missing %q in %s", fragment, where)
		}
	}
	if len(args) != 3 {
		t.Fatalf("appendCreatedCursorWhere args length = %d, want 3: %#v", len(args), args)
	}
	if args[0] != createdAt || args[1] != createdAt || args[2] != uint64(99) {
		t.Fatalf("appendCreatedCursorWhere args = %#v, want createdAt, createdAt, id", args)
	}
}

func TestMediaHotCursorWhereUsesScoreAndIdTieBreaker(t *testing.T) {
	where, args := appendHotCursorWhere("`status` = 'active'", 12.5, 99, nil)

	for _, fragment := range []string{
		"`status` = 'active'",
		"abs(",
		"`id` < ?",
	} {
		if !strings.Contains(where, fragment) {
			t.Fatalf("appendHotCursorWhere missing %q in %s", fragment, where)
		}
	}
	if len(args) != 3 {
		t.Fatalf("appendHotCursorWhere args length = %d, want 3: %#v", len(args), args)
	}
	if args[0] != 12.5 || args[1] != 12.5 || args[2] != uint64(99) {
		t.Fatalf("appendHotCursorWhere args = %#v, want score, score, id", args)
	}
}
