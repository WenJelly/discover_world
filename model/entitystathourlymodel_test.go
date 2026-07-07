package model

import (
	"strings"
	"testing"
)

func TestEntityStatHourlyIncrementSQLUpsertsCurrentHourBucket(t *testing.T) {
	query, err := entityStatHourlyIncrementSQL("reaction_count")
	if err != nil {
		t.Fatalf("entityStatHourlyIncrementSQL returned error: %v", err)
	}

	for _, fragment := range []string{
		"`entity_stat_hourly`",
		"`target_type`",
		"`target_id`",
		"`bucket_hour`",
		"date_format(now(), '%Y-%m-%d %H:00:00')",
		"`reaction_count`",
		"on duplicate key update",
		"`reaction_count` = `reaction_count` + values(`reaction_count`)",
	} {
		if !strings.Contains(query, fragment) {
			t.Fatalf("entityStatHourlyIncrementSQL missing %q in %s", fragment, query)
		}
	}
}

func TestNormalizeEntityStatHourlyDeltaIgnoresNegativeActivity(t *testing.T) {
	if got := normalizeEntityStatHourlyDelta(-1); got != 0 {
		t.Fatalf("normalizeEntityStatHourlyDelta(-1) = %d, want 0", got)
	}
	if got := normalizeEntityStatHourlyDelta(2); got != 2 {
		t.Fatalf("normalizeEntityStatHourlyDelta(2) = %d, want 2", got)
	}
}
